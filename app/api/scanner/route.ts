// ═══════════════════════════════════════════════════════════════
// app/api/scanner/route.ts — v10
//
// v10 changes:
// 1. [PROMPT] Analysis prompt rewritten:
//    - Pure JSON output (no mixed prose/JSON)
//    - Authenticity collapsed to 3 tiers (usable / suspiciously_edited / unusable)
//    - Only "unusable" blocks the funnel; filtered selfies now pass through
//    - Copy fields broken out for frontend templating
//    - Scoring anchors added to reduce subjective drift
//    - Fix plan defaults to conservative ("no_change") to reduce over-editing
// 2. [COPY] Friendlier generic error message
// ═══════════════════════════════════════════════════════════════

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, generateText } from 'ai';
import { ProxyAgent } from 'undici';
import { createClient } from "@/utils/supabase/server";

// ── Retry helper ──
async function streamTextWithRetry(
  params: Parameters<typeof streamText>[0],
  maxRetries = 2,
  delayMs = 2000,
) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await streamText(params);
      return result;
    } catch (err) {
      lastError = err as Error;
      console.warn(`⚠️ streamText attempt ${attempt + 1} failed: ${lastError.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

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

    const userPrompt = `You are a dating profile photo analyst. You return ONLY a JSON object. No preamble, no explanation, no markdown fences, no code blocks.

==============================
STEP 1 — AUTHENTICITY CHECK
==============================

Judge the photo on a 3-tier scale. Be generous — modern phone cameras apply beauty filters by default, and that is NORMAL, not a red flag.

- "usable" → The photo shows a real person whose identity is clearly recognizable. This includes ALL of the following, which all count as usable:
  • Raw photos with no editing
  • iPhone portrait mode / computational photography
  • Default beauty-camera smoothing (Meitu, BeautyCam, SNOW, default iOS selfie)
  • Instagram / VSCO / Lightroom filters
  • Moderate skin smoothing, brightening, color grading
  • Visible but not extreme editing
  DEFAULT TO "usable". When in doubt, choose usable.

- "suspiciously_edited" → Clear signs the face has been geometrically altered or reconstructed, BUT the person is still probably recognizable:
  • Obviously warped jawline, slimmed face, enlarged eyes beyond natural range
  • Skin looks like plastic / painted, zero texture anywhere on the face
  • Background has melted or bent straight lines near the subject
  NOTE: Still route this to "can_improve". Do NOT block the user. We'll mention it gently in the headline but continue to full analysis.

- "unusable" → Not a usable dating profile photo AT ALL:
  • Fully generated / synthetic person (not a real photo)
  • Anime, cartoon, illustration, 3D render
  • No human face visible / face heavily obscured
  • Clear artifacts: extra fingers, asymmetric ears, impossible anatomy, melted features
  • Multiple people where the target subject is ambiguous

==============================
STEP 2 — ROUTING
==============================

- authenticity == "unusable" → route = "needs_real_photo". Skip scoring. Set scores, percentile, diagnostics, match_prediction, fix_plan, usage_tips to null. Fill copy.headline and copy.cta only.

- authenticity is "usable" or "suspiciously_edited":
  Score all diagnostics first, then:
  - If ALL three main scores (attractiveness, approachability, confidence) are ≥ 8 → route = "already_great". fix_plan = null. Fill all copy fields except one_liner_issue (null).
  - Otherwise → route = "can_improve". Fill fix_plan. Fill all copy fields.

==============================
STEP 3 — SCORING ANCHORS
==============================

All diagnostic dimensions are scored 1-10. Use these anchors:

Lighting:
  1-3: Face is in shadow, muddy, or blown out
  4-6: Usable but flat / uneven / slightly dark
  7-8: Clean even light, face well-lit
  9-10: Flattering directional light, professional quality

Composition:
  1-3: Subject off-center awkwardly, head cut off, weird framing
  4-6: Acceptable but generic / centered-selfie framing
  7-8: Intentional framing, good subject placement
  9-10: Strong composition, leading lines or rule of thirds used well

Background:
  1-3: Cluttered, distracting, messy bedroom, bathroom mirror
  4-6: Neutral but boring (plain wall, generic indoor)
  7-8: Clean and contextual (adds story without distraction)
  9-10: Background actively enhances the photo

Eye contact:
  1-3: Looking away / eyes closed / sunglasses blocking
  4-6: Partial eye contact, slight angle
  7-8: Clear eye contact with camera
  9-10: Engaging, magnetic eye contact

Expression:
  1-3: Blank, grumpy, forced, uncomfortable
  4-6: Neutral, mild, unclear emotion
  7-8: Genuine smile or confident expression
  9-10: Warm, inviting, natural-looking expression

Color grading:
  1-3: Heavy color cast, ugly tones, over-saturated
  4-6: Acceptable but flat colors
  7-8: Balanced, natural color
  9-10: Intentional, cohesive color palette

Clothing:
  1-3: Stained, wrinkled, ill-fitting, distracting graphic tees
  4-6: Fine but generic / lazy
  7-8: Fits well, suits the person
  9-10: Style statement that matches personality

Sharpness:
  1-3: Blurry, motion blur, out of focus
  4-6: Soft but usable
  7-8: Sharp face, clean detail
  9-10: Tack sharp, professional quality

Main scores (attractiveness, approachability, confidence): score 1-10 based on overall impression. percentile: 1-100 estimate of where this photo ranks against typical dating app photos.

==============================
STEP 4 — MATCH PREDICTION
==============================

Estimate based on overall photo quality. Be realistic — most Tinder photos get 2-6% match rates.

Rough guide (average of attractiveness + approachability + confidence):
- Avg 1-3 → current "1-3%", enhanced "5-9%"
- Avg 4-5 → current "3-6%", enhanced "9-14%"
- Avg 6-7 → current "6-10%", enhanced "12-18%"
- Avg 8-10 → current "10-15%", enhanced "15-22%"

Adjust ±2% based on standout weak or strong dimensions.

==============================
STEP 5 — COPY FIELDS
==============================

Write these short, human, sharp, slightly teasing — never cruel. Second person ("you"). No emoji. No hashtags. Do not use the word "AI" or "algorithm". Do not mention the authenticity check process.

FOR route == "needs_real_photo":
- headline: 1 sentence (≤ 20 words). Gently name that this isn't a real photo (say "generated" or "not a real photo of you" — do NOT use the word "AI"). No shaming.
  Example: "This one's generated, not a photo of you — and dating app users can smell that from a mile away."
- cta: exactly this string → "Upload a real photo of you. That's the one worth working with."
- one_liner_positive, one_liner_issue, first_impression: null

FOR route == "already_great":
- headline: 1 sentence (≤ 20 words). Direct compliment on what's working.
- one_liner_positive: 1 sentence on the standout strength.
- one_liner_issue: null
- first_impression: 1 sentence on how this lands in a swipe feed (positive).
- cta: exactly this string → "This one's ready. Go get your matches."

FOR route == "can_improve":
- headline: 1 sentence (≤ 20 words). Name the ONE biggest issue directly. If authenticity == "suspiciously_edited", add a light touch like "this one looks a bit heavily filtered, but here's what else I'd tune."
- one_liner_positive: 1 sentence on a genuine strength (must be real, not fabricated).
- one_liner_issue: 1 sentence expanding on the main issue with specifics.
- first_impression: 1 sentence on how this currently lands in a swipe feed (honest).
- cta: use this template exactly, filling the two slots with the TWO most impactful fixes from fix_plan in plain language (2-4 words each, no jargon):
  "Same you. {FIX_1}. {FIX_2}. More matches. See it in 10 seconds."
  Good FIX examples: "Better lighting", "Cleaner background", "Sharper focus", "Warmer tone", "Blurred background", "Brighter face"
  Bad FIX examples (too technical): "add_rim_light", "neutral_balance", "sharpen_face"

==============================
STEP 6 — FIX PLAN ENUMS
==============================

Use ONLY these exact values:
- background: keep | blur | replace_outdoor_park | replace_outdoor_street | replace_cafe | replace_neutral_wall
- lighting: no_change | brighten_face | add_rim_light | warm_golden_hour | soften_shadows | add_directional_light
- skin_retouch: none | minimal_smooth | moderate_smooth_and_even
- expression: no_change | enhance_smile | soften_smile | add_slight_smile
- framing: no_change | crop_chest_up | crop_waist_up | zoom_out_slightly
- color_grade: no_change | warm_tone | cool_tone | neutral_balance | increase_vibrance
- sharpness: no_change | sharpen_face | sharpen_overall
- eye_enhance: no_change | brighten_eyes | sharpen_eyes

DEFAULTS (when in doubt, pick these — they are the safe choices):
- background: keep (only blur/replace if it's actively hurting the photo)
- lighting: no_change
- skin_retouch: none or minimal_smooth
- expression: no_change (expression edits are the highest-risk edits)
- framing: no_change
- color_grade: no_change
- sharpness: no_change
- eye_enhance: no_change

Only override a default if the diagnostic for that dimension is ≤ 6.

visual_outcome: 1 plain-English sentence (≤ 25 words) describing what the enhanced photo will LOOK like to the user. No jargon.
  Good: "Softer shadows on your face, blurred background behind you, same vibe but sharper."
  Bad: "Applied brighten_face and blur background with neutral color grade."

==============================
STEP 7 — USAGE TIPS
==============================

Exactly 3 tips, each ≤ 15 words, second person.
- Tip 1: about saving/downloading the enhanced photo
- Tip 2: which app to use it on + "don't crop it"
- Tip 3: timing or strategy tip for posting

FOR route == "needs_real_photo", set usage_tips to null.

==============================
RED FLAGS
==============================

Fill red_flags array with SHORT strings describing any of: bathroom mirror selfie, sunglasses covering eyes, group photo ambiguity, gym flexing, car selfie, heavy snapchat filter, shirtless non-beach context, holding dead fish, photo with ex cropped out. Empty array if none.

==============================
OUTPUT JSON SCHEMA
==============================

Return ONLY this JSON object. No markdown fences, no prose before or after, no explanation.

{
  "authenticity": "usable" | "suspiciously_edited" | "unusable",
  "route": "needs_real_photo" | "already_great" | "can_improve",
  "scores": { "attractiveness": <1-10>, "approachability": <1-10>, "confidence": <1-10> } | null,
  "percentile": <1-100> | null,
  "diagnostics": {
    "lighting": <1-10>,
    "composition": <1-10>,
    "background": <1-10>,
    "eye_contact": <1-10>,
    "expression": <1-10>,
    "color_grading": <1-10>,
    "clothing": <1-10>,
    "sharpness": <1-10>
  } | null,
  "match_prediction": {
    "current_rate": "<e.g. '3-5%'>",
    "enhanced_rate": "<e.g. '12-18%'>"
  } | null,
  "copy": {
    "headline": "<string>",
    "one_liner_positive": "<string>" | null,
    "one_liner_issue": "<string>" | null,
    "first_impression": "<string>" | null,
    "cta": "<string>"
  },
  "red_flags": [ "<string>", ... ],
  "fix_plan": {
    "background": "<enum>",
    "lighting": "<enum>",
    "skin_retouch": "<enum>",
    "expression": "<enum>",
    "framing": "<enum>",
    "color_grade": "<enum>",
    "sharpness": "<enum>",
    "eye_enhance": "<enum>",
    "visual_outcome": "<string>"
  } | null,
  "usage_tips": [ "<string>", "<string>", "<string>" ] | null
}`;

    // --- Model selection with probe ---

    const MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash'] as const;

    let chosenModel: string | null = null;

    for (const modelName of MODELS) {
      try {
        await generateText({
          model: googleCustom(modelName) as any,
          maxTokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        });
        chosenModel = modelName;
        console.log(`🎯 Model available: ${modelName}`);
        break;
      } catch (err) {
        console.warn(`⚠️ ${modelName} unavailable: ${(err as Error).message}`);
      }
    }

    if (!chosenModel) {
      return new Response(
        JSON.stringify({
          error: 'Our AI is experiencing high demand right now. Please try again in a few seconds.',
          code: 'MODEL_OVERLOADED',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- streamText with retry (up to 2 retries, 2s delay) ---

    const result = await streamTextWithRetry(
      {
        model: googleCustom(chosenModel) as any,
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
            console.log(`✅ Scan completed (User: ${user.id}, model: ${chosenModel}) — credits will be deducted in enhance step`);
          }
        },
      },
      2,    // maxRetries
      2000, // delayMs
    );

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error in Scanner API:', error);
    const err = error as Error;
    const msg = err.message || '';

    // Detect overload / rate-limit / 503 errors and return friendly code
    const isOverload = /overloaded|503|rate.?limit|quota|capacity|resource.*exhausted/i.test(msg);

    return new Response(
      JSON.stringify({
        error: isOverload
          ? 'Our AI is experiencing high demand right now. Please try again in a few seconds.'
          : 'Something went wrong on our end. Please try again.',
        code: isOverload ? 'MODEL_OVERLOADED' : 'INTERNAL_ERROR',
        retryable: isOverload,
      }),
      {
        status: isOverload ? 503 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}