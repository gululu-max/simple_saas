// ═══════════════════════════════════════════════════════════════
// POST /api/scan-result/[scanId]/retry
//
// 用户点 "Retry generation" 按钮时调。前置：scan 已 paid，且上次 enhance
// 失败（enhance_failed_at 较新）。本接口只负责清掉 failed/started 锁字段，
// 然后 GET /api/scan-result/[scanId] 下一轮轮询会重新拿到锁触发 enhance。
//
// 不再二次扣费 — scan 仍是 paid。
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ scanId: string }> },
) {
  try {
    const { scanId } = await params;
    if (!scanId) {
      return NextResponse.json({ error: 'Missing scanId' }, { status: 400 });
    }

    const { data: scan, error: scanErr } = await supabaseAdmin
      .from('photo_scans')
      .select('id, paid, expires_at, enhance_attempts')
      .eq('id', scanId)
      .maybeSingle();

    if (scanErr) {
      console.error('[retry] lookup failed:', scanErr.message);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }
    if (!scan.paid) {
      return NextResponse.json({ error: 'Scan not paid' }, { status: 402 });
    }
    if (scan.expires_at && new Date(scan.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Scan expired' }, { status: 410 });
    }

    // 软上限：避免恶意一直 retry 烧 Gemini 额度
    const MAX_RETRIES = 3;
    if ((scan.enhance_attempts ?? 0) >= MAX_RETRIES) {
      return NextResponse.json(
        { error: 'Too many retries, please contact support', code: 'RETRY_LIMIT' },
        { status: 429 },
      );
    }

    // 清掉锁 → 下一轮 /scan-result GET 会重新触发
    const { error: updErr } = await supabaseAdmin
      .from('photo_scans')
      .update({
        enhance_failed_at: null,
        enhance_started_at: null,
      })
      .eq('id', scanId);

    if (updErr) {
      console.error('[retry] update failed:', updErr.message);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    console.log(`✅ [retry] scan ${scanId} cleared for retry`);
    return NextResponse.json({ status: 'cleared' });
  } catch (error) {
    console.error('[retry] error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
