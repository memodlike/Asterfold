# Asterfold versioning

Asterfold follows `MAJOR.MINOR.PATCH`.

- `MAJOR`: incompatible product/data model step.
- `MINOR`: compatible capability or substantial security/data hardening.
- `PATCH`: compatible bug, visual or localization fix.

`2.2.0` adds strict trust-boundary validation, migration/backup guarantees, self-rebalancing ordering, bounded wallpaper processing, accessibility gates and deterministic packaging while preserving Pages → Boards → Bookmarks.

`2.2.1` removes an unused permission, completes wallpaper-aware backup v3 and adds Chrome Web Store submission materials.

`2.2.2` fixes selection backups, merge isolation, privacy presentation, Quick Save pairing, bounded media, Page actions and transactional bulk operations.

`2.2.3` is the final Store-readiness patch. It fixes popup destination state, cross-context session Privacy Mode, scoped restore safety, authoritative URL normalization, bounded/cancellable imports, HTML description round-trips, atomic free-grid moves, transactional settings, default-Page metadata and removal of inaccessible runtime snapshots while retaining the legacy store for migration compatibility.

Git tags and GitHub Releases use a `v` prefix, for example `v2.2.3`. Package and MV3 manifest use the numeric version `2.2.3`.
