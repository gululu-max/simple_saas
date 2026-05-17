import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { creem } from '@/lib/creem';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ═══════════════════════════════════════════════════════════════
// [no-login pivot 2026-05-17] 一次性买卖 checkout
//
// 入参：{ scanId, productId, gaClientId? }
//   - scanId: photo_scans.id (bearer token，UUID 不可猜)
//   - productId: NEXT_PUBLIC_PRODUCT_ID_BUNDLE_PROMO 或 _REGULAR
//   - gaClientId: GA cookie ID，付费成功 webhook 用它做转化上报
//
// 流程：
//   1. 校验 scan 存在 + 未付费（防止重复付款 / 防伪造 scan_id）
//   2. 向 Creem 创建 checkout，metadata 带 scan_id + ga_client_id
//   3. successUrl 带 scan_id —— 即便本地存储丢了，URL 也能找回
//   4. 不收 customer.email —— Creem 结账页让买家自填，回头 webhook 把
//      email 落到 photo_scans.customer_email
//
// 旧版（需要登录 + productType/userId/credits）整段在文件末尾注释里。
// ═══════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scanId, productId, gaClientId } = body as {
      scanId?: string;
      productId?: string;
      gaClientId?: string;
    };

    if (!scanId || !productId) {
      return NextResponse.json(
        { error: 'scanId 和 productId 必填' },
        { status: 400 },
      );
    }

    // ── 校验 scan ──
    const { data: scan, error: scanErr } = await supabaseAdmin
      .from('photo_scans')
      .select('id, paid, expires_at')
      .eq('id', scanId)
      .maybeSingle();

    if (scanErr) {
      console.error('[create-checkout] scan lookup failed:', scanErr.message);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }
    if (scan.paid) {
      return NextResponse.json(
        { error: 'Scan already paid', code: 'ALREADY_PAID' },
        { status: 409 },
      );
    }
    if (scan.expires_at && new Date(scan.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'Scan expired, please re-upload', code: 'SCAN_EXPIRED' },
        { status: 410 },
      );
    }

    // ── 构造 successUrl ──
    // scan_id 塞进 URL：付费回跳后即便 sessionStorage 丢了，前端也能凭
    // URL 调 /api/scan-result/{scanId} 找回结果。
    const origin = request.headers.get('origin') || '';
    const successUrl = `${origin}/subscribe/scanner?payment=success&scan_id=${scanId}`;

    const checkout = await creem.checkouts.create({
      productId,
      successUrl,
      metadata: {
        scan_id: scanId,
        ga_client_id: gaClientId || '',
      },
    });

    return NextResponse.json({ checkoutUrl: checkout.checkoutUrl });
  } catch (error) {
    console.error('Checkout error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// [DISABLED 2026-05-17 — no-login pivot]
// 旧版：登录用户买积分包 / 订阅，需要校验 auth + 用 user.email 作为
// customer 标识。恢复登录时把下面整段解开，并决定怎么共存（按入参字段
// 分流即可：有 scanId 走新版，有 productType 走旧版）。
// ═══════════════════════════════════════════════════════════════
//
// import { createClient } from '@/utils/supabase/server';
//
// export async function POST_legacy(request: Request) {
//   try {
//     const body = await request.json();
//     const { productId, productType, userId, credits, returnPath } = body;
//
//     const supabase = await createClient();
//     const { data: { user }, error: authError } = await supabase.auth.getUser();
//
//     if (authError || !user) {
//       return new NextResponse('Unauthorized', { status: 401 });
//     }
//
//     const origin = request.headers.get('origin') || '';
//     const successPath = returnPath || '/';
//     const separator = successPath.includes('?') ? '&' : '?';
//     const successUrl = `${origin}${successPath}${separator}payment=success`;
//
//     const checkout = await creem.checkouts.create({
//       productId: productId,
//       customer: { email: user.email },
//       successUrl,
//       metadata: {
//         user_id: user.id,
//         product_type: productType,
//         credits: credits || 0,
//       },
//     });
//
//     return NextResponse.json({ checkoutUrl: checkout.checkoutUrl });
//   } catch (error) {
//     console.error('Checkout error:', error);
//     return new NextResponse('Internal Server Error', { status: 500 });
//   }
// }
