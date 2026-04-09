import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { CreemWebhookEvent } from "@/types/creem";
import { sendPurchaseEvent } from "@/lib/meta-capi";
import {
  createOrUpdateCustomer,
  createOrUpdateSubscription,
  addCreditsToCustomer,
} from "@/utils/supabase/subscriptions";
import crypto from "crypto";

const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET!;

// ─── 从环境变量读取 Product IDs，构建积分映射表 ─────────────
const CREDITS_MAP: Record<string, { type: "subscription" | "package"; amount: number }> = {};

// 安全地注册映射：跳过未配置的环境变量，避免 undefined key
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
// Creem 有时返回完整 customer 对象，有时只返回 string ID
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
    resolveCustomer(checkout.customer),
    checkout.metadata.user_id
  );

  const productId =
    checkout.product?.id ||
    checkout.product_id ||
    checkout.items?.[0]?.product_id;

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
      `Purchased ${productConfig.amount} credits package`
    );
    console.log(
      `✅ 用户 ${checkout.metadata.user_id} 充值积分包 ${productConfig.amount}`
    );

    await sendPurchaseEvent(checkout.customer?.email ?? "", {
      value: checkout.order?.amount ? checkout.order.amount / 100 : 0,
      currency: checkout.currency ?? "USD",
      contentIds: [productId!],
      eventId: `purchase_${orderId}`,
    });
  } else if (checkout.subscription) {
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
    resolveCustomer(subscription.customer),
    subscription.metadata?.user_id
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
    subscription.metadata?.user_id
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
      `Monthly Subscription Renewal: ${productConfig.amount} credits`
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
    resolveCustomer(subscription.customer),
    subscription.metadata?.user_id
  );
  await createOrUpdateSubscription(subscription, customerId);
  console.log(`✅ 订阅已取消: ${subscription.id}`);
}

async function handleSubscriptionExpired(event: CreemWebhookEvent) {
  const subscription = event.object;
  const customerId = await createOrUpdateCustomer(
    resolveCustomer(subscription.customer),
    subscription.metadata?.user_id
  );
  await createOrUpdateSubscription(subscription, customerId);
  console.log(`✅ 订阅已过期: ${subscription.id}`);
}

async function handleSubscriptionTrialing(event: CreemWebhookEvent) {
  const subscription = event.object;
  const customerId = await createOrUpdateCustomer(
    resolveCustomer(subscription.customer),
    subscription.metadata?.user_id
  );
  await createOrUpdateSubscription(subscription, customerId);
  console.log(`✅ 订阅试用期: ${subscription.id}`);
}