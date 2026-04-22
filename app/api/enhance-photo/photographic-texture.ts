// app/api/enhance-photo/photographic-texture.ts
//
// 后处理: 极轻的"手机相机质感"。
//
// 在 Gemini 输出之后调用, 让生成图不至于"干净死板"。
// 关键: 必须放在生成之后 — 放在生成之前会被模型的去噪先验抹掉。

import sharp from 'sharp';

const NOISE_TILE_SIZE = 256;
let noiseTileCache: Buffer | null = null;

/** 懒加载一张 256×256 噪点 tile, 热实例内复用。composite 用 tile:true 平铺整图。 */
async function getNoiseTile(): Promise<Buffer> {
  if (noiseTileCache) return noiseTileCache;
  const size = NOISE_TILE_SIZE * NOISE_TILE_SIZE * 3;
  const data = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    // 128 ± 12 随机, soft-light 混合后对原图影响约 3%
    data[i] = 128 + Math.floor((Math.random() - 0.5) * 24);
  }
  noiseTileCache = await sharp(data, {
    raw: { width: NOISE_TILE_SIZE, height: NOISE_TILE_SIZE, channels: 3 },
  }).png().toBuffer();
  return noiseTileCache;
}

/**
 * 轻度对比度软化 + 阴影抬升 + 全图噪点 tile 平铺。
 * 让生成图接近"手机快照"质感, 而不是"AI 磨皮过度干净"。
 */
export async function applyPhotographicTexture(buffer: Buffer): Promise<Buffer> {
  const tile = await getNoiseTile();
  const result = await sharp(buffer)
    .linear(0.97, 4)
    .composite([{ input: tile, tile: true, blend: 'soft-light' }])
    .toBuffer();
  return Buffer.from(result as any);
}
