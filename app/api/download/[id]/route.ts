// app/api/download/[id]/route.ts
// [DISABLED 2026-05-17 — no-login pivot] createClient (server) 给登录用户读 session 用。
// 恢复登录时下两行解开，并把 COST_DOWNLOAD_FREE_TRIAL / DeductCreditsResult 也解开。
// import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// const COST_DOWNLOAD_FREE_TRIAL = 5;
const BUCKET = 'enhanced-photos';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// interface DeductCreditsResult {
//   success: boolean;
//   remaining: number;
//   customer_id: string;
// }

// ─── 预加载水印瓦片 + 缓存尺寸 ──────────────
let watermarkTileBuffer: Buffer | null = null;
let watermarkTileW = 600;
let watermarkTileH = 600;

async function getWatermarkTile(): Promise<{ buffer: Buffer; w: number; h: number }> {
  if (!watermarkTileBuffer) {
    const tilePath = path.join(process.cwd(), 'public', 'watermark-tile.png');
    watermarkTileBuffer = fs.readFileSync(tilePath);
    const tileMeta = await sharp(watermarkTileBuffer).metadata();
    watermarkTileW = tileMeta.width ?? 600;
    watermarkTileH = tileMeta.height ?? 600;
  }
  return { buffer: watermarkTileBuffer, w: watermarkTileW, h: watermarkTileH };
}

async function addWatermarkServer(imageBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width ?? 800;
  const h = meta.height ?? 800;

  const { buffer: tile, w: tileW, h: tileH } = await getWatermarkTile();

  const composites: sharp.OverlayOptions[] = [];
  for (let y = 0; y < h; y += tileH) {
    for (let x = 0; x < w; x += tileW) {
      composites.push({ input: tile, top: y, left: x, blend: 'over' });
    }
  }

  return sharp(imageBuffer)
    .composite(composites)
    .png()
    .toBuffer();
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: enhancementId } = await params;

    if (!enhancementId) {
      return new Response("Missing enhancement ID", { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════
    // [no-login pivot 2026-05-17] 鉴权 = enhancement 所属 scan.paid。
    // 1. enhancement_id 本身是 bearer token (UUID)
    // 2. 用 join 查 scan.paid，paid=true 即放行
    // 3. 旧的 customer / credits / is_free_trial 扣费整段废弃
    // 旧版完整代码保留在文件末尾注释里。
    // ═══════════════════════════════════════════════════════════
    const { data: record, error: recordError } = await supabaseAdmin
      .from('photo_enhancements')
      .select(`
        id, storage_key, mime_type, downloaded, expires_at, group_id,
        scan_id,
        photo_scans!inner ( paid )
      `)
      .eq('id', enhancementId)
      .maybeSingle();

    if (recordError || !record) {
      return new Response("Enhancement not found", { status: 404 });
    }

    // ── 过期检查 ──
    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      return new Response("Enhancement expired", { status: 410 });
    }

    // ── paid 校验 ──
    const scanPaid = (record as any).photo_scans?.paid === true;
    if (!scanPaid) {
      return new Response(
        JSON.stringify({ error: 'Not paid', code: 'NOT_PAID' }),
        { status: 402, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── 带水印下载（免费）──
    const url = new URL(req.url);
    const wantWatermarked = url.searchParams.get('watermarked') === '1';

    if (wantWatermarked) {
      const { data: origData, error: origError } = await supabaseAdmin.storage
        .from(BUCKET)
        .download(record.storage_key);

      if (origError || !origData) {
        return new Response("Failed to retrieve photo", { status: 500 });
      }

      const origBuffer = Buffer.from(await origData.arrayBuffer());
      const watermarkedBuffer = await addWatermarkServer(origBuffer);

      return new Response(new Uint8Array(watermarkedBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="matchfix-enhanced-watermark.png"`,
          'Cache-Control': 'no-store',
        },
      });
    }
    // 无水印下载也走 paid 校验，已通过 = 直接返回原图，不再扣积分

    // ── 从 Storage 取无水印图 ──
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(record.storage_key);

    if (downloadError || !fileData) {
      return new Response("Failed to retrieve photo", { status: 500 });
    }

    // ── 标记已下载 ──
    if (!record.downloaded) {
      await supabaseAdmin
        .from('photo_enhancements')
        .update({ downloaded: true })
        .eq('id', enhancementId);
    }

    // ── 返回文件流 ──
    const arrayBuffer = await fileData.arrayBuffer();
    const ext = record.mime_type === 'image/jpeg' ? 'jpg' : 'png';

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': record.mime_type,
        'Content-Disposition': `attachment; filename="matchfix-enhanced.${ext}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error("download GET error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}