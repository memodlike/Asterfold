# Audit evidence

## Baseline identity

- Date: 2026-07-24
- Time zone: Asia/Almaty
- Commit: `eeb0fe52804c6da9431260390837cd4c4302093f`
- Branch: `audit/hardening-2-2`
- OS: macOS 26.5.2 (25F84), arm64
- Node: 26.5.0
- npm: 11.17.0
- Chrome: 150.0.7871.182
- Playwright Chromium: 141.0.7390.37
- WXT: 0.20.27
- Vite: 7.3.6
- TypeScript: 5.9.3
- Playwright: 1.56.1

## Mandatory command evidence

| Command | Exit | Real duration | Key output |
| --- | ---: | ---: | --- |
| `npm ci` | 0 | 9.89 s | 642 packages; WXT prepare completed; four install scripts reported outside npm `allowScripts` coverage |
| `npm run typecheck` | 0 | 2.61 s | `tsc --noEmit` |
| `npm run lint` | 0 | 5.78 s | `eslint . --max-warnings=0` |
| `npm test` | 0 | 3.00 s | 8 test files, 37 tests completed |
| `npm run build` | 0 | 2.41 s | Chrome MV3, 940.5 kB total |
| `npm run release` | 0 | 3.09 s | Release artifacts generated and current macOS manifest validation completed |
| `npm run test:e2e` | 1 | 4.17 s | Chromium aborted before extension tests; 1 failed, 1 did not run |
| `npm audit --json` | 1 | 0.48 s | `ENOTFOUND registry.npmjs.org`; advisory result unavailable |

The initial tool invocation of `npm run release` used a misspelled work directory and did not create a process. It is not counted as a project command result; the correctly invoked command and result are shown above.

## E2E failure evidence

Primary launch error:

```text
open /Users/memodlike/Library/Application Support/Chromium/Crashpad/settings.dat:
Operation not permitted (1)
```

Secondary teardown error:

```text
TypeError: Cannot read properties of undefined (reading 'close')
e2e/extension.spec.ts:134
```

The service worker, UI flows, persistence, navigation, screenshots, network checks, and 100-bookmark assertions did not execute. This result must not be represented as a product failure or success until the runner is repaired and rerun.

A diagnostic rerun explicitly selected the installed browser:

```text
ASTERFOLD_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:e2e
exit 1; 0.99 s; browser exited with SIGABRT before extension startup
```

The same uninitialized-context teardown error followed. Selecting installed Chrome therefore did not bypass the managed process restriction.

## Phase 1 URL and navigation evidence

Environment access changed from managed filesystem restrictions to unrestricted local execution. Before any Phase 1 source change, the unchanged Phase 0 commit reran `npm run test:e2e` successfully: exit `0`, 2/2 tests, 16.9 s. This confirms that the earlier Crashpad result was a runner restriction, not an extension pass or failure.

Phase 1 command evidence:

| Test ID | Command | Exit | Key output |
| --- | --- | ---: | --- |
| AF-SEC-T001 | `npm test -- --run tests/domain.test.ts` | 0 | 19/19: credentials, encoded credentials, controls, mixed-case scheme, Unicode/punycode, length, schemes and explicit mail flow |
| AF-SEC-T002 | `npm test -- --run tests/browserApi.test.ts` | 0 | Four `openMode` values are routed to the background; poisoned stored URL is rejected before messaging |
| AF-SEC-T003 | `npm test` | 0 | 10 files, 54/54; strict message bounds and poisoned import coverage |
| AF-SEC-E001 | `npm run test:e2e` | 0 | 3/3 in 16.7 s; poisoned IndexedDB plus background executable/credential URL rejection, and new-tab, new-window, incognito-unavailable and current-tab flows |
| AF-SEC-B001 | `npm run build` | 0 | Chrome MV3 build, 945.97 kB |
| AF-SEC-S001 | `npm run typecheck && npm run lint` | 0 | TypeScript and ESLint completed without findings |

Implementation evidence:

- `SafeNavigationUrl` accepts only HTTP/HTTPS by default and `mailto:` only through an explicit option.
- Raw controls, credentials (including percent-encoded username), missing hosts, unsupported schemes and values over 8,192 characters are rejected.
- `openUrl` no longer uses `window.location.assign` or direct tab/window APIs. Every bookmark mode is sent to the service worker.
- The service worker reparses the URL immediately before `tabs.update`, `tabs.create`, or `windows.create`.
- Runtime message objects are strict, strings and IDs are bounded, `tabId` is a positive safe integer, and user-facing failures are stable codes.
- Incognito denial returns `INCOGNITO_UNAVAILABLE`; raw Chrome errors are not exposed.

## Phase 2 favicon and privacy evidence

| Test ID | Command | Exit | Key output |
| --- | --- | ---: | --- |
| AF-PRIV-T001 | `npm test -- --run tests/privacy.test.ts` | 0 | Bounded PNG/JPEG/WebP data policy; remote URL/SVG/oversize rejection; remote legacy favicon not rendered |
| AF-PRIV-T002 | `npm test -- --run tests/privacySearch.test.ts` | 0 | Privacy mode constructs neither search documents nor MiniSearch engine |
| AF-PRIV-U001 | `npm test` | 0 | 12 files, 58/58 |
| AF-PRIV-E001 | `npm run test:e2e` | 0 | 3/3 in 17.9 s; zero requests to injected `tracker.invalid`, neutral private DOM/a11y/context labels and disabled clipboard actions |
| AF-PRIV-B001 | `npm run build` | 0 | Chrome MV3 build, 948.74 kB |

Existing `faviconUrl` and `customIcon` fields remain in the data model so old backups restore without data loss. They are not trusted as render sources: remote favicon values are ignored and custom icons must pass the local bounded raster-data policy. Privacy Mode does not encrypt IndexedDB; this is documented as residual behavior rather than presented as a security guarantee.

## Phase 3 migration and backup evidence

| Test ID | Command | Exit | Key output |
| --- | --- | ---: | --- |
| AF-DATA-T001 | `npm test -- --run tests/migrations.test.ts` | 0 | Golden DB v1–v5 real-schema upgrades, close/reopen idempotency, all four `openMode` values, and injected rollback |
| AF-DATA-T002 | `npm test -- --run tests/importExport.test.ts` | 0 | Backup v1→v2, unknown-version rejection, all `openMode` values, repeat parse, and export→restore→export equality |
| AF-DATA-U001 | `npm test` | 0 | 12 files, 65/65 in 2.40 s |
| AF-DATA-E001 | `npm run test:e2e` | 0 | 3/3 in 18.58 s |
| AF-DATA-B001 | `npm run build` | 0 | Chrome MV3 build, 948.77 kB in 1.91 s |
| AF-DATA-S001 | `npm run typecheck` | 0 | `tsc --noEmit`, 2.50 s |
| AF-DATA-S002 | `npm run lint` | 0 | ESLint completed without findings, 4.90 s |

The database schema version and backup format version are separate constants. Migrations v3 and v4 write their own schema version, and v5 no longer changes `new-tab` bookmarks or their timestamps/version. Backup v1 has an explicit v1→v2 migrator; unsupported future formats fail validation rather than being guessed or wiped. Automatic downgrade remains unsupported and is documented in the installation guide.

## Phase 4 ordering evidence

| Test ID | Command | Exit | Key output |
| --- | --- | ---: | --- |
| AF-ORDER-T001 | `npm test -- --run tests/ordering.test.ts` | 0 | 1,000 sequential appends, 10,000 deterministic moves, dense ranks, duplicates, corruption diagnostics and repair |
| AF-ORDER-T002 | `npm test -- --run tests/repository.test.ts` | 0 | Atomic deduplicated bulk move, injected failure rollback, and 40 concurrent appends without duplicate positions |
| AF-ORDER-U001 | `npm test` | 0 | 13 files, 73/73 in 2.37 s |
| AF-ORDER-E001 | `npm run test:e2e` | 0 | 3/3 in 17.68 s |
| AF-ORDER-B001 | `npm run build` | 0 | Chrome MV3 build, 951.09 kB in 2.30 s |
| AF-ORDER-S001 | `npm run typecheck` | 0 | `tsc --noEmit`, 1.87 s |
| AF-ORDER-S002 | `npm run lint` | 0 | ESLint completed without findings, 4.62 s |

Rank comparison is byte-stable ASCII rather than locale-sensitive. The rank pattern is allocated once. `allocateAtEnd`, `allocateBetween`, `moveMany`, `rebalance`, and `validateScope` share the same bounded 12-character rank format. Exhausted, invalid, or duplicate positions are rebalanced within the current Page/Board scope before retry. Repository page, board, bookmark, bulk-move, duplicate, and board-change paths use the shared allocator inside Dexie write transactions.

## Phase 5 repository integrity evidence

| Test ID | Command | Exit | Key output |
| --- | --- | ---: | --- |
| AF-REPO-T001 | `npm test -- --run tests/repository.test.ts` | 0 | Default/active/Quick Save repair, hierarchy purge with mismatched timestamps, duplicate-on-edit, atomic bulk rollback, repeated permanent delete/empty Trash |
| AF-REPO-U001 | `npm test` | 0 | 13 files, 75/75 in 2.44 s |
| AF-REPO-E001 | `npm run test:e2e` | 0 | 3/3 in 17.05 s |
| AF-REPO-B001 | `npm run build` | 0 | Chrome MV3 build, 954.70 kB in 2.31 s |
| AF-REPO-S001 | `npm run typecheck` | 0 | `tsc --noEmit`, 1.90 s |
| AF-REPO-S002 | `npm run lint` | 0 | ESLint completed without findings, 4.84 s |

The repository now repairs Page/Board destination pairs in the same Dexie transaction as delete, restore, purge, permanent delete, and empty Trash. One active Page is always selected as the sole default, and active/default/last Quick Save references either point to a consistent active pair or to `null` where no Board exists. Root Page purge cascades through all descendants regardless of child deletion timestamps. Compound `[boardId+normalizedUrl]` lookup is used for create and edit duplicate checks. Repeated destructive submissions are idempotent and do not create empty snapshots.

## Phase 6 schema and import evidence

| Test ID | Command | Exit | Key output |
| --- | --- | ---: | --- |
| AF-IMPORT-T001 | `npm test -- --run tests/importExport.test.ts` | 0 | Strict unknown-field rejection, duplicate IDs/ranks, orphan parents, unsafe URLs/keys, v1 migration, identity-remapped merge, 10k import |
| AF-IMPORT-U001 | `npm test` | 0 | 13 files, 77/77 in 2.37 s |
| AF-IMPORT-E001 | `npm run test:e2e` | 0 | 3/3 in 16.13 s |
| AF-IMPORT-B001 | `npm run build` | 0 | Chrome MV3 build includes `import-worker.js`; 1.12 MB total in 2.54 s |
| AF-IMPORT-S001 | `npm run typecheck` | 0 | `tsc --noEmit`, 1.90 s |
| AF-IMPORT-S002 | `npm run lint` | 0 | ESLint completed without findings, 4.66 s |

`src/domain/schemas.ts` is the single dependency-direction-safe schema source for entities, settings, themes, wallpapers, snapshots, sync operations, and backups. Backup validation is strict, bounded, finite-number-only, and cross-validates IDs, parents, ranks, deletion hierarchy, one default Page, and settings references. JSON and Netscape HTML preview parsing run in the built WXT unlisted worker. External merge remaps Page/Board/Bookmark IDs and parent references; replace is the explicit trusted restore path. Snapshot creation and data writes share one Dexie transaction.

## Phase 7 wallpaper evidence

| Test ID | Command | Exit | Key output |
| --- | --- | ---: | --- |
| AF-WALL-T001 | `npm test -- --run tests/wallpaper.test.ts tests/repository.test.ts` | 0 | 15/15: MIME spoof, animation, decode failure, decoded caps, WebP/downscale/thumbnail, bitmap cleanup, repository GC |
| AF-WALL-T002 | `npm test` | 0 | 14 files, 84/84 in 2.55 s |
| AF-WALL-E001 | `npm run test:e2e` | 0 | 3/3 in 16.5 s |
| AF-WALL-B001 | `npm run build` | 0 | Chrome MV3 build, 1.13 MB in 2.07 s |
| AF-WALL-R001 | `npm run release` | 0 | Release build and local artifacts completed |
| AF-WALL-S001 | `npm run typecheck` | 0 | `tsc --noEmit` |
| AF-WALL-S002 | `npm run lint` | 0 | ESLint completed without findings |

Uploaded wallpaper input is limited to 8 MB and validated by raster signature, declared MIME, animation marker, browser decode, dimensions, and total pixels. The stored asset is a bounded WebP (maximum side 3,840 px) plus a 480 px thumbnail. Storage quota is checked before the transaction, decoded bitmaps are closed on success and failure, and changing the selected wallpaper removes unreferenced uploaded assets without touching built-ins or active data.

## Phase 8 performance evidence

| Test ID | Command | Exit | Key output |
| --- | --- | ---: | --- |
| AF-PERF-T001 | `npm test -- --run tests/performance.test.ts tests/search.test.ts` | 0 | No per-item document listeners, no Board backdrop filter, Unicode/query/result bounds |
| AF-PERF-T002 | `npm test -- --run tests/search.test.ts --reporter verbose` | 0 | 10k index 79.08 ms; query 2.41 ms |
| AF-PERF-U001 | `npm test` | 0 | 15 files, 87/87 in 2.55 s |
| AF-PERF-E001 | `npm run test:e2e` | 0 | 3/3 in 18.1 s |
| AF-PERF-B001 | `npm run build` | 0 | 1.13 MB in 2.08 s |
| AF-PERF-R001 | `npm run release` | 0 | Release completed |

At the 100-bookmark/4-board acceptance dataset, the previous source registered one permanent document pointer listener for every Bookmark and Board (104 total). Those listeners are now absent; the portalled menu owns one outside-pointer listener only while the menu exists and also closes on scroll/resize. Balanced rendering removes `backdrop-filter` from every Board, while Low Power and `prefers-reduced-transparency` force solid surfaces. Settings theme changes use a local draft and a 200 ms persistence debounce. GPU/raster and heap values remain unavailable, so no numerical claim is made for those metrics.

## Phase 9 accessibility evidence

| Test ID | Command | Exit | Key output |
| --- | --- | ---: | --- |
| AF-A11Y-T001 | `npm test -- --run tests/accessibility.test.ts tests/privacy.test.ts` | 0 | 5/5: menu focus/arrows/Home/Escape, modal scroll lock, neutral Privacy DOM |
| AF-A11Y-U001 | `npm test` | 0 | 16 files, 89/89 |
| AF-A11Y-E001 | `npm run test:e2e` | 0 | 4/4; axe has zero serious/critical violations; reduced motion and full core keyboard flow pass |
| AF-A11Y-S001 | `npm run typecheck && npm run lint` | 0 | TypeScript and ESLint completed without findings |

Context menus expose menuitems, skip disabled actions, support arrows/Home/End/typeahead/Escape/Tab and restore focus. Launcher pointer leave no longer closes keyboard focus. Search uses an ordinary list without nested buttons inside options and ignores composing Enter. Modals use an intentional pointer down/up backdrop sequence, fallback focus, focus restoration, body scroll lock and `100dvh`. Trash filters are pressed buttons. Toast urgency and icon match tone and timers pause while hovered or focused.

## Production bundle baseline

| Asset | Bytes |
| --- | ---: |
| `chunks/useWorkspace-Co0CddFR.js` | 395,854 |
| `background.js` | 248,647 |
| `chunks/newtab-C4FK1WCS.js` | 84,274 |
| `chunks/exportImport-uAQeef9g.js` | 62,412 |
| `assets/newtab-T0rosFGM.css` | 30,703 |
| `chunks/SearchPalette-BzUUAkwI.js` | 25,374 |
| Complete unpacked output | 940.5 kB reported by WXT; 988 KiB filesystem allocation |
| `release/Asterfold-Chrome.zip` | 308 KiB filesystem allocation |
| `release/extension-source.zip` | 880 KiB filesystem allocation |

## Existing screenshot evidence

| File | Dimensions | SHA-256 |
| --- | --- | --- |
| `docs/images/workspace.png` | 1672×941 | `388ff5b4228a8274a4367f8e52bab4c5694ceebe9510497f0801459fb6323162` |
| `docs/images/settings.png` | 1672×941 | `097d6579102fc4c7cd9e8b5cf10b4331bfea3ebab9ebe180bebd80c800b94762` |
| `docs/images/scale-1280x720.png` | 1280×720 | `e81d49ef9a0ea75114a0911a837fd174909b68506366c2897015de05a8e2c5ed` |
| `docs/images/scale-1920x1080.png` | 1920×1080 | `177b53b0b9a615ac6d47aa505becdf9d4bce9340fe02349697524e8dccae68b9` |

These screenshots predate the hardening branch. They are visual baselines only, not evidence that the current E2E run completed.

## Network evidence

No default-build application network log was captured because Chromium exited before the extension loaded. The value is `unavailable`, not zero. Phase 2 and Phase 15 must capture browser-level requests with remote favicon blocking and cloud disabled.

## Baseline release hashes

These are baseline artifacts and are not release candidates:

```text
3558bf319d5a578be7bd7ae89225888329571bb8bf2deacb2695dceefe0b748d  Asterfold-Chrome.zip
138561dcf3351a3d8d25aa0ecc85bd71e40a0f625f3aaa2865f92ba77745e847  chrome-unpacked.zip
8383da9f7d2efea00b9a0bd3ce1bc059f7fa5161d137128267cb3ff6f1f37932  extension-source.zip
```
