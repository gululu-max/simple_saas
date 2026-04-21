/**
 * 场景融合验证脚本 v3
 *
 * 完整 pipeline：
 *   用户原图 → Gemini Flash 打标签 → 从 scene-library.json 匹配背景 → Gemini 融合 → 输出
 *
 * 运行：npm run test:fusion
 *
 * 输入：
 *   scripts/test-inputs/     用户原图（3-10 张测试图）
 *   scripts/scene-library.json   场景库元数据
 *   public/scene-library/        场景库图片（实际 jpg 文件）
 *
 * 输出：
 *   scripts/test-outputs/    融合结果
 *   scripts/test-outputs/log.txt   完整调用日志
 *   scripts/test-outputs/match.json   每次匹配的详情（便于复盘）
 */

import { ProxyAgent, fetch as undiciFetch } from 'undici';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { tagUserPhoto, UserPhotoTags } from './tag-user-photo';
import { matchScene, SceneEntry, MatchResult } from './match-scene';

// ─── 路径 ────────────────────────────────────────────────────
let SCRIPT_DIR: string;
try {
  SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
} catch {
  SCRIPT_DIR = __dirname;
}

const PROJECT_ROOT = path.join(SCRIPT_DIR, '..');
const INPUT_DIR = path.join(SCRIPT_DIR, 'test-inputs');
const SCENE_LIBRARY_DIR = path.join(PROJECT_ROOT, 'public', 'scene-library');
const SCENE_LIBRARY_JSON = path.join(SCRIPT_DIR, 'scene-library.json');
const OUTPUT_DIR = path.join(SCRIPT_DIR, 'test-outputs');
const LOG_PATH = path.join(OUTPUT_DIR, 'log.txt');
const MATCH_LOG_PATH = path.join(OUTPUT_DIR, 'match.json');
const ENV_PATH = path.join(PROJECT_ROOT, '.env.local');

console.log('📍 脚本目录:', SCRIPT_DIR);
console.log('📍 用户原图:', INPUT_DIR);
console.log('📍 场景库图片:', SCENE_LIBRARY_DIR);
console.log('📍 场景库元数据:', SCENE_LIBRARY_JSON);
console.log('📍 输出目录:', OUTPUT_DIR);
console.log('');

// ─── 环境 ────────────────────────────────────────────────────
if (!fs.existsSync(ENV_PATH)) {
  console.error('❌ 找不到 .env.local');
  process.exit(1);
}
dotenv.config({ path: ENV_PATH });

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!API_KEY) {
  console.error('❌ 缺少 GOOGLE_GENERATIVE_AI_API_KEY');
  process.exit(1);
}

const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:30888';
console.log('🌐 代理:', PROXY_URL);

// ─── 读 scene-library.json ──────────────────────────────────
if (!fs.existsSync(SCENE_LIBRARY_JSON)) {
  console.error('❌ 找不到场景库元数据:', SCENE_LIBRARY_JSON);
  process.exit(1);
}

const sceneLibrary: SceneEntry[] = JSON.parse(fs.readFileSync(SCENE_LIBRARY_JSON, 'utf-8'));
console.log(`✅ 场景库已加载: ${sceneLibrary.length} 条`);

// 检查场景库图片文件是否都存在
const missingFiles: string[] = [];
for (const s of sceneLibrary) {
  const imgPath = path.join(SCENE_LIBRARY_DIR, s.file);
  if (!fs.existsSync(imgPath)) missingFiles.push(s.file);
}
if (missingFiles.length > 0) {
  console.error(`❌ ${missingFiles.length} 张场景图片文件缺失:`);
  missingFiles.slice(0, 10).forEach(f => console.error(`   ${f}`));
  if (missingFiles.length > 10) console.error(`   ... 和另外 ${missingFiles.length - 10} 个`);
  console.error(`   检查 public/scene-library/ 目录，或 scene-library.json 里的 file 字段`);
  process.exit(1);
}
console.log('✅ 所有场景图片文件都存在');
console.log('');

// ─── 融合 prompt（带动态参数）──────────────────────────────
function buildFusionPrompt(userTags: UserPhotoTags, scene: SceneEntry): string {
  return `You are an elite portrait photographer reshooting a scene. You will receive TWO images and must produce ONE output.

══════════════════════════════════════════════
IMAGE ROLES
══════════════════════════════════════════════

IMAGE 1 (PERSON): Identity reference. Use for face, hair, skin, and clothing only.
IMAGE 2 (SCENE): Target environment. The output photo should feel like it was shot in this location.

══════════════════════════════════════════════
CONTEXT (tag-matched, already compatible)
══════════════════════════════════════════════

User photo:
  - Visible body: ${userTags.visible_body}
  - Color temperature: ${userTags.color_temperature}
  - Light direction: ${userTags.light_direction}

Target scene:
  - Recommended person size: ${scene.recommended_person_size}
  - Color temperature: ${scene.color_temperature}
  - Light direction: ${scene.light_direction}
  - Scale reference: ${scene.person_scale_reference}

══════════════════════════════════════════════
CORE PRINCIPLE — READ TWICE
══════════════════════════════════════════════

You are NOT pasting IMAGE 1 onto IMAGE 2. You are RE-PHOTOGRAPHING the person from IMAGE 1 as if they had walked into IMAGE 2's environment and the photographer took a new picture.

The person's POSE, BODY ORIENTATION, HEAD ANGLE, and HAND POSITIONS should ADAPT to make sense in the new scene.

══════════════════════════════════════════════
LAYERED PRESERVATION
══════════════════════════════════════════════

STRICTLY PRESERVE from IMAGE 1 (identity layer):
- Facial bone structure (jawline, cheekbones, forehead)
- Facial feature shapes (eyes, nose, mouth, ears)
- Skin color and undertone
- Hair style, color, length, texture
- Every clothing item — garment type, color, pattern, fit, logos

ADAPT to the scene:
- Body pose (standing / sitting / leaning / walking)
- Posture, body orientation, arm/hand positions
- Head tilt and gaze direction

══════════════════════════════════════════════
PARTIAL VIEW HANDLING — IMAGE 1 SHOWS: ${userTags.visible_body}
══════════════════════════════════════════════

${getPartialViewInstructions(userTags.visible_body)}

══════════════════════════════════════════════
SCALE ANCHORING
══════════════════════════════════════════════

Use visible reference objects in IMAGE 2 for scale:
- Standard chair seat: ~45cm high, seated adult's shoulders reach chair backrest top
- Standard doorway: ~200cm tall, standing adult's head reaches ~85-90% of doorway height
- Standard cafe table: ~75cm high, seated adult's arms rest on table surface
- Park bench: ~45cm high, seated adult's knees bend at ~90°
- Adult head height ≈ 1/7 to 1/8 of total standing body height

The person should occupy approximately ${getSizeGuidance(scene.recommended_person_size)} of the frame height.

${scene.person_scale_reference === 'no_reference'
  ? 'NOTE: This scene has no clear scale reference objects. Use your best judgment to place the person at a natural size.'
  : 'NOTE: This scene has scale reference objects. Use them to verify the person\'s size is proportionally correct.'}

══════════════════════════════════════════════
LIGHTING AND COLOR — CRITICAL FOR REALISM
══════════════════════════════════════════════

IMAGE 2's color temperature is ${scene.color_temperature.toUpperCase()}. Match the person's skin tones accordingly:
${getColorTemperatureGuidance(scene.color_temperature)}

IMAGE 2's main light direction is ${scene.light_direction.toUpperCase()}. Re-light the person to match:
${getLightDirectionGuidance(scene.light_direction)}

Shadows on the person must fall in the same direction as shadows on objects in IMAGE 2.

══════════════════════════════════════════════
BACKGROUND TREATMENT
══════════════════════════════════════════════

Keep IMAGE 2's background clearly recognizable. Apply only slight, camera-natural depth-of-field softness — NOT heavy artistic blur.

══════════════════════════════════════════════
ABSOLUTE PROHIBITIONS
══════════════════════════════════════════════

1. Do NOT alter the person's face, hair, skin tone, or clothing.
2. Do NOT invent body parts that were not visible in IMAGE 1.
3. Do NOT force IMAGE 1's original pose into a scene where it doesn't fit.
4. Do NOT add lens flare, bokeh orbs, light leaks, film grain, vignettes.
5. Do NOT produce compositing artifacts (edge halos, scale mismatches, floating subjects).
6. Do NOT add any other person, silhouette, or human figure.
7. Do NOT add text, watermark, logo, or overlay.
8. Do NOT stylize — output must look like a real phone camera photograph.

══════════════════════════════════════════════
FINAL CHECK
══════════════════════════════════════════════

1. Identity preserved? (face + hair + clothing unchanged from IMAGE 1)
2. Framing matches IMAGE 1's visible extent (${userTags.visible_body})?
3. No invented body parts?
4. Person size matches scene scale references?
5. Pose looks natural in IMAGE 2?
6. Lighting direction matches IMAGE 2?
7. Color temperature matches IMAGE 2 (${scene.color_temperature})?
8. Looks like ONE photograph, not a collage?

Return only the final image.`;
}

function getPartialViewInstructions(visibleBody: string): string {
  const map: Record<string, string> = {
    face_only: 'The user photo shows ONLY the head and shoulders. The output MUST also be framed as head-and-shoulders. DO NOT generate any torso, arms, or legs. Frame IMAGE 2 so the visible area is behind and around the person\'s head.',
    upper_chest: 'The user photo shows the person from the chest up. The output MUST be framed chest-up. DO NOT generate the waist, hips, or legs. If IMAGE 2 is a wide scene, crop it so only the upper portion is visible behind the person.',
    waist_up: 'The user photo shows the person from the waist up. The output MUST be framed waist-up. DO NOT generate legs or feet. Frame IMAGE 2 to show the upper portion of the scene.',
    full_body: 'The user photo shows the full body (or most of it). The output CAN show the full body, and IMAGE 2 can be shown as a wider scene.',
  };
  return map[visibleBody] ?? map.upper_chest;
}

function getSizeGuidance(size: string): string {
  const map: Record<string, string> = {
    close: '40-60% (person is prominent in frame)',
    medium: '30-45% (person is clearly visible but scene has room to breathe)',
    far: '15-30% (scene dominates, person is a subject within it)',
  };
  return map[size] ?? map.medium;
}

function getColorTemperatureGuidance(temp: string): string {
  const map: Record<string, string> = {
    warm: '- Skin should appear slightly golden/peachy warmth\n- Whites in clothing or teeth should have a subtle warm tint\n- Avoid cool/bluish skin tones',
    neutral: '- Skin tones should appear natural, no color cast\n- Whites should look clean white\n- Avoid shifting warmer or cooler',
    cool: '- Skin should have slightly cooler undertones (no orange/gold cast)\n- Whites should have a very subtle cool tint\n- Avoid making skin look warm or golden',
  };
  return map[temp] ?? map.neutral;
}

function getLightDirectionGuidance(dir: string): string {
  const map: Record<string, string> = {
    left: '- Light comes from the LEFT side of the scene\n- The right side of the person\'s face should be in shadow\n- Shadows cast to the right',
    right: '- Light comes from the RIGHT side of the scene\n- The left side of the person\'s face should be in shadow\n- Shadows cast to the left',
    front: '- Light comes from the FRONT\n- Person\'s face should be evenly lit\n- Minimal shadow on either side',
    top: '- Light comes from ABOVE\n- Top of head is brightest, chin has shadow\n- Common for overhead indoor lights or midday sun',
    back: '- Light comes from BEHIND the person\n- Rim light along edges of head/shoulders\n- Face may be slightly darker than background',
    ambient: '- Light is diffuse with no strong direction\n- Person should be evenly lit without harsh shadows\n- Typical of overcast day or soft indoor light',
  };
  return map[dir] ?? map.ambient;
}

// ─── 调用 Gemini 融合 ────────────────────────────────────────
async function callGeminiFusion(
  personBase64: string,
  personMime: string,
  sceneBase64: string,
  sceneMime: string,
  prompt: string,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`;

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { data: personBase64, mimeType: personMime } },
        { inlineData: { data: sceneBase64, mimeType: sceneMime } },
      ],
    }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  };

  const agent = new ProxyAgent(PROXY_URL);
  const response = await undiciFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    dispatcher: agent,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Fusion API ${response.status}: ${errText}`);
  }
  return response.json() as Promise<any>;
}

// ─── 辅助 ────────────────────────────────────────────────────
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function readImage(filePath: string): { base64: string; mime: string } {
  return {
    base64: fs.readFileSync(filePath).toString('base64'),
    mime: getMimeType(filePath),
  };
}

function listImages(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
}

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_PATH, line + '\n');
  } catch {}
}

// ─── 主流程 ──────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_PATH, '');

  const personFiles = listImages(INPUT_DIR);
  if (personFiles.length === 0) {
    console.log(`⚠️  ${INPUT_DIR} 为空，请放入测试原图`);
    process.exit(0);
  }

  log(`🚀 开始测试：${personFiles.length} 张原图，每张匹配 1 张背景并融合`);
  log('');

  const matchLog: any[] = [];
  let success = 0;
  let failed = 0;

  for (let i = 0; i < personFiles.length; i++) {
    const personFile = personFiles[i];
    const personName = path.parse(personFile).name;
    const tag = `[${i + 1}/${personFiles.length}] ${personName}`;

    try {
      // ── 步骤 1：读原图 ──
      const person = readImage(path.join(INPUT_DIR, personFile));

      // ── 步骤 2：打标签 ──
      log(`${tag} 打标签中...`);
      const t1 = Date.now();
      const userTags = await tagUserPhoto(person.base64, person.mime, API_KEY!, PROXY_URL);
      log(`${tag} ✅ 标签 (${((Date.now() - t1) / 1000).toFixed(1)}s): ${JSON.stringify(userTags)}`);

      // ── 步骤 3：匹配背景 ──
      const match: MatchResult = matchScene(userTags, sceneLibrary);
      log(`${tag} 🎯 匹配: ${match.scene.id} (放宽级别 ${match.relaxation_level}, 候选 ${match.candidates_count}, 分 ${match.score})`);
      match.reasoning.forEach(r => log(`${tag}    ${r}`));

      // ── 步骤 4：读背景图 + 调 Gemini 融合 ──
      const scenePath = path.join(SCENE_LIBRARY_DIR, match.scene.file);
      const scene = readImage(scenePath);
      const prompt = buildFusionPrompt(userTags, match.scene);

      log(`${tag} 融合中...`);
      const t2 = Date.now();
      const result = await callGeminiFusion(
        person.base64, person.mime,
        scene.base64, scene.mime,
        prompt,
      );
      const fusionElapsed = ((Date.now() - t2) / 1000).toFixed(1);

      const parts = result.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p: any) => p.inlineData);

      if (!imagePart?.inlineData) {
        failed++;
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
        log(`${tag} ❌ 融合未返回图片。文本: ${textParts.join(' | ') || '(无)'}`);
        matchLog.push({ person: personName, userTags, match, status: 'no_image_returned' });
        continue;
      }

      // ── 步骤 5：保存结果 ──
      const outputName = `${personName}_+_${match.scene.id}.png`;
      const outputPath = path.join(OUTPUT_DIR, outputName);
      fs.writeFileSync(outputPath, Buffer.from(imagePart.inlineData.data, 'base64'));

      log(`${tag} ✅ 融合完成 (${fusionElapsed}s) → ${outputName}`);
      success++;
      matchLog.push({ person: personName, userTags, match, output: outputName, status: 'success' });
    } catch (err) {
      failed++;
      log(`${tag} ❌ 失败: ${(err as Error).message}`);
      matchLog.push({ person: personName, status: 'error', error: (err as Error).message });
    }

    log('');
  }

  fs.writeFileSync(MATCH_LOG_PATH, JSON.stringify(matchLog, null, 2));

  log(`🎯 完成: ${success}/${personFiles.length} 成功, ${failed} 失败`);
  log(`👀 查看结果: ${OUTPUT_DIR}`);
  log(`📊 匹配详情: ${MATCH_LOG_PATH}`);
}

main().catch(err => {
  console.error('❌ 脚本崩溃:', err);
  process.exit(1);
});