// ═══════════════════════════════════════════════════════════════
// app/api/select-photo/route.ts — v1
//
// "选片 Agent"：用户上传 N 张照片，一次多模态调用横向对比，
// 选出"修完后当主图、match 提升最大"的那一张。
//
// 设计：
//  - 无积分、无落库、无登录门控（纯前置体验步骤）
//  - 一次 generateText 把所有图一起喂给 Gemini 做对比
//  - 返回 { selectedIndex, reason, runnerUpIndex }
//  - 前端拿到 selectedIndex 后，把该图当主图喂进现有 /api/scanner
// ═══════════════════════════════════════════════════════════════

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { ProxyAgent } from 'undici';
import { classifyUpstreamError } from '@/lib/upstream-errors';

export async function GET() {
  return new Response('Not implemented', { status: 501 });
}

const SELECT_PROMPT = `You are a dating profile strategist. The user uploaded several photos. Your job is to pick the ONE photo that, AFTER light enhancement (lighting / background / color tuning — no identity change), will give the biggest boost to their match rate as the MAIN profile photo.

How to choose:
- PREFER a photo with "good bones": a real, clearly recognizable face, decent composition, and a natural/confident expression — BUT with fixable flaws (dim or flat lighting, distracting background, dull color). These have the highest upside.
- AVOID "unusable" photos: generated/synthetic, cartoon, no clear face, heavily obscured face, or group photos where the subject is ambiguous.
- AVOID photos that are already near-perfect — enhancing them barely moves the needle (low uplift).

The photos are provided in order, each preceded by "Photo i:" where i is the 0-based index.

Return ONLY a JSON object. No prose, no markdown fences, no explanation:
{
  "selectedIndex": <0-based index of the chosen photo>,
  "reason": "<one sentence, second person, why THIS photo — name its strength and the fixable flaw. No emoji, no jargon, don't use the word 'AI'.>",
  "runnerUpIndex": <0-based index of the second-best choice, or the same as selectedIndex if only one usable photo>
}`;

interface IncomingImage {
  base64: string;
  mimeType?: string;
}

interface SelectResult {
  selectedIndex: number;
  reason: string;
  runnerUpIndex: number;
}

function parseSelectResult(text: string, max: number): SelectResult {
  // 容错：去掉可能的 ```json 围栏，再取第一个 {...}
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Model did not return JSON');
  const raw = JSON.parse(match[0]) as Partial<SelectResult>;

  const clamp = (n: unknown): number => {
    const i = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(i) || i < 0 || i >= max) return 0;
    return Math.floor(i);
  };

  return {
    selectedIndex: clamp(raw.selectedIndex),
    reason: typeof raw.reason === 'string' && raw.reason.trim()
      ? raw.reason.trim()
      : 'This one has the most room to improve as your main photo.',
    runnerUpIndex: clamp(raw.runnerUpIndex),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const images: IncomingImage[] = Array.isArray(body.images)
      ? body.images.filter(
          (img: unknown): img is IncomingImage =>
            !!img && typeof (img as IncomingImage).base64 === 'string' && (img as IncomingImage).base64.length > 0,
        )
      : [];

    if (images.length === 0) {
      return new Response(JSON.stringify({ error: 'No photos provided' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 上限保护（与 scorer 的 9 张一致）
    if (images.length > 9) {
      images.length = 9;
    }

    // 单张体积上限（和 scanner 一致）
    for (const img of images) {
      if (img.base64.length > 6_000_000) {
        return new Response(
          JSON.stringify({ error: 'Image too large. Please upload images smaller than 6MB.' }),
          { status: 413, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    // 只有一张就不必调用模型，直接返回
    if (images.length === 1) {
      return new Response(
        JSON.stringify({ selectedIndex: 0, reason: "Only one photo — let's make it your best.", runnerUpIndex: 0 }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── dev proxy（抄 scanner 写法）──
    let fetchOptions: Record<string, unknown> = {};
    if (process.env.NODE_ENV === 'development') {
      const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:30808';
      fetchOptions = { dispatcher: new ProxyAgent(proxyUrl) };
    }

    const googleCustom = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      fetch: (url: RequestInfo | URL, options?: RequestInit) =>
        fetch(url, { ...options, ...fetchOptions } as RequestInit),
    });

    // ── 一次调用：所有图一起喂，做横向对比 ──
    const content: Array<Record<string, unknown>> = [{ type: 'text', text: SELECT_PROMPT }];
    images.forEach((img, i) => {
      content.push({ type: 'text', text: `Photo ${i}:` });
      content.push({ type: 'image', image: img.base64, mimeType: img.mimeType || 'image/jpeg' });
    });

    const { text } = await generateText({
      model: googleCustom('gemini-2.5-flash') as any,
      maxTokens: 1000,
      maxRetries: 1,
      messages: [{ role: 'user', content: content as any }],
    });

    const result = parseSelectResult(text, images.length);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in select-photo API:', error);
    const c = classifyUpstreamError(error as Error);
    return new Response(
      JSON.stringify({ error: c.userMsg, code: c.code, retryable: c.retryable }),
      { status: c.status, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
