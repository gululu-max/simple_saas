import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { CreemWebhookEvent } from "@/types/creem";
import {
  createOrUpdateCustomer,
  createOrUpdateSubscription,
  addCreditsToCustomer,
} from "@/utils/supabase/subscriptions";
import crypto from "crypto";

const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET!;

const CREDITS_MAP: Record<string, { type: "subscription" | "package"; amount: number }> = {
  // 订阅套餐
  "prod_5rb8HwRBFYrkLIk4Jo0zk4": { type: "subscription", amount: 40 },
  "prod_1OW6mmHO9dwQv7tcLvoWqE": { type: "subscription", amount: 200 },
  "prod_5lQJo4e8joxLuDMZXzaNAX": { type: "subscription", amount: 500 },
  // 单次积分包
  "prod_45VZKvDlwmOeCaZmtpVVht": { type: "package", amount: 25 },
  "prod_7BZsaTaYuNSxV3J351zJEU": { type: "package", amount: 100 },
  "prod_40nACa3LIp8EPw46bHJyyE": { type: "package", amount: 300 },
};

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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Webhook processing failed", details: errorMessage },
      { status: 500 }
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
    checkout.customer,
    checkout.metadata.user_id
  );

  const productId =
    checkout.product?.id ||
    checkout.product_id ||
    checkout.items?.[0]?.product_id;

  const productConfig = productId ? CREDITS_MAP[productId] : null;

  if (productConfig?.type === "package") {
    // ✅ 积分包：用 order.id 做幂等凭证
    const orderId = checkout.order?.id;
    if (!orderId) {
      throw new Error("checkout.completed: 积分包缺少 order.id，无法保证幂等");
    }
    await addCreditsToCustomer(
      customerId,
      productConfig.amount,
      orderId,
      `Purchased ${productConfig.amount} credits package`
    );
    console.log(
      `✅ 用户 ${checkout.metadata.user_id} 充值积分包 ${productConfig.amount}`
    );
  } else if (checkout.subscription) {
    // ✅ 订阅首次：只建记录，积分由 subscription.paid 统一发放
    await createOrUpdateSubscription(checkout.subscription, customerId);
    console.log(`✅ 订阅创建完成，积分将由 subscription.paid 事件发放`);
  } else {
    console.warn(
      `⚠️ checkout.completed: 无匹配处理逻辑 (productId: ${productId})`
    );
  }
}

// ─────────────────────────────────────────────
// subscription.active：订阅激活（仅更新状态）
// ─────────────────────────────────────────────
async function handleSubscriptionActive(event: CreemWebhookEvent) {
  const subscription = event.object;
  const customerId = await createOrUpdateCustomer(
    subscription.customer as any,
    subscription.metadata?.user_id
  );
  await createOrUpdateSubscription(subscription, customerId);
  console.log(`✅ 订阅激活: ${subscription.id}`);
}

// ─────────────────────────────────────────────
// subscription.paid：每次扣款成功（含首次 & 续费）→ 发积分
// ─────────────────────────────────────────────
async function handleSubscriptionPaid(event: CreemWebhookEvent) {
  const subscription = event.object;

  const customerId = await createOrUpdateCustomer(
    subscription.customer as any,
    subscription.metadata?.user_id
  );
  await createOrUpdateSubscription(subscription, customerId);

  const productId =
    typeof subscription.product === "string"
      ? subscription.product
      : subscription.product?.id;

  const productConfig = productId ? CREDITS_MAP[productId] : null;

  if (productConfig?.type === "subscription") {
    // ✅ 用 event.id 做幂等凭证，防止 webhook 重试重复发积分
    await addCreditsToCustomer(
      customerId,
      productConfig.amount,
      event.id,
      `Monthly Subscription Renewal: ${productConfig.amount} credits`
    );
    console.log(`✅ 订阅扣款成功，发放月度积分 ${productConfig.amount}`);
  } else {
    console.warn(`⚠️ subscription.paid: 未识别商品 ID: ${productId}`);
  }
}

// ─────────────────────────────────────────────
// 以下三个事件：仅更新订阅状态
// ─────────────────────────────────────────────
async function handleSubscriptionCanceled(event: CreemWebhookEvent) {
  const subscription = event.object;
  const customerId = await createOrUpdateCustomer(
    subscription.customer as any,
    subscription.metadata?.user_id
  );
  await createOrUpdateSubscription(subscription, customerId);
  console.log(`✅ 订阅已取消: ${subscription.id}`);
}

async function handleSubscriptionExpired(event: CreemWebhookEvent) {
  const subscription = event.object;
  const customerId = await createOrUpdateCustomer(
    subscription.customer as any,
    subscription.metadata?.user_id
  );
  await createOrUpdateSubscription(subscription, customerId);
  console.log(`✅ 订阅已过期: ${subscription.id}`);
}

async function handleSubscriptionTrialing(event: CreemWebhookEvent) {
  const subscription = event.object;
  const customerId = await createOrUpdateCustomer(
    subscription.customer as any,
    subscription.metadata?.user_id
  );
  await createOrUpdateSubscription(subscription, customerId);
  console.log(`✅ 订阅试用期: ${subscription.id}`);
}