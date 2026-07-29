# Asterfold 3.0.1 test evidence

## Final green PR candidate

- Candidate SHA: `470943fe946cc277d80edfb103bd204a51614711`
- CI run: `https://github.com/memodlike/Asterfold/actions/runs/30425528170`
- CodeQL run: `https://github.com/memodlike/Asterfold/actions/runs/30425528214`
- CI conclusion: PASS
- CodeQL conclusion: PASS
- Dependency review: PASS
- Production dependency audit: PASS
- Development audit baseline: PASS
- Typecheck: PASS
- Zero-warning lint: PASS
- Store asset/package validation: PASS
- Linux deterministic release: PASS
- Windows deterministic release: PASS
- Linux/Windows byte comparison: PASS

## Unit and integration coverage

- Test files: 41 passed / 41 total
- Tests: 298 passed / 298 total
- Tests failed: 0
- Duration: 77.54 seconds

| Metric | Result | Required | Status |
|---|---:|---:|---|
| Statements | 91.86% | 85% | PASS |
| Branches | 83.73% | 80% | PASS |
| Functions | 91.10% | 85% | PASS |
| Lines | 95.50% | 85% | PASS |

## Real Manifest V3 validation

The production unpacked extension was loaded into Chromium with its service worker and exact generated manifest.

- First-use hint and 1280×720 viewport fit: PASS
- Least-privilege manifest and MV3 service worker: PASS
- Axe serious/critical violations: 0
- Reduced motion and forced colors: PASS
- Twelve selectable locales: PASS
- Application HTTP(S) requests during locale flow: 0
- Privacy Mode shared with popup: PASS
- Background navigation message revalidation: PASS
- Core Page/Board/Bookmark/Search/Trash/Privacy flows: PASS
- 100-bookmark desktop fit: PASS
- Real MV3 tests: 7 passed / 0 failed / 1 intentionally skipped until the separate upgrade fixture step
- Duration: 40.1 seconds

## Exact upgrade gate

The published `v2.2.3` Store package was downloaded and verified with SHA-256 `e666c0e40ca2bcd1631b04e3b9087e38b26f71336664ecfc475ee8b4d610920a`, then upgraded in the same persistent extension profile to the exact 3.0.1 candidate.

- Exact `2.2.3 → 3.0.1` upgrade: PASS
- Extension identity preserved: PASS
- Page, Board, Bookmark and Trash records preserved: PASS
- Locale, layout, Quick Save, theme and wallpaper settings preserved: PASS
- Persisted Privacy Mode preserved and usable: PASS
- Existing profile did not receive fresh-user onboarding: PASS
- Search after migration: PASS
- Upgrade tests: 1 passed / 0 failed
- Duration: 4.4 seconds

## Reproducibility hashes

Linux and Windows produced byte-identical release subjects:

- `Asterfold-Chrome.zip`: `bae6ec2422fdb557bd1a1fb3cbcb59f89582bcece6dadebb313f15d586f197f1`
- `chrome-unpacked.zip`: `8fd32e5b91a81189195b312f96a7ca39a5b1c645ed81a63140548b045baa7302`
- `extension-source.zip`: `baad669117f3c1292a2b27496195e684c18b8d879bff5253580fe556dea19431`
- `Asterfold-Store-Assets.zip`: `d3fa4f5a9d98c0388eaa5b3cfcb5577ab54378eb5e05ac37c3435243f7d884f3`
- `sbom.spdx.json`: `bac5e732b65ed8dfe388a67537b48475c409ea41fa702e3ffc4142efe7d16ae7`

This evidence update is documentation-only. Its resulting exact SHA must pass the same complete CI and CodeQL gates before merge.
