/**
 * 用户原图打标签模块
 *
 * 用 Gemini 2.5 Flash 分析用户上传的照片，输出结构化标签：
 * - color_temperature: 色温
 * - light_direction: 光照方向
 * - light_intensity: 光照强度
 * - visible_body: 可见身体范围（独有，用于控制输出 framing）
 *
 * 生产环境可以改用 vLLM，prompt 结构保持一致即可。
 */

import { ProxyAgent, fetch as undiciFetch } from 'undici';

export interface UserPhotoTags {
  color_temperature: 'warm' | 'neutral' | 'cool';
  light_direction: 'left' | 'right' | 'front' | 'top' | 'back' | 'ambient';
  light_intensity: 'harsh' | 'soft' | 'dim';
  visible_body: 'face_only' | 'upper_chest' | 'waist_up' | 'full_body';
}

const TAGGING_PROMPT = `Analyze this photo of a person and output ONLY a single JSON object with the following fields. Do NOT include any other text, markdown, or explanation — just the raw JSON.

Fields:

1. "color_temperature" (one of: "warm", "neutral", "cool")
   - "warm" if the whites/neutrals in the photo appear yellow/orange/golden
   - "neutral" if whites look like clean white, no color cast
   - "cool" if whites appear blue/cyan/bluish-gray

2. "light_direction" (one of: "left", "right", "front", "top", "back", "ambient")
   - "left" if shadows fall on the right side of the subject's face (light from left)
   - "right" if shadows fall on the left side (light from right)
   - "front" if the face is evenly lit from the front with a clear frontal source
   - "top" if the top of face/head is bright and chin has shadow (overhead light, noon sun)
   - "back" if the subject is backlit (rim-lit edges, face darker than background)
   - "ambient" if lighting is diffuse with no clear directional source (cloudy day, indoor soft light)

3. "light_intensity" (one of: "harsh", "soft", "dim")
   - "harsh" if shadows have sharp edges and high contrast (direct sunlight)
   - "soft" if shadows are gradual and low contrast (cloudy, softbox, window light)
   - "dim" if the scene is dark overall (evening, low light indoor)

4. "visible_body" (one of: "face_only", "upper_chest", "waist_up", "full_body")
   - "face_only" if only head and shoulders are visible (selfie from chin up)
   - "upper_chest" if visible from chest up (torso top visible, no arms or only partial arms)
   - "waist_up" if visible from waist up (most of torso, arms visible)
   - "full_body" if legs are visible (standing/sitting full body shot)

Output format (exact JSON, no other text):
{"color_temperature":"...","light_direction":"...","light_intensity":"...","visible_body":"..."}`;

export async function tagUserPhoto(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  proxyUrl?: string,
): Promise<UserPhotoTags> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: TAGGING_PROMPT },
        { inlineData: { data: imageBase64, mimeType } },
      ],
    }],
    generationConfig: {
      temperature: 0.1, // 低温度求稳定输出
      responseMimeType: 'application/json',
    },
  };

  let response;
  if (proxyUrl) {
    const agent = new ProxyAgent(proxyUrl);
    response = await undiciFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      dispatcher: agent,
    });
  } else {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Tagging API error: ${response.status} ${errText}`);
  }

  const result = await response.json() as any;
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // 尝试提取 JSON（有时模型会带 markdown 代码块）
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse tag response: ${text}`);
  }

  const tags = JSON.parse(jsonMatch[0]) as UserPhotoTags;

  // 合法性检查
  validateTags(tags);

  return tags;
}

function validateTags(tags: any): void {
  const valid = {
    color_temperature: ['warm', 'neutral', 'cool'],
    light_direction: ['left', 'right', 'front', 'top', 'back', 'ambient'],
    light_intensity: ['harsh', 'soft', 'dim'],
    visible_body: ['face_only', 'upper_chest', 'waist_up', 'full_body'],
  };

  for (const [field, allowed] of Object.entries(valid)) {
    if (!allowed.includes(tags[field])) {
      throw new Error(`Invalid tag value: ${field}="${tags[field]}" (allowed: ${allowed.join(', ')})`);
    }
  }
}