// app/api/download/route.ts
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from '@supabase/supabase-js';

const COST_PER_DOWNLOAD = 5;
const BUCKET = 'enhanced-photos';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { enhancementId } = await req.json();

    if (!enhancementId) {
      return new Response(JSON.stringify({ error: "enhancementId is required" }), { status: 400 });
    }

    // ── 鉴权 ──
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: "LOGIN_REQUIRED" }),
        { status: 401 }
      );
    }

    // ── 查 enhancement 记录（只查自己的，防止越权） ──
    const { data: record, error: recordError } = await supabaseAdmin
      .from('photo_enhancements')
      .select('id, user_id, storage_key, mime_type, is_free_trial, downloaded, expires_at')
      .eq('id', enhancementId)
      .eq('user_id', user.id)
      .single();

    if (recordError || !record) {
      return new Response(JSON.stringify({ error: "Enhancement not found" }), { status: 404 });
    }

    // ── 过期检查 ──
    if (new Date(record.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Enhancement expired", code: "EXPIRED" }),
        { status: 410 }
      );
    }

    // ── 查积分 + 会员状态 ──
    // ── 查积分 ──
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("id, credits")
      .eq("user_id", user.id)
      .single();

    if (customerError || !customer) {
      console.error("查询 customer 失败:", customerError);
      return new Response(JSON.stringify({ error: "Failed to fetch customer data" }), { status: 500 });
    }

    // ── 查会员状态：subscriptions.customer_id → customers.id，status='active' ──
    const { data: subData } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("customer_id", customer.id)
      .eq("status", "active")
      .maybeSingle();

    const isSubscribed: boolean = !!subData;

    // ── 收费逻辑 ──
    // is_free_trial=true（首次免费生图）→ 下载扣 5 credits，会员免费
    // is_free_trial=false（付费生图）→ 下载免费，已在生图时收过费
    const downloadIsFree = !record.is_free_trial || isSubscribed;

    if (!downloadIsFree) {
      if (customer.credits < COST_PER_DOWNLOAD) {
        return new Response(
          JSON.stringify({ error: "Insufficient credits", code: "INSUFFICIENT_CREDITS" }),
          { status: 402 }
        );
      }

      // 扣积分
      const { error: updateError } = await supabaseAdmin
        .from('customers')
        .update({ credits: customer.credits - COST_PER_DOWNLOAD })
        .eq('id', customer.id);

      if (updateError) {
        console.error("扣费失败:", updateError);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), { status: 500 });
      }

      // 写流水
      await supabaseAdmin.from('credits_history').insert({
        customer_id: customer.id,
        amount: COST_PER_DOWNLOAD,
        type: 'subtract',
        description: 'PhotoDownload',
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
      console.error("Storage download error:", downloadError);
      return new Response(JSON.stringify({ error: "Failed to retrieve photo" }), { status: 500 });
    }

    // ── 标记已下载（首次才更新，之后重复下载不再写 DB） ──
    if (!record.downloaded) {
      await supabaseAdmin
        .from('photo_enhancements')
        .update({ downloaded: true })
        .eq('id', enhancementId);
    }

    // ── 返回文件流 ──
    const arrayBuffer = await fileData.arrayBuffer();
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': record.mime_type,
        'Content-Disposition': `attachment; filename="matchfix-enhanced.png"`,
      },
    });

  } catch (error) {
    const err = error as Error;
    console.error("download error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal Server Error" }),
      { status: 500 }
    );
  }
}