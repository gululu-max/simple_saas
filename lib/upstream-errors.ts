// ═══════════════════════════════════════════════════════════════
// Shared error classifier for upstream AI calls (Gemini, OpenAI, ...).
// Used by both scanner and enhance-photo routes so the frontend sees
// a consistent code taxonomy.
// ═══════════════════════════════════════════════════════════════

export type UpstreamErrorCode =
  | 'UPSTREAM_OVERLOADED'  // Transient 429/503; auto-retry makes sense
  | 'UPSTREAM_TIMEOUT'     // Timed out; often same as overloaded in practice
  | 'UPSTREAM_ERROR'       // Other upstream 4xx/5xx that isn't retryable
  | 'INTERNAL_ERROR';      // Our code blew up, not the model

export interface ClassifiedError {
  code: UpstreamErrorCode;
  status: number;       // HTTP status to return to the client
  retryable: boolean;   // Whether the client should auto-retry
  userMsg: string;      // Human-facing copy
}

export function classifyUpstreamError(err: Error): ClassifiedError {
  const msg = err.message || '';

  if (/\b(503|502|429)\b|UNAVAILABLE|high demand|overloaded|rate.?limit|quota|resource.*exhausted|capacity/i.test(msg)) {
    return {
      code: 'UPSTREAM_OVERLOADED',
      status: 503,
      retryable: true,
      userMsg: 'Our AI is experiencing high demand right now. Please try again in a few seconds.',
    };
  }

  if (/\b504\b|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|fetch failed|network/i.test(msg)) {
    return {
      code: 'UPSTREAM_TIMEOUT',
      status: 504,
      retryable: true,
      userMsg: 'The request took too long. Please try again.',
    };
  }

  if (/Gemini API error|OpenAI API error|upstream/i.test(msg)) {
    return {
      code: 'UPSTREAM_ERROR',
      status: 502,
      retryable: false,
      userMsg: 'The AI service returned an unexpected response. Please try again.',
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    status: 500,
    retryable: false,
    userMsg: 'Something went wrong on our end. Please try again.',
  };
}

// ─── Gemini no-image classification ──────────────────────────────
// When Gemini returns 200 but no image, it's usually either a safety
// block or a generic "model couldn't produce output" situation. These
// mean different things to the user — safety blocks are content-related
// (try a different photo), others are model-related (try again).

export type NoImageCode = 'SAFETY_BLOCKED' | 'NO_IMAGE_RETURNED';

export interface NoImageClassification {
  code: NoImageCode;
  status: number;
  retryable: boolean;
  userMsg: string;
  detail: string | null;
}

export function classifyGeminiNoImage(geminiResult: any): NoImageClassification {
  const promptBlock: string | undefined = geminiResult?.promptFeedback?.blockReason;
  const finishReason: string | undefined = geminiResult?.candidates?.[0]?.finishReason;

  // Gemini signals safety/recitation blocks in two places
  const isSafety =
    (typeof promptBlock === 'string' && promptBlock !== 'BLOCK_REASON_UNSPECIFIED') ||
    finishReason === 'SAFETY' ||
    finishReason === 'RECITATION' ||
    finishReason === 'PROHIBITED_CONTENT' ||
    finishReason === 'SPII';

  if (isSafety) {
    return {
      code: 'SAFETY_BLOCKED',
      status: 422,
      retryable: false,
      userMsg: "This photo can't be processed by our AI. Try a different photo — clear face, good lighting works best.",
      detail: promptBlock ?? finishReason ?? null,
    };
  }

  return {
    code: 'NO_IMAGE_RETURNED',
    status: 502,
    retryable: true,
    userMsg: 'The AI didn\'t produce an image this time. Please try again.',
    detail: finishReason ?? null,
  };
}
