// app/api/download/[id]/route.ts
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const COST_DOWNLOAD_FREE_TRIAL = 5;
const BUCKET = 'enhanced-photos';

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

    // ── 鉴权 ──
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // ── 查 enhancement 记录 ──
    const { data: record, error: recordError } = await supabaseAdmin
      .from('photo_enhancements')
      .select('id, user_id, storage_key, mime_type, is_free_trial, downloaded, expires_at')
      .eq('id', enhancementId)
      .eq('user_id', user.id)
      .single();

    if (recordError || !record) {
      return new Response("Enhancement not found", { status: 404 });
    }

    // ── 过期检查 ──
    if (new Date(record.expires_at) < new Date()) {
      return new Response("Enhancement expired", { status: 410 });
    }

    // ── 带水印下载（免费，不扣积分）──
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

    // ── 查会员状态（单次查询 join subscriptions）──
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select(`
        id, credits,
        subscriptions (status, current_period_end)
      `)
      .eq("user_id", user.id)
      .single();

    if (customerError || !customer) {
      return new Response("Failed to fetch customer data", { status: 500 });
    }

    const now = new Date().toISOString();
    const sub = (customer as any).subscriptions?.[0] ?? null;
    const isSubscribed = !!sub && (
      sub.status === "active" ||
      (sub.status === "canceled" && !!sub.current_period_end && sub.current_period_end > now)
    );

    // ── 收费逻辑 ──
    const needsPayment = record.is_free_trial && !isSubscribed;

    if (needsPayment) {
      // ── 原子扣积分（RPC 内含积分不足判断）──
      const { data: rpcResult, error: rpcError } = await supabaseAdmin
        .rpc('deduct_credits', {
          p_user_id: user.id,
          p_amount: COST_DOWNLOAD_FREE_TRIAL,
          p_description: 'PhotoDownload (free trial conversion)',
          p_metadata: {
            source: 'system_deduction',
            action: 'PhotoDownload',
            enhancement_id: enhancementId,
          },
        })
        .returns<DeductCreditsResult[]>()  // ← 加这行
        .single();

      if (rpcError) {
        console.error("RPC deduct_credits error:", rpcError);
        return new Response(
          JSON.stringify({ error: "Failed to deduct credits" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!rpcResult.success) {
        // 积分不足 → 返回 402 JSON，让前端处理
        return new Response(
          JSON.stringify({
            error: "Insufficient credits",
            code: "INSUFFICIENT_CREDITS",
            needed: COST_DOWNLOAD_FREE_TRIAL,
            current: customer.credits,
          }),
          { status: 402, headers: { "Content-Type": "application/json" } }
        );
      }
    }

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