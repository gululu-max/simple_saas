// app/api/enhance-photo/color-align.ts
//
// 色温对齐（高光锚 + 1D 色温轴）。
//
// 思路:
// 1. 高光锚 — 取图 top 5% 亮度像素的 RGB 均值当作"白点"参考。
//    比整图均值准得多: 肖像里的衣服 / 场景里的天空 / 大面积主体色都不会污染锚点。
// 2. 1D 色温轴 — R 乘 e^(s/2)、B 除以 e^(s/2)、G 保持。
//    log(R/B) 反映色温（蓝↔橙），G 是亮度近似轴 — 锁 G 就是纯色温调整，不会引入绿-洋红 tint。
// 3. clamp + 小偏差跳过 — 避免激进或无意义的拉扯。

import sharp from 'sharp';

interface HighlightAnchor {
  r: number;
  g: number;
  b: number;
}

const ANCHOR_SAMPLE_SIZE = 256;
const HIGHLIGHT_PERCENTILE = 0.05;

/** 取图 top 5% 亮度像素的 RGB 均值。先下采样到 256px 再扫，避免全图开销。 */
export async function computeHighlightAnchor(buffer: Buffer): Promise<HighlightAnchor> {
  const { data, info } = await sharp(buffer)
    .resize(ANCHOR_SAMPLE_SIZE, ANCHOR_SAMPLE_SIZE, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const numPixels = info.width * info.height;
  const lumas = new Float32Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    lumas[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const sorted = Array.from(lumas).sort((a, b) => b - a);
  const topCount = Math.max(1, Math.floor(numPixels * HIGHLIGHT_PERCENTILE));
  const threshold = sorted[topCount - 1];

  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let i = 0; i < numPixels; i++) {
    if (lumas[i] >= threshold) {
      sumR += data[i * 3];
      sumG += data[i * 3 + 1];
      sumB += data[i * 3 + 2];
      count++;
    }
  }
  return { r: sumR / count, g: sumG / count, b: sumB / count };
}

export interface AlignOptions {
  /** 推进比例，0..1。典型: pre-align 0.4, post-correct 0.3~0.6。 */
  progress: number;
  /** log(R/B) 最大偏移，clamp 上限。0.10 ≈ R/B 比变化 10%，对应 LAB b 轴 ~5 单位。 */
  maxLogShift: number;
  /** log(R/B) 低于此值直接跳过 — 动不动的差异不值得做。 */
  minLogShift?: number;
  /** raw log(R/B) 差异高于此值视为"信号不可信"，跳过整体对齐。 */
  maxRawLogDelta?: number;
}

export interface AlignResult {
  buffer: Buffer;
  applied: boolean;
  logShift: number;
  rawLogDelta: number;
  /** 跳过原因。未跳过时为 null。 */
  skippedReason: 'below_threshold' | 'above_max_raw' | null;
}

/**
 * 把 sourceBuffer 的色温对齐到 targetBuffer。
 *
 * - retouch 场景: source = 生成图, target = 原图（回拉）
 * - fusion pre-align: source = 原图, target = 场景图
 * - fusion post-correct: source = 生成图, target = 场景图
 */
export async function alignColorTemperature(
  sourceBuffer: Buffer,
  targetBuffer: Buffer,
  options: AlignOptions,
): Promise<AlignResult> {
  const [sourceAnchor, targetAnchor] = await Promise.all([
    computeHighlightAnchor(sourceBuffer),
    computeHighlightAnchor(targetBuffer),
  ]);

  const sourceRB = sourceAnchor.r / (sourceAnchor.b || 1);
  const targetRB = targetAnchor.r / (targetAnchor.b || 1);
  const rawLogDelta = Math.log(targetRB / sourceRB);

  const maxRawLogDelta = options.maxRawLogDelta ?? 0.6;
  if (Math.abs(rawLogDelta) > maxRawLogDelta) {
    return {
      buffer: sourceBuffer,
      applied: false,
      logShift: 0,
      rawLogDelta,
      skippedReason: 'above_max_raw',
    };
  }

  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  const logShift = clamp(rawLogDelta * options.progress, -options.maxLogShift, options.maxLogShift);

  const minLogShift = options.minLogShift ?? 0.015;
  if (Math.abs(logShift) < minLogShift) {
    return {
      buffer: sourceBuffer,
      applied: false,
      logShift,
      rawLogDelta,
      skippedReason: 'below_threshold',
    };
  }

  const half = logShift / 2;
  const kR = Math.exp(half);
  const kB = Math.exp(-half);
  const result = await sharp(sourceBuffer)
    .linear([kR, 1, kB], [0, 0, 0])
    .toBuffer();

  return {
    buffer: Buffer.from(result as any),
    applied: true,
    logShift,
    rawLogDelta,
    skippedReason: null,
  };
}
