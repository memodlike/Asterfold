---
name: extension-testing-qa
description: Quality assurance, unit testing with Vitest and fake-indexeddb, Playwright real-MV3 unpacked extension E2E testing, 600-card benchmarks, and schema migration validation. Use when writing tests, verifying PRs, running stress suites, or debugging rendering regressions.
license: MIT
metadata:
  target-platforms: "Google Chrome MV3, Linux, macOS, Windows"
  testing-tools: "Vitest, Playwright, axe-core, fake-indexeddb"
---

# Chrome Extension Testing, E2E & Quality Assurance

## Multi-Layer Test Strategy
1. **Unit & Integration Suite (`vitest`)**:
   - Headless, ultra-fast test execution using `jsdom` and `fake-indexeddb`.
   - Setup configuration in `tests/setup.ts`: in-memory storage fallback for Node 26+ and BroadcastChannel polyfills.
   - Coverage thresholds: ≥ 85% statements, functions, lines; ≥ 80% branches.
2. **Real MV3 Extension E2E Suite (`playwright`)**:
   - Launches headless or headed Chromium with `--disable-extensions-except=.output/chrome-mv3 --load-extension=.output/chrome-mv3`.
   - Validates actual Chrome extension APIs (`chrome.storage`, `chrome.tabs`, `chrome.bookmarks`, context menus, popup quick save).
3. **Stress & Performance Gates**:
   - 600-card stress test: 12 Boards × 50 Bookmarks = 600 cards rendered and manipulated.
   - 10,000-item search benchmark: verifies MiniSearch query latency remains under 50ms for 10k items.
   - Zero-flash startup test: samples frame timings to ensure absence of white flash.
4. **Automated Accessibility Testing (`axe-core`)**:
   - Every page and modal audited via `@axe-core/playwright` for WCAG 2.1 AA violations.

## Database Migration & Upgrades Testing
- Test exact migrations from historical schemas (v1 -> v2 ... -> v7) to current schema.
- Validate that user bookmarks, custom boards, and themes are never dropped during automatic Dexie migrations.
- Test rollback and recovery when parsing corrupt JSON or HTML bookmark exports.

## Running Verification Commands
- `npm test`: Runs all unit tests via Vitest.
- `npm run typecheck`: Strict TypeScript checking across code and tests (`tsc --noEmit`).
- `npm run lint`: ESLint with zero-warning threshold (`--max-warnings=0`).
- `npm run scan:source`: Source security and CSP invariant scanner.
- `npm run test:stress`: Executes high-load stress scenario.
