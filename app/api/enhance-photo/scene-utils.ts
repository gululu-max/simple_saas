// app/api/enhance-photo/scene-utils.ts
//
// 场景库加载 + 场景图读取 + 前置色温校正。

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type { SceneEntry } from './match-scene';

// 场景库 JSON 在 build 时会被 Next.js 打包进 serverless。
// 生产部署：把 scene-library.json 放到 public/scene-library/ 目录下，图片也在同目录。
const SCENE_LIBRARY_DIR = path.join(process.cwd(), 'public', 'scene-library');
const SCENE_LIBRARY_JSON_PATH = path.join(SCENE_LIBRARY_DIR, 'scene-library.json');

// 场景库元数据（lambda 冷启动时读一次）
let sceneLibraryCache: SceneEntry[] | null = null;
export function loadSceneLibrary(): SceneEntry[] {
  if (!sceneLibraryCache) {
    const raw = fs.readFileSync(SCENE_LIBRARY_JSON_PATH, 'utf-8');
    sceneLibraryCache = JSON.parse(raw) as SceneEntry[];
    console.log(`📚 scene-library loaded: ${sceneLibraryCache.length} entries`);
  }
  return sceneLibraryCache;
}

// 场景图 Buffer 缓存（lambda 热实例内）
const sceneImageCache = new Map<string, { buffer: Buffer; mime: string }>();
export function loadSceneImage(file: string): { buffer: Buffer; mime: string } {
  if (sceneImageCache.has(file)) return sceneImageCache.get(file)!;
  const imgPath = path.join(SCENE_LIBRARY_DIR, file);
  const buffer = fs.readFileSync(imgPath);
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const entry = { buffer, mime };
  sceneImageCache.set(file, entry);
  return entry;
}

/**
 * 前置色温校正：把用户原图的 RGB 通道均值轻推向场景图。
 *
 * 关键点:
 * - clamp [0.85, 1.15] — 最多 15% 拉扯,避免把肤色搞怪
 * - 走 60% 路程 — 不完全对齐，只是"靠近",保留用户原图的质感
 * - drift 过大时完全跳过 — 原图和场景差异太大,硬拉反而让 Gemini 输入变奇怪
 */
export async function preAlignColorTemperature(
  userBuffer: Buffer,
  sceneBuffer: Buffer,
): Promise<Buffer> {
  const [userStats, sceneStats] = await Promise.all([
    sharp(userBuffer).stats(),
    sharp(sceneBuffer).stats(),
  ]);

  const userR = userStats.channels[0].mean;
  const userG = userStats.channels[1].mean;
  const userB = userStats.channels[2].mean;

  const sceneR = sceneStats.channels[0].mean;
  const sceneG = sceneStats.channels[1].mean;
  const sceneB = sceneStats.channels[2].mean;

  // 完全对齐时的 scale
  const fullScaleR = sceneR / (userR || 1);
  const fullScaleG = sceneG / (userG || 1);
  const fullScaleB = sceneB / (userB || 1);

  // 如果任何一个通道需要拉扯超过 50%,说明原图和场景色温差距太大,
  // 硬拉会让用户原图变奇怪,完全跳过校正,交给 Gemini 处理
  const fullDrift = Math.max(
    Math.abs(fullScaleR - 1),
    Math.abs(fullScaleG - 1),
    Math.abs(fullScaleB - 1),
  );
  if (fullDrift > 0.5) {
    console.log(`🎨 pre-align: drift ${(fullDrift * 100).toFixed(0)}% too large, skip (letting fusion prompt handle color)`);
    return userBuffer;
  }

  // 走 60% 路程 + clamp 到 [0.85, 1.15]
  const lerp = (v: number, t: number) => 1 + (v - 1) * t;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  const scaleR = clamp(lerp(fullScaleR, 0.6), 0.85, 1.15);
  const scaleG = clamp(lerp(fullScaleG, 0.6), 0.85, 1.15);
  const scaleB = clamp(lerp(fullScaleB, 0.6), 0.85, 1.15);

  const maxDrift = Math.max(
    Math.abs(scaleR - 1),
    Math.abs(scaleG - 1),
    Math.abs(scaleB - 1),
  );
  if (maxDrift < 0.03) {
    console.log('🎨 pre-align: drift <3%, skip');
    return userBuffer;
  }

  console.log(`🎨 pre-align color (60% toward scene): R×${scaleR.toFixed(3)} G×${scaleG.toFixed(3)} B×${scaleB.toFixed(3)} [full drift ${(fullDrift * 100).toFixed(0)}%]`);

  const corrected = await sharp(userBuffer)
    .recomb([
      [scaleR, 0, 0],
      [0, scaleG, 0],
      [0, 0, scaleB],
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
  return Buffer.from(corrected as any);
}