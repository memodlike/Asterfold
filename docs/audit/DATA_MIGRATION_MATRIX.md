# Data migration and backup matrix

Static fixtures are generated deterministically by `scripts/generate-audit-fixtures.mjs` and checked into `tests/fixtures/audit/`.

| Source | Fixture | Required preserved semantics | Edge cases included | Current evidence | Status |
| --- | --- | --- | --- | --- | --- |
| DB v1 | `migrations/db-v1.json` | Page/Board/Bookmark hierarchy and all four `openMode` values | Sparse settings | Fixture integrity test only | OPEN |
| DB v2 | `migrations/db-v2.json` | Existing theme/navigation and all `openMode` values | Stale default/last Quick Save refs | Fixture integrity test only | OPEN |
| DB v3 | `migrations/db-v3.json` | Layout fields and deleted hierarchy | Deleted Page → Board → Bookmark | Fixture integrity test only | OPEN |
| DB v4 | `migrations/db-v4.json` | Performance settings and all `openMode` values | Uploaded WebP representation | Fixture integrity test only | OPEN |
| DB v5 | `migrations/db-v5.json` | 100 active bookmarks, order, settings and optional sync state | Invalid rank, duplicate rank, stale refs, deleted hierarchy, wallpaper, pending outbox | Fixture integrity test only | OPEN |
| Backup v1 | `backups/backup-v1-golden.json` | Export→parse→restore deep-equal user semantics | Legacy sparse layout/theme and all `openMode` values | Static golden created | OPEN |
| Backup v2 | `backups/backup-v2-golden.json` | Export→parse→restore deep-equal user semantics | Full settings and all `openMode` values | Static golden created | OPEN |

## Required Phase 3 proofs

- Load each DB fixture using its actual Dexie schema, upgrade to the current schema, close, reopen, and compare semantic projections.
- Prove each migration writes only its own schema version and is idempotent.
- Inject an exception inside each migration transaction and prove the original database remains intact.
- Preserve `current`, `new-tab`, `new-window`, and `incognito`; only newly created bookmarks default to `current`.
- Separate `dbSchemaVersion` from `backupFormatVersion`.
- Parse and restore both golden backups without changing hierarchy, order, `openMode`, or settings.
- Document downgrade limitations; never use catch-and-wipe or automatic destructive repair.
