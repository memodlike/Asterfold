# Security review

Review date: 24 July 2026. Commit: recorded by the Phase 15 final evidence update.

## Verified controls

| Control | Evidence |
| --- | --- |
| URL and message boundaries | AF-SEC-T001/T002/T003 and AF-SEC-E001 |
| Remote favicon/privacy isolation | AF-PRIV-T001/T002 and AF-PRIV-E001 |
| Lossless migration and backup | AF-DATA-T001/T002 |
| Atomic ordering/repository invariants | AF-ORDER-T001/T002/E001 and AF-REPO-T001/E001 |
| Strict import and rollback | AF-IMPORT-T001/E001 |
| Wallpaper bounds and cleanup | AF-WALL-T001/T002/E001 |
| Manifest/CSP/archive scan | AF-CI-T003/T004 |

The default manifest has no host permission or cloud identity permission. Cloud runtime and Supabase dependency were removed in Phase 11. Release archives are sorted, timestamp-normalized and reproduced twice before acceptance.

## Dependency status

`npm run audit:production` reports zero production advisories at this review. Full `npm audit --json` reports seven high advisories in WXT's `web-ext` development toolchain. Those are not in the runtime dependency graph, but the full audit is not called clean. CI blocks high production advisories and new high-severity dependency changes.

## Residual risk

Privacy Mode is not encryption. HTTPS bookmarks may still lead to phishing sites. Local malware or a compromised Chrome profile can read extension data. Representative low-end Windows GPU traces and completed GitHub Windows runner evidence remain external validation items until their runs finish.
