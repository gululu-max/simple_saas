import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { createClient } from "@/utils/supabase/server";
import { consumeCredits } from "@/lib/credits";

const COST_PER_ENHANCE = 20;

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

    if (parsed.lighting) {
      lines.push(`- Lighting quality is currently **${parsed.lighting}** → improve to make the face clearer and more flattering`);
    }
    if (parsed.background) {
      lines.push(`- Background is **${parsed.background}** → ${parsed.background === 'messy' ? 'clean or simplify the background' : 'keep or subtly enhance the background'}`);
    }
    if (parsed.expression) {
      lines.push(`- Expression reads as **${parsed.expression}** → ${parsed.expression === 'closed' ? 'enhance warmth without altering face shape' : 'preserve this expression'}`);
    }
    if (parsed.main_issues?.length) {
      lines.push(`- Main issues identified: ${parsed.main_issues.join(', ')}`);
    }
    if (parsed.improvement_focus?.length) {
      lines.push(`- Focus improvements on: ${parsed.improvement_focus.join(', ')}`);
    }

    return lines.length > 0
      ? lines.join('\n')
      : 'No specific issues found. Apply subtle general improvements.';
  } catch {
    const trimmed = analysisResult.trim().slice(0, 800);
    return `Based on this prior analysis:\n"""\n${trimmed}\n"""\nAddress the identified issues as part of your enhancement.`;
  }
}

async function callGeminiImageGeneration(
  imageBase64: string,
  mimeType: string,
  analysisResult?: string,
) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`;

  const enhancementContext = buildEnhancementContext(analysisResult);

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a professional dating profile photo editor.

Your goal is to subtly improve this photo so the person looks more attractive, confident, and appealing on dating apps like Tinder or Hinge — while keeping everything 100% realistic and natural.

Based on the following analysis:
${enhancementContext}

Apply ONLY these improvements where needed:

- Improve lighting to make the face clearer and more flattering
- Adjust contrast and color to create a clean, attractive look
- Clean or simplify the background if it is distracting
- Add a slight natural depth-of-field effect if appropriate
- Enhance overall clarity and sharpness subtly

Strict rules:

- Do NOT change the person's identity, face shape, or facial features
- Do NOT beautify excessively or create "perfect skin"
- Do NOT add new elements or change clothing
- Do NOT make the image look AI-generated or over-edited
- Keep it realistic, like a high-quality photo taken by a professional

The result should look like a better version of the SAME photo, not a different photo.

Return only the enhanced image.`
          },
          {
            inlineData: { data: imageBase64, mimeType }
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"]
    }
  };

  // ✅ 用 any 避免 undici fetch 与原生 fetch 类型冲突
  let fetchFn: any = fetch;

  if (process.env.NODE_ENV === 'development') {
    const proxyUrl =
      process.env.HTTP_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:10808';
    console.log('🚀 Local dev mode: using proxy', proxyUrl);
    const agent = new ProxyAgent(proxyUrl);
    fetchFn = (u: any, opts: any) => undiciFetch(u, { ...opts, dispatcher: agent });
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

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType = "image/jpeg", analysisResult } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── 1. 验证登录 ──
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Please sign in", code: "UNAUTHENTICATED" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 2. 验证积分 ──
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("credits")
      .eq("user_id", user.id)
      .single();

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch credits" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (customer.credits < COST_PER_ENHANCE) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", code: "INSUFFICIENT_CREDITS" }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 3. 调 Gemini 图像生成 ──
    const geminiResult = await callGeminiImageGeneration(imageBase64, mimeType, analysisResult);

    const parts = geminiResult.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData);

    if (!imagePart?.inlineData) {
      return new Response(
        JSON.stringify({ error: "No image returned from Gemini" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 4. 扣积分 ──
    const deduction = await consumeCredits(user.id, "PhotoEnhance");
    if (!deduction.success) {
      console.error(`扣费失败 (User: ${user.id}):`, deduction.message);
    }

    // ── 5. 返回优化后的图片 ──
    return new Response(
      JSON.stringify({
        success: true,
        enhancedImage: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType ?? "image/png",
        creditsRemaining: deduction.remaining ?? customer.credits - COST_PER_ENHANCE,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in enhance-photo API:", error);
    const err = error as Error;
    return new Response(
      JSON.stringify({ error: err.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}