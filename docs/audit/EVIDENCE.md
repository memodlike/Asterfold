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
