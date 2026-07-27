import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { creem } from '@/lib/creem';

// ═══════════════════════════════════════════════════════════════
// [RESTORED 2026-05-29 — login revert]
// 恢复登录门控的订阅/积分 checkout（旧版）。
// 一次性买卖（访客 scanId 版）整段移到文件末尾注释里，未来想再做
// 一次性 flow 时解开即可。
// ═══════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, productType, userId, credits, returnPath } = body;

    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 支付成功后跳回来源页，默认跳首页
    const origin = request.headers.get('origin') || '';
    const successPath = returnPath || '/';
    const separator = successPath.includes('?') ? '&' : '?';
    const successUrl = `${origin}${successPath}${separator}payment=success`;

    const checkout = await creem.checkouts.create({
      productId: productId,
      customer: { email: user.email },
      successUrl,
      metadata: {
        user_id: user.id,
        product_type: productType,
        credits: credits || 0,
      },
    });

    return NextResponse.json({ checkoutUrl: checkout.checkoutUrl });
  } catch (error) {
    console.error('Checkout error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// [DISABLED 2026-05-29 — login revert] 一次性买卖 checkout（访客 scanId 版）
// 入参 { scanId, productId, gaClientId }；scan.paid 守卫防重复付款。
// 恢复一次性 flow 时把下面解开（并把上面登录版改名/分流）。
// 依赖：import { createClient as createAdminClient } from '@supabase/supabase-js';
// ═══════════════════════════════════════════════════════════════
//
// const supabaseAdmin = createAdminClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!,
// );
//
// export async function POST_oneshot(request: Request) {
//   try {
//     const body = await request.json();
//     const { scanId, productId, gaClientId } = body as {
//       scanId?: string;
//       productId?: string;
//       gaClientId?: string;
//     };
//
//     if (!scanId || !productId) {
//       return NextResponse.json({ error: 'scanId 和 productId 必填' }, { status: 400 });
//     }
//
//     const { data: scan, error: scanErr } = await supabaseAdmin
//       .from('photo_scans')
//       .select('id, paid, expires_at')
//       .eq('id', scanId)
//       .maybeSingle();
//
//     if (scanErr) {
//       console.error('[create-checkout] scan lookup failed:', scanErr.message);
//       return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
//     }
//     if (!scan) {
//       return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
//     }
//     if (scan.paid) {
//       return NextResponse.json({ error: 'Scan already paid', code: 'ALREADY_PAID' }, { status: 409 });
//     }
//     if (scan.expires_at && new Date(scan.expires_at).getTime() < Date.now()) {
//       return NextResponse.json({ error: 'Scan expired, please re-upload', code: 'SCAN_EXPIRED' }, { status: 410 });
//     }
//
//     const origin = request.headers.get('origin') || '';
//     const successUrl = `${origin}/subscribe/scanner?payment=success&scan_id=${scanId}`;
//
//     const checkout = await creem.checkouts.create({
//       productId,
//       successUrl,
//       metadata: { scan_id: scanId, ga_client_id: gaClientId || '' },
//     });
//
//     return NextResponse.json({ checkoutUrl: checkout.checkoutUrl });
//   } catch (error) {
//     console.error('Checkout error:', error);
//     return new NextResponse('Internal Server Error', { status: 500 });
//   }
// }
