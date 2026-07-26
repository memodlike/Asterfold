# Asterfold versioning

Asterfold follows `MAJOR.MINOR.PATCH`.

- `MAJOR`: incompatible product/data model step.
- `MINOR`: compatible capability or substantial security/data hardening.
- `PATCH`: compatible bug, visual or localization fix.

`2.2.0` is a minor release because it adds strict trust-boundary validation, lossless migration/backup guarantees, atomic self-rebalancing order, bounded wallpaper processing, renderer profiles, accessibility gates and deterministic release packaging while preserving Pages → Boards → Bookmarks, existing settings and all bookmark `openMode` values.

`2.2.1` is a patch release because it preserves the 2.2 product and data model while removing one unused permission, completing wallpaper-aware backup v3, and adding Chrome Web Store submission materials and validation.

`2.2.2` is a patch release because it preserves the 2.2 product/data model and visual composition while fixing scoped backup, merge isolation, privacy presentation, Quick Save pairing, atomic bulk operations, bounded media and release evidence.

Git tags and GitHub Releases use a `v` prefix, for example `v2.2.2`. Package and MV3 manifest use the numeric version, for example `2.2.2`.
