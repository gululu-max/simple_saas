// app/api/my-photos/route.ts
// ═══════════════════════════════════════════════════════════════
// GET /api/my-photos — 登录用户的「相册」数据源。
//
// 返回该用户所有 photo_enhancements（最新在前），每条带：
//   - enhancedPreviewUrl: 现有 /api/download/[id]?watermarked=1（免费带水印预览）
//   - originalUrl: original-photos bucket 的短期 signed URL（用于「按住看原图」对比）
//   - unlocked: 是否已解锁清晰图（已下载 或 订阅中）
//
// ?count=1 → 只返回 { count }，给顶 bar 角标用（不签 URL，便宜）。
//
// 数据已存数据库（photo_enhancements），无需 localStorage。
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const ORIGINAL_BUCKET = "original-photos";
const SIGNED_URL_TTL = 60 * 60; // 1h

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// matched_scene_id ("outdoor_park") → 友好 look 标签 ("Outdoor Park")，
// 拿不到就回退 "Look N"。
function lookLabel(matchedSceneId: string | null, variantIndex: number | null): string {
  if (matchedSceneId && matchedSceneId.trim()) {
    return matchedSceneId
      .replace(/[_-]+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return `Look ${(variantIndex ?? 0) + 1}`;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const nowIso = new Date().toISOString();

    // ── 轻量计数模式（顶 bar 角标用）──
    if (url.searchParams.get("count") === "1") {
      const { count } = await supabaseAdmin
        .from("photo_enhancements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
      return NextResponse.json({ count: count ?? 0 });
    }

    // ── 列表 ──
    const { data: rows, error } = await supabaseAdmin
      .from("photo_enhancements")
      .select(
        "id, group_id, variant_index, matched_scene_id, match_score, mime_type, downloaded, created_at, original_storage_key, is_free_trial, expires_at",
      )
      .eq("user_id", user.id)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .order("variant_index", { ascending: true });

    if (error) {
      console.error("[my-photos] list failed:", error.message);
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }

    // ── 订阅状态（决定 unlocked）──
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select(`id, subscriptions (status, current_period_end)`)
      .eq("user_id", user.id)
      .single();
    const sub = (customer as any)?.subscriptions?.[0] ?? null;
    const isSubscribed =
      !!sub &&
      (sub.status === "active" ||
        (sub.status === "canceled" &&
          !!sub.current_period_end &&
          sub.current_period_end > nowIso));

    const photos = await Promise.all(
      (rows ?? []).map(async (r) => {
        let originalUrl: string | null = null;
        if (r.original_storage_key) {
          const { data: signed } = await supabaseAdmin.storage
            .from(ORIGINAL_BUCKET)
            .createSignedUrl(r.original_storage_key, SIGNED_URL_TTL);
          originalUrl = signed?.signedUrl ?? null;
        }
        return {
          id: r.id as string,
          groupId: (r.group_id as string) ?? null,
          look: lookLabel(r.matched_scene_id as string | null, r.variant_index as number | null),
          score: (r.match_score as number | null) ?? null,
          variantIndex: (r.variant_index as number | null) ?? 0,
          createdAt: r.created_at as string,
          mimeType: (r.mime_type as string) ?? "image/png",
          downloaded: !!r.downloaded,
          unlocked: isSubscribed || !!r.downloaded,
          enhancedPreviewUrl: `/api/download/${r.id}?watermarked=1`,
          originalUrl,
        };
      }),
    );

    return NextResponse.json({ photos });
  } catch (err) {
    console.error("[my-photos] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
