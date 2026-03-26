import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { consumeCredits } from "@/lib/credits";
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const COST_PER_ENHANCE = 20;
const BUCKET = 'enhanced-photos';

// ─── Supabase Admin（绕过 RLS，用于写 Storage）───────────────
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── 预加载水印瓦片（启动时读一次，常驻内存）──────────────────
let watermarkTileBuffer: Buffer | null = null;

function getWatermarkTile(): Buffer {
  if (!watermarkTileBuffer) {
    const tilePath = path.join(process.cwd(), 'public', 'watermark-tile.png');
    watermarkTileBuffer = fs.readFileSync(tilePath);
  }
  return watermarkTileBuffer;
}

// ─── 分析 JSON 结构 ──────────────────────────────────────────
interface AnalysisJSON {
  lighting?: 'low' | 'medium' | 'high';
  background?: 'clean' | 'neutral' | 'messy';
  expression?: 'warm' | 'neutral' | 'closed';
  main_issues?: string[];
  improvement_focus?: string[];
}

function buildEnhancementContext(analysisResult?: string): string {
  if (!analysisResult) {
    return 'No prior analysis available. Apply general improvements.';
  }
  try {
    const parsed: AnalysisJSON = JSON.parse(analysisResult);
    const lines: string[] = [];
    if (parsed.lighting)
      lines.push(`- Lighting quality is currently **${parsed.lighting}** → improve to make the face clearer and more flattering`);
    if (parsed.background)
      lines.push(`- Background is **${parsed.background}** → ${parsed.background === 'messy' ? 'clean or simplify the background' : 'keep or subtly enhance the background'}`);
    if (parsed.expression)
      lines.push(`- Expression reads as **${parsed.expression}** → ${parsed.expression === 'closed' ? 'enhance warmth without altering face shape' : 'preserve this expression'}`);
    if (parsed.main_issues?.length)
      lines.push(`- Main issues identified: ${parsed.main_issues.join(', ')}`);
    if (parsed.improvement_focus?.length)
      lines.push(`- Focus improvements on: ${parsed.improvement_focus.join(', ')}`);
    return lines.length > 0 ? lines.join('\n') : 'No specific issues found. Apply subtle general improvements.';
  } catch {
    return `Based on this prior analysis:\n"""\n${analysisResult.trim().slice(0, 800)}\n"""\nAddress the identified issues as part of your enhancement.`;
  }
}

// ─── 调 Gemini 生图 ──────────────────────────────────────────
async function callGeminiImageGeneration(
  imageBase64: string,
  mimeType: string,
  analysisResult?: string,
) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
  const enhancementContext = buildEnhancementContext(analysisResult);

  const body = {
    contents: [{
      role: "user",
      parts: [
        {
          text: `You are an elite portrait retoucher for dating app photos.
      
      ANALYSIS CONTEXT:
      ${enhancementContext}
      
      YOUR MISSION:
      Transform this into the best possible dating profile photo while keeping the person 100% recognizable. Think "professional photographer shot this" — not "AI touched this."
      
      EDITING PRIORITIES (in order):
      
      1. COMPOSITION & CROP
      - Crop to a flattering frame: head and upper chest centered, slight rule-of-thirds offset
      - Remove excessive empty space above the head
      - If the subject is too far away, crop closer
      - Target aspect ratio: 4:5 (optimal for dating apps)
      - If the subject is off-center in an unflattering way, re-center
      
      2. BACKGROUND
      - If the background is cluttered, has other people, or is distracting: replace it with a clean, contextually appropriate blurred environment (café, park, urban street, etc.)
      - If the background is already clean: keep it, just add natural depth-of-field blur
      - Remove photobombers, random passersby, or any distracting elements behind the subject
      
      3. LIGHTING & COLOR
      - Simulate soft, directional golden-hour or window light on the face
      - Lift shadows on the face without flattening depth
      - Correct white balance if the photo looks too cold or too yellow
      - Add subtle warmth to skin tones
      - Add a gentle catchlight reflection in the eyes if missing — this is the single biggest "alive and attractive" signal in portraits
      
      4. EYES & GAZE
      - Brighten the whites of the eyes very subtly (not unnaturally white)
      - Enhance iris clarity and natural color just enough to make eyes pop
      - If eyes look tired or slightly red, gently correct
      - Do NOT enlarge eyes or change eye shape
      
      5. SKIN & FACE
      - KEEP all natural skin texture: pores, fine lines, freckles, moles — these are ESSENTIAL for realism
      - Only remove temporary blemishes (active pimples, redness, under-eye darkness)
      - Do NOT smooth skin globally — if anything, ADD micro-texture back
      - Do NOT reshape face, jaw, nose, or any facial features
      - Do NOT whiten teeth or enlarge eyes beyond natural appearance
      - Even out blotchy skin tone without removing texture
      
      6. HAIR
      - Tame obvious flyaways or frizz that distract from the face
      - Add subtle shine and definition if hair looks flat or dull
      - Do NOT change hairstyle, color, or length
      
      7. CLOTHING & DETAILS
      - Subtly reduce visible wrinkles or creases in clothing
      - Slightly boost color vibrancy of clothing if it looks washed out
      - Remove lint, pet hair, or small stains if visible
      - Do NOT change the clothing itself
      
      8. CLEANUP & REPAIR
      - Remove obstructions partially covering the subject (stray objects, hands of others, etc.) where possible
      - Fix lens flare, motion blur, or compression artifacts
      - Remove visible logos, text overlays, or watermarks if present
      - Straighten the image if the horizon or vertical lines are noticeably tilted
      
      9. FINAL POLISH
      - Add a very subtle vignette to draw focus to the face
      - Apply gentle sharpening on eyes and facial features only
      - If the overall image feels flat, add just enough contrast to create depth
      - The mood should feel warm, inviting, and approachable
      
      STRICT PROHIBITIONS:
      - No identity changes — the person must be immediately recognizable
      - No plastic-surgery-level edits (slimming face, enlarging lips, etc.)
      - No HDR or over-saturated look
      - No obvious AI artifacts (melted edges, extra fingers, asymmetric features)
      - No adding accessories, makeup, or clothing changes
      - No body shape modifications of any kind
      
      The final image should make someone think: "Wow, that's a great photo of them" — not "That doesn't look like a real person."
      
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

  const tile = getWatermarkTile();
  const tileMeta = await sharp(tile).metadata();
  const tileW = tileMeta.width ?? 600;
  const tileH = tileMeta.height ?? 600;

  // 构建平铺的 composite 列表，覆盖整张图
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

    // ── 读用户信息 ──
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("credits, free_enhance_used")
      .eq("user_id", user.id)
      .single();

    if (customerError || !customer) {
      console.error("Supabase Error:", customerError);
      return new Response(JSON.stringify({ error: "Failed to fetch customer data" }), { status: 500 });
    }

    const isFreeTrial = !customer.free_enhance_used;

    // ── 积分检查（非首次免费才检查）──
    if (!isFreeTrial && customer.credits < COST_PER_ENHANCE) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", code: "INSUFFICIENT_CREDITS" }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 调 Gemini 生图 ──
    const geminiResult = await callGeminiImageGeneration(imageBase64, mimeType, analysisResult);
    const parts = geminiResult.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData);

    if (!imagePart?.inlineData) {
      return new Response(JSON.stringify({ error: "No image returned from AI" }), { status: 500 });
    }

    const cleanMime: string = imagePart.inlineData.mimeType ?? "image/png";
    const rawBase64: string = imagePart.inlineData.data;
    const rawBuffer = Buffer.from(rawBase64, 'base64');

    // ── 后端加水印 ──
    const watermarkedBuffer = await addWatermarkServer(rawBuffer);
    const watermarkedBase64 = watermarkedBuffer.toString('base64');

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

    // ── 结算：首次免费只改状态，非首次扣费 ──
    let creditsRemaining = customer.credits;

    if (isFreeTrial) {
      await supabase
        .from("customers")
        .update({ free_enhance_used: true })
        .eq("user_id", user.id);
    } else {
      const deduction = await consumeCredits(user.id, "PhotoEnhance");
      if (!deduction.success) {
        console.error(`扣费失败 (User: ${user.id}):`, deduction.message);
      } else {
        creditsRemaining = deduction.remaining ?? creditsRemaining;
      }
    }

    // ── 返回水印图 + enhancement_id ──
    return new Response(
      JSON.stringify({
        success: true,
        enhancementId: enhRecord.id,
        watermarkedImage: watermarkedBase64,
        mimeType: 'image/png',
        creditsRemaining,
        isFreeTrial,
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