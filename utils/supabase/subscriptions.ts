import { createServiceRoleClient } from "./service-role";
import { CreemCustomer, CreemSubscription } from "@/types/creem";

export async function createOrUpdateCustomer(
  creemCustomer: CreemCustomer,
  userId?: string
) {
  const supabase = createServiceRoleClient();

  let existingCustomer = null;

  if (userId) {
    const { data, error } = await supabase
      .from("customers")
      .select()
      .eq("user_id", userId)
      .single();

    if (!error) {
      existingCustomer = data;
    } else if (error.code !== "PGRST116") {
      throw error;
    }
  }

  if (!existingCustomer) {
    const { data, error } = await supabase
      .from("customers")
      .select()
      .eq("creem_customer_id", creemCustomer.id)
      .single();

    if (!error) {
      existingCustomer = data;
    } else if (error.code !== "PGRST116") {
      throw error;
    }
  }

  if (existingCustomer) {
    const { error } = await supabase
      .from("customers")
      .update({
        creem_customer_id: creemCustomer.id,
        email: creemCustomer.email,
        name: creemCustomer.name,
        country: creemCustomer.country,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingCustomer.id);

    if (error) throw error;
    return existingCustomer.id;
  }

  if (!userId) {
    throw new Error(
      "Cannot create customer: user_id is missing from webhook metadata"
    );
  }

  const { data: newCustomer, error } = await supabase
    .from("customers")
    .insert({
      user_id: userId,
      creem_customer_id: creemCustomer.id,
      email: creemCustomer.email,
      name: creemCustomer.name,
      country: creemCustomer.country,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return newCustomer.id;
}

export async function createOrUpdateSubscription(
  creemSubscription: CreemSubscription,
  customerId: string
) {
  const supabase = createServiceRoleClient();

  const { data: existingSubscription, error: fetchError } = await supabase
    .from("subscriptions")
    .select()
    .eq("creem_subscription_id", creemSubscription.id)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw fetchError;
  }

  const subscriptionData = {
    customer_id: customerId,
    creem_product_id:
      typeof creemSubscription?.product === "string"
        ? creemSubscription?.product
        : creemSubscription?.product?.id,
    status: creemSubscription?.status,
    current_period_start: creemSubscription?.current_period_start_date,
    current_period_end: creemSubscription?.current_period_end_date,
    canceled_at: creemSubscription?.canceled_at,
    metadata: creemSubscription?.metadata,
    updated_at: new Date().toISOString(),
  };

  if (existingSubscription) {
    const { error } = await supabase
      .from("subscriptions")
      .update(subscriptionData)
      .eq("id", existingSubscription.id);

    if (error) throw error;
    return existingSubscription.id;
  }

  const { data: newSubscription, error } = await supabase
    .from("subscriptions")
    .insert({
      ...subscriptionData,
      creem_subscription_id: creemSubscription.id,
    })
    .select()
    .single();

  if (error) throw error;
  return newSubscription.id;
}

// ─────────────────────────────────────────────
// ✅ 修改：查询用户有效订阅（active 或 canceled 但还没到期的）
// ─────────────────────────────────────────────
export async function getUserSubscription(userId: string) {
  const supabase = createServiceRoleClient();

  // 先查 active 的订阅
  const { data: activeSub, error: activeError } = await supabase
    .from("subscriptions")
    .select(
      `
      *,
      customers!inner(user_id)
    `
    )
    .eq("customers.user_id", userId)
    .eq("status", "active")
    .single();

  if (activeSub) return activeSub;
  if (activeError && activeError.code !== "PGRST116") throw activeError;

  // 没有 active 的，再查 canceled 但还没到期的
  const { data: canceledSub, error: canceledError } = await supabase
    .from("subscriptions")
    .select(
      `
      *,
      customers!inner(user_id)
    `
    )
    .eq("customers.user_id", userId)
    .eq("status", "canceled")
    .gte("current_period_end", new Date().toISOString())
    .single();

  if (canceledError && canceledError.code !== "PGRST116") throw canceledError;

  return canceledSub || null;
}

// ─────────────────────────────────────────────
// ✅ 新增：判断订阅是否仍然有效（可在前端/后端任意地方调用）
// ─────────────────────────────────────────────
export function isSubscriptionActive(subscription: any): boolean {
  if (!subscription) return false;

  // active 状态 → 直接有效
  if (subscription.status === "active") return true;

  // canceled 状态 → 看 current_period_end 是否还没到
  if (subscription.status === "canceled" && subscription.current_period_end) {
    return new Date(subscription.current_period_end) > new Date();
  }

  return false;
}

export async function addCreditsToCustomer(
  customerId: string,
  credits: number,
  creemOrderId?: string,
  description?: string
) {
  const supabase = createServiceRoleClient();

  // ✅ 幂等检查：同一个 creemOrderId 只发一次
  if (creemOrderId) {
    const { data: existing } = await supabase
      .from("credits_history")
      .select("id")
      .eq("creem_order_id", creemOrderId)
      .maybeSingle();

    if (existing) {
      console.log(`⚠️ 重复事件，跳过积分发放: ${creemOrderId}`);
      const { data: customer } = await supabase
        .from("customers")
        .select("credits")
        .eq("id", customerId)
        .single();
      return customer?.credits || 0;
    }
  }

  // ✅ 先写历史记录，再更新余额
  const { error: historyError } = await supabase
    .from("credits_history")
    .insert({
      customer_id: customerId,
      amount: credits,
      type: "add",
      description: description || "Credits purchase",
      creem_order_id: creemOrderId,
    });

  if (historyError) {
    // 若是唯一约束冲突（并发重复请求），视为幂等成功
    if (historyError.code === "23505") {
      console.log(`⚠️ 并发重复事件，跳过积分发放: ${creemOrderId}`);
      const { data: customer } = await supabase
        .from("customers")
        .select("credits")
        .eq("id", customerId)
        .single();
      return customer?.credits || 0;
    }
    throw historyError;
  }

  // 再更新余额
  const { data: customer, error: fetchError } = await supabase
    .from("customers")
    .select("credits")
    .eq("id", customerId)
    .single();

  if (fetchError) throw fetchError;
  if (!customer) throw new Error("Customer not found");

  const newCredits = (customer.credits || 0) + credits;

  const { error: updateError } = await supabase
    .from("customers")
    .update({ credits: newCredits, updated_at: new Date().toISOString() })
    .eq("id", customerId);

  if (updateError) throw updateError;

  return newCredits;
}

export async function useCredits(
  customerId: string,
  credits: number,
  description: string
) {
  const supabase = createServiceRoleClient();

  const { data: client } = await supabase
    .from("customers")
    .select("credits")
    .eq("id", customerId)
    .single();

  if (!client) throw new Error("Customer not found");
  if ((client.credits || 0) < credits) throw new Error("Insufficient credits");

  const newCredits = client.credits - credits;

  const { error: updateError } = await supabase
    .from("customers")
    .update({ credits: newCredits, updated_at: new Date().toISOString() })
    .eq("id", customerId);

  if (updateError) throw updateError;

  const { error: historyError } = await supabase
    .from("credits_history")
    .insert({
      customer_id: customerId,
      amount: credits,
      type: "subtract",
      description,
    });

  if (historyError) throw historyError;

  return newCredits;
}

export async function getCustomerCredits(customerId: string) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("customers")
    .select("credits")
    .eq("id", customerId)
    .single();

  if (error) throw error;
  return data?.credits || 0;
}

export async function getCreditsHistory(customerId: string) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("credits_history")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}