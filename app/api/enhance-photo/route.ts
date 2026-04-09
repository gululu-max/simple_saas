import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const BUCKET = 'enhanced-photos';

// ─── Supabase Admin（绕过 RLS，用于写 Storage）───────────────
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

// ─── 预加载水印瓦片（启动时读一次，常驻内存 + 缓存尺寸）──────
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

// ─── 从 analysisResult 中提取 fix_plan ──────────────────────
interface FixPlan {
  background: string;
  lighting: string;
  skin_retouch: string;
  expression: string;
  framing: string;
  color_grade: string;
  sharpness: string;
  eye_enhance: string;
  visual_outcome: string;
}

function extractFixPlan(analysisResult?: string): FixPlan | null {
  if (!analysisResult) return null;
  try {
    const parsed = JSON.parse(analysisResult);
    if (parsed.fix_plan && typeof parsed.fix_plan === 'object') {
      return parsed.fix_plan as FixPlan;
    }
    return null;
  } catch {
    // analysisResult 可能不是纯 JSON，尝试从中提取 JSON 块
    const jsonMatch = analysisResult.match(/\{[\s\S]*"fix_plan"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.fix_plan as FixPlan;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ─── 默认 fix_plan（当解析失败时的兜底）──────────────────────
const DEFAULT_FIX_PLAN: FixPlan = {
  background: "keep",
  lighting: "no_change",
  skin_retouch: "none",
  expression: "no_change",
  framing: "no_change",
  color_grade: "no_change",
  sharpness: "no_change",
  eye_enhance: "no_change",
  visual_outcome: "Minimal touch-up preserving the natural look of the original photo.",
};

// ─── 调 Gemini 生图 ──────────────────────────────────────────
async function callGeminiImageGeneration(
  imageBase64: string,
  mimeType: string,
  analysisResult?: string,
) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

  // 从分析结果中提取 fix_plan，失败则用保守默认值
  const fixPlan = extractFixPlan(analysisResult) ?? DEFAULT_FIX_PLAN;

  const body = {
    contents: [{
      role: "user",
      parts: [
        {
          text: `You are an elite portrait retoucher. Your work should be invisible — viewers should think "great photo," never "edited photo."

SUPREME RULE — READ THIS FIRST:
When in doubt, do less. An under-edited photo that looks real ALWAYS beats an over-edited photo that looks fake. If you are unsure whether an edit is needed, DO NOT make it.

COLOR FIDELITY RULE — EQUAL PRIORITY TO SUPREME RULE:
The output image MUST match the original photo's overall color temperature, white balance, and color palette by default. Do NOT shift colors warmer, cooler, more orange, or more yellow unless fix_plan.color_grade EXPLICITLY specifies a change. Preserve the original's exact color feel. Any unwanted color shift is a FAILURE equivalent to altering the subject's face.

IDENTITY LOCK — HIGHEST PRIORITY:
The following must be PIXEL-LEVEL FAITHFUL to the original:
- Facial bone structure (jawline, cheekbones, forehead shape)
- All facial feature shapes and proportions (eyes, nose, mouth, ears)
- Skin color baseline and undertone
- Body shape and proportions
- Hair style, color, length, and texture
Any deviation from the above is a FAILURE, regardless of how "improved" it may look.

---

FIX PLAN (from analysis):
${JSON.stringify(fixPlan, null, 2)}

EXECUTION RULES:
You must ONLY execute edits specified in the fix_plan above. For every field:
- If the value is "no_change" or "none" → DO NOT touch that aspect AT ALL
- If a field has a specific action → execute ONLY that action, conservatively
- Do NOT infer, assume, or add edits beyond what fix_plan specifies

---

FIELD-BY-FIELD INSTRUCTIONS:

【FRAMING】
- "no_change" → Do NOT crop, reframe, or adjust composition in any way. Keep exact original framing.
- "crop_chest_up" / "crop_waist_up" → Crop to specified frame. Center subject with slight rule-of-thirds offset. Target 4:5 aspect ratio.
- "zoom_out_slightly" → Add contextual space around subject if image feels too tight.
- If fix_plan says no_change but you think cropping would help: DO NOT CROP. Trust the plan.

【BACKGROUND】
- "keep" → Do NOT alter the background in any way. No blur, no color shift, no cleanup. Leave it exactly as-is.
- "blur" → Apply subtle, natural depth-of-field blur to existing background. The original environment must remain clearly recognizable. Do NOT replace any elements.
- "replace_outdoor_park" / "replace_outdoor_street" / "replace_cafe" / "replace_neutral_wall" → Replace background with the specified environment. Must look photorealistic — shot on a real camera, not rendered. No fake bokeh balls, no film grain, no dreamy glow.
- NEVER replace background unless fix_plan explicitly says "replace_*".

【LIGHTING】
- "no_change" → Do NOT adjust lighting, shadows, highlights, or add any light sources. Do NOT warm up or cool down the existing light.
- "brighten_face" → Gently lift shadows on the face only. Do NOT flatten the natural light/shadow interplay. Do NOT add warmth or change color temperature.
- "add_rim_light" → Add a subtle edge light to separate subject from background. Must look like a natural light source, not a studio effect. Match the existing color temperature of the scene.
- "warm_golden_hour" → Add VERY SUBTLE warm-tinted directional light. The color shift should be almost imperceptible — if a viewer would describe the image as "yellow" or "orange," you have FAILED. The result should look like late afternoon sun gently kissing the subject, not an orange filter. Compare your output colors to the input before returning.
- "soften_shadows" → Reduce harsh shadow contrast on face. Preserve dimensionality. Do NOT change color temperature.
- "add_directional_light" → Add soft light from one side to create gentle depth. Must match the existing light direction AND color temperature in the scene.

【SKIN RETOUCH】
- "none" → Do NOT touch skin at all. No smoothing, no evening, no blemish removal. Leave every pore, line, and mark.
- "minimal_smooth" → Remove ONLY active temporary blemishes (fresh pimples, temporary redness). Keep ALL: pores, fine lines, freckles, moles, scars, natural skin texture. If you cannot see obvious temporary blemishes, do nothing.
- "moderate_smooth_and_even" → Remove temporary blemishes AND gently even out blotchy skin tone. Still preserve all permanent skin features and visible texture. The skin must still look like real skin under natural light, not airbrushed.

【EXPRESSION】
- "no_change" → Do NOT alter the expression, mouth, eyes, or any facial muscles in any way.
- "enhance_smile" / "soften_smile" / "add_slight_smile" → Make the MINIMUM adjustment needed. This is the highest-risk edit for breaking identity lock. If the result looks even slightly unnatural, revert to original expression.

【COLOR GRADE】
- "no_change" → Preserve the EXACT original color temperature, white balance, and color palette. Do NOT add ANY warmth, coolness, or vibrance. The output should be indistinguishable from the input in terms of overall color feel. This is the DEFAULT behavior.
- "warm_tone" → Shift color temperature by no more than 300K warmer. The change should ONLY be noticeable in direct A/B comparison. Skin tones must NOT appear orange or yellow. If they do, you have gone too far.
- "cool_tone" → Add very subtle cool shift. Same restraint applies.
- "neutral_balance" → Correct obvious color cast to neutral. Do not over-correct.
- "increase_vibrance" → Gently boost color saturation. Skin tones must remain natural.

【SHARPNESS】
- "no_change" → Do not sharpen.
- "sharpen_face" → Apply gentle sharpening to eyes and facial features only. Must not create halos or crunchy texture.
- "sharpen_overall" → Gentle global sharpening. Must look natural.

【EYE ENHANCE】
- "no_change" → Do NOT touch the eyes in any way.
- "brighten_eyes" → Very subtly brighten the whites. If the result looks "glowing" or "anime," you've gone too far. The eyes must still look like they belong in the lighting conditions of the scene.
- "sharpen_eyes" → Add subtle clarity to iris detail only.

---

ABSOLUTE PROHIBITIONS — VIOLATION OF ANY = FAILURE:
1. Do NOT add ANY element not present in the original photo: no lens flare, no light leaks, no bokeh orbs, no particles, no film grain, no vignette, no glow effects, no catchlights unless eyes are completely dead-black
2. Do NOT modify the number or shape of fingers, teeth, or any body parts
3. Do NOT create symmetry artifacts (perfectly mirrored features that look uncanny)
4. Do NOT produce edge bleeding, texture discontinuity, or melted/warped regions
5. Do NOT apply any global filter or color LUT — edits must be targeted per fix_plan
6. Do NOT add makeup, accessories, clothing changes, or tattoos
7. Do NOT modify body shape, weight, or proportions in any way
8. Do NOT make skin look plastic, waxy, or artificially smooth
9. Do NOT produce output at a different resolution than the input (unless framing change is specified)
10. Do NOT add any text, watermark, or overlay to the image
11. Do NOT shift the overall color temperature or white balance of the image unless fix_plan.color_grade EXPLICITLY requires it. Any unwanted warm/cool/yellow/orange shift is a FAILURE.

OUTPUT QUALITY CHECK (apply before returning):
- Would the subject's close friends immediately recognize this as them? If no → too much editing.
- Does the photo look like it could have been taken by a skilled friend with a good phone? If no → too much editing.
- Can you spot any element that wasn't in the original? If yes → remove it.
- Does any area look "digitally painted" rather than "photographed"? If yes → pull back.
- Compare the overall color temperature and white balance to the original. If the output is noticeably warmer, yellower, oranger, or cooler without fix_plan.color_grade requesting it → you MUST revert the color shift. This check is mandatory.

Return only the enhanced image.`
        },
        { inlineData: { data: imageBase64, mimeType } }
      ]
    }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
  };

  let fetchFn: typeof fetch = fetch;
  if (process.env.NODE_ENV === 'development') {
    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:10808';
    console.log('🚀 Local dev mode: using proxy', proxyUrl);
    const agent = new ProxyAgent(proxyUrl);
    fetchFn = (u: any, opts: any) => undiciFetch(u, { ...opts, dispatcher: agent }) as any;
  }

  const response = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }
  return response.json();
}

// ─── 后端加水印（预制PNG瓦片平铺，不依赖系统字体）──────────────
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

// ─── 主 Handler ──────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType = "image/jpeg", analysisResult } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), { status: 400 });
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

    // ── 读用户信息 + 会员状态（合并为单次查询，省一次 DB round trip）──
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select(`
        id, credits, free_enhance_used,
        subscriptions (status, current_period_end)
      `)
      .eq("user_id", user.id)
      .single();

    if (customerError || !customer) {
      console.error("Supabase Error:", customerError);
      return new Response(JSON.stringify({ error: "Failed to fetch customer data" }), { status: 500 });
    }

    const isFreeTrial = !customer.free_enhance_used;

    // ── 判断会员状态（含 canceled 但仍在有效期内的情况）──
    const now = new Date().toISOString();
    const subs = (customer as any).subscriptions as any[] | null;
    const subData = subs?.find((s: any) =>
      s.status === 'active' ||
      (s.status === 'canceled' && s.current_period_end && s.current_period_end > now)
    ) ?? null;

    const isSubscribed = !!subData;
    console.log('🔍 user.id:', user.id);
    console.log('🔍 customer.id:', customer.id);
    console.log('🔍 subData:', JSON.stringify(subData));
    console.log('🔍 isSubscribed:', isSubscribed);

    // ── 前置收费（非首次免费才收费）──
    // 会员扣 20 credits，非会员扣 25 credits（含无水印下载）
    let creditsRemaining = customer.credits;

    if (!isFreeTrial) {
      const actionType = isSubscribed ? 'PhotoEnhance_Member' : 'PhotoEnhance_NonMember';
      const costNeeded = isSubscribed ? 20 : 25;
      console.log('🔍 actionType:', actionType, '| costNeeded:', costNeeded);

      // 快速失败：前端友好提示
      if (customer.credits < costNeeded) {
        return new Response(
          JSON.stringify({
            error: "Insufficient credits",
            code: "INSUFFICIENT_CREDITS",
            needed: costNeeded,
            current: customer.credits,
            isSubscribed,
          }),
          { status: 402, headers: { "Content-Type": "application/json" } }
        );
      }

      // ── 原子扣积分（RPC，防止并发超扣）──
      const { data: rpcResult, error: rpcError } = await supabaseAdmin
        .rpc('deduct_credits', {
          p_user_id: user.id,
          p_amount: costNeeded,
          p_description: actionType,
          p_metadata: {
            source: 'system_deduction',
            action: actionType,
          },
        })
        .returns<DeductCreditsResult[]>()  // ← 加这行
        .single();

      if (rpcError) {
        console.error(`扣费RPC失败 (User: ${user.id}):`, rpcError);
        return new Response(
          JSON.stringify({ error: "Failed to deduct credits" }),
          { status: 500 }
        );
      }

      if (!rpcResult.success) {
        // 并发场景：前面检查时够，RPC 执行时已被别的请求扣完
        return new Response(
          JSON.stringify({
            error: "Insufficient credits",
            code: "INSUFFICIENT_CREDITS",
            needed: costNeeded,
            current: 0,
            isSubscribed,
          }),
          { status: 402, headers: { "Content-Type": "application/json" } }
        );
      }

      creditsRemaining = rpcResult.remaining;
    }

    // ── 调 Gemini 生图 ──
    let geminiResult;
    try {
      geminiResult = await callGeminiImageGeneration(imageBase64, mimeType, analysisResult);
    } catch (geminiError) {
      // 生图失败时，如果已扣费，需要退回积分（非免费试用时）
      if (!isFreeTrial) {
        const refundAmount = isSubscribed ? 20 : 25;
        try {
          // 退款：直接加回积分 + 写流水
          await supabaseAdmin
            .from('customers')
            .update({ credits: creditsRemaining + refundAmount })
            .eq('user_id', user.id);

          await supabaseAdmin.from('credits_history').insert({
            customer_id: customer.id,
            amount: refundAmount,
            type: 'add',
            description: 'Refund: AI generation failed',
            metadata: {
              source: 'system_refund',
              action: 'refund_generation_failed',
            },
          });

          creditsRemaining += refundAmount;
          console.log(`退款成功: ${refundAmount} credits refunded to user ${user.id}`);
        } catch (refundErr) {
          console.error(`退款失败 (User: ${user.id}):`, refundErr);
        }
      }
      throw geminiError;
    }

    const parts = geminiResult.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData);

    if (!imagePart?.inlineData) {
      // 同样退款
      if (!isFreeTrial) {
        const refundAmount = isSubscribed ? 20 : 25;
        try {
          await supabaseAdmin
            .from('customers')
            .update({ credits: creditsRemaining + refundAmount })
            .eq('user_id', user.id);

          await supabaseAdmin.from('credits_history').insert({
            customer_id: customer.id,
            amount: refundAmount,
            type: 'add',
            description: 'Refund: No image returned',
            metadata: {
              source: 'system_refund',
              action: 'refund_no_image',
            },
          });

          creditsRemaining += refundAmount;
        } catch (refundErr) {
          console.error(`退款失败 (User: ${user.id}):`, refundErr);
        }
      }
      return new Response(JSON.stringify({ error: "No image returned from AI" }), { status: 500 });
    }

    const cleanMime: string = imagePart.inlineData.mimeType ?? "image/png";
    const rawBase64: string = imagePart.inlineData.data;
    const rawBuffer = Buffer.from(rawBase64, 'base64');

    // ── 后端加水印（仅首次免费试用才加水印）──
    // 付费用户已前置付费，直接给无水印图
    let watermarkedBuffer: Buffer | null = null;
    let watermarkedBase64: string | null = null;

    if (isFreeTrial) {
      watermarkedBuffer = await addWatermarkServer(rawBuffer);
      watermarkedBase64 = watermarkedBuffer.toString('base64');
    }

    // ── 无水印图上传到 Supabase Storage ──
    const storageKey = `${user.id}/${Date.now()}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storageKey, rawBuffer, {
        contentType: cleanMime,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to store enhanced photo" }), { status: 500 });
    }

    // ── 写 photo_enhancements 记录 ──
    const { data: enhRecord, error: dbError } = await supabaseAdmin
      .from('photo_enhancements')
      .insert({
        user_id: user.id,
        storage_key: storageKey,
        mime_type: cleanMime,
        is_free_trial: isFreeTrial,
        downloaded: false,
      })
      .select('id')
      .single();

    if (dbError || !enhRecord) {
      await supabaseAdmin.storage.from(BUCKET).remove([storageKey]);
      console.error("DB insert error:", dbError);
      return new Response(JSON.stringify({ error: "Failed to record enhancement" }), { status: 500 });
    }

    // ── 首次免费：只改状态 ──
    if (isFreeTrial) {
      await supabase
        .from("customers")
        .update({ free_enhance_used: true })
        .eq("user_id", user.id);
    }

    // ── 返回结果 ──
    // 首次免费 → 返回水印图 + enhancementId（下载时再收费）
    // 付费用户 → 返回无水印图（已前置收费，下载免费）
    return new Response(
      JSON.stringify({
        success: true,
        enhancementId: enhRecord.id,
        // 首次免费返回水印图，付费用户返回无水印原图
        watermarkedImage: isFreeTrial ? watermarkedBase64 : rawBase64,
        mimeType: 'image/png',
        creditsRemaining,
        isFreeTrial,
        isSubscribed,
        // 告诉前端：付费用户的图已经是无水印的，不需要再走下载付费流程
        downloadFree: !isFreeTrial,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    const err = error as Error;
    console.error("enhance-photo error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}