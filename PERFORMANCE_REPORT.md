# Performance report

Measured 17 July 2026 on Linux 6.12 x86_64, Node 24.14, headless Chromium 141.0.7390.37. Measurements come from production MV3 bundles, application performance marks, Playwright, and Vitest/fake-indexeddb. Container timings are useful regression evidence but are not a promise for every device.

## Results

| Measure | Result | Target / interpretation | Status |
| --- | ---: | --- | --- |
| Fresh-install new tab interactive | 572.9 ms | Includes first IndexedDB open/schema/starter seed | Informational |
| Warm new tab samples | 222.9, 194.1, 187.4, 172.5, 443.6 ms | Median <300 ms | Pass — median 194.1 ms |
| Bookmark local transaction to commit | 63.0 ms | Save feedback <100 ms | Pass |
| Popup interactive | 180.0 ms | Fast independent surface | Pass |
| 10,000-document search index build | 443.86 ms | Built outside the keystroke path | Pass |
| 10,000-document fuzzy query | 14.81 ms | First result <100 ms | Pass |
| 10,000-record Unicode import | 2,737.62 ms | Bounded bulk transaction; no fixed target | Pass |
| Longest browser long-task entry | 197.0 ms | No common >200 ms task | Pass |
| Production folder | 842.53 kB reported by WXT | Reasonable offline extension | Pass |
| Initial new-tab JS + CSS, gzip estimate | 139,267 bytes | Excludes lazy import/settings/search/editor chunks | Pass |
| Four bundled wallpapers | 87,564 bytes | Far below 20 MB guidance | Pass |

## Bundle boundaries

- Initial new-tab application chunk: 89.79 kB uncompressed / 29,322 bytes gzip.
- Shared React/Dexie workspace runtime: 321.87 kB / 102,486 bytes gzip.
- Initial new-tab CSS: 38.24 kB / 7,459 bytes gzip.
- Import/export/Zod: 61.41 kB lazy chunk, removed from initial render after profiling.
- Search, Settings, Trash, and Bookmark Editor are separate lazy chunks.
- Popup is an independent 5.48 kB application chunk and does not import DnD, search, Settings, or cloud UI.
- Optional Supabase engine is compile-time disabled and dynamically imported only by an enabled build.

## Data-path findings

- Search query time is comfortably below budget even though index construction is roughly 444 ms for 10,000 records. The index is created after the palette is requested and reused for that palette lifetime; it never blocks first render.
- Import originally copied a growing folder array for every record, creating quadratic grouping behavior. It now mutates scoped Map arrays and bulk-adds per Board, allowing the 10k multilingual fixture to complete in about 2.74 seconds.
- Dexie live queries are read-only; starter seeding occurs once in a separate effect. Writes are committed before success feedback.
- Fractional ranks keep routine drag/reorder writes to one moved record; scoped rebalance is exceptional.

## Rendering and memory controls

Board/card keys are stable; drag feedback uses transforms; search results are capped; off-screen board content uses CSS containment/content visibility where supported; object URLs for uploaded wallpapers are revoked; BroadcastChannel listeners and timers are cleaned up; no wallpaper is kept as base64 or duplicated in React state.

## Follow-up threshold

If a personal dataset repeatedly exceeds 10,000 active bookmarks or produces >100 ms queries, move index construction/querying to a Worker and serialize incremental updates. Current evidence does not justify the added worker/cache complexity.
