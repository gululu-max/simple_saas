// ═══════════════════════════════════════════════════════════════
// app/api/scanner/route.ts — 直接覆盖
//
// v8 change: model gemini-2.5-flash → gemini-3-flash-preview
// ═══════════════════════════════════════════════════════════════

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { ProxyAgent } from 'undici';
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType: receivedMimeType } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (imageBase64.length > 6_000_000) {
      return new Response(
        JSON.stringify({ error: 'Image too large. Please upload an image smaller than 6MB.' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, credits, free_enhance_used')
        .eq('user_id', user.id)
        .single();

      if (customerError || !customer) {
        console.error('Fetch customer error:', customerError);
        return new Response(JSON.stringify({ error: 'Failed to fetch user credits' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        });
      }

      const isFirstFreeUser = !customer.free_enhance_used;

      if (!isFirstFreeUser) {
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

    let fetchOptions: Record<string, unknown> = {};
    if (process.env.NODE_ENV === 'development') {
      const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:10808';
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
4. End with a CTA that paints the outcome, not a question. Use this structure:
   "Same you. [specific fix 1]. [specific fix 2]. More matches. See it in 10 seconds."
   Example: "Same you. Better lighting. Cleaner background. More matches. See it in 10 seconds."
   Tailor the two fixes to the actual main_issue and fix_plan for this photo.

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
  "diagnostics": {
    "lighting": <1-10>,
    "composition": <1-10>,
    "background": <1-10>,
    "eye_contact": <1-10>,
    "expression": <1-10>,
    "color_grading": <1-10>,
    "clothing": <1-10>,
    "sharpness": <1-10>
  },
  "match_prediction": {
    "current_rate": "<estimated match rate as string like '3-5%'>",
    "enhanced_rate": "<estimated match rate after enhancement like '12-18%'>"
  },
  "main_issue": "<the single biggest problem or 'none'>",
  "positive": "<the one genuine strength>",
  "red_flags": [],
  "fix_plan": {
    "background": "<keep|blur|replace_outdoor_park|replace_outdoor_street|replace_cafe|replace_neutral_wall>",
    "lighting": "<no_change|brighten_face|add_rim_light|warm_golden_hour|soften_shadows|add_directional_light>",
    "skin_retouch": "<none|minimal_smooth|moderate_smooth_and_even>",
    "expression": "<no_change|enhance_smile|soften_smile|add_slight_smile>",
    "framing": "<no_change|crop_chest_up|crop_waist_up|zoom_out_slightly>",
    "color_grade": "<no_change|warm_tone|cool_tone|neutral_balance|increase_vibrance>",
    "sharpness": "<no_change|sharpen_face|sharpen_overall>",
    "eye_enhance": "<no_change|brighten_eyes|sharpen_eyes>",
    "visual_outcome": "<one sentence describing the enhanced result in plain language, e.g. 'Warmer skin tone, blurred café background, sharper jawline — looks like a natural golden-hour portrait'>"
  },
  "usage_tips": [
    "<tip 1: save instruction, e.g. 'Save this photo now — we delete it when you leave'>",
    "<tip 2: where to upload, e.g. 'Set as your Hinge cover photo — don't crop it'>",
    "<tip 3: timing/strategy, e.g. 'Swap tonight between 8-10pm for maximum visibility'>"
  ]
}
</analysis_json>

IMPORTANT for diagnostics:
- Score each dimension 1-10 based on what you actually see
- Be honest — a dark indoor selfie should get low lighting, a cluttered background should get low background score
- These scores drive the visual diagnostics panel the user sees

IMPORTANT for match_prediction:
- Estimate realistically based on the photo quality scores
- current_rate: what this photo would get on a typical dating app
- enhanced_rate: what a professionally enhanced version could get
- Express as percentage ranges like "3-5%" or "12-18%"

IMPORTANT for fix_plan:
- Every field must use ONLY the predefined enum values listed above
- Choose the single best option per field based on the photo's actual issues
- visual_outcome is a natural language sentence for the user — describe what the enhanced photo will LOOK like, not what you're doing technically
- If the photo is already_great, set fix_plan to null

IMPORTANT for usage_tips:
- Exactly 3 tips, each under 15 words
- Tip 1: always about saving/downloading
- Tip 2: which platform to upload to + don't crop
- Tip 3: timing or strategy tip
- If route is "needs_real_photo", set to ["Upload a real photo first", "We need the unedited version", "Then we'll build your strategy"]
`;

    const result = await streamText({
      // [v8] model upgraded from gemini-2.5-flash to gemini-3-flash-preview
      model: googleCustom('gemini-3-flash-preview') as any,
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