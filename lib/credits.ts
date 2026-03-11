import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase Admin Client (绕过 RLS 权限)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 定义消耗常量
export const COST_CONFIG = {
  MatchfixScanner: 5,
  AIPhotoScorer: 10,
} as const;

export type ActionType = keyof typeof COST_CONFIG;

/**
 * 扣除积分
 */
export async function consumeCredits(userId: string, actionType: ActionType) {
  const amountToDeduct = COST_CONFIG[actionType];

  if (!amountToDeduct) {
    throw new Error('未知的消费类型');
  }

  // 1. 获取当前总积分和客户主键 ID
  const { data: customerData, error: fetchError } = await supabaseAdmin
    .from('customers')
    .select('id, credits') // 🚨 核心修复：必须查出 id
    .eq('user_id', userId)
    .single();

  if (fetchError || !customerData) {
    console.error('获取用户积分失败:', fetchError);
    return { success: false, message: '系统错误，无法获取积分状态' };
  }

  const currentTotal = customerData.credits || 0;

  // 2. 校验余额
  if (currentTotal < amountToDeduct) {
    return { 
      success: false, 
      message: `积分不足，当前可用: ${currentTotal}，需要: ${amountToDeduct}` 
    };
  }

  const newTotal = currentTotal - amountToDeduct;

  // 3. 更新 customers 表中的总余额
  const { error: updateError } = await supabaseAdmin
    .from('customers')
    .update({ credits: newTotal })
    .eq('id', customerData.id); // 使用主键更新更严谨

  if (updateError) {
    console.error(`更新用户积分失败:`, updateError);
    return { success: false, message: '扣费过程中发生系统错误' };
  }

  // 4. 写入审计流水 credits_history
  await supabaseAdmin.from('credits_history').insert({
    customer_id: customerData.id, // 🚨 核心修复：使用查出来的客户主键
    amount: amountToDeduct,
    type: 'subtract',
    description: `Used ${actionType}`,
    metadata: { source: 'system_deduction', action: actionType },
  });

  return { success: true, message: '扣费成功', deducted: amountToDeduct, remaining: newTotal };
}

/**
 * 发放积分
 */
export async function addCreditsToCustomer(
  userId: string,
  amount: number,
  orderId: string,
  description: string
) {
  if (!userId || !amount || isNaN(amount) || amount <= 0) {
    console.error("发放积分失败：参数无效", { userId, amount });
    throw new Error("Invalid parameters for adding credits");
  }

  // 1. 获取当前总积分和客户主键 ID
  const { data: customerData, error: fetchError } = await supabaseAdmin
    .from('customers')
    .select('id, credits') // 🚨 核心修复：查出关联的 id
    .eq('user_id', userId)
    .single();

  if (fetchError) { 
    console.error("获取用户记录失败:", fetchError);
    throw new Error("Customer record not found. Please ensure customer exists before adding credits.");
  }

  const currentTotal = customerData.credits || 0;
  const newTotal = currentTotal + amount;

  // 2. 更新 customers 表
  const { error: updateError } = await supabaseAdmin
    .from('customers')
    .update({ credits: newTotal })
    .eq('id', customerData.id);

  if (updateError) {
    console.error("更新用户总积分失败:", updateError);
    throw new Error(`Failed to update customer credits: ${updateError.message}`);
  }

  // 3. 写入审计流水 credits_history
  const { error: historyError } = await supabaseAdmin
    .from('credits_history')
    .insert({
      customer_id: customerData.id,  // 🚨 核心修复：匹配 SQL 脚本结构
      amount: amount,
      type: 'add',
      description: description,
      metadata: { source: 'purchase', order_id: orderId },
    });
    
  if (historyError) {
     console.error("写入积分历史失败:", historyError);
  }

  console.log(`✅ 成功发放 ${amount} 积分，当前余额: ${newTotal}`);
  return { success: true, newTotal };
}