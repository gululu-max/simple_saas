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
/**
 * 前置预处理：色温轻推向场景 + 极轻摄影化处理（减少贴纸感）
 *
 * 两件事:
 * 1. 色温: 走 40% 路程,最多 ±12% 拉扯 (比之前更克制)
 * 2. 摄影化: 极轻阴影提亮 + 极轻对比度软化 + 3% 噪点
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

  const fullScaleR = sceneR / (userR || 1);
  const fullScaleG = sceneG / (userG || 1);
  const fullScaleB = sceneB / (userB || 1);

  const fullDrift = Math.max(
    Math.abs(fullScaleR - 1),
    Math.abs(fullScaleG - 1),
    Math.abs(fullScaleB - 1),
  );

  // drift 太大,直接跳过色温,但仍然做摄影化处理
  let needColorAlign = true;
  if (fullDrift > 0.5) {
    console.log(`🎨 pre-align: color drift ${(fullDrift * 100).toFixed(0)}% too large, skip color align`);
    needColorAlign = false;
  }

  // 色温: 走 40% 路程 + clamp [0.88, 1.12] (比之前 60% + [0.85, 1.15] 更克制)
  const lerp = (v: number, t: number) => 1 + (v - 1) * t;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  const scaleR = needColorAlign ? clamp(lerp(fullScaleR, 0.4), 0.88, 1.12) : 1;
  const scaleG = needColorAlign ? clamp(lerp(fullScaleG, 0.4), 0.88, 1.12) : 1;
  const scaleB = needColorAlign ? clamp(lerp(fullScaleB, 0.4), 0.88, 1.12) : 1;

  const colorDrift = Math.max(Math.abs(scaleR - 1), Math.abs(scaleG - 1), Math.abs(scaleB - 1));

  if (colorDrift < 0.03) {
    console.log('🎨 pre-align: color drift <3%, skipping color (still doing photographic texture)');
  } else {
    console.log(`🎨 pre-align: color R×${scaleR.toFixed(3)} G×${scaleG.toFixed(3)} B×${scaleB.toFixed(3)} (40% toward scene, full drift ${(fullDrift * 100).toFixed(0)}%)`);
  }

  // ─── 摄影化处理: 极轻,只是让手机图看起来不那么"干净死板" ───
  let pipeline = sharp(userBuffer);

  // 1. 色温调整 (如果需要)
  if (colorDrift >= 0.03) {
    pipeline = pipeline.recomb([
      [scaleR, 0, 0],
      [0, scaleG, 0],
      [0, 0, scaleB],
    ]);
  }

  // 2. 极轻阴影提亮 + 对比度软化 (modulate 的 brightness 是整体,
  //    这里用 linear 的 (a, b) 做 y = a*x + b,轻微扩动态范围)
  //    a=0.97 (略压对比), b=4 (略抬阴影) — 效果非常克制
  pipeline = pipeline.linear(0.97, 4);

  // 3. 加极轻噪点 (~3%,模拟手机 CMOS 颗粒)
  //    用 sharp 叠加一张半透明的随机噪点 overlay
  const meta = await pipeline.clone().metadata();
  const w = meta.width ?? 800;
  const h = meta.height ?? 800;

  // 生成等大小的随机噪点 buffer (每像素 RGB 独立)
  const noiseSize = w * h * 3;
  const noiseData = Buffer.alloc(noiseSize);
  for (let i = 0; i < noiseSize; i++) {
    // 128 ± 10 随机,叠加后对原图影响 ~3%
    noiseData[i] = 128 + Math.floor((Math.random() - 0.5) * 20);
  }

  const noiseBuffer = await sharp(noiseData, {
    raw: { width: w, height: h, channels: 3 },
  }).png().toBuffer();

  const processed = await pipeline
    .composite([{
      input: noiseBuffer,
      blend: 'soft-light',  // soft-light 混合模式,噪点效果自然
    }])
    .jpeg({ quality: 92 })
    .toBuffer();

  console.log('🎨 pre-align: photographic texture applied (shadow lift + noise 3%)');

  return Buffer.from(processed as any);
}