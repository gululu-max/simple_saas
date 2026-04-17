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

// ─── [v2] fix_plan 净化：把高风险枚举值降级为安全值 ─────────────
// 分析 prompt 仍然可能输出 add_rim_light / warm_golden_hour，
// 但这两个值是光晕和假暖色的主要来源，所以在生图前做一层净化。
// 等观察稳定后可以把分析 prompt 里的这两个枚举也删掉。
function sanitizeFixPlan(plan: FixPlan): FixPlan {
  const sanitized = { ...plan };

  if (sanitized.lighting === 'add_rim_light') {
    console.log('🛡️  sanitize: add_rim_light → no_change (光晕风险降级)');
    sanitized.lighting = 'no_change';
  }
  if (sanitized.lighting === 'warm_golden_hour') {
    console.log('🛡️  sanitize: warm_golden_hour → brighten_face (去掉加暖色副作用)');
    sanitized.lighting = 'brighten_face';
  }

  return sanitized;
}

// ─── 调 Gemini 生图 ──────────────────────────────────────────
async function callGeminiImageGeneration(
  imageBase64: string,
  mimeType: string,
  analysisResult?: string,
) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

  // 从分析结果中提取 fix_plan，失败则用保守默认值
  const rawFixPlan = extractFixPlan(analysisResult) ?? DEFAULT_FIX_PLAN;
  // [v2] 净化高风险枚举值
  const fixPlan = sanitizeFixPlan(rawFixPlan);

  const body = {
    contents: [{
      role: "user",
      parts: [
        {
          text: `You are an elite portrait retoucher. Your work should be invisible — viewers should think "great photo," never "edited photo."

══════════════════════════════════════════════
THREE SUPREME RULES — READ BEFORE EVERYTHING ELSE
══════════════════════════════════════════════

RULE 1 — DO LESS WHEN IN DOUBT:
An under-edited photo that looks real ALWAYS beats an over-edited photo that looks fake. If you are unsure whether an edit is needed, DO NOT make it.

RULE 2 — NO ADDED LIGHT, NO ADDED EFFECTS:
Do NOT add ANY visual element that is not present in the original photo. This specifically includes:
- NO lens flare, light rays, or sun glints
- NO bokeh orbs, light balls, or sparkle particles
- NO rim lighting halos or edge glows around the subject
- NO film grain, light leaks, or dreamy haze
- NO vignettes or post-processing overlays
- NO catchlights added to eyes
If the original photo doesn't have it, the output must not have it. Adding light effects is the most common way these edits go wrong — and it is a FAILURE.

RULE 3 — PRESERVE ORIGINAL COLOR:
The output MUST match the original's color temperature, white balance, and palette by default. Do NOT shift warmer, cooler, oranger, or yellower unless fix_plan.color_grade EXPLICITLY specifies a change. Any unwanted color shift is a FAILURE equivalent to altering the subject's face.

══════════════════════════════════════════════
IDENTITY LOCK — HIGHEST PRIORITY
══════════════════════════════════════════════

The following must be PIXEL-LEVEL FAITHFUL to the original:
- Facial bone structure (jawline, cheekbones, forehead shape)
- All facial feature shapes and proportions (eyes, nose, mouth, ears)
- Skin color baseline and undertone
- Body shape and proportions
- Hair style, color, length, and texture
Any deviation from the above is a FAILURE, regardless of how "improved" it may look.

══════════════════════════════════════════════
FIX PLAN (from analysis) — EXECUTE ONLY WHAT IS SPECIFIED
══════════════════════════════════════════════

${JSON.stringify(fixPlan, null, 2)}

EXECUTION RULES:
- If a field value is "no_change" or "none" → DO NOT touch that aspect AT ALL
- If a field has a specific action → execute ONLY that action, conservatively
- Do NOT infer, assume, or add edits beyond what fix_plan specifies

══════════════════════════════════════════════
FIELD-BY-FIELD INSTRUCTIONS
══════════════════════════════════════════════

【FRAMING】
- "no_change" → Do NOT crop, reframe, or adjust composition. Keep exact original framing.
- "crop_chest_up" / "crop_waist_up" → Crop to specified frame. Center subject with slight rule-of-thirds offset. Target 4:5 aspect ratio.
- "zoom_out_slightly" → Add contextual space around subject if image feels too tight.
- If fix_plan says no_change but you think cropping would help: DO NOT CROP. Trust the plan.

【BACKGROUND】
REMINDER: Rule 2 applies — no added light effects, no bokeh orbs, no dreamy glow in any background edit.

- "keep" → Do NOT alter the background in ANY way. No blur, no color shift, no cleanup. Leave it exactly as-is.
- "blur" → Apply subtle, natural depth-of-field blur to the EXISTING background only. The original environment must remain clearly recognizable. Do NOT replace any element. Do NOT add synthetic bokeh balls or light orbs — only an optical-style blur that a real camera aperture would produce.
- "replace_outdoor_park" / "replace_outdoor_street" / "replace_cafe" / "replace_neutral_wall" → Replace the background with the specified environment. The replacement MUST:
  • Match the original photo's focal length and perspective (if the subject was shot on a phone at arm's length, don't make the background look like a 85mm portrait lens)
  • Match the original's lighting direction and time of day (if the subject's face is lit from the left by afternoon sun, the background must also read as afternoon with light from the same direction)
  • Be a photograph-style environment — not a stylized, painted, cinematic, or AI-aesthetic render
  • Contain ordinary, real-world detail (real objects, real textures, real imperfections) — never fantasy elements
  • Have natural depth-of-field softness, not stylized heavy blur
- NEVER replace background unless fix_plan explicitly says "replace_*".

【LIGHTING】
REMINDER: Rule 2 applies — even "brighten_face" must not add light effects, only adjust existing light.

- "no_change" → Do NOT adjust lighting, shadows, or highlights. Do NOT add any light sources. Do NOT warm up or cool down the existing light.
- "brighten_face" → Gently lift shadows on the face only. Preserve the natural light/shadow interplay. Do NOT add warmth, do NOT add rim light, do NOT add glow. This is a shadow-recovery edit, not a lighting-addition edit.
- "soften_shadows" → Reduce harsh shadow contrast on face. Preserve dimensionality. Do NOT change color temperature. Do NOT flatten the face into evenness.
- "add_directional_light" → Very subtly emphasize existing directional light from one side. This is NOT adding a new light source — it is enhancing what's already there. Must match the existing light direction AND color temperature. If there is no existing directional light in the scene, treat this as "no_change".

【SKIN RETOUCH】
- "none" → Do NOT touch skin. No smoothing, no evening, no blemish removal. Leave every pore, line, and mark.
- "minimal_smooth" → Remove ONLY active temporary blemishes (fresh pimples, temporary redness). Keep ALL: pores, fine lines, freckles, moles, scars, natural skin texture. If you cannot see obvious temporary blemishes, do nothing.
- "moderate_smooth_and_even" → Remove temporary blemishes AND gently even out blotchy skin tone. Preserve all permanent skin features and visible texture. Skin must still look like real skin under natural light, not airbrushed.

【EXPRESSION】
- "no_change" → Do NOT alter the expression, mouth, eyes, or any facial muscles.
- "enhance_smile" / "soften_smile" / "add_slight_smile" → Make the MINIMUM adjustment needed. This is the highest-risk edit for breaking identity lock. If the result looks even slightly unnatural, revert to original expression.

【COLOR GRADE】
- "no_change" → Preserve the EXACT original color temperature, white balance, and palette. Do NOT add ANY warmth, coolness, or vibrance. This is the DEFAULT. The output should be indistinguishable from the input in overall color feel.
- "warm_tone" → Shift color temperature by no more than 300K warmer. The change should ONLY be noticeable in direct A/B comparison. Skin tones must NOT appear orange or yellow.
- "cool_tone" → Add very subtle cool shift. Same restraint applies.
- "neutral_balance" → Correct obvious color cast to neutral. Do not over-correct.
- "increase_vibrance" → Gently boost color saturation. Skin tones must remain natural.

【SHARPNESS】
- "no_change" → Do not sharpen.
- "sharpen_face" → Apply gentle sharpening to eyes and facial features only. No halos, no crunchy texture.
- "sharpen_overall" → Gentle global sharpening. Must look natural.

【EYE ENHANCE】
- "no_change" → Do NOT touch the eyes.
- "brighten_eyes" → Very subtly brighten the whites. If the result looks "glowing" or "anime," you've gone too far. Eyes must still read as natural under the scene's lighting.
- "sharpen_eyes" → Add subtle clarity to iris detail only.

══════════════════════════════════════════════
ABSOLUTE PROHIBITIONS — VIOLATION = FAILURE
══════════════════════════════════════════════

1. Do NOT add ANY element not present in the original: no lens flare, no light leaks, no bokeh orbs, no particles, no film grain, no vignette, no glow effects, no halos, no sparkles. This re-states Rule 2 because it is the most common failure mode.
2. Do NOT modify the number or shape of fingers, teeth, or any body parts.
3. Do NOT create symmetry artifacts (perfectly mirrored features that look uncanny).
4. Do NOT produce edge bleeding, texture discontinuity, or melted/warped regions.
5. Do NOT apply any global filter or color LUT — edits must be targeted per fix_plan.
6. Do NOT add makeup, accessories, clothing changes, or tattoos.
7. Do NOT modify body shape, weight, or proportions.
8. Do NOT make skin look plastic, waxy, or artificially smooth.
9. Do NOT produce output at a different resolution than the input (unless framing change is specified).
10. Do NOT add any text, watermark, or overlay to the image.
11. Do NOT shift the overall color temperature or white balance unless fix_plan.color_grade EXPLICITLY requires it.

══════════════════════════════════════════════
OUTPUT QUALITY CHECK — APPLY BEFORE RETURNING
══════════════════════════════════════════════

- Would the subject's close friends immediately recognize this as them? If no → too much editing.
- Does the photo look like it could have been taken by a skilled friend with a good phone? If no → too much editing.
- SCAN THE ENTIRE IMAGE for any light effect, glow, flare, orb, halo, sparkle, or lens artifact. If you find ANY → you have violated Rule 2 → remove it and regenerate.
- Does any area look "digitally painted" rather than "photographed"? If yes → pull back.
- Compare overall color temperature and white balance to the original. If the output is noticeably warmer, yellower, oranger, or cooler without fix_plan.color_grade requesting it → revert the color shift. This check is mandatory.
- Does the background look like a real photograph taken on a real camera, or does it look stylized / AI-generated / "too pretty"? If the latter → redo it with more ordinary, real-world detail.

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

// ─── 判断 fix_plan 是否包含主动色温变更指令 ─────────────────────
// 注意：这里判断的是"净化前"的原始 fix_plan，因为 warm_golden_hour 已经被净化成
// brighten_face（不改色温）。如果用户显式要了 warm_tone/cool_tone 才跳过校色。
function shouldCorrectColor(fixPlan: FixPlan | null): boolean {
  if (!fixPlan) return true;
  const activeColorGrades = ['warm_tone', 'cool_tone'];
  if (activeColorGrades.includes(fixPlan.color_grade)) return false;
  return true;
}

/**
 * 后处理色温校正：将生成图的 RGB 通道均值拉回原图水平
 */
async function correctColorTemperature(
  originalBase64: string,
  generatedBuffer: Buffer,
): Promise<Buffer> {
  const originalBuffer = Buffer.from(originalBase64, 'base64');
  const originalStats = await sharp(originalBuffer).stats();
  const generatedStats = await sharp(generatedBuffer).stats();

  const origR = originalStats.channels[0].mean;
  const origG = originalStats.channels[1].mean;
  const origB = originalStats.channels[2].mean;

  const genR = generatedStats.channels[0].mean;
  const genG = generatedStats.channels[1].mean;
  const genB = generatedStats.channels[2].mean;

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  const scaleR = clamp(origR / (genR || 1), 0.8, 1.2);
  const scaleG = clamp(origG / (genG || 1), 0.8, 1.2);
  const scaleB = clamp(origB / (genB || 1), 0.8, 1.2);

  const maxDrift = Math.max(
    Math.abs(scaleR - 1),
    Math.abs(scaleG - 1),
    Math.abs(scaleB - 1),
  );
  if (maxDrift < 0.02) {
    console.log('🎨 色温偏移 <2%，跳过校色');
    return generatedBuffer;
  }

  console.log(`🎨 色温校正: R×${scaleR.toFixed(3)} G×${scaleG.toFixed(3)} B×${scaleB.toFixed(3)}`);

  const corrected = await sharp(generatedBuffer)
    .recomb([
      [scaleR, 0, 0],
      [0, scaleG, 0],
      [0, 0, scaleB],
    ])
    .toBuffer();
  return Buffer.from(corrected as any);
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

  const wmResult = await sharp(imageBuffer)
    .composite(composites)
    .png()
    .toBuffer();
  return Buffer.from(wmResult as any);
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

    // ── 读用户信息 + 会员状态 ──
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

    // ── 前置收费 ──
    let creditsRemaining = customer.credits;

    if (!isFreeTrial) {
      const actionType = isSubscribed ? 'PhotoEnhance_Member' : 'PhotoEnhance_NonMember';
      const costNeeded = isSubscribed ? 20 : 25;
      console.log('🔍 actionType:', actionType, '| costNeeded:', costNeeded);

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
        .returns<DeductCreditsResult[]>()
        .single();

      if (rpcError) {
        console.error(`扣费RPC失败 (User: ${user.id}):`, rpcError);
        return new Response(
          JSON.stringify({ error: "Failed to deduct credits" }),
          { status: 500 }
        );
      }

      if (!rpcResult.success) {
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

    // ── 后处理色温校正 ──
    const fixPlan = extractFixPlan(analysisResult);
    let correctedBuffer = rawBuffer;

    if (shouldCorrectColor(fixPlan)) {
      try {
        correctedBuffer = Buffer.from(await correctColorTemperature(imageBase64, rawBuffer) as any);
        console.log('🎨 色温校正完成');
      } catch (colorErr) {
        console.error('🎨 色温校正失败，使用原始生成图:', colorErr);
        correctedBuffer = rawBuffer;
      }
    } else {
      console.log('🎨 fix_plan 含主动色温调整，跳过校色');
    }

    const correctedBase64 = correctedBuffer.toString('base64');

    // ── 后端加水印（仅首次免费试用才加水印）──
    let watermarkedBuffer: Buffer | null = null;
    let watermarkedBase64: string | null = null;

    if (isFreeTrial) {
      watermarkedBuffer = await addWatermarkServer(correctedBuffer);
      watermarkedBase64 = watermarkedBuffer.toString('base64');
    }

    // ── 无水印图上传到 Supabase Storage ──
    const storageKey = `${user.id}/${Date.now()}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storageKey, correctedBuffer, {
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
    return new Response(
      JSON.stringify({
        success: true,
        enhancementId: enhRecord.id,
        watermarkedImage: isFreeTrial ? watermarkedBase64 : correctedBase64,
        mimeType: 'image/png',
        creditsRemaining,
        isFreeTrial,
        isSubscribed,
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