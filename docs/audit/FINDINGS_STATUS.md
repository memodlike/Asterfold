# Findings status

Statuses are limited to `OPEN`, `IN_PROGRESS`, `FIXED`, `ACCEPTED_RISK`, and `NOT_APPLICABLE`. No finding is accepted as risk without an owner decision and a residual-behavior test.

| ID | Status | Commit | Tests | Evidence | Residual risk |
| --- | --- | --- | --- | --- | --- |
| AF-BASE-001 | IN_PROGRESS | Phase 0 commit containing this document | `tests/auditFixtures.test.ts` | Versioned fixtures and golden backups under `tests/fixtures/audit/` | Fixtures are not yet exercised through every Dexie upgrade path |
| AF-SEC-001 | FIXED | Phase 1 commit | AF-SEC-T001, AF-SEC-T002, AF-SEC-E001 | Strict branded parser runs in the UI client and again immediately before Chrome navigation APIs | An OS handler controls an explicitly allowed `mailto:` after validation |
| AF-SEC-002 | FIXED | Phase 1 commit | AF-SEC-T003, AF-SEC-E001 | All runtime message objects are strict and bounded; responses use `{ok,data}` or `{ok,code,params}` | Internal extension contexts remain trusted senders and are still schema-validated |
| AF-PRIV-001 | OPEN | Base audit commit | Phase 2 pending | Fixture contains a remote `faviconUrl` for interception coverage | Remote favicon rendering could disclose visited bookmark hosts |
| AF-PRIV-002 | OPEN | Base audit commit | Phase 2 pending | Privacy contract matrix pending | Titles may remain observable through DOM, accessibility, menus, index, or clipboard |
| AF-DATA-001 | OPEN | Base audit commit | Golden backups preserve all four `openMode` values | `migrateToV5` and `parseBackup` currently convert `new-tab` to `current` | User navigation behavior is changed during migration/restore |
| AF-DATA-002 | OPEN | Base audit commit | v1–v5 fixtures created | v3/v4 migrations write `CURRENT_DB_SCHEMA_VERSION` rather than their own version | Interrupted or partial upgrades are difficult to reason about |
| AF-DATA-003 | OPEN | Base audit commit | Golden backup v1/v2 created | DB schema and backup format versions are coupled in current parser | Restore semantics may drift across application versions |
| AF-ORDER-001 | OPEN | Base audit commit | Phase 4 pending | Current comparator uses `localeCompare`; rank regex is reallocated | Ordering may differ by locale or exhaust dense positions |
| AF-REPO-001 | OPEN | Base audit commit | Phase 5 pending | v5 fixture includes stale Quick Save refs and deleted hierarchy | Mutations may leave inconsistent destination/default relationships |
| AF-IMPORT-001 | OPEN | Base audit commit | Phase 6 pending | Existing Zod objects are not consistently strict or semantically cross-validated | Unknown fields, orphans, duplicates, or oversized inputs may be accepted |
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
