// app/api/enhance-photo/scene-utils.ts
//
// 场景库加载 + 场景图读取 + 前置色温校正。

import fs from 'fs';
import path from 'path';
import { alignColorTemperature } from './color-align';
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
 * 前置色温校正: 把用户原图轻推向场景图的色温。
 *
 * 使用 color-align 的高光锚 + 1D 色温轴:
 * - 高光锚 (top 5% 亮度均值) 代替整图均值 — 不会被衣服/背景主体色污染
 * - R 乘 e^(s/2)、B 除以 e^(s/2)、G 保持 — 纯 1D 色温调整, 不引入 tint 色偏
 * - 走 40% 路程, clamp log(R/B) ≤ 0.10 (~R/B 比 10%), 原始偏差 >0.6 整体跳过
 *
 * 注意: 摄影化处理 (噪点 / 阴影抬升) 已搬到 photographic-texture, 在生成之后做 —
 * 放在 Gemini 之前会被其去噪先验抹掉。
 */
export async function preAlignColorTemperature(
  userBuffer: Buffer,
  sceneBuffer: Buffer,
): Promise<Buffer> {
  const result = await alignColorTemperature(userBuffer, sceneBuffer, {
    progress: 0.4,
    maxLogShift: 0.10,
    minLogShift: 0.02,
    maxRawLogDelta: 0.6,
  });

  if (result.skippedReason === 'above_max_raw') {
    console.log(`🎨 pre-align: raw log(R/B) Δ ${result.rawLogDelta.toFixed(3)} too large, skip`);
  } else if (result.skippedReason === 'below_threshold') {
    console.log(`🎨 pre-align: log(R/B) shift ${result.logShift.toFixed(3)} below threshold, skip`);
  } else {
    console.log(`🎨 pre-align: log(R/B) shift ${result.logShift.toFixed(3)} (raw Δ ${result.rawLogDelta.toFixed(3)}, 40% progress)`);
  }

  return result.buffer;
}