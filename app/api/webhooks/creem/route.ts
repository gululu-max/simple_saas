import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { CreemWebhookEvent } from "@/types/creem";
import { sendPurchaseEvent } from "@/lib/meta-capi";
import { sendGooglePurchaseEvent } from "@/lib/google-ads-conversion";
import {
  createOrUpdateCustomer,
  createOrUpdateSubscription,
  addCreditsToCustomer,
} from "@/utils/supabase/subscriptions";
import crypto from "crypto";

// ═══════════════════════════════════════════════════════════════
// [RESTORED 2026-05-29 — login revert]
// 恢复登录门控的订阅/积分 webhook。一次性买卖 (scan.paid) 版整段
// 移到文件末尾注释里。
// ═══════════════════════════════════════════════════════════════

const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET!;

// ─── 从环境变量读取 Product IDs，构建积分映射表 ─────────────
const CREDITS_MAP: Record<string, { type: "subscription" | "package"; amount: number }> = {};

function registerProduct(envKey: string, type: "subscription" | "package", amount: number) {
  const productId = process.env[envKey];
  if (productId) {
    CREDITS_MAP[productId] = { type, amount };
  } else {
    console.warn(`⚠️ 环境变量 ${envKey} 未配置，对应积分映射跳过`);
  }
}

// 订阅套餐
registerProduct("NEXT_PUBLIC_PRODUCT_ID_STARTER", "subscription", 40);
registerProduct("NEXT_PUBLIC_PRODUCT_ID_PRO", "subscription", 200);
registerProduct("NEXT_PUBLIC_PRODUCT_ID_ULTRA", "subscription", 500);
// 单次积分包
registerProduct("NEXT_PUBLIC_PRODUCT_ID_PACK_MICRO", "package", 5);
registerProduct("NEXT_PUBLIC_PRODUCT_ID_PACK_STARTER", "package", 75);
registerProduct("NEXT_PUBLIC_PRODUCT_ID_PACK_VALUE", "package", 200);
registerProduct("NEXT_PUBLIC_PRODUCT_ID_PACK_PRO", "package", 500);

// ─── 安全提取 customer 对象 ─────────────
function resolveCustomer(raw: any): any {
  if (!raw) return raw;
  if (typeof raw === "string") return { id: raw };
  return raw;
}

export async function POST(request: Request) {
  try {
    const body = await request.text();

    const headersList = await headers();
    const signature = headersList.get("creem-signature") || "";
    const expectedSignature = crypto
      .createHmac("sha256", CREEM_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("❌ Invalid webhook signature");
      return new NextResponse("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body) as CreemWebhookEvent;
    console.log(`👉 收到 Creem 事件: ${event.eventType}`, event.object?.id);

    switch (event.eventType) {
      case "checkout.completed":
        await handleCheckoutCompleted(event);
        break;
      case "subscription.active":
        await handleSubscriptionActive(event);
        break;
      case "subscription.paid":
        await handleSubscriptionPaid(event);
        break;
      case "subscription.canceled":
        await handleSubscriptionCanceled(event);
        break;
      case "subscription.expired":
        await handleSubscriptionExpired(event);
        break;
      case "subscription.trialing":
        await handleSubscriptionTrialing(event);
        break;
      default:
        console.log(`⚠️ 未处理的事件类型: ${event.eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Webhook 处理失败:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Webhook processing failed", details: errorMessage },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// checkout.completed：一次性付款（积分包 or 订阅首次）
// ─────────────────────────────────────────────
async function handleCheckoutCompleted(event: CreemWebhookEvent) {
  const checkout = event.object;

  if (!checkout.metadata?.user_id) {
    throw new Error("user_id is required in checkout metadata");
  }

  const customerId = await createOrUpdateCustomer(
    resolveCustomer(checkout.customer),
    checkout.metadata.user_id,
  );

  const productId =
    checkout.product?.id || checkout.product_id || checkout.items?.[0]?.product_id;

  const productConfig = productId ? CREDITS_MAP[productId] : null;

  if (productConfig?.type === "package") {
    const orderId = checkout.order?.id;
    if (!orderId) {
      throw new Error("checkout.completed: 积分包缺少 order.id，无法保证幂等");
    }
    await addCreditsToCustomer(
      customerId,
      productConfig.amount,
      orderId,
      `Purchased ${productConfig.amount} credits package`,
    );
    console.log(`✅ 用户 ${checkout.metadata.user_id} 充值积分包 ${productConfig.amount}`);

    await sendPurchaseEvent(checkout.customer?.email ?? "", {
      value: checkout.order?.amount ? checkout.order.amount / 100 : 0,
      currency: checkout.currency ?? "USD",
      contentIds: [productId!],
      eventId: `purchase_${orderId}`,
    });
    await sendGooglePurchaseEvent({
      clientId: checkout.metadata?.ga_client_id || checkout.metadata.user_id,
      transactionId: orderId,
      value: checkout.order?.amount ? checkout.order.amount / 100 : 0,
      currency: checkout.currency ?? "USD",
      items: [{ item_id: productId!, item_name: "credits_pack", price: checkout.order?.amount ? checkout.order.amount / 100 : 0 }],
    });
  } else if (checkout.subscription) {
    await createOrUpdateSubscription(checkout.subscription, customerId);
    console.log(`✅ 订阅创建完成，积分将由 subscription.paid 事件发放`);
  } else {
    console.warn(`⚠️ checkout.completed: 无匹配处理逻辑 (productId: ${productId})`);
  }
}

// ─────────────────────────────────────────────
// subscription.active：订阅激活（仅更新状态）
// ─────────────────────────────────────────────
async function handleSubscriptionActive(event: CreemWebhookEvent) {
  const subscription = event.object;
  const customerId = await createOrUpdateCustomer(
    resolveCustomer(subscription.customer),
    subscription.metadata?.user_id,
  );
  await createOrUpdateSubscription(subscription, customerId);
  console.log(`✅ 订阅激活: ${subscription.id}`);
}

// ─────────────────────────────────────────────
// subscription.paid：每次扣款成功（含首次 & 续费）→ 发积分
// ─────────────────────────────────────────────
async function handleSubscriptionPaid(event: CreemWebhookEvent) {
  const subscription = event.object as any;

  const customerId = await createOrUpdateCustomer(
    resolveCustomer(subscription.customer),
    subscription.metadata?.user_id,
  );
  await createOrUpdateSubscription(subscription, customerId);

  const productId =
    typeof subscription.product === "string"
      ? subscription.product
      : subscription.product?.id;

  const productConfig = productId ? CREDITS_MAP[productId] : null;

  if (productConfig?.type === "subscription") {
    const transactionId = subscription.last_transaction?.id;
    if (!transactionId) {
      throw new Error("subscription.paid: 缺少 last_transaction.id,无法保证幂等");
    }

    await addCreditsToCustomer(
      customerId,
      productConfig.amount,
      transactionId,
      `Monthly Subscription Renewal: ${productConfig.amount} credits`,
    );
    console.log(`✅ 订阅扣款成功，发放月度积分 ${productConfig.amount}`);

    await sendPurchaseEvent(subscription.customer?.email ?? "", {
      value: subscription.last_transaction?.amount
        ? subscription.last_transaction.amount / 100
        : 0,
      currency: subscription.currency ?? "USD",
      contentIds: [productId!],
      eventId: `purchase_${transactionId}`,
    });
    await sendGooglePurchaseEvent({
      clientId: subscription.metadata?.ga_client_id || subscription.metadata?.user_id || "unknown",
      transactionId,
      value: subscription.last_transaction?.amount ? subscription.last_transaction.amount / 100 : 0,
      currency: subscription.currency ?? "USD",
      items: [{ item_id: productId!, item_name: "subscription_renewal", price: subscription.last_transaction?.amount ? subscription.last_transaction.amount / 100 : 0 }],
    });
  } else {
    console.warn(`⚠️ subscription.paid: 未识别商品 ID: ${productId}`);
  }
}

async function handleSubscriptionCanceled(event: CreemWebhookEvent) {
  const subscription = event.object;
  const customerId = await createOrUpdateCustomer(
    resolveCustomer(subscription.customer),
    subscription.metadata?.user_id,
  );
  await createOrUpdateSubscription(subscription, customerId);
  console.log(`✅ 订阅已取消: ${subscription.id}`);
}

async function handleSubscriptionExpired(event: CreemWebhookEvent) {
  const subscription = event.object;
  const customerId = await createOrUpdateCustomer(
    resolveCustomer(subscription.customer),
    subscription.metadata?.user_id,
  );
  await createOrUpdateSubscription(subscription, customerId);
  console.log(`✅ 订阅已过期: ${subscription.id}`);
}

async function handleSubscriptionTrialing(event: CreemWebhookEvent) {
  const subscription = event.object;
  const customerId = await createOrUpdateCustomer(
    resolveCustomer(subscription.customer),
    subscription.metadata?.user_id,
  );
  await createOrUpdateSubscription(subscription, customerId);
  console.log(`✅ 订阅试用期: ${subscription.id}`);
}

// ═══════════════════════════════════════════════════════════════
// [DISABLED 2026-05-29 — login revert] 一次性买卖 webhook（scan.paid 版）
// 只处理 checkout.completed：拿 metadata.scan_id 去 UPDATE photo_scans
// SET paid=true。幂等靠 creem_order_id。恢复一次性 flow 时解开此段 +
// 把 switch 改成只调它（或按 metadata.scan_id 有无分流）。
// ═══════════════════════════════════════════════════════════════
//
// async function handleCheckoutCompleted_oneshot(event: CreemWebhookEvent) {
//   const checkout = event.object;
//   const scanId: string | undefined = checkout.metadata?.scan_id;
//   const orderId: string | undefined = checkout.order?.id;
//   if (!scanId) throw new Error("checkout.completed: metadata.scan_id 缺失");
//   if (!orderId) throw new Error("checkout.completed: order.id 缺失，无法保证幂等");
//
//   const customerEmail: string | null =
//     (typeof checkout.customer === "object" && checkout.customer?.email) || null;
//   const gaClientId: string | null = checkout.metadata?.ga_client_id || null;
//
//   const { data: updated, error: updateErr } = await supabaseAdmin
//     .from("photo_scans")
//     .update({
//       paid: true,
//       paid_at: new Date().toISOString(),
//       creem_order_id: orderId,
//       customer_email: customerEmail,
//       ga_client_id: gaClientId,
//     })
//     .eq("id", scanId)
//     .eq("paid", false)
//     .select("id, creem_order_id")
//     .maybeSingle();
//
//   if (updateErr) {
//     if ((updateErr as any).code === "23505") {
//       console.log(`✅ checkout.completed 幂等吃掉: order ${orderId}`);
//       return;
//     }
//     throw new Error(`photo_scans update failed: ${updateErr.message}`);
//   }
//   if (!updated) {
//     console.log(`✅ scan ${scanId} 已是 paid 状态，跳过`);
//     return;
//   }
//   console.log(`✅ scan ${scanId} 标记 paid 成功 (order ${orderId})`);
//
//   const valueInDollars = checkout.order?.amount ? checkout.order.amount / 100 : 0;
//   const currency = checkout.currency ?? "USD";
//   const productId: string =
//     checkout.product?.id || checkout.product_id || checkout.items?.[0]?.product_id || "unknown";
//   try {
//     await sendPurchaseEvent(customerEmail ?? "", {
//       value: valueInDollars, currency, contentIds: [productId], eventId: `purchase_${orderId}`,
//     });
//   } catch (err) { console.error("[meta-capi] purchase event failed:", err); }
//   try {
//     await sendGooglePurchaseEvent({
//       clientId: gaClientId || scanId, transactionId: orderId, value: valueInDollars, currency,
//       items: [{ item_id: productId, item_name: "matchfix_3_photo_bundle", price: valueInDollars }],
//     });
//   } catch (err) { console.error("[google-ads] purchase event failed:", err); }
// }
//
// 注：一次性版还需要在文件顶部恢复：
//   import { createClient as createAdminClient } from "@supabase/supabase-js";
//   const supabaseAdmin = createAdminClient(URL, SERVICE_ROLE_KEY);
