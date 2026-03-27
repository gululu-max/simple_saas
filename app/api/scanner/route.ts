import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { ProxyAgent } from 'undici';
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType: receivedMimeType } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (imageBase64.length > 6_000_000) {
      return new Response(
        JSON.stringify({ error: 'Image too large. Please upload an image smaller than 6MB.' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── 1. 尝试获取登录状态（不强制要求登录）──
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // ── 2. 已登录用户：前置校验（Scanner 本身不扣费，费用在 enhance 统一扣）──
    if (user) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, credits, free_enhance_used')
        .eq('user_id', user.id)
        .single();

      if (customerError || !customer) {
        console.error('Fetch customer error:', customerError);
        return new Response(JSON.stringify({ error: 'Failed to fetch user credits' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const isFirstFreeUser = !customer.free_enhance_used;

      if (!isFirstFreeUser) {
        // 查会员状态
        const { createClient: createAdminClient } = await import('@supabase/supabase-js');
        const adminClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const now = new Date().toISOString();
        const { data: subData } = await adminClient
          .from('subscriptions')
          .select('status, current_period_end')
          .eq('customer_id', customer.id)
          .in('status', ['active', 'canceled'])
          .maybeSingle();

        const isSubscribed = !!subData && (
          subData.status === 'active' ||
          (subData.status === 'canceled' && !!subData.current_period_end && subData.current_period_end > now)
        );

        const requiredCredits = isSubscribed ? 20 : 25;

        if (customer.credits < requiredCredits) {
          return new Response(
            JSON.stringify({ error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' }),
            { status: 402, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }
    // 未登录用户：跳过积分检查，免费分析

    // ── 3. 代理配置（仅开发环境）──
    let fetchOptions: Record<string, unknown> = {};

    if (process.env.NODE_ENV === 'development') {
      const proxyUrl =
        process.env.HTTP_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:10808';
      console.log('🚀 Local dev mode: using proxy', proxyUrl);
      fetchOptions = { dispatcher: new ProxyAgent(proxyUrl) };
    }

    const googleCustom = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      fetch: (url: RequestInfo | URL, options?: RequestInit) =>
        fetch(url, { ...options, ...fetchOptions } as RequestInit),
    });

    const mimeType = receivedMimeType || 'image/jpeg';

    const userPrompt = `
Role:
You are a sharp, witty dating profile expert. Brutally honest but fair.

Input:
A dating profile photo.

Step 1 — Authenticity Check (internal, never show this process to user):
Before scoring, assess the photo for signs of heavy editing:
- Overly smooth skin with no texture
- Warped lines/surfaces near face or body
- Unnatural lighting uniformity
- AI-generated artifacts (extra fingers, asymmetric ears, melted backgrounds)
- Filter-heavy color grading (extreme warmth, fake film grain)
- Teeth/eyes unnaturally white or bright

Rate authenticity: raw / lightly_edited / heavily_edited / ai_generated

Step 2 — Route output based on authenticity:

[If heavily_edited or ai_generated]:
Skip the normal scoring. Instead write a short, witty paragraph (40-60 words) that:
- Acknowledges the photo looks polished
- Points out that dating app users can sense over-editing and it kills trust
- Tells them their real face is the one that gets the date, not the filtered version
- Asks them to upload an unedited photo for a real analysis
End with: "Send me the raw version. That's the one worth working with."

[If raw or lightly_edited AND score would be 8+/10 across all three]:
Score block as normal, then a short paragraph (40-60 words) that:
- Genuinely compliments what works
- Makes it clear no major edits are needed
- Suggests at most 1 micro-tweak (or says "honestly, don't touch it")
End with: "This one's ready. Go get your matches."
Set fix_plan to null in JSON.

[If raw or lightly_edited AND any score below 8]:
Score block, then the standard analysis:
1. ONE biggest issue — direct and specific
2. 1 genuine positive (one sentence)
3. First impression on a dating app (one sentence)
4. End with: "Want to see what a +2 version could look like? I can show you in 10 seconds."

Constraints (all routes):
- Natural paragraphs only — no bullets, no headers, no lists
- Tone: sharp, human, slightly teasing — never cruel
- Do NOT mention "AI" or "AI-generated" — say "heavily edited" or "filtered"
- Do NOT reveal the authenticity check process
- Red flags must be called out if present

---

<analysis_json>
{
  "authenticity": "<raw|lightly_edited|heavily_edited|ai_generated>",
  "authenticity_signals": ["<signal1>", "<signal2>"],
  "route": "<needs_real_photo|already_great|can_improve>",
  "scores": { "attractiveness": X, "approachability": X, "confidence": X },
  "percentile": X,
  "lighting": "<low|medium|high>",
  "background": "<clean|neutral|messy>",
  "expression": "<warm|neutral|closed>",
  "main_issue": "<the single biggest problem or 'none'>",
  "positive": "<the one genuine strength>",
  "red_flags": [],
  "fix_plan": {
    "crop": "<suggestion or 'none'>",
    "brightness": <-100 to 100>,
    "contrast": <-100 to 100>,
    "saturation": <-100 to 100>,
    "warmth": <-100 to 100>,
    "sharpen": <0 to 100>,
    "vignette": <0 to 100>,
    "suggestion": "<one-line or 'no edit needed'>"
  } // set entire fix_plan to null if route is "needs_real_photo" or "already_great"
}
</analysis_json>
`;

    // ── 4. 流式调用 Gemini ──
    const result = await streamText({
      model: googleCustom('gemini-2.5-flash') as any,
      maxRetries: 1,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image', image: imageBase64, mimeType },
          ],
        },
      ],
      async onFinish({ finishReason }) {
        if (!user) {
          console.log('👤 Guest scan completed — no credits deducted');
        } else {
          console.log(`✅ Scan completed (User: ${user.id}) — credits will be deducted in enhance step`);
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error in Scanner API:', error);
    const err = error as Error;
    return new Response(
      JSON.stringify({
        error: err.message || 'Internal Server Error',
        details: 'Check Vercel logs for more info',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}