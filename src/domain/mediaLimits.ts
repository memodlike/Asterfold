export const WALLPAPER_LIMITS = Object.freeze({
  sourceBytes: 8 * 1024 * 1024,
  encodedBytes: 8 * 1024 * 1024,
  thumbnailBytes: 2 * 1024 * 1024,
  aggregateBytes: 10 * 1024 * 1024,
  sourceDimension: 8_192,
  sourcePixels: 40_000_000,
  outputDimension: 3_840,
  thumbnailDimension: 480,
  minimumOutputDimension: 640,
  minimumThumbnailDimension: 96,
  minimumQuality: 0.42,
} as const);
