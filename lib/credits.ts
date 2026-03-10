import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase Admin Client (需要 service_role key 以绕过 RLS 权限限制进行底层的积分操作)
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

export async function consumeCredits(customerId: string, actionType: ActionType) {
  const amountToDeduct = COST_CONFIG[actionType];

  if (!amountToDeduct) {
    throw new Error('未知的消费类型');
  }

  // 1. 获取所有未过期且有余额的积分桶，按过期时间升序（最快过期的排在最前面）
  const { data: buckets, error: fetchError } = await supabaseAdmin
    .from('credit_buckets')
    .select('id, balance, expire_at')
    .eq('customer_id', customerId)
    .gt('expire_at', new Date().toISOString())
    .gt('balance', 0)
    .order('expire_at', { ascending: true });

  if (fetchError) {
    console.error('获取积分桶失败:', fetchError);
    return { success: false, message: '系统错误，无法获取积分状态' };
  }

  // 2. 校验总余额是否足够
  const totalAvailable = buckets?.reduce((sum, b) => sum + b.balance, 0) || 0;
  if (totalAvailable < amountToDeduct) {
    return { 
      success: false, 
      message: `积分不足，当前可用: ${totalAvailable}，需要: ${amountToDeduct}` 
    };
  }

  // 3. 循环扣减（核心：先进先出）
  let remainingToDeduct = amountToDeduct;
  for (const bucket of buckets!) {
    if (remainingToDeduct <= 0) break;

    const take = Math.min(bucket.balance, remainingToDeduct);
    const newBalance = bucket.balance - take;

    // 更新当前桶的余额
    const { error: updateError } = await supabaseAdmin
      .from('credit_buckets')
      .update({ balance: newBalance })
      .eq('id', bucket.id);

    if (updateError) {
      console.error(`更新积分桶 ${bucket.id} 失败:`, updateError);
      return { success: false, message: '扣费过程中发生系统错误' };
    }

    remainingToDeduct -= take;
  }

  // 4. 同步更新 customers 表的总余额 (为了兼容你旧的报表系统)
  // 获取当前总余额
  const { data: customerData } = await supabaseAdmin
    .from('customers')
    .select('credits')
    .eq('id', customerId)
    .single();

  const currentTotal = customerData?.credits || 0;
  const newTotal = Math.max(0, currentTotal - amountToDeduct);

  await supabaseAdmin
    .from('customers')
    .update({ credits: newTotal })
    .eq('id', customerId);

  // 5. 写入审计流水 credits_history
  await supabaseAdmin.from('credits_history').insert({
    customer_id: customerId,
    amount: amountToDeduct,
    type: 'subtract',
    description: `Used ${actionType}`,
    metadata: { source: 'system_deduction', action: actionType },
  });

  return { success: true, message: '扣费成功', deducted: amountToDeduct };
}