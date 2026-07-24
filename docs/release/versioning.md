# Asterfold versioning

Asterfold follows `MAJOR.MINOR.PATCH`.

- `MAJOR`: incompatible product/data model step.
- `MINOR`: compatible capability or substantial security/data hardening.
- `PATCH`: compatible bug, visual or localization fix.

`2.2.0` is a minor release because it adds strict trust-boundary validation, lossless migration/backup guarantees, atomic self-rebalancing order, bounded wallpaper processing, renderer profiles, accessibility gates and deterministic release packaging while preserving Pages → Boards → Bookmarks, existing settings and all bookmark `openMode` values.

Git tags and GitHub Releases use `v2.2.0`. Package and MV3 manifest use `2.2.0`.
