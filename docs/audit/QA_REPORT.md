# QA report

Machine-generated and command evidence belongs in `EVIDENCE.md`; this file is the reviewer summary.

On 26 July 2026, branch `codex/final-hardening-v2.2.2` completed a clean local install plus typecheck, lint, 129 unit/integration/component tests with coverage, production build, Store validation, reproducible release, five real unpacked-MV3 Playwright tests and the production dependency audit.

Covered flows include safe navigation, Privacy Mode, v1–v5 migration, backup v1/v2/v3 round-trip, selection backup, deleted-batch merge isolation, atomic ordering/repository rollback, strict import, wallpaper rejection/optimization, Quick Save destination repair, keyboard overlay behavior, serious/critical axe checks, 12 locale startup checks, zero application network requests, 100-bookmark desktop layout and deterministic archives.

The five 1280×800 Store screenshots were recaptured from the production MV3 build and visually compared with the 2.2.1 reference at the same viewport. Pages → Boards → Bookmarks, Frost Light/Graphite Dark, glass treatment and the lower-left launcher remain recognizable and unchanged in composition.

Not claimed: Chrome Web Store approval, a published public privacy URL, representative low-end Windows GPU traces, manual Windows Chrome interaction, or global 85/85/80/85 source coverage. The current full-source coverage is 57.79% lines, 41.98% functions, 46.03% branches and 52.28% statements; critical domain/media modules have stricter per-file gates.
