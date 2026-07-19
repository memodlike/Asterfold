# QA report

Final source gate: 17 July 2026.

## Environment

- Linux 6.12.47 x86_64
- Node.js 24.14.0 / npm 11.9.0
- Chromium 141.0.7390.37
- WXT 0.20.27 / Vite 7.3.6 / TypeScript 5.9.3
- Playwright 1.56.1 / Vitest 4.1.10

## Final automated gate

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | Pass | Strict TypeScript, no emit, zero errors |
| `npm run lint` | Pass | ESLint with zero warnings allowed |
| `npm test` | Pass | 6 files, 26 tests, 6.64 s recorded full run |
| `npm run build` | Pass | Production Chrome MV3 output, 842.53 kB, 7.77 s recorded run |
| `npm run test:e2e` | Pass | 3 real-extension tests; final `release/chrome-unpacked` run 44.8 s, no page/console errors |
| `npm audit --json` | Pass | 0 info/low/moderate/high/critical vulnerabilities across 720 resolved dependency entries |

The E2E browser is launched with `--load-extension` and `--disable-extensions-except`; the test resolves the real `chrome-extension://…/background.js` service worker rather than serving the UI as a normal website.
The last run set `ASTERFOLD_EXTENSION_PATH=release/chrome-unpacked`, so the folder documented for **Load unpacked**—not only the intermediate WXT output—was exercised.

## Test coverage

| Area | Automated evidence |
| --- | --- |
| Manifest/security | MV3, override, popup, command, required permissions, optional/no host permissions, live service worker |
| Domain | Safe URL normalization, tracking cleanup, unsafe scheme/credentials, fractional ordering, theme bounds, typed messages |
| Database | Seed, CRUD, duplicates, reorder, cascade delete/restore, retention purge, invariants, schema-1→2 sparse migration |
| Search | Ranking, typo/fuzzy, prefix/exact, title/URL field, Page/Board scope, 10,000 multilingual documents, <100 ms assertion |
| Import/export | JSON lossless round-trip, HTML escaping/parser, Markdown, unsafe/prototype input, duplicate summary, 10,000 Unicode records |
| Sync protocol | Configuration, operation validation/idempotency, conflict/retry/tombstone/cursor behavior without fake backend success |
| Browser workspace | Fresh install/onboarding, Page/Board/bookmark CRUD, real pointer cross-board drag, reload/order persistence, keyboard search |
| Browser safety | Privacy masking/search disable, Graphite computed contrast, JSON download/preview/cancel, Trash delete/restore, sender-safe background save |
| Appearance | Every preset switched and captured, Aurora WebP loaded, high contrast, 1440/1920/narrow responsive captures |
| Multi-surface | Page created in a second new tab appears/activates in the first through shared IndexedDB; popup reads the same Pages/Boards |
| Performance | In-app interactive/save marks, five warm samples, popup mark, 10k search/import, bundle sizes |

The Chrome shortcut accelerator and native context-menu chrome cannot be clicked through page DOM in headless Playwright. Their manifest registrations, displayed resolved shortcut, idempotent menu construction, event handlers, and least-privilege active-tab paths are verified through live worker introspection plus source tests/review.

## Manual visual review

All six theme captures plus narrow and popup captures were visually inspected. Text, boundaries, controls, wallpaper composition, responsive board scrolling, and transient state were checked. See `DESIGN_FIDELITY_REPORT.md` for concept comparison and exact paths.

## Defects found and fixed

1. Dexie starter seeding inside `liveQuery` caused `ReadOnlyError`; moved to an initialization effect and retained a read-only subscription.
2. Promise-returning Chrome message listener closed the response port; changed to validated callback + `return true` and added background-message E2E.
3. Dark theme inherited black shell text; applied the semantic text token and asserted computed Graphite color.
4. No-wallpaper themes still received the dim overlay; made dim conditional and regenerated visual evidence.
5. Import grouping copied arrays quadratically; changed to in-place scoped groups and added a 10k import benchmark.
6. Heavy import/Zod code was present in initial new-tab chunk; changed selected export to a dynamic import, reducing that chunk from about 151 kB to 90 kB.
7. Unused optional `notifications` permission was removed.
8. Ambiguous visual-test locators (`Aurora`, `Live tab`, bookmark title) were made exact/scoped; no product behavior was weakened.

## Remaining deployment-only validation

No Supabase URL/key or OAuth provider account was supplied. Therefore live Google callback, token revocation, two-user RLS isolation, cross-device offline replay, and public sharing are not claimed. The default release exposes no nonfunctional cloud/share control; it remains fully local.
