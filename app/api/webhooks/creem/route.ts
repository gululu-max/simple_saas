import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { CreemWebhookEvent } from "@/types/creem";
import { sendPurchaseEvent } from "@/lib/meta-capi";
import { sendGooglePurchaseEvent } from "@/lib/google-ads-conversion";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import crypto from "crypto";

const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET!;

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ═══════════════════════════════════════════════════════════════
// [no-login pivot 2026-05-17] 一次性买卖 webhook
//
// 旧版：处理 checkout.completed (积分包 / 订阅首付) + subscription.*
//   系列 5 个事件。所有逻辑依赖 user_id 走 customers / subscriptions /
//   credits_history 三张表 + addCreditsToCustomer / createOrUpdateSubscription。
//
// 新版：只处理 checkout.completed。一笔 $4.99 / $12.99 付款对应一个
//   scan_id（前端创建 checkout 时塞进 metadata），webhook 拿 scan_id
//   去 UPDATE photo_scans SET paid=true。幂等靠 creem_order_id unique。
//
// 旧的 subscription handler 函数和 CREDITS_MAP 整段保留在文件末尾
// 注释里，恢复登录时直接解开 + 把 switch case 接回来即可。
// ═══════════════════════════════════════════════════════════════

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
      // [DISABLED 2026-05-17 — no-login pivot]
      // 一次性买卖不签订阅，下面 5 个事件理论上不会再触发。
      // 恢复登录时解开注释 + 把对应 handler 函数（文件末尾注释里）也解开。
      // case "subscription.active":
      //   await handleSubscriptionActive(event);
      //   break;
      // case "subscription.paid":
      //   await handleSubscriptionPaid(event);
      //   break;
      // case "subscription.canceled":
      //   await handleSubscriptionCanceled(event);
      //   break;
      // case "subscription.expired":
      //   await handleSubscriptionExpired(event);
      //   break;
      // case "subscription.trialing":
      //   await handleSubscriptionTrialing(event);
      //   break;
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
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// checkout.completed: 把对应 photo_scans 行标记成 paid
// 幂等：creem_order_id 有 unique partial index，重复同一笔订单的
// UPDATE 会因为已经设过 creem_order_id 而走到 "already paid" 分支。
// ─────────────────────────────────────────────
async function handleCheckoutCompleted(event: CreemWebhookEvent) {
  const checkout = event.object;

  const scanId: string | undefined = checkout.metadata?.scan_id;
  const orderId: string | undefined = checkout.order?.id;

  if (!scanId) {
    throw new Error("checkout.completed: metadata.scan_id 缺失");
  }
  if (!orderId) {
    throw new Error("checkout.completed: order.id 缺失，无法保证幂等");
  }

  // Customer email Creem 在结账页让买家填进来，可能在 checkout.customer.email
  // 或 checkout.order.customer 上，安全提取一下。
  const customerEmail: string | null =
    (typeof checkout.customer === "object" && checkout.customer?.email) ||
    null;

  const gaClientId: string | null = checkout.metadata?.ga_client_id || null;

  // 关键 UPDATE — paid=false 守卫防止 webhook 重发把状态搞坏
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("photo_scans")
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
      creem_order_id: orderId,
      customer_email: customerEmail,
      ga_client_id: gaClientId,
    })
    .eq("id", scanId)
    .eq("paid", false)
    .select("id, creem_order_id")
    .maybeSingle();

  if (updateErr) {
    // unique 冲突 = 同一笔 order 已经成功 update 过别的 scan（不该发生），
    // 或者并发重发把第二次冲到了。两种都视为幂等成功。
    if ((updateErr as any).code === "23505") {
      console.log(`✅ checkout.completed 幂等吃掉: order ${orderId}`);
      return;
    }
    throw new Error(`photo_scans update failed: ${updateErr.message}`);
  }

  if (!updated) {
    // 已经 paid 过 → 当前 update 命中 0 行。幂等成功。
    console.log(`✅ scan ${scanId} 已是 paid 状态，跳过`);
    return;
  }

  console.log(`✅ scan ${scanId} 标记 paid 成功 (order ${orderId})`);

  // ── 转化上报：Meta CAPI / Google Ads ──
  // 用 ga_client_id 做用户标识（访客无 user_id），event_id 用 order_id 防重报。
  const valueInDollars = checkout.order?.amount
    ? checkout.order.amount / 100
    : 0;
  const currency = checkout.currency ?? "USD";
  const productId: string =
    checkout.product?.id ||
    checkout.product_id ||
    checkout.items?.[0]?.product_id ||
    "unknown";

  try {
    await sendPurchaseEvent(customerEmail ?? "", {
      value: valueInDollars,
      currency,
      contentIds: [productId],
      eventId: `purchase_${orderId}`,
    });
  } catch (err) {
    console.error("[meta-capi] purchase event failed:", err);
  }

  try {
    await sendGooglePurchaseEvent({
      clientId: gaClientId || scanId,
      transactionId: orderId,
      value: valueInDollars,
      currency,
      items: [
        {
          item_id: productId,
          item_name: "matchfix_3_photo_bundle",
          price: valueInDollars,
        },
      ],
    });
  } catch (err) {
    console.error("[google-ads] purchase event failed:", err);
  }
}

// ═══════════════════════════════════════════════════════════════
// [DISABLED 2026-05-17 — no-login pivot]
// 下方是旧版登录流程下的 subscription / credits 完整实现。一字未改，
// 整段保留。恢复登录时：
//   1. 把 import { createOrUpdateCustomer, createOrUpdateSubscription,
//      addCreditsToCustomer } from "@/utils/supabase/subscriptions" 加回 import
//   2. 解开上面 switch case 的注释
//   3. 解开下面整段函数 + CREDITS_MAP 的注释
//   4. 决定 checkout.completed 走新版（一次性买卖）还是旧版（积分包/订阅）—
//      可以靠 metadata 里有没有 scan_id 来分流，或者按 product_id 分流。
// ═══════════════════════════════════════════════════════════════
//
// const CREDITS_MAP: Record<string, { type: "subscription" | "package"; amount: number }> = {};
//
// function registerProduct(envKey: string, type: "subscription" | "package", amount: number) {
//   const productId = process.env[envKey];
//   if (productId) {
//     CREDITS_MAP[productId] = { type, amount };
//   } else {
//     console.warn(`⚠️ 环境变量 ${envKey} 未配置，对应积分映射跳过`);
//   }
// }
//
// registerProduct("NEXT_PUBLIC_PRODUCT_ID_STARTER", "subscription", 40);
// registerProduct("NEXT_PUBLIC_PRODUCT_ID_PRO", "subscription", 200);
// registerProduct("NEXT_PUBLIC_PRODUCT_ID_ULTRA", "subscription", 500);
// registerProduct("NEXT_PUBLIC_PRODUCT_ID_PACK_MICRO", "package", 5);
// registerProduct("NEXT_PUBLIC_PRODUCT_ID_PACK_STARTER", "package", 75);
// registerProduct("NEXT_PUBLIC_PRODUCT_ID_PACK_VALUE", "package", 200);
// registerProduct("NEXT_PUBLIC_PRODUCT_ID_PACK_PRO", "package", 500);
//
// function resolveCustomer(raw: any): any {
//   if (!raw) return raw;
//   if (typeof raw === "string") return { id: raw };
//   return raw;
// }
//
// async function legacyHandleCheckoutCompleted(event: CreemWebhookEvent) {
//   const checkout = event.object;
//   if (!checkout.metadata?.user_id) {
//     throw new Error("user_id is required in checkout metadata");
//   }
//   const customerId = await createOrUpdateCustomer(
//     resolveCustomer(checkout.customer),
//     checkout.metadata.user_id,
//   );
//   const productId =
//     checkout.product?.id || checkout.product_id || checkout.items?.[0]?.product_id;
//   const productConfig = productId ? CREDITS_MAP[productId] : null;
//   if (productConfig?.type === "package") {
//     const orderId = checkout.order?.id;
//     if (!orderId) {
//       throw new Error("checkout.completed: 积分包缺少 order.id，无法保证幂等");
//     }
//     await addCreditsToCustomer(
//       customerId,
//       productConfig.amount,
//       orderId,
//       `Purchased ${productConfig.amount} credits package`,
//     );
//     console.log(
//       `✅ 用户 ${checkout.metadata.user_id} 充值积分包 ${productConfig.amount}`,
//     );
//     await sendPurchaseEvent(checkout.customer?.email ?? "", {
//       value: checkout.order?.amount ? checkout.order.amount / 100 : 0,
//       currency: checkout.currency ?? "USD",
//       contentIds: [productId!],
//       eventId: `purchase_${orderId}`,
//     });
//     await sendGooglePurchaseEvent({
//       clientId: checkout.metadata?.ga_client_id || checkout.metadata.user_id,
//       transactionId: orderId,
//       value: checkout.order?.amount ? checkout.order.amount / 100 : 0,
//       currency: checkout.currency ?? "USD",
//       items: [{ item_id: productId!, item_name: "credits_pack", price: checkout.order?.amount ? checkout.order.amount / 100 : 0 }],
//     });
//   } else if (checkout.subscription) {
//     await createOrUpdateSubscription(checkout.subscription, customerId);
//     console.log(`✅ 订阅创建完成，积分将由 subscription.paid 事件发放`);
//   } else {
//     console.warn(`⚠️ checkout.completed: 无匹配处理逻辑 (productId: ${productId})`);
//   }
// }
//
// async function handleSubscriptionActive(event: CreemWebhookEvent) {
//   const subscription = event.object;
//   const customerId = await createOrUpdateCustomer(
//     resolveCustomer(subscription.customer),
//     subscription.metadata?.user_id,
//   );
//   await createOrUpdateSubscription(subscription, customerId);
//   console.log(`✅ 订阅激活: ${subscription.id}`);
// }
//
// async function handleSubscriptionPaid(event: CreemWebhookEvent) {
//   const subscription = event.object as any;
//   const customerId = await createOrUpdateCustomer(
//     resolveCustomer(subscription.customer),
//     subscription.metadata?.user_id,
//   );
//   await createOrUpdateSubscription(subscription, customerId);
//   const productId =
//     typeof subscription.product === "string"
//       ? subscription.product
//       : subscription.product?.id;
//   const productConfig = productId ? CREDITS_MAP[productId] : null;
//   if (productConfig?.type === "subscription") {
//     const transactionId = subscription.last_transaction?.id;
//     if (!transactionId) {
//       throw new Error("subscription.paid: 缺少 last_transaction.id,无法保证幂等");
//     }
//     await addCreditsToCustomer(
//       customerId,
//       productConfig.amount,
//       transactionId,
//       `Monthly Subscription Renewal: ${productConfig.amount} credits`,
//     );
//     console.log(`✅ 订阅扣款成功，发放月度积分 ${productConfig.amount}`);
//     await sendPurchaseEvent(subscription.customer?.email ?? "", {
//       value: subscription.last_transaction?.amount
//         ? subscription.last_transaction.amount / 100
//         : 0,
//       currency: subscription.currency ?? "USD",
//       contentIds: [productId!],
//       eventId: `purchase_${transactionId}`,
//     });
//     await sendGooglePurchaseEvent({
//       clientId: subscription.metadata?.ga_client_id || subscription.metadata?.user_id || "unknown",
//       transactionId,
//       value: subscription.last_transaction?.amount ? subscription.last_transaction.amount / 100 : 0,
//       currency: subscription.currency ?? "USD",
//       items: [{ item_id: productId!, item_name: "subscription_renewal", price: subscription.last_transaction?.amount ? subscription.last_transaction.amount / 100 : 0 }],
//     });
//   } else {
//     console.warn(`⚠️ subscription.paid: 未识别商品 ID: ${productId}`);
//   }
// }
//
// async function handleSubscriptionCanceled(event: CreemWebhookEvent) {
//   const subscription = event.object;
//   const customerId = await createOrUpdateCustomer(
//     resolveCustomer(subscription.customer),
//     subscription.metadata?.user_id,
//   );
//   await createOrUpdateSubscription(subscription, customerId);
//   console.log(`✅ 订阅已取消: ${subscription.id}`);
// }
//
// async function handleSubscriptionExpired(event: CreemWebhookEvent) {
//   const subscription = event.object;
//   const customerId = await createOrUpdateCustomer(
//     resolveCustomer(subscription.customer),
//     subscription.metadata?.user_id,
//   );
//   await createOrUpdateSubscription(subscription, customerId);
//   console.log(`✅ 订阅已过期: ${subscription.id}`);
// }
//
// async function handleSubscriptionTrialing(event: CreemWebhookEvent) {
//   const subscription = event.object;
//   const customerId = await createOrUpdateCustomer(
//     resolveCustomer(subscription.customer),
//     subscription.metadata?.user_id,
//   );
//   await createOrUpdateSubscription(subscription, customerId);
//   console.log(`✅ 订阅试用期: ${subscription.id}`);
// }
