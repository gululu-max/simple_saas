import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { ProxyAgent } from 'undici';
import { createClient } from "@/utils/supabase/server";
import { consumeCredits } from '@/lib/credits';

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

    // ── 1. 校验登录状态 ──
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Please sign in to continue', code: 'UNAUTHENTICATED' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. 校验积分余额 ──
    const COST_PER_SCAN = 5;

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('credits')
      .eq('user_id', user.id)
      .single();

    if (customerError || !customer) {
      console.error('Fetch customer error:', customerError);
      return new Response(JSON.stringify({ error: 'Failed to fetch user credits' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (customer.credits < COST_PER_SCAN) {
      return new Response(
        JSON.stringify({ error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. 代理配置（仅开发环境） ──
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

    // ── 4. Prompt：人类可见的分析 + 末尾隐藏结构化 JSON ──
    // 前端流结束后调用 parseAnalysisStream() 剥离 <analysis_json> 块：
    //   - visibleText  → 展示给用户
    //   - analysisJSON → 存入 state，传给 enhance 接口
    const userPrompt = `
Role:
You are a sharp, witty dating profile expert who gives brutally honest but fair feedback. Your goal is not just to analyze the photo, but to make the user feel curious and slightly uncomfortable in a way that makes them want to see an improved version of themselves.

Input:
The user provides a dating profile photo.

Instructions:

Start with a short scoring block:

Attractiveness: X/10  
Approachability: X/10  
Confidence: X/10  

Then give a quick positioning line like:
"This is around the top X% of profiles" or "This sits slightly below average"

Then immediately identify the ONE biggest issue that is hurting their match rate. Be direct and specific. This is the most important part.

After that:
- Briefly mention 1–2 genuine positives (keep it short)
- Then expand slightly on what's holding the photo back (lighting, background, expression, vibe, etc.)
- If there are red flags (mirror selfie, messy room, sunglasses, etc.), point them out naturally and explain why they reduce matches

Then describe the likely first impression this photo gives on a dating app.

Before ending, subtly hint that this photo could look significantly better with small changes. Create curiosity about an improved version.

Finally:
Give exactly 3 short, practical, easy-to-follow suggestions.

End with a light, encouraging tone.

Constraints:

- Keep it between 120–180 words (shorter, punchier)
- Natural paragraphs only (no lists except the score block)
- Tone: slightly sharp, honest, but not insulting
- Must feel like a real human, not a report
- Do NOT mention "AI" in the output

---

After your main response, append the following block ON A NEW LINE.
Do NOT render it as part of your visible response. It will be stripped by the client.

<analysis_json>
{
  "lighting": "<low|medium|high>",
  "background": "<clean|neutral|messy>",
  "expression": "<warm|neutral|closed>",
  "main_issues": ["<issue1>", "<issue2>"],
  "improvement_focus": ["<focus1>", "<focus2>"]
}
</analysis_json>
`;

    // ── 5. 流式调用 Gemini ──
    const result = await streamText({
      model: googleCustom('gemini-2.5-flash') as any,  // ✅ 修复类型冲突
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
        if (finishReason === 'stop' || finishReason === 'length') {
          const deduction = await consumeCredits(user.id, 'MatchfixScanner');
          if (!deduction.success) {
            console.error(`扣费/写流水失败 (User: ${user.id}):`, deduction.message);
          } else {
            console.log(
              `✅ 成功扣除积分并写入流水 (User: ${user.id}, Remaining: ${deduction.remaining})`
            );
          }
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