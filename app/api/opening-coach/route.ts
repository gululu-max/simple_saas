import { z } from "zod";

const inputSchema = z.object({
  action: z.enum(["generate", "simulate", "review"]),
  profile: z.string().trim().min(10).max(1200),
  vibe: z.enum(["playful", "natural", "direct", "thoughtful"]),
  opener: z.string().trim().max(500).optional(),
  userReply: z.string().trim().max(700).optional(),
});

const vibeGuide = {
  playful: "lightly playful and warm; never insulting or sexual",
  natural: "relaxed, conversational, and specific",
  direct: "clear, confident, and respectful",
  thoughtful: "curious, attentive, and genuine",
} as const;

function extractJson(text: string) {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("The model returned an invalid response.");
  return JSON.parse(match[0]);
}

async function askOllama(prompt: string) {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3.2:3b",
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.7, num_predict: 700 },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Ollama returned ${response.status}: ${detail.slice(0, 180)}`);
    }
    const data = await response.json() as { response?: string };
    if (!data.response) throw new Error("Ollama returned an empty response.");
    return extractJson(data.response);
  } finally {
    clearTimeout(timer);
  }
}

function baseContext(profile: string, vibe: keyof typeof vibeGuide) {
  return `You are Opening Coach, a dating-conversation practice coach. Be kind, concise, and useful. Never use manipulation, negging, sexual pressure, insults, protected-trait assumptions, or false promises. Help the user start a respectful conversation based only on the profile below.\n\nOther person's profile:\n${profile}\n\nRequested tone: ${vibeGuide[vibe]}`;
}

export async function POST(request: Request) {
  try {
    const payload = inputSchema.parse(await request.json());
    const context = baseContext(payload.profile, payload.vibe);
    let prompt: string;

    if (payload.action === "generate") {
      prompt = `${context}\n\nCreate exactly three distinctly worded opening messages. Each must reference a real detail from the profile, end with an easy question, and stay under 240 characters. Return JSON only:\n{"strategy":"one short sentence","openers":[{"text":"...","label":"2-4 word tone label","why":"one short sentence","watchOut":"one short sentence"}]}`;
    } else if (payload.action === "simulate") {
      if (!payload.opener) return Response.json({ error: "Choose an opener first." }, { status: 400 });
      prompt = `${context}\n\nThe user plans to send this opener:\n${payload.opener}\n\nSimulate one plausible, interested-but-not-overly-eager reply (max 180 characters). Then give one short tip for the user's next message. Return JSON only:\n{"reply":"...","tip":"..."}`;
    } else {
      if (!payload.opener || !payload.userReply) return Response.json({ error: "An opener and reply are required." }, { status: 400 });
      prompt = `${context}\n\nOpener:\n${payload.opener}\n\nThe match replied with a plausible short response. The user wrote this next message:\n${payload.userReply}\n\nCoach it. Score each category from 1 to 5. Give a short, encouraging diagnosis and one improved rewrite under 260 characters. Return JSON only:\n{"scores":{"natural":1,"specific":1,"momentum":1,"respect":1},"feedback":"...","rewrite":"..."}`;
    }

    return Response.json(await askOllama(prompt));
  } catch (error) {
    console.error("[opening-coach]", error);
    const message = error instanceof z.ZodError
      ? "Please add a little more profile context."
      : "Opening Coach is unavailable. Make sure Ollama is running, then try again.";
    return Response.json({ error: message }, { status: 503 });
  }
}
