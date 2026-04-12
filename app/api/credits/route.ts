import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ↓ 加这个
interface DeductCreditsResult {
  success: boolean;
  remaining: number;
  customer_id: string;
}
// GET - 获取用户积分 + 会员状态（单次查询，join subscriptions）
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 一次查询拿齐 customer + credits_history + subscriptions ──
    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .select(`
        *,
        credits_history (
          amount,
          type,
          created_at,
          description
        ),
        subscriptions (
          status,
          current_period_end
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching customer data:', error);
      return NextResponse.json({ error: 'Failed to fetch customer data' }, { status: 500 });
    }

    // ── 判断会员状态 ──
    const now = new Date().toISOString();
    const sub = customer?.subscriptions?.[0] ?? null;
    const isSubscribed = !!sub && (
      sub.status === 'active' ||
      (sub.status === 'canceled' && !!sub.current_period_end && sub.current_period_end > now)
    );

    return NextResponse.json({
      credits: {
        id: customer.id,
        user_id: customer.user_id,
        total_credits: customer.credits,
        remaining_credits: customer.credits,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
      },
      isSubscribed,
      hasFreeTrial: !customer.free_enhance_used,
    });
  } catch (error) {
    console.error('Credits API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - 消费积分（原子操作，使用 service role + RPC）
export async function POST(request: NextRequest) {
  try {
    const { amount, operation } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid credit amount' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 原子扣积分 ──
    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc('deduct_credits', {
        p_user_id: user.id,
        p_amount: amount,
        p_description: operation || 'credit_deduction',
        p_metadata: {
          operation: operation || 'credit_deduction',
          source: 'api_credits_post',
        },
      })
      .returns<DeductCreditsResult[]>()  // ← 加这行
      .single();

    if (rpcError) {
      console.error('Error deducting credits:', rpcError);
      return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 });
    }

    if (!rpcResult.success) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 });
    }

    return NextResponse.json({
      credits: {
        id: rpcResult.customer_id,
        user_id: user.id,
        total_credits: rpcResult.remaining,
        remaining_credits: rpcResult.remaining,
      },
      success: true,
    });
  } catch (error) {
    console.error('Credits spend API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}