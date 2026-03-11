import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 1️⃣ 定义商品 ID 到积分的映射字典
const CREDITS_MAP: Record<string, number> = {
  "prod_1xQAaVUDAS8ok2LC4ByDkt": 40,   // 记得换成真实的 Starter ID
  "prod_2Ec2MDEKTw4m2eTpeK2QDI": 200,      // 记得换成真实的 Pro ID
  "prod_1oqDuB2aNKdNUqoXdH1jCp": 500, // 👈 你的 Ultra 套餐真实 ID
};

// 初始化 Supabase Admin 客户端 (绕过 RLS 权限)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 🚨 修正 1：精准获取事件名称
    const eventType = body.eventType; 
    
    console.log(`👉 收到 Creem 事件: ${eventType}`);

    // 🚨 修正 2：匹配正确的支付成功事件名
    if (eventType === "subscription.paid") {
      
      // 🚨 修正 3：按照 Creem 真实的数据层级提取 ID
      const productId = body.object?.product?.id; 
      const userId = body.object?.metadata?.user_id;

      if (!userId) {
        console.error("❌ Webhook 没找到 user_id, 无法发货");
        return NextResponse.json({ error: "Missing User ID" }, { status: 400 });
      }

      const creditsToAdd = CREDITS_MAP[productId];

      if (!creditsToAdd) {
        console.error(`❌ 未知的商品 ID: ${productId}`);
        return NextResponse.json({ error: "Unknown Product" }, { status: 400 });
      }

      // 查询当前积分
      const { data: customer, error: fetchError } = await supabaseAdmin
        .from("customers")
        .select("credits")
        .eq("user_id", userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const currentCredits = customer?.credits || 0;
      const newBalance = currentCredits + creditsToAdd;

      // 更新积分
      const { error: updateError } = await supabaseAdmin
        .from("customers")
        .update({ credits: newBalance })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      // 成功撒花！
      console.log(`✅ 成功给用户 ${userId} 充值了 ${creditsToAdd} 积分！当前余额: ${newBalance}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    console.error("❌ Webhook 处理失败:", error.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}