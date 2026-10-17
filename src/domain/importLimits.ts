export const IMPORT_LIMITS = {
  fileBytes: 128 * 1024 * 1024,
  depth: 100,
  nodes: 250_000,
  pages: 10_000,
  boards: 50_000,
  bookmarks: 50_000,
} as const;
