import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { randomUUID } from 'crypto';
// [RESTORED 2026-05-29 — login revert] createClient (server) 给登录用户读 session。
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

import type { SceneTags } from '@/app/api/scanner/tag-prompt';
import { loadSceneLibrary, loadSceneImage } from './scene-utils';
import { matchScenesForPhotos, type SceneEntry, type MatchResult } from './match-scene';
import { classifyUpstreamError, classifyGeminiNoImage } from '@/lib/upstream-errors';

const ENHANCED_BUCKET = 'enhanced-photos';
const ORIGINAL_BUCKET = 'original-photos';

// ─── Unified pricing (X plan) ────────────────────────────────────
// Both retouch and fusion cost the same. Simpler, and fusion (3 variants)
// will use the same cost once 3-variant mode is enabled.
const COST_SUBSCRIBED = 25;
const COST_NON_SUBSCRIBED = 40;

// Emergency rollback: if true, ALL enhance requests are routed to the
// retouch path regardless of requested mode. Use when fusion is globally
// broken; flip back off once recovered.
const FORCE_RETOUCH_MODE = process.env.FORCE_RETOUCH_MODE === 'true';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RefundCreditsResult {
  success: boolean;
  remaining: number;
  customer_id: string;
}

interface DeductCreditsResult {
  success: boolean;
  remaining: number;
  customer_id: string;
}

// ─── Scan loader ─────────────────────────────────────────────────
// Loads a photo_scans row and its original image buffer. Verifies
// paid status and expiration. Returns null if anything is wrong so
// the caller can fall back to legacy body params.
//
// [no-login pivot 2026-05-17] 旧版 user_id 校验已停用，改成 paid 校验。
// 鉴权语义变了：访客无 user_id，"我有权 enhance 这个 scan" = "这个 scan
// 的 paid=true"。旧的 userId 参数保留但忽略（只为兼容签名），未来恢复
// 登录时把下面 paid 检查改成 paid OR user_id 匹配即可。
interface LoadedScan {
  // [multi-photo 2026-05-18] imageBase64 = 用户上传的主图 (index 0)
  // imageBase64s = 全部 1-3 张原图（按上传顺序），含主图
  // [N→N 2026-05-19] originalKeys = 与 imageBase64s 同序的 storage keys
  imageBase64: string;
  imageBase64s: string[];
  originalKeys: string[];
  mimeType: string;
  analysisResultString: string | null;
}

async function loadScanById(
  scanId: string,
  userId: string | null,
): Promise<LoadedScan | null> {
  const { data: scan, error } = await supabaseAdmin
    .from('photo_scans')
    .select('id, user_id, paid, original_storage_key, original_storage_keys, mime_type, analysis_json, scene_tags, expires_at')
    .eq('id', scanId)
    .maybeSingle();

  if (error) {
    console.error('[enhance] scan lookup failed:', error.message);
    return null;
  }
  if (!scan) {
    console.warn(`[enhance] scan ${scanId} not found`);
    return null;
  }
  // [RESTORED 2026-05-29 — login revert] user_id 归属校验取代 paid 校验。
  if (scan.user_id !== userId) {
    console.warn(`[enhance] scan ${scanId} owner mismatch (scan=${scan.user_id}, req=${userId})`);
    return null;
  }
  if (scan.expires_at && new Date(scan.expires_at).getTime() < Date.now()) {
    console.warn(`[enhance] scan ${scanId} expired at ${scan.expires_at}`);
    return null;
  }

  // [multi-photo] 优先用 original_storage_keys (数组)，没有就回退到单 key
  let keys: string[] = Array.isArray(scan.original_storage_keys)
    ? (scan.original_storage_keys as string[]).filter(Boolean)
    : [];
  if (keys.length === 0 && scan.original_storage_key) {
    keys = [scan.original_storage_key];
  }
  if (keys.length === 0) {
    console.warn(`[enhance] scan ${scanId} has no original keys`);
    return null;
  }

  // 并行下载所有原图（保持 key↔base64 对齐，失败的整对剔除）
  const downloads = await Promise.all(
    keys.map(async (key) => {
      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from(ORIGINAL_BUCKET)
        .download(key);
      if (dlErr || !blob) {
        console.warn(`[enhance] download failed for ${key}:`, dlErr?.message);
        return null;
      }
      const ab = await blob.arrayBuffer();
      return { key, b64: Buffer.from(ab).toString('base64') };
    }),
  );
  const okPairs = downloads.filter((d): d is { key: string; b64: string } => d !== null);
  if (okPairs.length === 0) {
    console.error(`[enhance] all originals failed to download for scan ${scanId}`);
    return null;
  }
  const imageBase64s = okPairs.map(p => p.b64);
  const originalKeys = okPairs.map(p => p.key);

  // Reconstruct analysisResult string (extractors expect string input)
  let analysisResultString: string | null = null;
  if (scan.analysis_json) {
    const merged = { ...(scan.analysis_json as object) };
    if (scan.scene_tags) {
      (merged as any).scene_tags = scan.scene_tags;
    }
    analysisResultString = JSON.stringify(merged);
  }

  return {
    imageBase64: imageBase64s[0],
    imageBase64s,
    originalKeys,
    mimeType: scan.mime_type || 'image/jpeg',
    analysisResultString,
  };
}

// ─── 水印瓦片 ─────────────────────────────────────────────
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

// ─── fix_plan 相关 ────────────────────────────────────────
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
    const jsonMatch = analysisResult.match(/\{[\s\S]*"fix_plan"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.fix_plan as FixPlan;
      } catch { return null; }
    }
    return null;
  }
}

// ─── 从 analysisResult 里提取 tags ────────────────────────
function extractSceneTags(analysisResult?: string): SceneTags | null {
  if (!analysisResult) return null;
  try {
    const parsed = JSON.parse(analysisResult);
    if (parsed.scene_tags && typeof parsed.scene_tags === 'object') {
      return parsed.scene_tags as SceneTags;
    }
    return null;
  } catch { return null; }
}

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

function sanitizeFixPlan(plan: FixPlan): FixPlan {
  const sanitized = { ...plan };
  if (sanitized.lighting === 'add_rim_light') {
    console.log('🛡️  sanitize: add_rim_light → no_change');
    sanitized.lighting = 'no_change';
  }
  if (sanitized.lighting === 'warm_golden_hour') {
    console.log('🛡️  sanitize: warm_golden_hour → brighten_face');
    sanitized.lighting = 'brighten_face';
  }
  return sanitized;
}

// ═══════════════════════════════════════════════════════════
// 现有 retouch prompt（保持原样，仅在 useFusion=false 时使用）
// ═══════════════════════════════════════════════════════════
function buildRetouchPrompt(fixPlan: FixPlan): string {
  return `You are an elite portrait retoucher RETOUCHING an existing DATING PROFILE photo. You are NOT creating a new portrait — you are adjusting the pixels that are already there. Think Lightroom/Photoshop on the original file: tonal and local corrections layered on top of the real photo, never a repaint. Goal: the same photo, looking like it was shot on a great day in good light — clearly more polished, but unmistakably the SAME person and a real, un-filtered photograph.

══════════════════════════════════════════════
EDIT IN PLACE — DO NOT REPAINT THE FACE (this is the #1 rule)
══════════════════════════════════════════════

PRESERVE THE ORIGINAL FACE PIXELS. Do NOT regenerate, redraw, or "re-imagine" the face. Treat the face as locked reference geometry and only push tone, light, color, and clarity on top of the existing pixels. The single most common failure here is the output looking like a DIFFERENT person — that is a TOTAL FAILURE, worse than doing nothing.

Keep these EXACT and pixel-faithful to the original:
- Facial bone structure and proportions: jawline, cheekbones, chin, forehead, overall face width and length
- The exact shape, size, position, and spacing of every feature: eyes, eyebrows, nose, lips, ears
- Underlying skin color, undertone, and ethnicity
- Natural hair color, hairline, and hair length
- Body shape and every clothing item

Do NOT slim or reshape the face/jaw, enlarge or reposition the eyes, shrink the nose, alter lip shape, smooth away identifying features, or apply ANY "beauty-filter" geometry. When attractiveness and identity conflict, IDENTITY WINS every time. The test: someone who knows this person must say "great photo of them" — never "is that really them?" If in doubt about a face edit, don't make it.

══════════════════════════════════════════════
FLATTERING PASS — ALWAYS APPLY (local, on top of the original)
══════════════════════════════════════════════

Apply the subtle, universally-flattering corrections a professional does on every portrait — as local adjustments to the EXISTING pixels, never by redrawing. Enough to clearly lift the photo, never enough to change who it is:
- Lighting: even out and gently lift shadows on the face so features read clearly and skin looks healthy; balanced, natural exposure. No new or colored light sources, no relighting that reshapes the face.
- Skin: remove only temporary blemishes (spots, shine, stray hairs). KEEP all pores, texture, freckles, moles, and natural lines — absolutely no plastic or airbrushed skin.
- Eyes: subtly brighten and add natural catchlight clarity; keep their exact shape and real color. Stop well before any "glow."
- Color & tone: clean, healthy, natural white balance with gentle contrast and vibrance for a polished finish. Preserve the original color temperature.
- Sharpness: crisp, clear focus on the eyes and face. No halos, no global over-sharpening.
- Believability: a great shot of THIS person in good light — not a different photo and not a different face.

══════════════════════════════════════════════
FIXPLAN — TARGETED ADJUSTMENTS (stronger, only where flagged)
══════════════════════════════════════════════

${buildActiveFixPlanLines(fixPlan)}

${fixPlan.background === 'blur' ? '- Background: apply subtle depth-of-field softening to the existing background; do NOT replace it.\n' : ''}${fixPlan.background?.startsWith('replace_') ? `- Background: replace with ${fixPlan.background.slice('replace_'.length).replace(/_/g, ' ')}. Match the original photo's focal length, light direction, and time of day.\n` : ''}${fixPlan.framing === 'crop_chest_up' ? '- Framing: crop to chest-up.\n' : ''}${fixPlan.framing === 'crop_waist_up' ? '- Framing: crop to waist-up.\n' : ''}${fixPlan.framing === 'zoom_out_slightly' ? '- Framing: zoom out slightly (extend canvas naturally).\n' : ''}
These intensify the baseline pass for the listed dimensions only. Anything not listed gets the baseline pass and nothing more.

══════════════════════════════════════════════
PROHIBITIONS
══════════════════════════════════════════════

No change to facial geometry, feature shapes, body shape, ethnicity, age, or hair color. No beauty-filter slimming, eye-enlarging, or skin-plastic effects. No added makeup, accessories, tattoos, or teeth veneers. No lens flare, glow, halos, bokeh orbs, film grain, or heavy vignettes. No finger/teeth anomalies, symmetry artifacts, or edge bleeding. No background replacement unless FIXPLAN says so. No text/watermark/logo overlay. The output must read as a real, un-filtered phone/camera photograph.

Return only the enhanced image.`;
}

// ═══════════════════════════════════════════════════════════
// 融合 prompt
//
// Inputs to Gemini (order MUST match prompt indices):
//   IMAGE 1 = user photo (PERSON)
//   IMAGE 2 = scene photo (SCENE)
//
// Active fixPlan overrides are listed at the top so they take precedence
// over generic rules. "no_change"/"none" fields are omitted entirely.
// ═══════════════════════════════════════════════════════════
function buildFusionPrompt(userTags: SceneTags, scene: SceneEntry, fixPlan: FixPlan): string {
  const teethSection = (userTags.visible_body === 'face_only' || userTags.visible_body === 'upper_chest')
    ? `══════════════════════════════════════════════
TEETH (only if visible)
══════════════════════════════════════════════

If teeth are visible in IMAGE 1, gently brighten them to a natural off-white. Subtle only — "healthy teeth," not "veneers." If no teeth are visible, skip this entirely.

`
    : '';

  return `You are an elite portrait photographer reshooting a scene. You will receive TWO images and must produce ONE output.

══════════════════════════════════════════════
IMAGE ROLES — STRICT
══════════════════════════════════════════════

IMAGE 1 (first attached image) = PERSON. FACE reference — use IMAGE 1 to lock the facial identity (features, bone structure, skin undertone, hair color). Clothing / pose / accessories in IMAGE 1 are just context; you are free to restyle them for the scene.
IMAGE 2 (second attached image) = SCENE. Target environment. The output should feel like it was shot in this location, with the person dressed and posed appropriately for it.

There are exactly TWO input images. If you perceive more, you have miscounted — re-read.

══════════════════════════════════════════════
ABSOLUTE RULES
══════════════════════════════════════════════

R1. The PERSON from IMAGE 1 MUST appear in the output. A background-only output (IMAGE 2 with no person) is a TOTAL FAILURE. This holds regardless of whether IMAGE 1's face is sharp, blurred, in shadow, side-profile, or turned away.

R2. PRESERVE IMAGE 1's VISIBLE EXTENT exactly:
  - face_only → output shows head and shoulders only
  - upper_chest → output shows chest up
  - waist_up → output shows waist up
  - full_body → output may show full body
  IMAGE 1 here shows: ${userTags.visible_body.toUpperCase()}.
  Inventing body parts that weren't in IMAGE 1 is a SEVERE FAILURE. If IMAGE 2 normally requires a different framing (e.g. seated furniture but IMAGE 1 is face_only), the PERSON WINS — crop or reframe IMAGE 2 to fit.

R3. PRESERVE IMAGE 1's FACE ANGLE. If IMAGE 1 shows the back, a profile, or a turned-away angle, do NOT invent a front-facing face.

══════════════════════════════════════════════
CORE PRINCIPLE — FACE IS LOCKED, EVERYTHING ELSE ADAPTS
══════════════════════════════════════════════

You are NOT pasting IMAGE 1 onto IMAGE 2. You are RE-PHOTOGRAPHING the person as if they had walked into IMAGE 2's environment and the photographer took a new picture there. Treat IMAGE 1 as a FACE REFERENCE, not a literal template — the rest of the look should adapt to fit the scene like a stylist made appropriate choices.

LOCKED — must survive unchanged (these are inviolable):
- Facial bone structure and feature shapes (eyes / nose / mouth / ears / jawline / forehead)
- Underlying skin color and undertone — adapt to scene lighting only, do NOT change ethnicity
- Approximate age and overall body type
- Natural hair color

FREE — adapt to the scene with photographic judgment:
- Pose, body orientation, head tilt, gaze direction
- Arm / hand positions and gestures
- Clothing — choose an outfit that fits the scene's formality, season, and activity. Do NOT feel obligated to recreate what IMAGE 1 wears.
- Accessories — sunglasses (outdoor / sunlit scenes), hat, scarf, jewelry, watch, bag, etc. — add or omit as the scene calls for
- Subtle expression adjustment to match the scene's mood
- Hairstyle (length within reason, parting, up vs. down) — but keep the natural hair color from IMAGE 1

CORE TEST: someone who knows this person should still recognize them instantly from their FACE alone. The clothing, pose, and styling can be entirely scene-driven — that's the whole point.

══════════════════════════════════════════════
SCENE COMPATIBILITY DATA
══════════════════════════════════════════════

User photo tags: visible_body=${userTags.visible_body}, color_temperature=${userTags.color_temperature}, light_direction=${userTags.light_direction}, light_intensity=${userTags.light_intensity}.

Target scene: color_temperature=${scene.color_temperature}, light_direction=${scene.light_direction}, light_intensity=${scene.light_intensity}, background_complexity=${scene.background_complexity}, subject_slot=${scene.subject_slot}, recommended_person_size=${scene.recommended_person_size}, person_scale_reference=${scene.person_scale_reference}.

══════════════════════════════════════════════
COMPOSITION — WHERE TO PLACE THE PERSON
══════════════════════════════════════════════

${getSubjectSlotGuidance(scene.subject_slot)}

The person should occupy approximately ${getSizeGuidance(scene.recommended_person_size)} of the frame height. ${scene.person_scale_reference === 'no_reference'
      ? 'This scene has no clear scale reference — use best judgment for natural size.'
      : 'This scene has scale references (furniture / doorways / etc.) — use them to verify proportional correctness.'}

Scale anchors when references are present:
- Standard chair seat: ~45cm high; seated adult's shoulders reach chair backrest top
- Standard doorway: ~200cm tall; standing adult's head reaches ~85-90% of doorway height
- Standard cafe table: ~75cm high; seated adult's arms rest on table surface
- Adult head height ≈ 1/7 to 1/8 of total standing body height

${getPartialViewInstructions(userTags.visible_body)}

══════════════════════════════════════════════
LIGHTING AND COLOR
══════════════════════════════════════════════

IMAGE 2's main light direction is ${scene.light_direction.toUpperCase()}. Re-light the person to match:
${getLightDirectionGuidance(scene.light_direction)}

IMAGE 2's light intensity is ${scene.light_intensity.toUpperCase()}.
${getLightIntensityGuidance(scene.light_intensity)}

IMAGE 2's color temperature is ${scene.color_temperature.toUpperCase()}. Bias the SKIN TONES accordingly:
${getColorTemperatureGuidance(scene.color_temperature)}

IDENTITY OVERRIDE: the bias above is for skin tone realism in the new light, NOT for changing the person's underlying skin color or undertone from IMAGE 1. Preserve the person's actual ethnicity and undertone; only adjust how that skin reads under the new light.

Shadows on the person must fall in the same direction as shadows on objects in IMAGE 2.

══════════════════════════════════════════════
BACKGROUND TREATMENT
══════════════════════════════════════════════

Background complexity in IMAGE 2 is ${scene.background_complexity.toUpperCase()}.
${getBackgroundComplexityGuidance(scene.background_complexity)}

Keep IMAGE 2's environment clearly recognizable. Apply only slight, camera-natural depth-of-field softness — NOT heavy artistic blur.

══════════════════════════════════════════════
TEXTURE CONSISTENCY
══════════════════════════════════════════════

IMAGE 2 is likely a professional photograph; IMAGE 1 is a casual smartphone photo. Unify the textures toward the SMARTPHONE end so the person doesn't look "pasted on":
- Soften IMAGE 2's professional sharpness and DOF drama toward a phone-camera look
- Reduce IMAGE 2's highlight/shadow contrast range (phones have narrower dynamic range)
- Match subtle grain/noise across the whole frame
- Aim for "nice casual snapshot," not "magazine shoot"

${teethSection}══════════════════════════════════════════════
FIXPLAN OVERRIDES (active edits only)
══════════════════════════════════════════════

${buildActiveFixPlanLines(fixPlan)}

These FIXPLAN overrides take precedence over generic rules above. If FIXPLAN explicitly enables an edit (e.g. brighten_eyes), apply it conservatively — but do not let the generic "no added effects" lines block it.

══════════════════════════════════════════════
PROHIBITIONS
══════════════════════════════════════════════

- Do NOT output IMAGE 2 alone with no person from IMAGE 1.
- Do NOT alter the person's facial features, bone structure, or underlying skin tone (light-adapt only).
- Do NOT change ethnicity, approximate age, overall body type, or natural hair color.
- Do NOT invent a face if IMAGE 1 shows the back/side/turned-away — keep that exact angle.
- Do NOT invent body parts beyond IMAGE 1's visible extent (see framing rules above).
- Do NOT add lens flare, bokeh orbs, light leaks, film grain, or vignettes (these are post-processing effects, not styling — clothing/accessory choices are fine).
- Do NOT produce compositing artifacts (edge halos, scale mismatches, floating subjects).
- Do NOT add any other person, silhouette, or figure.
- Do NOT add text, watermark, logo, or overlay.
- Do NOT stylize as illustration / cartoon / painting / anime — output must read as a real phone camera photograph.

══════════════════════════════════════════════
FINAL CHECK
══════════════════════════════════════════════

1. Person from IMAGE 1 visible? (background-only = REDO)
2. FACIAL identity preserved? (features, bone structure, skin undertone, hair color — face is locked)
3. Face angle matches IMAGE 1 (no invented front face if IMAGE 1 was profile/back)?
4. Framing matches ${userTags.visible_body} (no invented body parts)?
5. Person placed per subject_slot=${scene.subject_slot}?
6. Person size matches recommended_person_size=${scene.recommended_person_size}?
7. Lighting direction and intensity match IMAGE 2?
8. Clothing / accessories / pose feel scene-appropriate (not a stiff IMAGE 1 paste)?
9. Looks like ONE phone photograph, not a collage or magazine shoot?

Return only the final image.`;
}

// ─── Helper: emit only the active (non-default) fix_plan items ────
// Returns natural-language bullets for edits that actually need to happen.
// "no_change" / "none" / "keep" → omitted entirely. If nothing is active,
// returns a single line saying so, so the section isn't empty.
function buildActiveFixPlanLines(fixPlan: FixPlan): string {
  const lines: string[] = [];
  if (fixPlan.skin_retouch === 'minimal_smooth') {
    lines.push('- Skin: remove only active blemishes; keep all pore texture and natural skin character.');
  } else if (fixPlan.skin_retouch === 'moderate_smooth_and_even') {
    lines.push('- Skin: remove blemishes and gently even skin tone; preserve pores and texture (no plastic skin).');
  }
  if (fixPlan.expression === 'enhance_smile') {
    lines.push('- Expression: very subtly enhance the smile. If result looks forced or unnatural, REVERT to original expression.');
  } else if (fixPlan.expression === 'soften_smile') {
    lines.push('- Expression: very subtly soften an over-wide smile.');
  } else if (fixPlan.expression === 'add_slight_smile') {
    lines.push('- Expression: add the slightest hint of a closed-mouth smile. Stop the moment it looks forced.');
  }
  if (fixPlan.sharpness === 'sharpen_face') {
    lines.push('- Sharpness: subtle sharpening of eyes and key facial features only — not the whole frame.');
  } else if (fixPlan.sharpness === 'sharpen_overall') {
    lines.push('- Sharpness: light overall sharpening; do not introduce halos.');
  }
  if (fixPlan.eye_enhance === 'brighten_eyes') {
    lines.push('- Eyes: very subtly brighten the whites. Stop well before any "glow" appearance.');
  } else if (fixPlan.eye_enhance === 'sharpen_eyes') {
    lines.push('- Eyes: subtle sharpening of iris detail only.');
  }
  if (fixPlan.color_grade === 'warm_tone') {
    lines.push('- Color grade: shift the OUTPUT toward warmer tones (≤300K). This OVERRIDES the scene\'s native color bias.');
  } else if (fixPlan.color_grade === 'cool_tone') {
    lines.push('- Color grade: shift the OUTPUT toward cooler tones (≤300K). This OVERRIDES the scene\'s native color bias.');
  } else if (fixPlan.color_grade === 'increase_vibrance') {
    lines.push('- Color grade: lightly increase vibrance; do not oversaturate skin.');
  }
  if (fixPlan.lighting === 'brighten_face') {
    lines.push('- Lighting: lift face shadows only. Do NOT add warmth or new light sources.');
  } else if (fixPlan.lighting === 'soften_shadows') {
    lines.push('- Lighting: reduce face/skin contrast; gentler shadow falloff.');
  } else if (fixPlan.lighting === 'add_directional_light') {
    lines.push('- Lighting: add a single soft directional light consistent with the scene\'s light_direction.');
  }
  if (lines.length === 0) {
    return '(no active fixPlan edits — use only the generic rules above)';
  }
  return lines.join('\n');
}

function getPartialViewInstructions(visibleBody: string): string {
  const map: Record<string, string> = {
    face_only: `THE USER PHOTO (IMAGE 1) SHOWS ONLY HEAD AND SHOULDERS.

HARD RULES — VIOLATING ANY OF THESE IS A FAILURE:
- DO NOT generate a torso, arms, hands, waist, hips, legs, or feet that don't exist in IMAGE 1
- DO NOT invent body parts to "complete" the person — if IMAGE 1 shows head only, output shows head only
- The PERSON from IMAGE 1 is MANDATORY in the output. Preserve their exact head/shoulder visibility — whether the face is fully visible, in profile, turned away, or partially obscured. A background-only result with no person is a TOTAL FAILURE.
- DO NOT invent a face if IMAGE 1 shows the back of the head or a side profile — keep that exact angle

SCENE CONFLICT HANDLING:
If IMAGE 2 shows chairs, sofas, tables, or other furniture that would normally require a seated/full body:
→ CROP IMAGE 2 TIGHTLY. Show only the upper portion (the area behind the person's head and shoulders).
→ The furniture should be BEHIND and AROUND the person's head — it should NOT force you to invent a seated body.
→ Treat IMAGE 2 as a backdrop, not as a scene the person must physically fit into.

Frame the output as a head-and-shoulders portrait. Background from IMAGE 2 sits behind the head.`,

    upper_chest: `THE USER PHOTO (IMAGE 1) SHOWS THE PERSON FROM THE CHEST UP.

HARD RULES — VIOLATING ANY OF THESE IS A FAILURE:
- DO NOT generate the waist, hips, legs, feet, or lower body
- DO NOT invent arms, hands, or body parts in positions that don't exist in IMAGE 1
- DO NOT invent a seated pose, leg-crossing pose, or any lower-body posture
- The PERSON from IMAGE 1 is MANDATORY in the output. Whatever face angle IMAGE 1 shows (front, profile, three-quarter, turned away, blurred) — preserve it exactly. A background-only result with no person is a TOTAL FAILURE.

SCENE CONFLICT HANDLING:
If IMAGE 2 contains chairs, sofas, tables, desks, or other sitting furniture:
→ DO NOT place the person sitting in them. IMAGE 1 has no lower body to sit with.
→ CROP IMAGE 2 TIGHTLY to show only the upper portion of the scene (above table/chair level).
→ The furniture in IMAGE 2 can appear BEHIND or BESIDE the person as visible context, but NEVER require the person to sit.
→ If the scene cannot be meaningfully cropped without the furniture, treat IMAGE 2's background as loose visual reference only — keep the focus tightly on the chest-up framing.

The output is a chest-up portrait. Background from IMAGE 2 sits behind the person's head and shoulders.`,

    waist_up: `THE USER PHOTO (IMAGE 1) SHOWS THE PERSON FROM THE WAIST UP.

HARD RULES — VIOLATING ANY OF THESE IS A FAILURE:
- DO NOT generate legs, feet, or anything below the waist
- DO NOT invent a full seated body or leg-crossing
- The PERSON from IMAGE 1 is MANDATORY in the output. Preserve whatever face angle IMAGE 1 shows — front, side, back, blurred, all valid. A background-only result with no person is a TOTAL FAILURE.

SCENE CONFLICT HANDLING:
If IMAGE 2 requires a full seated or full-body pose:
→ Frame IMAGE 2 so only the upper portion is visible behind the person
→ The person remains waist-up in the output, even if IMAGE 2 normally shows legs/feet

The output is a waist-up portrait.`,

    full_body: `THE USER PHOTO (IMAGE 1) SHOWS THE FULL BODY.

The output CAN show the full body. IMAGE 2 can be shown as a wider scene including floor/ground. Choose footwear and outfit appropriate to the scene — IMAGE 1's clothing is just a reference, not a requirement.`,
  };
  return map[visibleBody] ?? map.upper_chest;
}

function getSizeGuidance(size: string): string {
  const map: Record<string, string> = {
    close: '40-60% (person is prominent in frame)',
    medium: '30-45% (person is clearly visible but scene has room to breathe)',
    far: '15-30% (scene dominates, person is a subject within it)',
  };
  return map[size] ?? map.medium;
}

function getColorTemperatureGuidance(temp: string): string {
  const map: Record<string, string> = {
    warm: '- Skin should appear slightly golden/peachy warmth\n- Whites in clothing or teeth should have a subtle warm tint\n- Avoid cool/bluish skin tones',
    neutral: '- Skin tones should appear natural, no color cast\n- Whites should look clean white\n- Avoid shifting warmer or cooler',
    cool: '- Skin should have slightly cooler undertones (no orange/gold cast)\n- Whites should have a very subtle cool tint\n- Avoid making skin look warm or golden',
  };
  return map[temp] ?? map.neutral;
}

function getLightDirectionGuidance(dir: string): string {
  const map: Record<string, string> = {
    left: '- Light comes from the LEFT side of the scene\n- The right side of the person\'s face should be in shadow\n- Shadows cast to the right',
    right: '- Light comes from the RIGHT side of the scene\n- The left side of the person\'s face should be in shadow\n- Shadows cast to the left',
    front: '- Light comes from the FRONT\n- Person\'s face should be evenly lit\n- Minimal shadow on either side',
    top: '- Light comes from ABOVE\n- Top of head is brightest, chin has shadow',
    back: '- Light comes from BEHIND the person\n- Rim light along edges of head/shoulders\n- Face may be slightly darker than background',
    ambient: '- Light is diffuse with no strong direction\n- Person should be evenly lit without harsh shadows',
  };
  return map[dir] ?? map.ambient;
}

function getLightIntensityGuidance(intensity: string): string {
  const map: Record<string, string> = {
    harsh: '- High-contrast shadows with crisp edges; bright highlights vs. deep shadows on the face — but no clipping.',
    soft: '- Gentle, gradual shadow falloff; low contrast on the face; no hard shadow edges.',
    dim: '- Overall low brightness; muted highlights; lift midtones slightly so the face stays readable, but keep the scene\'s native darkness.',
  };
  return map[intensity] ?? map.soft;
}

function getBackgroundComplexityGuidance(complexity: string): string {
  const map: Record<string, string> = {
    simple: '- Background should stay clean and uncluttered. Avoid adding visual noise. Slight DOF softening is fine.',
    moderate: '- Background has some elements — keep them recognizable but not competing with the subject.',
    busy: '- Background has many elements — apply slightly stronger DOF softening behind the subject so the person reads clearly, but the scene is still legible.',
  };
  return map[complexity] ?? map.moderate;
}

function getSubjectSlotGuidance(slot: string): string {
  const map: Record<string, string> = {
    center: 'Place the person CENTERED horizontally in the frame.',
    left: 'Place the person in the LEFT third of the frame; leave the scene\'s right side visible as context.',
    right: 'Place the person in the RIGHT third of the frame; leave the scene\'s left side visible as context.',
  };
  return map[slot] ?? map.center;
}

// ═══════════════════════════════════════════════════════════
// Gemini 调用
// ═══════════════════════════════════════════════════════════
async function callGeminiRetouch(
  imageBase64: string,
  mimeType: string,
  analysisResult?: string,
) {
  const rawFixPlan = extractFixPlan(analysisResult) ?? DEFAULT_FIX_PLAN;
  const fixPlan = sanitizeFixPlan(rawFixPlan);

  const body = {
    contents: [{
      role: "user",
      parts: [
        { text: buildRetouchPrompt(fixPlan) },
        { inlineData: { data: imageBase64, mimeType } },
      ],
    }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  };

  return callGeminiAPI(body);
}

async function callGeminiFusion(
  userBase64: string,
  userMime: string,
  sceneBase64: string,
  sceneMime: string,
  prompt: string,
) {
  // [N→N 2026-05-19] Order matches prompt: IMAGE 1 = person, IMAGE 2 = scene
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { data: userBase64, mimeType: userMime } },
        { inlineData: { data: sceneBase64, mimeType: sceneMime } },
      ],
    }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  };

  return callGeminiAPI(body);
}

// Retry wrapper: transient upstream failures (503 / 502 / 504 / network
// errors / "high demand" text) retry with exponential backoff. Terminal
// errors (400 / 401 / 403 / safety-related) fail fast.
async function callGeminiAPI(body: any, maxRetries = 2, baseDelayMs = 1500) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callGeminiAPIOnce(body);
    } catch (err) {
      lastError = err as Error;
      const msg = lastError.message;
      const isRetryable =
        /\b(503|502|504)\b|UNAVAILABLE|high demand|overloaded|rate.?limit|quota|ECONNRESET|ETIMEDOUT|timeout|fetch failed/i.test(msg);

      console.warn(`⚠️ Gemini attempt ${attempt + 1}/${maxRetries + 1} failed: ${msg.slice(0, 200)}`);

      if (!isRetryable || attempt >= maxRetries) throw lastError;

      // Exponential backoff: 1.5s, 2.25s, 3.4s, ...
      const delay = Math.round(baseDelayMs * Math.pow(1.5, attempt));
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

async function callGeminiAPIOnce(body: any) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

  let fetchFn: typeof fetch = fetch;
  if (process.env.NODE_ENV === 'development') {
    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:30808';
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

// ═══════════════════════════════════════════════════════════════
// [N→N 2026-05-19] Per-photo VLM tagger — 付费后跑一次
// 输入: 1-N 张用户原图
// 输出: { per_photo_tags: SceneTags[] }  长度与输入对齐
//        失败时返回 null，调用方降级到 pre-pay 单张 tag 复用 N 次
// 用 Gemini 2.5 Flash (text+image)，一次调用拿到所有图的 tag
// ═══════════════════════════════════════════════════════════════
interface PerPhotoTagResult {
  per_photo_tags: SceneTags[];
}

async function runPerPhotoTagger(
  base64s: string[],
  mime: string,
): Promise<PerPhotoTagResult | null> {
  if (base64s.length === 0) return null;

  const prompt = `You are tagging ${base64s.length} dating profile photos of the same person. For EACH photo (in input order, 0-indexed), output the four scene tags used by downstream fusion.

For each photo:
1. color_temperature: "warm" (yellow/orange/golden cast) | "neutral" (clean white) | "cool" (bluish)
2. light_direction: "left" (shadows on right side of face) | "right" (shadows on left) | "front" (even frontal) | "top" (overhead, shadowed chin) | "back" (backlit, rim light) | "ambient" (diffuse, no direction)
3. light_intensity: "harsh" (sharp high-contrast shadows) | "soft" (gradual low-contrast) | "dim" (dark overall)
4. visible_body: "face_only" (head + shoulders only) | "upper_chest" (chest up) | "waist_up" (waist up with arms) | "full_body" (legs visible)

Return ONLY this JSON (no markdown fences, no prose):
{"per_photo_tags": [
  {"color_temperature": "...", "light_direction": "...", "light_intensity": "...", "visible_body": "..."},
  ... one object per input photo, in the same order
]}`;

  const parts: any[] = [{ text: prompt }];
  for (const b64 of base64s) {
    parts.push({ inlineData: { data: b64, mimeType: mime } });
  }
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  };

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  let fetchFn: typeof fetch = fetch;
  if (process.env.NODE_ENV === 'development') {
    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:30808';
    const agent = new ProxyAgent(proxyUrl);
    fetchFn = (u: any, opts: any) => undiciFetch(u, { ...opts, dispatcher: agent }) as any;
  }

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[vlm-rerank] Gemini error ${response.status}: ${errText.slice(0, 200)}`);
      return null;
    }
    const json: any = await response.json();
    const text = json?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
    if (!text) {
      console.warn('[per-photo-tag] no text in response');
      return null;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try { parsed = JSON.parse(m[0]); } catch { return null; }
    }
    const arr = parsed?.per_photo_tags;
    if (!Array.isArray(arr) || arr.length !== base64s.length) {
      console.warn(`[per-photo-tag] bad shape: expected array of ${base64s.length}, got ${Array.isArray(arr) ? arr.length : typeof arr}`);
      return null;
    }
    const VALID: Record<keyof SceneTags, readonly string[]> = {
      color_temperature: ['warm', 'neutral', 'cool'],
      light_direction: ['left', 'right', 'front', 'top', 'back', 'ambient'],
      light_intensity: ['harsh', 'soft', 'dim'],
      visible_body: ['face_only', 'upper_chest', 'waist_up', 'full_body'],
    };
    for (let i = 0; i < arr.length; i++) {
      const t = arr[i];
      if (!t || typeof t !== 'object') {
        console.warn(`[per-photo-tag] photo ${i}: not an object`);
        return null;
      }
      for (const [field, allowed] of Object.entries(VALID)) {
        if (!allowed.includes(t[field])) {
          console.warn(`[per-photo-tag] photo ${i}: invalid ${field}="${t[field]}"`);
          return null;
        }
      }
    }
    return { per_photo_tags: arr as SceneTags[] };
  } catch (err) {
    console.warn('[per-photo-tag] threw:', (err as Error).message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// [post-gen check 2026-05-18] 校验 Gemini 生图里有清晰可辨的人物
//
// 用 Gemini 2.5 Flash 做"是否包含人像"的二元判定。Flash Image 偶尔会
// 输出纯背景 / 手部特写 / 没人的场景，需要后校验把这些当失败处理 →
// fusion 重试循环会自动补一张正常的。
//
// 失败时 (Gemini 错误 / 网络异常) **fail open** 返回 true —— 宁可放过
// 一张可疑结果，也别因为校验链路本身出问题挡掉所有合法用户。
// ═══════════════════════════════════════════════════════════════
async function validatePersonInImage(
  imageBase64: string,
  mimeType: string,
): Promise<boolean> {
  const prompt = `Look at this image. Does it clearly show a recognizable human person (face or upper body of a real-looking human)?

Reject if any of:
- No human visible at all (background only, food, animal, object)
- Face heavily obscured, cropped out, or unrecognizable
- Multiple people where target subject is ambiguous
- Anime / cartoon / illustration only

Reply with EXACTLY one word: YES or NO. No punctuation, no explanation.`;

  const body = {
    contents: [{ role: 'user', parts: [
      { text: prompt },
      { inlineData: { data: imageBase64, mimeType } },
    ] }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'text/plain',
    },
  };

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  let fetchFn: typeof fetch = fetch;
  if (process.env.NODE_ENV === 'development') {
    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:30808';
    const agent = new ProxyAgent(proxyUrl);
    fetchFn = (u: any, opts: any) => undiciFetch(u, { ...opts, dispatcher: agent }) as any;
  }

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[validate-person] Gemini ${response.status}: ${errText.slice(0, 200)} (fail open)`);
      return true;
    }
    const json: any = await response.json();
    const text: string =
      json?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text ?? '';
    const verdict = text.trim().toUpperCase();
    const hasPerson = verdict.startsWith('YES');
    console.log(`[validate-person] verdict: "${verdict.slice(0, 20)}" → ${hasPerson ? '✓' : '✗'}`);
    return hasPerson;
  } catch (err) {
    console.warn('[validate-person] threw (fail open):', (err as Error).message);
    return true;
  }
}

// ─── 后端水印 ────────────────────────────────────────────
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

// ─── Color correction (retouch path only) ─────────────────────────
// Compares generated buffer's per-channel mean to original; nudges back
// toward the original's white balance if the model drifted.
async function colorCorrectIfNeeded(
  generatedBuffer: Buffer,
  userImageBase64: string,
  fixPlan: FixPlan | null,
): Promise<Buffer> {
  const activeColorGrades = ['warm_tone', 'cool_tone'];
  const shouldCorrect = !fixPlan || !activeColorGrades.includes(fixPlan.color_grade);
  if (!shouldCorrect) return generatedBuffer;

  try {
    const originalBuffer = Buffer.from(userImageBase64, 'base64');
    const origStats = await sharp(originalBuffer).stats();
    const genStats = await sharp(generatedBuffer).stats();

    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
    const scaleR = clamp(origStats.channels[0].mean / (genStats.channels[0].mean || 1), 0.8, 1.2);
    const scaleG = clamp(origStats.channels[1].mean / (genStats.channels[1].mean || 1), 0.8, 1.2);
    const scaleB = clamp(origStats.channels[2].mean / (genStats.channels[2].mean || 1), 0.8, 1.2);

    const maxDrift = Math.max(Math.abs(scaleR - 1), Math.abs(scaleG - 1), Math.abs(scaleB - 1));
    if (maxDrift < 0.02) return generatedBuffer;

    const corrected = await sharp(generatedBuffer)
      .recomb([[scaleR, 0, 0], [0, scaleG, 0], [0, 0, scaleB]])
      .toBuffer();
    console.log(`🎨 retouch post-correct: R×${scaleR.toFixed(3)} G×${scaleG.toFixed(3)} B×${scaleB.toFixed(3)}`);
    return Buffer.from(corrected as any);
  } catch (colorErr) {
    console.error('🎨 色温校正失败:', colorErr);
    return generatedBuffer;
  }
}

// ─── Per-variant processing ───────────────────────────────────────
// Takes a single Gemini result (one image) and runs the post-Gemini
// pipeline: extract → color-correct (retouch only) → watermark (free
// trial only) → upload to enhanced-photos → insert photo_enhancements.
// Throws on safety block / no-image / upload / DB failure so the caller
// can decide whether to count it as a partial or total failure.

interface VariantInput {
  geminiResult: any;
  // [no-login pivot 2026-05-17] 改成 nullable，访客流程下传 null
  userId: string | null;
  isFreeTrial: boolean;
  scanId: string | null;
  groupId: string;
  variantIndex: number;
  mode: 'fusion' | 'retouch';
  engine: string;
  matchInfo: MatchResult | null;
  // [N→N 2026-05-19] per-variant: 每个 variant 对应一张用户原图 + 一个 scene
  userImageBase64: string;
  originalStorageKey: string | null;
  ts: number;
  analysisResult?: string;
}

interface VariantOutput {
  enhancementId: string;
  storageKey: string;
  clientImage: string;
  mimeType: string;
  matchedScene: string | null;
  variantIndex: number;
}

async function processVariant(input: VariantInput): Promise<VariantOutput> {
  // 1. Extract image from Gemini response
  const parts = input.geminiResult.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData);
  if (!imagePart?.inlineData) {
    const c = classifyGeminiNoImage(input.geminiResult);
    const err: any = new Error(c.userMsg);
    err.code = c.code;
    err.retryable = c.retryable;
    err.detail = c.detail;
    throw err;
  }

  const cleanMime: string = imagePart.inlineData.mimeType ?? 'image/png';
  let finalBuffer = Buffer.from(imagePart.inlineData.data, 'base64');

  // 2. Color correction (retouch only — fusion already aligns via prompt)
  if (input.mode === 'retouch') {
    const fixPlan = input.analysisResult ? extractFixPlan(input.analysisResult) : null;
    const corrected = await colorCorrectIfNeeded(finalBuffer, input.userImageBase64, fixPlan);
    finalBuffer = Buffer.from(corrected);
  }

  // 3. Watermark for free-trial users
  let clientImage: string;
  if (input.isFreeTrial) {
    const watermarked = await addWatermarkServer(finalBuffer);
    clientImage = watermarked.toString('base64');
  } else {
    clientImage = finalBuffer.toString('base64');
  }

  // 4. Upload enhanced image
  // [no-login pivot] storage prefix 改成 scan_id 优先（访客无 user_id）。
  // 旧形式 `${userId}/...` 在恢复登录时自然回来，无须再改回。
  const keyPrefix = input.userId ?? (input.scanId ? `scan-${input.scanId}` : 'guest');
  const storageKey = `${keyPrefix}/${input.ts}-v${input.variantIndex}.png`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(ENHANCED_BUCKET)
    .upload(storageKey, finalBuffer, { contentType: cleanMime, upsert: false });
  if (uploadErr) {
    throw new Error(`Enhanced upload failed: ${uploadErr.message}`);
  }

  // 5. Insert photo_enhancements row
  const { data: enhRecord, error: dbErr } = await supabaseAdmin
    .from('photo_enhancements')
    .insert({
      user_id: input.userId,
      storage_key: storageKey,
      original_storage_key: input.originalStorageKey,
      mime_type: cleanMime,
      is_free_trial: input.isFreeTrial,
      downloaded: false,
      scan_id: input.scanId,
      group_id: input.groupId,
      variant_index: input.variantIndex,
      mode: input.mode,
      engine: input.engine,
      matched_scene_id: input.matchInfo?.scene.id ?? null,
      match_relaxation_level: input.matchInfo?.relaxation_level ?? null,
      match_score: input.matchInfo?.score ?? null,
    })
    .select('id')
    .single();

  if (dbErr || !enhRecord) {
    // Best-effort cleanup of orphan storage object
    await supabaseAdmin.storage.from(ENHANCED_BUCKET).remove([storageKey]);
    throw new Error(`DB insert failed: ${dbErr?.message ?? 'unknown'}`);
  }

  return {
    enhancementId: enhRecord.id,
    storageKey,
    clientImage,
    mimeType: cleanMime,
    matchedScene: input.matchInfo?.scene.id ?? null,
    variantIndex: input.variantIndex,
  };
}

// ═══════════════════════════════════════════════════════════
// 主 Handler
// ═══════════════════════════════════════════════════════════
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      scanId: rawScanId,
      useFusion: rawUseFusion = true,
    }: {
      scanId?: string;
      useFusion?: boolean;
    } = body;

    // Legacy inputs (still accepted while frontend migrates)
    let imageBase64: string | undefined = body.imageBase64;
    let mimeType: string = body.mimeType ?? 'image/jpeg';
    let analysisResult: string | undefined = body.analysisResult;

    // ═══════════════════════════════════════════════════════════
    // [RESTORED 2026-05-29 — login revert] 登录鉴权 + scan 归属校验。
    // 一次性买卖的 scan.paid 版整段保留在文件下方注释里。
    // ═══════════════════════════════════════════════════════════
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: "LOGIN_REQUIRED" }),
        { status: 401 }
      );
    }

    // [RESTORED 2026-05-29 — login revert] scanId 可选：
    //   - 有 scanId（登录用户分析时已落 photo_scans）→ loadScanById 校验归属
    //   - 无 scanId（游客分析后登录续跑）→ 走 legacy imageBase64 (body) 单图路径
    let loaded: LoadedScan | null = null;
    if (rawScanId) {
      loaded = await loadScanById(rawScanId, user.id);
      if (!loaded) {
        return new Response(
          JSON.stringify({ error: 'Scan not found or expired', code: 'SCAN_NOT_FOUND' }),
          { status: 410, headers: { 'Content-Type': 'application/json' } }
        );
      }
      imageBase64 = loaded.imageBase64;
      mimeType = loaded.mimeType;
      if (loaded.analysisResultString) {
        analysisResult = loaded.analysisResultString;
      }
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }

    // legacy 单图路径无 originalKeys；多图路径用 loaded 的数组。
    const allUserImages = loaded ? loaded.imageBase64s : [imageBase64];
    const allOriginalKeys = loaded ? loaded.originalKeys : [];

    // ═══════════════════════════════════════════════════════════
    // [N→N 2026-05-19] Per-photo tagger
    // 付费后跑一次 Gemini 2.5 Flash，给每张图打独立 scene_tags。
    // 后续每个 variant 用 (photo_i, tags_i) 配 1 个独立场景。
    // 失败时降级：复用 pre-pay 主图 tags ×N（所有 variant 共用一份 tags，
    // 但 photo 仍 per-variant，效果略弱但不会崩）
    // ═══════════════════════════════════════════════════════════
    const N = allUserImages.length;
    console.log(`[enhance] N=${N} (scanId=${rawScanId}) | originalKeys=[${allOriginalKeys.join(', ')}]`);

    let perPhotoTags: SceneTags[] | null = null;
    if (N >= 2) {
      const tagResult = await runPerPhotoTagger(allUserImages, mimeType);
      if (tagResult) {
        perPhotoTags = tagResult.per_photo_tags;
        console.log(`🏷️  [per-photo-tag] ${N} photos tagged: ${perPhotoTags.map((t, i) => `#${i}:${t.visible_body}/${t.color_temperature}/${t.light_direction}`).join(' | ')}`);
      } else {
        console.log(`⚠️  [per-photo-tag] failed — falling back to pre-pay main tags ×${N}`);
      }
    }
    // 降级 / 单图：所有 variant 共用 pre-pay 的主图 tags
    if (!perPhotoTags) {
      const fallback = extractSceneTags(analysisResult);
      if (fallback) {
        perPhotoTags = Array.from({ length: N }, () => fallback);
      }
    }

    // ── 紧急回滚开关：强制走 retouch 路径 ──
    const useFusion = FORCE_RETOUCH_MODE ? false : rawUseFusion;
    if (FORCE_RETOUCH_MODE && rawUseFusion) {
      console.warn('⚠️  FORCE_RETOUCH_MODE active — fusion request routed to retouch');
    }

    // ═══════════════════════════════════════════════════════════
    // [RESTORED 2026-05-29 — login revert] 积分扣费 + 失败退款恢复。
    // ═══════════════════════════════════════════════════════════
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
    const nowIso = new Date().toISOString();
    const subs = (customer as any).subscriptions as any[] | null;
    const subData = subs?.find((s: any) =>
      s.status === 'active' ||
      (s.status === 'canceled' && s.current_period_end && s.current_period_end > nowIso)
    ) ?? null;
    const isSubscribed = !!subData;

    const costNeeded = isSubscribed ? COST_SUBSCRIBED : COST_NON_SUBSCRIBED;
    const actionType = isSubscribed ? 'PhotoEnhance_Member' : 'PhotoEnhance_NonMember';
    let creditsRemaining = customer.credits;
    let deducted = false;

    console.log(`🔍 user.id: ${user.id} | useFusion: ${useFusion} | scanId: ${rawScanId}`);

    if (!isFreeTrial) {
      if (customer.credits < costNeeded) {
        return new Response(
          JSON.stringify({
            error: "Insufficient credits", code: "INSUFFICIENT_CREDITS",
            needed: costNeeded, current: customer.credits, isSubscribed,
          }),
          { status: 402, headers: { "Content-Type": "application/json" } }
        );
      }

      const { data: rpcResult, error: rpcError } = await supabaseAdmin
        .rpc('deduct_credits', {
          p_user_id: user.id,
          p_amount: costNeeded,
          p_description: actionType,
          p_metadata: { source: 'system_deduction', action: actionType },
        })
        .returns<DeductCreditsResult[]>()
        .single();

      if (rpcError) {
        console.error(`扣费RPC失败 (User: ${user.id}):`, rpcError);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), { status: 500 });
      }
      if (!rpcResult.success) {
        return new Response(
          JSON.stringify({
            error: "Insufficient credits", code: "INSUFFICIENT_CREDITS",
            needed: costNeeded, current: 0, isSubscribed,
          }),
          { status: 402, headers: { "Content-Type": "application/json" } }
        );
      }
      creditsRemaining = rpcResult.remaining;
      deducted = true;
    }

    const refundOnFailure = async (reason: string) => {
      if (!deducted) return;
      try {
        const { data: refundResult, error: refundErr } = await supabaseAdmin
          .rpc('refund_credits', {
            p_user_id: user.id,
            p_amount: costNeeded,
            p_description: `Refund: ${reason}`,
            p_metadata: { action: reason },
          })
          .returns<RefundCreditsResult[]>()
          .single();

        if (refundErr || !refundResult?.success) {
          console.error(`退款失败 (User: ${user.id}):`, refundErr ?? refundResult);
          return;
        }
        creditsRemaining = refundResult.remaining;
        deducted = false;
        console.log(`退款: ${costNeeded} credits, reason: ${reason}`);
      } catch (err) {
        console.error(`退款异常 (User: ${user.id}):`, err);
      }
    };

    // ═══════════════════════════════════════════════════════════
    // [DISABLED 2026-05-17 — no-login pivot] 旧版鉴权 + 计费整段
    //
    // const supabase = await createClient();
    // const { data: { user } } = await supabase.auth.getUser();
    // if (!user) {
    //   return new Response(
    //     JSON.stringify({ error: "Unauthorized", code: "LOGIN_REQUIRED" }),
    //     { status: 401 }
    //   );
    // }
    //
    // if (rawScanId) {
    //   const loaded = await loadScanById(rawScanId, user.id);
    //   if (!loaded) {
    //     return new Response(
    //       JSON.stringify({ error: 'Scan not found or expired', code: 'SCAN_NOT_FOUND' }),
    //       { status: 410, headers: { 'Content-Type': 'application/json' } }
    //     );
    //   }
    //   imageBase64 = loaded.imageBase64;
    //   mimeType = loaded.mimeType;
    //   if (loaded.analysisResultString) {
    //     analysisResult = loaded.analysisResultString;
    //   }
    // }
    //
    // if (!imageBase64) {
    //   return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    // }
    //
    // const useFusion = FORCE_RETOUCH_MODE ? false : rawUseFusion;
    // if (FORCE_RETOUCH_MODE && rawUseFusion) {
    //   console.warn('⚠️  FORCE_RETOUCH_MODE active — fusion request routed to retouch');
    // }
    //
    // const { data: customer, error: customerError } = await supabaseAdmin
    //   .from("customers")
    //   .select(`
    //     id, credits, free_enhance_used,
    //     subscriptions (status, current_period_end)
    //   `)
    //   .eq("user_id", user.id)
    //   .single();
    //
    // if (customerError || !customer) {
    //   console.error("Supabase Error:", customerError);
    //   return new Response(JSON.stringify({ error: "Failed to fetch customer data" }), { status: 500 });
    // }
    //
    // const isFreeTrial = !customer.free_enhance_used;
    // const now = new Date().toISOString();
    // const subs = (customer as any).subscriptions as any[] | null;
    // const subData = subs?.find((s: any) =>
    //   s.status === 'active' ||
    //   (s.status === 'canceled' && s.current_period_end && s.current_period_end > now)
    // ) ?? null;
    // const isSubscribed = !!subData;
    //
    // console.log(`🔍 user.id: ${user.id} | useFusion: ${useFusion} | scanId: ${rawScanId ?? 'none'}`);
    //
    // const costNeeded = isSubscribed ? COST_SUBSCRIBED : COST_NON_SUBSCRIBED;
    // const actionType = isSubscribed ? 'PhotoEnhance_Member' : 'PhotoEnhance_NonMember';
    // let creditsRemaining = customer.credits;
    // let deducted = false;
    //
    // if (!isFreeTrial) {
    //   if (customer.credits < costNeeded) {
    //     return new Response(
    //       JSON.stringify({
    //         error: "Insufficient credits", code: "INSUFFICIENT_CREDITS",
    //         needed: costNeeded, current: customer.credits, isSubscribed,
    //       }),
    //       { status: 402, headers: { "Content-Type": "application/json" } }
    //     );
    //   }
    //
    //   const { data: rpcResult, error: rpcError } = await supabaseAdmin
    //     .rpc('deduct_credits', {
    //       p_user_id: user.id,
    //       p_amount: costNeeded,
    //       p_description: actionType,
    //       p_metadata: { source: 'system_deduction', action: actionType },
    //     })
    //     .returns<DeductCreditsResult[]>()
    //     .single();
    //
    //   if (rpcError) {
    //     console.error(`扣费RPC失败 (User: ${user.id}):`, rpcError);
    //     return new Response(JSON.stringify({ error: "Failed to deduct credits" }), { status: 500 });
    //   }
    //
    //   if (!rpcResult.success) {
    //     return new Response(
    //       JSON.stringify({
    //         error: "Insufficient credits", code: "INSUFFICIENT_CREDITS",
    //         needed: costNeeded, current: 0, isSubscribed,
    //       }),
    //       { status: 402, headers: { "Content-Type": "application/json" } }
    //     );
    //   }
    //   creditsRemaining = rpcResult.remaining;
    //   deducted = true;
    // }
    //
    // const refundOnFailure = async (reason: string) => {
    //   if (!deducted) return;
    //   try {
    //     const { data: refundResult, error: refundErr } = await supabaseAdmin
    //       .rpc('refund_credits', {
    //         p_user_id: user.id,
    //         p_amount: costNeeded,
    //         p_description: `Refund: ${reason}`,
    //         p_metadata: { action: reason },
    //       })
    //       .returns<RefundCreditsResult[]>()
    //       .single();
    //
    //     if (refundErr || !refundResult?.success) {
    //       console.error(`退款失败 (User: ${user.id}):`, refundErr ?? refundResult);
    //       return;
    //     }
    //     creditsRemaining = refundResult.remaining;
    //     deducted = false;
    //     console.log(`退款: ${costNeeded} credits, reason: ${reason}`);
    //   } catch (err) {
    //     console.error(`退款异常 (User: ${user.id}):`, err);
    //   }
    // };

    // ═══════════════════════════════════════════════════════
    // 分支：融合 vs retouch
    // 所有后置逻辑包在 try/finally 里：任何未显式退款的失败路径
    // 都会在 finally 里兜底退款（refundOnFailure 幂等）。
    // ═══════════════════════════════════════════════════════
    let success = false;
    try {
    // [N→N 2026-05-19] originalKeys 来自 loadScanById，与 allUserImages 同序。
    // 每个 variant 用自己对应的 key (不再 shared)。
    const ts = Date.now();

    // ─── Generate variants ─────────────────────────────────────────
    const groupId = randomUUID();
    const ENGINE = 'gemini-2.5-flash-image';
    let appliedMode: 'fusion' | 'retouch' = useFusion ? 'fusion' : 'retouch';
    let variants: VariantOutput[] = [];

    // ─── Retouch top-up helper ────────────────────────────────────
    // Runs a single retouch variant on photo[idx]. Used as a safety net to
    // backfill missing slots when fusion can't produce N images, and as the
    // primary loop when fusion is skipped entirely. Never throws — failures
    // return null so callers can continue with whatever did succeed.
    const runRetouchForVariant = async (idx: number): Promise<VariantOutput | null> => {
      const photo = allUserImages[idx];
      const key = allOriginalKeys[idx] ?? null;
      if (!photo) {
        console.warn(`[retouch variant ${idx}] no source photo`);
        return null;
      }
      try {
        const geminiResult = await callGeminiRetouch(photo, mimeType, analysisResult);
        return await processVariant({
          geminiResult,
          userId: user.id,
          isFreeTrial,
          scanId: rawScanId ?? null,
          groupId,
          variantIndex: idx,
          mode: 'retouch',
          engine: ENGINE,
          matchInfo: null,
          userImageBase64: photo,
          originalStorageKey: key,
          ts,
          analysisResult,
        });
      } catch (err) {
        console.warn(`[retouch variant ${idx}] failed:`, (err as Error).message);
        return null;
      }
    };

    if (appliedMode === 'fusion') {
      if (!perPhotoTags || perPhotoTags.length === 0) {
        console.warn('⚠️ fusion requested but no scene_tags available; falling back to retouch');
        appliedMode = 'retouch';
      } else {
        const library = loadSceneLibrary();
        const matches = matchScenesForPhotos(perPhotoTags, library);
        if (matches.length === 0) {
          console.warn('⚠️ matchScenesForPhotos returned 0; falling back to retouch');
          appliedMode = 'retouch';
        } else {
          console.log(`🎯 N→N matched ${matches.length}: ${matches.map((m, i) => `#${i}=${m.scene.id}`).join(', ')}`);
          matches[0].reasoning.forEach(r => console.log(`   ${r}`));

          const rawFixPlan = extractFixPlan(analysisResult) ?? DEFAULT_FIX_PLAN;
          const fixPlan = sanitizeFixPlan(rawFixPlan);

          // [N→N] Per-variant pair: (allUserImages[i], perPhotoTags[i], matches[i], allOriginalKeys[i])
          const expectedCount = matches.length;
          const geminiPromises = matches.map(async (match, idx) => {
            const { buffer: sceneBuffer, mime: sceneMime } = loadSceneImage(match.scene.file);
            const fusionPrompt = buildFusionPrompt(perPhotoTags![idx], match.scene, fixPlan);
            return callGeminiFusion(
              allUserImages[idx], 'image/jpeg',
              sceneBuffer.toString('base64'), sceneMime,
              fusionPrompt,
            );
          });
          const settled = await Promise.allSettled(geminiPromises);

          // First pass: process each Gemini result. Each variant has its
          // own try/catch so one bad output doesn't sink the batch.
          const variantPromises = settled.map(async (result, idx) => {
            const sceneId = matches[idx].scene.id;
            if (result.status === 'rejected') {
              console.warn(`[fusion] variant ${idx} (photo#${idx}→${sceneId}) gemini failed:`, result.reason?.message ?? result.reason);
              return null;
            }
            const parts = result.value?.candidates?.[0]?.content?.parts ?? [];
            const imagePart = parts.find((p: any) => p.inlineData);
            if (!imagePart?.inlineData?.data) {
              console.warn(`[fusion] variant ${idx} (photo#${idx}→${sceneId}) no image in result`);
              return null;
            }
            const hasPerson = await validatePersonInImage(
              imagePart.inlineData.data,
              imagePart.inlineData.mimeType ?? 'image/png',
            );
            if (!hasPerson) {
              console.warn(`[fusion] variant ${idx} (photo#${idx}→${sceneId}) rejected: no person detected`);
              return null;
            }
            try {
              return await processVariant({
                geminiResult: result.value,
                userId: user.id,
                isFreeTrial,
                scanId: rawScanId ?? null,
                groupId,
                variantIndex: idx,
                mode: 'fusion',
                engine: ENGINE,
                matchInfo: matches[idx],
                userImageBase64: allUserImages[idx],
                originalStorageKey: allOriginalKeys[idx] ?? null,
                ts,
                analysisResult,
              });
            } catch (procErr) {
              console.warn(`[fusion] variant ${idx} (photo#${idx}→${sceneId}) process failed:`, (procErr as Error).message);
              return null;
            }
          });
          const variantResults = await Promise.all(variantPromises);
          variants = variantResults.filter((v): v is VariantOutput => v !== null);
          console.log(`🖼️  fusion produced ${variants.length}/${expectedCount} variants on first pass`);

          // ═══════════════════════════════════════════════════════════
          // Retry: refill missing (photo_i, scene_i) pairs by variantIndex.
          // ═══════════════════════════════════════════════════════════
          const RETRY_ROUNDS = 2;
          for (let round = 1; round <= RETRY_ROUNDS && variants.length < expectedCount; round++) {
            const haveIndices = new Set(variants.map((v) => v.variantIndex));
            const missingIndices: number[] = [];
            for (let i = 0; i < expectedCount; i++) {
              if (!haveIndices.has(i)) missingIndices.push(i);
            }
            if (missingIndices.length === 0) break;
            console.log(`🔁 fusion retry round ${round}: refilling ${missingIndices.length} variant(s) [${missingIndices.join(',')}]`);

            const retryPromises = missingIndices.map(async (idx) => {
              const match = matches[idx];
              try {
                const { buffer: sceneBuffer, mime: sceneMime } = loadSceneImage(match.scene.file);
                const fusionPrompt = buildFusionPrompt(perPhotoTags![idx], match.scene, fixPlan);
                const geminiResult = await callGeminiFusion(
                  allUserImages[idx], 'image/jpeg',
                  sceneBuffer.toString('base64'), sceneMime,
                  fusionPrompt,
                );
                const parts = geminiResult?.candidates?.[0]?.content?.parts ?? [];
                const imagePart = parts.find((p: any) => p.inlineData);
                if (!imagePart?.inlineData?.data) {
                  console.warn(`[fusion retry r${round}] variant ${idx} (photo#${idx}→${match.scene.id}) no image in result`);
                  return null;
                }
                const hasPerson = await validatePersonInImage(
                  imagePart.inlineData.data,
                  imagePart.inlineData.mimeType ?? 'image/png',
                );
                if (!hasPerson) {
                  console.warn(`[fusion retry r${round}] variant ${idx} (photo#${idx}→${match.scene.id}) rejected: no person detected`);
                  return null;
                }
                return await processVariant({
                  geminiResult,
                  userId: user.id,
                  isFreeTrial,
                  scanId: rawScanId ?? null,
                  groupId,
                  variantIndex: idx,
                  mode: 'fusion',
                  engine: ENGINE,
                  matchInfo: match,
                  userImageBase64: allUserImages[idx],
                  originalStorageKey: allOriginalKeys[idx] ?? null,
                  ts,
                  analysisResult,
                });
              } catch (err) {
                console.warn(`[fusion retry r${round}] variant ${idx} (photo#${idx}→${match.scene.id}) still failing:`, (err as Error).message);
                return null;
              }
            });
            const newOnes = (await Promise.all(retryPromises)).filter(
              (v): v is VariantOutput => v !== null,
            );
            variants.push(...newOnes);
            console.log(`🔁 fusion retry round ${round} added ${newOnes.length}/${missingIndices.length}; total now ${variants.length}/${expectedCount}`);
          }

          // ═══════════════════════════════════════════════════════════
          // Retouch top-up: fusion 凑不齐时不再清空 partial，改成对仍缺
          // 的 variantIndex 用 retouch 兜底（同一张原图 + 通用 retouch
          // prompt）。保证用户上传 N 张就能拿到 N 张输出。
          // 这些 top-up variant 的 mode 字段写 'retouch' 而非 'fusion'，
          // 下游统计/分析可据此区分。
          // ═══════════════════════════════════════════════════════════
          if (variants.length < expectedCount) {
            const haveIndices = new Set(variants.map((v) => v.variantIndex));
            const stillMissing: number[] = [];
            for (let i = 0; i < expectedCount; i++) {
              if (!haveIndices.has(i)) stillMissing.push(i);
            }
            console.log(`🩹 fusion still missing ${stillMissing.length} after retries — retouch top-up for [${stillMissing.join(',')}]`);
            const topupResults = await Promise.all(stillMissing.map(runRetouchForVariant));
            const topupOk = topupResults.filter((v): v is VariantOutput => v !== null);
            variants.push(...topupOk);
            console.log(`🩹 retouch top-up filled ${topupOk.length}/${stillMissing.length}; total ${variants.length}/${expectedCount}`);
          }
        }
      }
    }

    if (appliedMode === 'retouch') {
      // Retouch fallback path: fusion 整体不可用（perPhotoTags 失败 /
      // matches 为空）时走这里。对每张上传图各跑一次 retouch，保证
      // 输出 N 张而不是 1 张。
      const N = allUserImages.length;
      const retouchResults = await Promise.all(
        Array.from({ length: N }, (_, idx) => runRetouchForVariant(idx)),
      );
      variants = retouchResults.filter((v): v is VariantOutput => v !== null);
      console.log(`🖼️  retouch fallback produced ${variants.length}/${N} variants`);
    }

    if (variants.length === 0) {
      // [multi-photo 2026-05-18] All variants failed. Mark enhance_failed_at
      // so /api/scan-result returns 'failed' status → 前端展示重试按钮。
      // scan 保持 paid，重试不再扣费。
      // enhance_attempts 用一次 select+update 凑合做（不是高并发场景，OK）
      try {
        const { data: cur } = await supabaseAdmin
          .from('photo_scans')
          .select('enhance_attempts')
          .eq('id', rawScanId)
          .maybeSingle();
        await supabaseAdmin
          .from('photo_scans')
          .update({
            enhance_failed_at: new Date().toISOString(),
            enhance_attempts: (cur?.enhance_attempts ?? 0) + 1,
          })
          .eq('id', rawScanId);
      } catch (err) {
        console.warn('[enhance] mark failure failed:', (err as Error).message);
      }
      throw new Error('All variants failed to generate');
    }

    // [RESTORED 2026-05-29 — login revert] 首次免费额度用掉后标记。
    if (isFreeTrial) {
      await supabase
        .from('customers')
        .update({ free_enhance_used: true })
        .eq('user_id', user.id);
    }

    success = true;
    const first = variants[0];
    return new Response(
      JSON.stringify({
        success: true,
        // Legacy top-level fields (mirror first variant) for back-compat
        enhancementId: first.enhancementId,
        watermarkedImage: first.clientImage,
        mimeType: first.mimeType,
        fusion: appliedMode === 'fusion',
        matchedScene: first.matchedScene,
        // Shared
        creditsRemaining,
        isFreeTrial,
        isSubscribed,
        downloadFree: !isFreeTrial,
        // New: full variants (length 1 for retouch, up to 3 for fusion)
        mode: appliedMode,
        groupId,
        variants: variants.map(v => ({
          enhancementId: v.enhancementId,
          image: v.clientImage,
          mimeType: v.mimeType,
          matchedScene: v.matchedScene,
          variantIndex: v.variantIndex,
        })),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    } finally {
      if (!success) {
        await refundOnFailure('post_deduction_failure');
      }
    }

  } catch (error) {
    const err = error as Error;
    console.error("enhance-photo error:", err);
    const c = classifyUpstreamError(err);
    return new Response(
      JSON.stringify({
        error: c.userMsg,
        code: c.code,
        retryable: c.retryable,
      }),
      { status: c.status, headers: { "Content-Type": "application/json" } }
    );
  }
}