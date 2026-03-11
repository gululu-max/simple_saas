import { NextResponse } from "next/server";
import { addCreditsToCustomer } from "@/lib/credits"; // 引入发积分底层逻辑

// 1️⃣ 终极版：定义【所有】商品 ID 到积分的映射字典
const CREDITS_MAP: Record<string, { type: 'subscription' | 'package', amount: number }> = {
  // === 📅 订阅套餐 ===
  "prod_1xQAaVUDAS8ok2LC4ByDkt": { type: 'subscription', amount: 40 },   // Starter
  "prod_2Ec2MDEKTw4m2eTpeK2QDI": { type: 'subscription', amount: 200 },  // Pro
  "prod_1oqDuB2aNKdNUqoXdH1jCp": { type: 'subscription', amount: 500 },  // Ultra

  // === 💰 单次购买积分包 (⚠️ 请把这里的 prod_xxx 换成你真实的商品 ID) ===
  "prod_2yCr5jDyIWNbaXkEmdHi8U":  { type: 'package', amount: 25 },   // $5  (25 credits)
  "prod_7FSCixl1ehaoEo27D8BOan": { type: 'package', amount: 100 },  // $12 (100 credits)
  "prod_6pWAhN7ZgxyvzexM2ls4Et": { type: 'package', amount: 300 },  // $25 (300 credits)
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const eventType = body.eventType; 
    const eventId = body.id; // 防重凭证
    
    console.log(`👉 收到 Creem 事件: ${eventType}`);

    const userId = body.object?.metadata?.user_id;

    if (!userId) {
      console.error("❌ Webhook 没找到 user_id, 无法发货");
      return NextResponse.json({ error: "Missing User ID" }, { status: 400 });
    }

    // 提取当前事件关联的商品 ID (兼容不同事件层级)
    const productId = body.object?.product?.id || body.object?.product_id || body.object?.items?.[0]?.product_id;
    const productConfig = CREDITS_MAP[productId];

    // ==========================================
    // 场景 A：单次购买积分包完成 ($5 / $12 / $25)
    // ==========================================
    if (eventType === "checkout.completed") {
      if (productConfig && productConfig.type === 'package') {
        const creditsToAdd = productConfig.amount;
        
        await addCreditsToCustomer(
          userId, 
          creditsToAdd,
          body.object?.order?.id || eventId, 
          `Purchased ${creditsToAdd} credits package`
        );
        console.log(`✅ 成功给用户 ${userId} 充值了单次包 ${creditsToAdd} 积分！`);
      } else {
        console.log(`👉 checkout.completed: 但不是积分包商品 (ID: ${productId})，跳过发货。`);
      }
    }

    // ==========================================
    // 场景 B：订阅会员扣款成功 (首次订阅 & 每月自动续费)
    // ==========================================
    if (eventType === "subscription.paid") {
      if (productConfig && productConfig.type === 'subscription') {
        const creditsToAdd = productConfig.amount;
        
        await addCreditsToCustomer(
          userId,
          creditsToAdd,
          eventId, 
          `Monthly Subscription Renewal: ${creditsToAdd} credits`
        );
        console.log(`✅ 成功给订阅用户 ${userId} 自动充值了 ${creditsToAdd} 个月度积分！`);
      } else {
        console.warn(`⚠️ subscription.paid: 未知的订阅商品 ID: ${productId}，跳过发货。`);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    console.error("❌ Webhook 处理失败:", error.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}