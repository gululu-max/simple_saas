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

// ─── 预加载水印瓦片（与 enhance-photo 共用同一张）──────────────
let watermarkTileBuffer: Buffer | null = null;

function getWatermarkTile(): Buffer {
  if (!watermarkTileBuffer) {
    const tilePath = path.join(process.cwd(), 'public', 'watermark-tile.png');
    watermarkTileBuffer = fs.readFileSync(tilePath);
  }
  return watermarkTileBuffer;
}

async function addWatermarkServer(imageBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width ?? 800;
  const h = meta.height ?? 800;

  const tile = getWatermarkTile();
  const tileMeta = await sharp(tile).metadata();
  const tileW = tileMeta.width ?? 600;
  const tileH = tileMeta.height ?? 600;

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
      // 从 Storage 取无水印原图，实时加水印返回
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

    // ── 查积分 + 会员状态 ──
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("id, credits")
      .eq("user_id", user.id)
      .single();

    if (customerError || !customer) {
      return new Response("Failed to fetch customer data", { status: 500 });
    }

    const now = new Date().toISOString();

    const { data: subData } = await supabaseAdmin
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("customer_id", customer.id)
      .in("status", ["active", "canceled"])
      .maybeSingle();
    
    const isSubscribed = !!subData && (
      subData.status === "active" ||
      (subData.status === "canceled" && !!subData.current_period_end && subData.current_period_end > now)
    );

    // ── 收费逻辑 ──
    const needsPayment = record.is_free_trial && !isSubscribed;

    if (needsPayment) {
      if (customer.credits < COST_DOWNLOAD_FREE_TRIAL) {
        // 积分不够 → 重定向回前端，让前端弹充值弹窗
        const returnUrl = new URL('/boost', req.url);
        returnUrl.searchParams.set('download_error', 'insufficient_credits');
        return Response.redirect(returnUrl.toString(), 302);
      }

      // 扣积分
      const { error: updateError } = await supabaseAdmin
        .from('customers')
        .update({ credits: customer.credits - COST_DOWNLOAD_FREE_TRIAL })
        .eq('id', customer.id);

      if (updateError) {
        return new Response("Failed to deduct credits", { status: 500 });
      }

      await supabaseAdmin.from('credits_history').insert({
        customer_id: customer.id,
        amount: COST_DOWNLOAD_FREE_TRIAL,
        type: 'subtract',
        description: 'PhotoDownload (free trial conversion)',
        metadata: {
          source: 'system_deduction',
          action: 'PhotoDownload',
          enhancement_id: enhancementId,
        },
      });
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
