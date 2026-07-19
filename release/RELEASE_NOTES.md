# Asterfold 1.0.0 release notes

Released 17 July 2026. Application version `1.0.0`; IndexedDB schema version `2`; minimum Chrome version `120`.

## Included

- Manifest V3 new-tab workspace with Pages, Boards, and Bookmarks.
- Toolbar Quick Save, instant mode, context menus, and configurable keyboard shortcut.
- Pointer and keyboard drag-and-drop, entity menus, duplicate/move flows, and multi-select bulk actions.
- Local fuzzy/prefix/exact search with global, Page, and Board scopes.
- JSON backup/merge/replace, Netscape HTML import/export, Markdown export, optional Chrome bookmark import, validation preview, and local snapshots.
- Cascading Trash, restore, undo, permanent deletion, and configurable retention.
- Privacy Mode, six complete themes, four original built-in wallpapers, user wallpaper upload, and theme import/export.
- Dexie schema migration, safe URL/message/import validation, strict CSP, minimal permissions, and original Asterfold branding/assets.
- Unit/integration, 10,000-record search, migration, and real unpacked-extension Chromium E2E coverage.
- Optional Supabase PKCE/RLS/outbox sync source and migration, disabled safely by default.

## Upgrade notes

Schema 2 adds sync/outbox state and compound indexes while preserving schema-1 local settings and entities. Migration is transactional and covered by an upgrade fixture test. Export a JSON backup before any update.

## Known limitations

- The default release is intentionally local-only. Live OAuth, two-user RLS isolation, cross-device synchronization, and sharing require a user-owned Supabase project and were not live-verified because no cloud credentials were supplied.
- Public Page/Board sharing is not exposed in the local release.
- Privacy Mode masks the interface; it is not at-rest encryption.
- Unpacked extension identity is path-derived when no signing key is used. Keep the installation folder path stable across updates.
