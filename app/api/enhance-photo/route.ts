import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { randomUUID } from 'crypto';
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

import type { SceneTags } from '@/app/api/scanner/tag-prompt';
import { loadSceneLibrary, loadSceneImage } from './scene-utils';
import { matchScenesTop3, type SceneEntry, type MatchResult } from './match-scene';
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
// ownership (user_id match) and expiration. Returns null if anything
// is wrong so the caller can fall back to legacy body params.
interface LoadedScan {
  imageBase64: string;
  mimeType: string;
  analysisResultString: string | null;
}

async function loadScanById(
  scanId: string,
  userId: string,
): Promise<LoadedScan | null> {
  const { data: scan, error } = await supabaseAdmin
    .from('photo_scans')
    .select('id, user_id, original_storage_key, mime_type, analysis_json, scene_tags, expires_at')
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
  if (scan.user_id !== userId) {
    console.warn(`[enhance] scan ${scanId} owner mismatch (scan=${scan.user_id}, req=${userId})`);
    return null;
  }
  if (scan.expires_at && new Date(scan.expires_at).getTime() < Date.now()) {
    console.warn(`[enhance] scan ${scanId} expired at ${scan.expires_at}`);
    return null;
  }
  if (!scan.original_storage_key) {
    console.warn(`[enhance] scan ${scanId} has no original_storage_key`);
    return null;
  }

  // Download original image from storage
  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from(ORIGINAL_BUCKET)
    .download(scan.original_storage_key);

  if (dlErr || !blob) {
    console.error(`[enhance] failed to download ${scan.original_storage_key}:`, dlErr?.message);
    return null;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const imageBase64 = Buffer.from(arrayBuffer).toString('base64');

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
    imageBase64,
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
  return `You are an elite portrait retoucher. Your work should be invisible — viewers should think "great photo," never "edited photo."

══════════════════════════════════════════════
THREE SUPREME RULES — READ BEFORE EVERYTHING ELSE
══════════════════════════════════════════════

RULE 1 — DO LESS WHEN IN DOUBT:
An under-edited photo that looks real ALWAYS beats an over-edited photo that looks fake. If you are unsure whether an edit is needed, DO NOT make it.

RULE 2 — NO ADDED LIGHT, NO ADDED EFFECTS:
Do NOT add ANY visual element that is not present in the original photo. NO lens flare, NO bokeh orbs, NO rim lighting halos, NO film grain, NO vignettes, NO catchlights added to eyes.

RULE 3 — PRESERVE ORIGINAL COLOR:
The output MUST match the original's color temperature by default. Do NOT shift warmer, cooler, oranger, or yellower unless fix_plan.color_grade EXPLICITLY specifies.

══════════════════════════════════════════════
IDENTITY LOCK — HIGHEST PRIORITY
══════════════════════════════════════════════

PIXEL-LEVEL FAITHFUL to the original: facial bone structure, feature shapes, skin color, body shape, hair.

══════════════════════════════════════════════
FIX PLAN — EXECUTE ONLY WHAT IS SPECIFIED
══════════════════════════════════════════════

${JSON.stringify(fixPlan, null, 2)}

If a field value is "no_change" or "none" → DO NOT touch that aspect AT ALL.

Field instructions: framing (no_change keeps framing; crop_chest_up/crop_waist_up only if specified), background (keep = no alteration; blur = DOF on existing only; replace_* = match original focal length/light/time), lighting (no_change = don't touch; brighten_face = lift shadows only, no warmth added; soften_shadows = reduce contrast only), skin_retouch (none = no touch; minimal_smooth = active blemishes only; moderate_smooth_and_even = blemishes + tone only, keep texture), expression (no_change is default; enhance_smile/soften_smile = minimum adjustment or revert), color_grade (no_change = preserve exact; warm_tone/cool_tone = ≤300K shift), sharpness (no_change = no sharpen; sharpen_face = eyes/features only), eye_enhance (no_change default; brighten_eyes = subtle whites only).

══════════════════════════════════════════════
PROHIBITIONS
══════════════════════════════════════════════

No added light effects / glow / halos / flares. No finger/teeth anomalies. No symmetry artifacts. No edge bleeding. No global LUT. No added makeup/accessories/tattoos. No body shape change. No plastic skin. No text/watermark overlay. No unrequested color temperature shift.

Return only the enhanced image.`;
}

// ═══════════════════════════════════════════════════════════
// 融合 prompt（新，useFusion=true 时使用）
// ═══════════════════════════════════════════════════════════
function buildFusionPrompt(userTags: SceneTags, scene: SceneEntry, fixPlan: FixPlan): string {
  return `You are an elite portrait photographer reshooting a scene. You will receive TWO images and must produce ONE output.

══════════════════════════════════════════════
IMAGE ROLES
══════════════════════════════════════════════

IMAGE 1 (PERSON): Identity reference. Use for face, hair, skin, and clothing only.
IMAGE 2 (SCENE): Target environment. The output photo should feel like it was shot in this location.

══════════════════════════════════════════════
CONTEXT (tag-matched, already compatible)
══════════════════════════════════════════════

User photo:
  - Visible body: ${userTags.visible_body}
  - Color temperature: ${userTags.color_temperature}
  - Light direction: ${userTags.light_direction}

Target scene:
  - Recommended person size: ${scene.recommended_person_size}
  - Color temperature: ${scene.color_temperature}
  - Light direction: ${scene.light_direction}
  - Scale reference: ${scene.person_scale_reference}

══════════════════════════════════════════════
ABSOLUTE RULE #0 — THE PERSON MUST BE IN THE OUTPUT
══════════════════════════════════════════════

The PERSON from IMAGE 1 MUST appear in the output. This is non-negotiable.

A background-only output (IMAGE 2 with no person composited in) is a TOTAL, CATASTROPHIC FAILURE — worse than any other error in this prompt. If you produce IMAGE 2 with no person, you have failed completely.

The person from IMAGE 1 must be present regardless of:
- Whether their face is fully visible, partially visible, side profile, back of head, or facing away
- Whether their face is sharp, blurred, in shadow, or partially obscured
- Whether the photo is a casual selfie, candid shot, action shot, or any other style

You are compositing a PERSON into a SCENE. Both elements must exist in the final image. If the person from IMAGE 1 is not clearly present in your output, you must redo the composition.

══════════════════════════════════════════════
ABSOLUTE RULE #1 — PRESERVE VISIBLE EXTENT
══════════════════════════════════════════════

The person in IMAGE 1 has a SPECIFIC VISIBLE EXTENT — exactly what body parts are shown.

You MUST preserve this exact visible extent in the output:
- If IMAGE 1 shows only the head → output shows only the head
- If IMAGE 1 shows chest up → output shows chest up
- If IMAGE 1 shows waist up → output shows waist up
- If IMAGE 1 shows the full body → output shows the full body

Inventing body parts that weren't in IMAGE 1 is a SEVERE FAILURE equivalent to changing the person's identity.

If IMAGE 2 (the scene) seems to require a different body framing than IMAGE 1, the PERSON WINS — crop, reframe, or creatively interpret IMAGE 2 to match IMAGE 1's visible extent. Never force IMAGE 1's partial view into a full-body pose to "fit" the scene.
══════════════════════════════════════════════
CORE PRINCIPLE — READ TWICE
══════════════════════════════════════════════

You are NOT pasting IMAGE 1 onto IMAGE 2. You are RE-PHOTOGRAPHING the person from IMAGE 1 as if they had walked into IMAGE 2's environment and the photographer took a new picture.

The person's POSE, BODY ORIENTATION, HEAD ANGLE, and HAND POSITIONS should ADAPT to make sense in the new scene.

══════════════════════════════════════════════
LAYERED PRESERVATION
══════════════════════════════════════════════

STRICTLY PRESERVE from IMAGE 1 (identity layer):
- Facial bone structure (jawline, cheekbones, forehead)
- Facial feature shapes (eyes, nose, mouth, ears)
- Skin color and undertone
- Hair style, color, length, texture
- Every clothing item — garment type, color, pattern, fit, logos

ADAPT to the scene:
- Body pose (standing / sitting / leaning / walking)
- Posture, body orientation, arm/hand positions
- Head tilt and gaze direction

══════════════════════════════════════════════
TEETH
══════════════════════════════════════════════

If teeth are visible in IMAGE 1, gently brighten them to a natural off-white. Do NOT make them unnaturally bright, pure white, or fluorescent. The goal is "healthy teeth," not "veneers" — subtle only.

══════════════════════════════════════════════
RETOUCH INSTRUCTIONS (from analysis, apply conservatively)
══════════════════════════════════════════════

- Skin retouch: ${fixPlan.skin_retouch} (none = no touch; minimal_smooth = active blemishes only, keep all texture; moderate_smooth_and_even = blemishes + tone evening, preserve pores)
- Expression: ${fixPlan.expression} (no_change is default; any smile adjustment must be minimal — if result looks unnatural, revert)
- Sharpness: ${fixPlan.sharpness} (no_change = don't sharpen; sharpen_face = subtle on eyes/features only)
- Eye enhance: ${fixPlan.eye_enhance} (no_change = don't touch eyes; brighten_eyes = very subtle whites; anything that looks "glowing" has gone too far)

══════════════════════════════════════════════
PARTIAL VIEW HANDLING — IMAGE 1 SHOWS: ${userTags.visible_body}
══════════════════════════════════════════════

${getPartialViewInstructions(userTags.visible_body)}

══════════════════════════════════════════════
SCALE ANCHORING
══════════════════════════════════════════════

Use visible reference objects in IMAGE 2 for scale:
- Standard chair seat: ~45cm high, seated adult's shoulders reach chair backrest top
- Standard doorway: ~200cm tall, standing adult's head reaches ~85-90% of doorway height
- Standard cafe table: ~75cm high, seated adult's arms rest on table surface
- Adult head height ≈ 1/7 to 1/8 of total standing body height

The person should occupy approximately ${getSizeGuidance(scene.recommended_person_size)} of the frame height.

${scene.person_scale_reference === 'no_reference'
      ? 'NOTE: This scene has no clear scale reference. Use best judgment for natural size.'
      : 'NOTE: This scene has scale references. Use them to verify proportional correctness.'}

══════════════════════════════════════════════
LIGHTING AND COLOR — CRITICAL FOR REALISM
══════════════════════════════════════════════

IMAGE 2's color temperature is ${scene.color_temperature.toUpperCase()}. Match the person's skin tones accordingly:
${getColorTemperatureGuidance(scene.color_temperature)}

IMAGE 2's main light direction is ${scene.light_direction.toUpperCase()}. Re-light the person to match:
${getLightDirectionGuidance(scene.light_direction)}

Shadows on the person must fall in the same direction as shadows on objects in IMAGE 2.

══════════════════════════════════════════════
BACKGROUND TREATMENT
══════════════════════════════════════════════

Keep IMAGE 2's background clearly recognizable. Apply only slight, camera-natural depth-of-field softness — NOT heavy artistic blur.

══════════════════════════════════════════════
TEXTURE CONSISTENCY — CRITICAL FOR REALISM
══════════════════════════════════════════════

IMAGE 2 is a professional photograph. IMAGE 1 is a casual smartphone photo.

The final output must look like a CASUAL SMARTPHONE PHOTO — not a professional magazine photograph. The two images have different native textures, and if you preserve IMAGE 2's professional qualities while preserving IMAGE 1's casual qualities, the person will look "pasted on." You must unify the textures toward the SMARTPHONE end:

- Reduce IMAGE 2's professional sharpness and depth-of-field drama — soften backgrounds slightly toward what a phone camera would capture
- Reduce IMAGE 2's highlight/shadow contrast range — phones have narrower dynamic range
- Match the subtle image grain/noise across the whole frame — if IMAGE 1 has phone-camera noise, IMAGE 2's background should have consistent noise too, not be ultra-clean
- Avoid "magazine photo" aesthetic for the final output — aim for "nice casual snapshot"

The goal: someone scrolling a dating app should think "nice photo he took" — not "this looks like a magazine shoot" (which reads as fake/edited).

══════════════════════════════════════════════
ABSOLUTE PROHIBITIONS
══════════════════════════════════════════════

1. Do NOT output IMAGE 2 alone with no person from IMAGE 1 — this is the worst possible failure.
2. Do NOT alter the person's face, hair, skin tone, or clothing.
3. Do NOT invent a face when IMAGE 1 shows the back of the head, a side profile, or a turned-away angle — preserve that exact angle.
4. Do NOT invent body parts that were not visible in IMAGE 1.
5. Do NOT force IMAGE 1's original pose into a scene where it doesn't fit.
6. Do NOT add lens flare, bokeh orbs, light leaks, film grain, vignettes.
7. Do NOT produce compositing artifacts (edge halos, scale mismatches, floating subjects).
8. Do NOT add any other person, silhouette, or human figure.
9. Do NOT add text, watermark, logo, or overlay.
10. Do NOT stylize — output must look like a real phone camera photograph.

══════════════════════════════════════════════
FINAL CHECK
══════════════════════════════════════════════

1. Is the PERSON from IMAGE 1 visible in the output? (If output is background only → REDO, this is the #1 failure mode.)
2. Identity preserved (hair + clothing + skin tone unchanged from IMAGE 1)?
3. Face angle preserved (if IMAGE 1 shows back/side/blurred face, output must match — don't invent a front-facing face)?
4. Framing matches IMAGE 1's visible extent (${userTags.visible_body})?
5. No invented body parts?
6. Person size matches scene scale references?
7. Pose looks natural in IMAGE 2?
8. Lighting direction matches IMAGE 2?
9. Color temperature matches IMAGE 2 (${scene.color_temperature})?
10. Looks like ONE photograph, not a collage?

Return only the final image.`;
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

The output CAN show the full body. IMAGE 2 can be shown as a wider scene including floor/ground.

Preserve all clothing (top, bottom, shoes) exactly as they appear in IMAGE 1.`,
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
  userId: string;
  isFreeTrial: boolean;
  scanId: string | null;
  groupId: string;
  variantIndex: number;
  mode: 'fusion' | 'retouch';
  engine: string;
  matchInfo: MatchResult | null;
  userImageBase64: string;
  sharedOriginalKey: string | null;
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
  const storageKey = `${input.userId}/${input.ts}-v${input.variantIndex}.png`;
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
      original_storage_key: input.sharedOriginalKey,
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

    // ── 鉴权 ──
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: "LOGIN_REQUIRED" }),
        { status: 401 }
      );
    }

    // ── scan_id 路径：从 DB+storage 载入，覆盖 legacy 参数 ──
    if (rawScanId) {
      const loaded = await loadScanById(rawScanId, user.id);
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

    // ── 紧急回滚开关：强制走 retouch 路径 ──
    const useFusion = FORCE_RETOUCH_MODE ? false : rawUseFusion;
    if (FORCE_RETOUCH_MODE && rawUseFusion) {
      console.warn('⚠️  FORCE_RETOUCH_MODE active — fusion request routed to retouch');
    }

    // ── 读客户信息 ──
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

    console.log(`🔍 user.id: ${user.id} | useFusion: ${useFusion} | scanId: ${rawScanId ?? 'none'}`);

    // ── 扣费（统一 25/40）──
    const costNeeded = isSubscribed ? COST_SUBSCRIBED : COST_NON_SUBSCRIBED;
    const actionType = isSubscribed ? 'PhotoEnhance_Member' : 'PhotoEnhance_NonMember';
    let creditsRemaining = customer.credits;
    let deducted = false;

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

    // ── 原子退款（走 RPC） ──
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
        deducted = false;  // prevent double-refund
        console.log(`退款: ${costNeeded} credits, reason: ${reason}`);
      } catch (err) {
        console.error(`退款异常 (User: ${user.id}):`, err);
      }
    };

    // ═══════════════════════════════════════════════════════
    // 分支：融合 vs retouch
    // 所有后置逻辑包在 try/finally 里：任何未显式退款的失败路径
    // 都会在 finally 里兜底退款（refundOnFailure 幂等）。
    // ═══════════════════════════════════════════════════════
    let success = false;
    try {
    // ─── Resolve original_storage_key (shared across variants) ─────
    // scan_id path: scanner already uploaded the original.
    // Legacy path: upload now (non-blocking — DB row can have null key).
    const ts = Date.now();
    let originalStorageKey: string | null = null;

    if (rawScanId) {
      const { data: scanRow } = await supabaseAdmin
        .from('photo_scans')
        .select('original_storage_key')
        .eq('id', rawScanId)
        .maybeSingle();
      originalStorageKey = scanRow?.original_storage_key ?? null;
    } else {
      try {
        const candidateKey = `${user.id}/${ts}.jpg`;
        const originalBuffer = Buffer.from(imageBase64, 'base64');
        const { error: origUploadError } = await supabaseAdmin.storage
          .from(ORIGINAL_BUCKET)
          .upload(candidateKey, originalBuffer, { contentType: mimeType, upsert: false });
        if (origUploadError) {
          console.error('Original upload error (non-blocking):', origUploadError.message);
        } else {
          originalStorageKey = candidateKey;
        }
      } catch (origErr) {
        console.error('Original upload exception (non-blocking):', origErr);
      }
    }

    // ─── Generate variants ─────────────────────────────────────────
    const groupId = randomUUID();
    const ENGINE = 'gemini-2.5-flash-image';
    let appliedMode: 'fusion' | 'retouch' = useFusion ? 'fusion' : 'retouch';
    let variants: VariantOutput[] = [];

    if (appliedMode === 'fusion') {
      const tags = extractSceneTags(analysisResult);
      if (!tags) {
        console.warn('⚠️ fusion requested but no scene_tags; falling back to retouch');
        appliedMode = 'retouch';
      } else {
        const library = loadSceneLibrary();
        const matches = matchScenesTop3(tags, library);
        if (matches.length === 0) {
          console.warn('⚠️ matchScenesTop3 returned 0; falling back to retouch');
          appliedMode = 'retouch';
        } else {
          console.log(`🎯 top-${matches.length} matched: ${matches.map(m => m.scene.id).join(', ')}`);
          matches[0].reasoning.forEach(r => console.log(`   ${r}`));

          const rawFixPlan = extractFixPlan(analysisResult) ?? DEFAULT_FIX_PLAN;
          const fixPlan = sanitizeFixPlan(rawFixPlan);
          const userBase64 = Buffer.from(imageBase64, 'base64').toString('base64');

          // Fire all Gemini calls in parallel
          const geminiPromises = matches.map(async (match) => {
            const { buffer: sceneBuffer, mime: sceneMime } = loadSceneImage(match.scene.file);
            const fusionPrompt = buildFusionPrompt(tags, match.scene, fixPlan);
            return callGeminiFusion(
              userBase64, 'image/jpeg',
              sceneBuffer.toString('base64'), sceneMime,
              fusionPrompt,
            );
          });
          const settled = await Promise.allSettled(geminiPromises);

          // Process each successful Gemini result through processVariant.
          // Each variant has its own try/catch so a single bad output
          // (safety block, upload error) doesn't sink the whole batch.
          const variantPromises = settled.map(async (result, idx) => {
            const sceneId = matches[idx].scene.id;
            if (result.status === 'rejected') {
              console.warn(`[fusion] variant ${idx} (${sceneId}) gemini failed:`, result.reason?.message ?? result.reason);
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
                userImageBase64: imageBase64,
                sharedOriginalKey: originalStorageKey,
                ts,
                analysisResult,
              });
            } catch (procErr) {
              console.warn(`[fusion] variant ${idx} (${sceneId}) process failed:`, (procErr as Error).message);
              return null;
            }
          });
          const variantResults = await Promise.all(variantPromises);
          variants = variantResults.filter((v): v is VariantOutput => v !== null);
          console.log(`🖼️  fusion produced ${variants.length}/${matches.length} variants`);
        }
      }
    }

    if (appliedMode === 'retouch') {
      const geminiResult = await callGeminiRetouch(imageBase64, mimeType, analysisResult);
      const v = await processVariant({
        geminiResult,
        userId: user.id,
        isFreeTrial,
        scanId: rawScanId ?? null,
        groupId,
        variantIndex: 0,
        mode: 'retouch',
        engine: ENGINE,
        matchInfo: null,
        userImageBase64: imageBase64,
        sharedOriginalKey: originalStorageKey,
        ts,
        analysisResult,
      });
      variants = [v];
    }

    if (variants.length === 0) {
      // All variants failed. Let finally refund and outer catch shape response.
      throw new Error('All variants failed to generate');
    }

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