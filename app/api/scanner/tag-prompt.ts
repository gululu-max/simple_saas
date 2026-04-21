// app/api/scanner/tag-prompt.ts
//
// 打标 prompt 独立成模块，方便后续切 vLLM 时替换。
// 返回值必须是以下 4 个字段的 JSON：
//   color_temperature: 'warm' | 'neutral' | 'cool'
//   light_direction:   'left' | 'right' | 'front' | 'top' | 'back' | 'ambient'
//   light_intensity:   'harsh' | 'soft' | 'dim'
//   visible_body:      'face_only' | 'upper_chest' | 'waist_up' | 'full_body'

// app/api/scanner/tag-prompt.ts

export const TAG_PROMPT = `Analyze this photo of a person and output ONLY a single JSON object with exactly four fields. Do NOT include any other text, markdown, or explanation.

Fields:

1. "color_temperature" (one of: "warm", "neutral", "cool")
2. "light_direction" (one of: "left", "right", "front", "top", "back", "ambient")
3. "light_intensity" (one of: "harsh", "soft", "dim")
4. "visible_body" (one of: "face_only", "upper_chest", "waist_up", "full_body")

Definitions:
- color_temperature: "warm" if whites/neutrals appear yellow/orange/golden, "neutral" if clean white, "cool" if bluish.
- light_direction: "left"=shadows on right side of face, "right"=shadows on left, "front"=even frontal lighting, "top"=overhead (bright top, shadowed chin), "back"=backlit with rim light, "ambient"=diffuse no direction.
- light_intensity: "harsh"=sharp high-contrast shadows, "soft"=gradual low-contrast, "dim"=dark scene overall.
- visible_body: "face_only"=head and shoulders only, "upper_chest"=chest up, "waist_up"=waist up with arms, "full_body"=legs visible.

Output exactly this JSON with no other text, no markdown fences, no explanation:
{"color_temperature":"...","light_direction":"...","light_intensity":"...","visible_body":"..."}`;

export type SceneTags = {
  color_temperature: 'warm' | 'neutral' | 'cool';
  light_direction: 'left' | 'right' | 'front' | 'top' | 'back' | 'ambient';
  light_intensity: 'harsh' | 'soft' | 'dim';
  visible_body: 'face_only' | 'upper_chest' | 'waist_up' | 'full_body';
};

const VALID: Record<keyof SceneTags, string[]> = {
  color_temperature: ['warm', 'neutral', 'cool'],
  light_direction: ['left', 'right', 'front', 'top', 'back', 'ambient'],
  light_intensity: ['harsh', 'soft', 'dim'],
  visible_body: ['face_only', 'upper_chest', 'waist_up', 'full_body'],
};

export function parseSceneTags(text: string): SceneTags {
  const cleaned = text.replace(/```json|```/g, '').trim();
  let parsed: any = {};

  // 先尝试正常 JSON 解析
  try {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } else {
      throw new Error('No complete braces');
    }
  } catch {
    // 兜底:逐字段正则提取(处理截断的 JSON)
    for (const field of Object.keys(VALID)) {
      const re = new RegExp(`"${field}"\\s*:\\s*"([a-z_]+)"`);
      const m = cleaned.match(re);
      if (m) parsed[field] = m[1];
    }
  }

  // 校验
  for (const [field, allowed] of Object.entries(VALID)) {
    if (!allowed.includes(parsed[field])) {
      throw new Error(
        `Invalid tag value: ${field}="${parsed[field]}" (allowed: ${allowed.join(', ')}) — raw: ${text.slice(0, 300)}`
      );
    }
  }
  return parsed as SceneTags;
}