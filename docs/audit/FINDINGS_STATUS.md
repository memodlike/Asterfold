# Findings status

Statuses are limited to `OPEN`, `IN_PROGRESS`, `FIXED`, `ACCEPTED_RISK`, and `NOT_APPLICABLE`. No finding is accepted as risk without an owner decision and a residual-behavior test.

| ID | Status | Commit | Tests | Evidence | Residual risk |
| --- | --- | --- | --- | --- | --- |
| AF-BASE-001 | FIXED | Phase 3 commit | AF-DATA-T001, AF-DATA-T002 | Versioned fixtures are exercised through their real Dexie schemas; golden backups are parsed/restored | Corrupt ordering and stale references are intentionally deferred to Phases 4–6 |
| AF-SEC-001 | FIXED | Phase 1 commit | AF-SEC-T001, AF-SEC-T002, AF-SEC-E001 | Strict branded parser runs in the UI client and again immediately before Chrome navigation APIs | An OS handler controls an explicitly allowed `mailto:` after validation |
| AF-SEC-002 | FIXED | Phase 1 commit | AF-SEC-T003, AF-SEC-E001 | All runtime message objects are strict and bounded; responses use `{ok,data}` or `{ok,code,params}` | Internal extension contexts remain trusted senders and are still schema-validated |
| AF-PRIV-001 | FIXED | Phase 2 commit | AF-PRIV-T001, AF-PRIV-E001 | New saves store no remote favicon; legacy remote values are ignored; Chrome `_favicon` and bounded local raster data are the only render sources | Chrome itself resolves `_favicon`; this is a browser trust dependency |
| AF-PRIV-002 | FIXED | Phase 2 commit | AF-PRIV-T002, AF-PRIV-E001 | Private title absent from DOM/title/a11y/context label; clipboard disabled; search documents/index not constructed | IndexedDB is intentionally not encrypted and remains visible to the local browser profile |
| AF-DATA-001 | FIXED | Phase 3 commit | AF-DATA-T001, AF-DATA-T002 | DB upgrades and backup parsing preserve `current`, `new-tab`, `new-window`, and `incognito` exactly | Chrome may still reject incognito at runtime; Phase 1 returns a stable localized error |
| AF-DATA-002 | FIXED | Phase 3 commit | AF-DATA-T001 | v1–v5 real-schema upgrades, close/reopen idempotency, and injected-transaction rollback pass | Automatic downgrade is unsupported and documented |
| AF-DATA-003 | FIXED | Phase 3 commit | AF-DATA-T002 | `CURRENT_BACKUP_FORMAT_VERSION` is separate from DB schema; explicit v1→v2 migrator and round trip pass | Future backup formats must add explicit migrators before acceptance |
| AF-ORDER-001 | FIXED | Phase 4 commit | AF-ORDER-T001, AF-ORDER-T002, AF-ORDER-E001 | ASCII comparator, cached validation, scoped rebalance/retry, atomic multi-move, concurrent append coverage | IndexedDB serializes write transactions per database; sync conflict ordering remains out of default release scope |
| AF-REPO-001 | FIXED | Phase 5 commit | AF-REPO-T001, AF-REPO-E001 | Transactional invariant repair covers active/default Page, Quick Save pairs, hierarchy purge, duplicate edits, bulk rollback and repeated destructive submissions | Cross-device conflict repair is excluded with cloud from the default release |
| AF-IMPORT-001 | FIXED | Phase 6 commit | AF-IMPORT-T001, AF-IMPORT-E001 | Central strict bounded schemas, semantic hierarchy/rank/reference validation, worker parsing, identity-remapped merge, atomic snapshot/write | The custom Netscape tokenizer supports the standard Chrome export structure; exotic nonstandard HTML may be skipped |
| AF-WALL-001 | OPEN | Base audit commit | Phase 7 pending | v4/v5 fixtures include deterministic uploaded WebP data | Decode bombs, quota exhaustion, or orphaned blobs remain possible |
| AF-PERF-001 | OPEN | Base audit commit | Phase 8 pending | Baseline bundle captured; runtime measurements unavailable due E2E launch failure | Low-end GPU/CPU costs are unquantified |
| AF-PERF-002 | OPEN | Base audit commit | Phase 8 pending | Listener count measurement pending | Per-item listeners or filters may scale poorly |
| AF-A11Y-001 | OPEN | Base audit commit | Phase 9 pending | `ACCESSIBILITY_MATRIX.md` | Launcher, menus, search, dialogs, trash and toast patterns are not fully verified |
| AF-UX-001 | OPEN | Base audit commit | Phase 10 pending | Functional settings matrix pending | Visible controls may not persist or affect rendering consistently |
| AF-SYNC-001 | OPEN | Base audit commit | Phase 11 pending | Default build currently includes Supabase dependency and conditional host logic | Incomplete cloud code may be bundled or overclaimed |
| AF-BRAND-001 | OPEN | Base audit commit | Phase 12 pending | Current icon inventory recorded by build | Required folded-asterisk optical masters are incomplete |
| AF-CI-001 | OPEN | Base audit commit | `npm ci` warning | npm reported four install scripts outside `allowScripts` coverage | Supply-chain execution policy is not explicit |
| AF-CI-003 | OPEN | Base audit commit | macOS release exit `0`; Windows smoke pending | `scripts/release.mjs` shells out to external `zip` | Release is not portable to a clean Windows runner |
| AF-CI-004 | OPEN | Base audit commit | Two-build comparison pending | Archive timestamps/order/permissions are not normalized | Byte-for-byte reproducibility is unproven |
| AF-CI-005 | FIXED | Phase 1 environment rerun | `npm run test:e2e` exit `0`, 3/3 | The unchanged baseline passed after the managed filesystem restriction was removed; Phase 1 MV3 E2E also passed | CI portability and teardown hardening remain Phase 13 work |
| AF-CI-006 | OPEN | Base audit commit | `npm audit --json` exit `1` | Registry DNS failure in `EVIDENCE.md` | Dependency advisories are unknown, not zero |
| AF-DOC-001 | OPEN | Base audit commit | Phase 14 pending | Current docs have not been revalidated against hardening evidence | Public claims may describe older behavior |
