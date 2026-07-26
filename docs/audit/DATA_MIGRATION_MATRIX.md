# Data migration and backup matrix

Static fixtures are generated deterministically by `scripts/generate-audit-fixtures.mjs` and checked into `tests/fixtures/audit/`.

| Source | Fixture | Required preserved semantics | Edge cases included | Current evidence | Status |
| --- | --- | --- | --- | --- | --- |
| DB v1 | `migrations/db-v1.json` | Page/Board/Bookmark hierarchy and all four `openMode` values | Sparse settings | AF-DATA-T001 real-schema upgrade and reopen | FIXED |
| DB v2 | `migrations/db-v2.json` | Existing theme/navigation and all `openMode` values | Stale default/last Quick Save refs | AF-DATA-T001 real-schema upgrade and reopen | FIXED |
| DB v3 | `migrations/db-v3.json` | Layout fields and deleted hierarchy | Deleted Page → Board → Bookmark | AF-DATA-T001 real-schema upgrade and reopen | FIXED |
| DB v4 | `migrations/db-v4.json` | Performance settings and all `openMode` values | Uploaded WebP representation | AF-DATA-T001 real-schema upgrade and reopen | FIXED |
| DB v5 | `migrations/db-v5.json` | 100 active bookmarks, order, settings and optional sync state | Invalid rank, duplicate rank, stale refs, deleted hierarchy, wallpaper, pending outbox | AF-DATA-T001 real-schema open and reopen | FIXED |
| Backup v1 | `backups/backup-v1-golden.json` | Export→parse→restore deep-equal user semantics | Legacy sparse layout/theme and all `openMode` values | AF-DATA-T002 explicit v1→v2 migration and restore round trip | FIXED |
| Backup v2 | `backups/backup-v2-golden.json` | Export→parse→restore deep-equal user semantics | Full settings and all `openMode` values | AF-DATA-T002 parse/restore/re-export deep equality | FIXED |

## Required Phase 3 proofs

- Load each DB fixture using its actual Dexie schema, upgrade to the current schema, close, reopen, and compare semantic projections.
- Prove each migration writes only its own schema version and is idempotent.
- Inject an exception inside each migration transaction and prove the original database remains intact.
- Preserve `current`, `new-tab`, `new-window`, and `incognito`; only newly created bookmarks default to `current`.
- Separate `dbSchemaVersion` from `backupFormatVersion`.
- Parse and restore both golden backups without changing hierarchy, order, `openMode`, or settings.
- Document downgrade limitations; never use catch-and-wipe or automatic destructive repair.

## Verified behavior

- Each fixture is opened using the matching historical Dexie store declaration and upgraded transactionally.
- Closing and reopening the upgraded database produces the same Pages, Boards, Bookmarks, and Settings.
- An injected exception during the v1→v2 transaction leaves the original settings unchanged.
- Migration v3 records schema `3`, v4 records schema `4`, and v5 records schema `5`.
- A migration changes `updatedAt` only when it actually changes that record's schema fields.
- Backup format `1` is migrated explicitly to format `2`; unknown formats are rejected.
- Export→parse→restore→export preserves entity and settings semantics, including all `openMode` values.

Downgrade is not automatic. Keep a pre-update backup and load an older extension as a separate unpacked installation only when that version explicitly supports the backup format.
