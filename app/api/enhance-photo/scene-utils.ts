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
 * 前置色温校正：把用户原图的 RGB 通道均值拉向场景图水平。
 * 目的是让融合后的人像和场景色调更融合，减少"贴纸感"。
 * clamp 在 [0.7, 1.3] 防止极端拉扯破坏肤色。
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

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  const scaleR = clamp(sceneR / (userR || 1), 0.7, 1.3);
  const scaleG = clamp(sceneG / (userG || 1), 0.7, 1.3);
  const scaleB = clamp(sceneB / (userB || 1), 0.7, 1.3);

  const maxDrift = Math.max(
    Math.abs(scaleR - 1),
    Math.abs(scaleG - 1),
    Math.abs(scaleB - 1),
  );
  if (maxDrift < 0.03) {
    console.log('🎨 pre-align: drift <3%, skip');
    return userBuffer;
  }

  console.log(`🎨 pre-align color: R×${scaleR.toFixed(3)} G×${scaleG.toFixed(3)} B×${scaleB.toFixed(3)}`);

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