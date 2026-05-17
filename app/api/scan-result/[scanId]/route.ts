// ═══════════════════════════════════════════════════════════════
// /api/scan-result/[scanId] — 付费回跳后前端轮询的接口
//
// 三种状态：
//   - 'unpaid'      → 还没付（前端不该到这步，但兜底）
//   - 'processing'  → 已付，enhance 在跑（前端 2s 一轮，最多 ~30s）
//   - 'done'        → 3 张图齐了，返回 variants
//
// 首次访问时（enhance_started_at IS NULL）这个接口负责触发 enhance：
// 用一条 UPDATE ... WHERE enhance_started_at IS NULL 做并发锁，
// 同一个 scan_id 被多次并发请求，只有一个会拿到 update 成功的连接，
// 其他都看到 enhance_started_at 已设，乖乖返回 processing。
//
// 触发方式：fire-and-forget fetch /api/enhance-photo，本接口不等结果。
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// 兜底超时：enhance 应该 10-15s 完成；超过这个值还没出图 → 视为失败，
// 允许重新触发。常规 enhance 任务 ~15s，留 90s 余量。
const ENHANCE_TIMEOUT_MS = 90 * 1000;

export async function GET(
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
      .select('id, paid, paid_at, enhance_started_at, enhance_failed_at, enhance_attempts, expires_at, original_storage_key, original_storage_keys')
      .eq('id', scanId)
      .maybeSingle();

    if (scanErr) {
      console.error('[scan-result] lookup failed:', scanErr.message);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }
    if (scan.expires_at && new Date(scan.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { status: 'expired', error: 'Scan expired' },
        { status: 410 },
      );
    }
    if (!scan.paid) {
      return NextResponse.json({ status: 'unpaid' }, { status: 402 });
    }

    // ── 查 enhancements ──
    const { data: enhancements, error: enhErr } = await supabaseAdmin
      .from('photo_enhancements')
      .select('id, storage_key, mime_type, matched_scene_id, variant_index, group_id')
      .eq('scan_id', scanId)
      .order('variant_index', { ascending: true });

    if (enhErr) {
      console.error('[scan-result] enhancements lookup failed:', enhErr.message);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }

    // [multi-photo 2026-05-18] 失败标记：enhance_failed_at 比 started_at 新
    // → 最近一次 enhance 全失败，前端展示重试按钮。
    // POST /retry 会清掉 failed_at + started_at 让下一轮轮询重新触发。
    const failedAt = scan.enhance_failed_at ? new Date(scan.enhance_failed_at).getTime() : null;
    const startedAt = scan.enhance_started_at ? new Date(scan.enhance_started_at).getTime() : null;
    const isFailed = failedAt !== null && (startedAt === null || failedAt >= startedAt);

    // [N→N 2026-05-19] 期望产出张数 = 用户上传张数 (N 张原图 → N 张输出)。
    // 旧 scan 无 original_storage_keys (单数 key) → expected = 1.
    // 必须等齐 expected 张才能返回 done，否则 enhance 还在并发 insert 时
    // 前端可能在只有 1 条的瞬间就 stop 轮询，最终只显示 1 张。
    const expectedKeys = Array.isArray(scan.original_storage_keys)
      ? (scan.original_storage_keys as string[]).filter(Boolean)
      : [];
    const expectedCount = expectedKeys.length > 0
      ? expectedKeys.length
      : (scan.original_storage_key ? 1 : 1);

    const havePartial = !!enhancements && enhancements.length > 0;
    const haveAll = havePartial && (enhancements as any[]).length >= expectedCount;

    if (haveAll) {
      // 全部就绪 —— 拉每张的 watermarked base64 一次性返回。前端要展示就直接渲染。
      // (full-res 下载走 /api/download/[id]，依旧鉴权)
      const variants = await Promise.all(
        enhancements!.map(async (e, idx) => {
          const { data: blob } = await supabaseAdmin.storage
            .from('enhanced-photos')
            .download(e.storage_key);
          let image = '';
          if (blob) {
            const ab = await blob.arrayBuffer();
            image = Buffer.from(ab).toString('base64');
          }
          return {
            enhancementId: e.id,
            image,
            mimeType: e.mime_type ?? 'image/png',
            matchedScene: e.matched_scene_id ?? null,
            variantIndex: e.variant_index ?? idx,
          };
        }),
      );

      return NextResponse.json({ status: 'done', variants });
    }

    // partial 但 enhance 已经失败 → 走 failed 分支让前端显示重试。下面 isFailed 判断会处理。
    // partial 且 enhance 还在跑 → 继续 processing。
    if (havePartial) {
      console.log(`[scan-result] partial: ${enhancements!.length}/${expectedCount} variants ready, waiting…`);
    }

    // ── 还没出图 ──
    // 先看是不是上次失败了 — 失败状态由前端调 /retry 清掉，本接口不自动重试
    if (isFailed) {
      return NextResponse.json({
        status: 'failed',
        attempts: scan.enhance_attempts ?? 0,
      });
    }

    // 看是否需要触发 enhance
    const isStale =
      startedAt !== null && Date.now() - startedAt > ENHANCE_TIMEOUT_MS;

    if (startedAt === null || isStale) {
      // 用 UPDATE ... WHERE 做并发锁：只允许一个并发请求拿到锁
      const lockGuard = isStale
        ? { lt: scan.enhance_started_at! } // 旧锁超时 → 允许新锁覆盖
        : null;

      let updateQuery = supabaseAdmin
        .from('photo_scans')
        .update({ enhance_started_at: new Date().toISOString() })
        .eq('id', scanId);

      if (lockGuard) {
        updateQuery = updateQuery.lt('enhance_started_at', lockGuard.lt);
      } else {
        updateQuery = updateQuery.is('enhance_started_at', null);
      }

      const { data: lockResult, error: lockErr } = await updateQuery
        .select('id')
        .maybeSingle();

      if (lockErr) {
        console.error('[scan-result] lock failed:', lockErr.message);
        return NextResponse.json({ status: 'processing' });
      }

      if (lockResult) {
        // 拿到锁 — fire-and-forget 触发 enhance。本接口不等 enhance 完成。
        // 用 absolute URL（同一 Next.js 实例）；不需要带任何 auth header
        // 因为 enhance-photo 校验 scan.paid，已经满足。
        const origin = process.env.BASE_URL || '';
        const enhanceUrl = origin
          ? `${origin}/api/enhance-photo`
          : '/api/enhance-photo';
        fetch(enhanceUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scanId, useFusion: true }),
        }).catch((err) => {
          console.error('[scan-result] enhance trigger failed:', err);
        });
        console.log(`✅ [scan-result] enhance triggered for scan ${scanId}`);
      } else {
        // 没拿到锁说明另一个请求正在跑（或者刚跑完，下一轮就能看到 enhancements）
        console.log(`ℹ️ [scan-result] enhance already in flight for ${scanId}`);
      }
    }

    return NextResponse.json({ status: 'processing' });
  } catch (error) {
    console.error('[scan-result] error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
