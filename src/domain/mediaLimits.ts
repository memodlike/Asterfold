export const WALLPAPER_LIMITS = Object.freeze({
  sourceBytes: 64 * 1024 * 1024,
  encodedBytes: 64 * 1024 * 1024,
  thumbnailBytes: 8 * 1024 * 1024,
  aggregateBytes: 72 * 1024 * 1024,
  sourceDimension: 16_384,
  sourcePixels: 120_000_000,
  outputDimension: 1_920,
  thumbnailDimension: 1_920,
  minimumOutputDimension: 1_280,
  minimumThumbnailDimension: 640,
  minimumQuality: 0.76,
} as const);
