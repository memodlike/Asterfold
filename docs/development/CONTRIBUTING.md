# Asterfold development guide

These instructions apply to every contributor working in this repository.

## Start here

Read these files before changing code:

1. `README.md`
2. `docs/architecture/decisions.md`
3. `docs/security/review.md` and `docs/security/threat-model.md`

For installation and release work, also read `docs/release/install.md`, `docs/security/permissions.md`, `docs/security/privacy.md`, and `docs/release/release-notes.md`.

## Product boundaries

- Asterfold is an original Chrome Manifest V3 extension, not a LumiList fork.
- Keep the extension local-first and fully usable without an account, API key, or cloud service.
- IndexedDB through Dexie is the source of truth. Chrome storage is reserved for optional auth state.
- Optional Supabase sync must remain disabled unless explicitly configured.
- Do not add remote code, analytics, wildcard host permissions, or broad browser permissions.
- Preserve Pages → Boards → Bookmarks, Quick Save, search, drag-and-drop, import/export, Trash, Privacy Mode, and themes.
- Never claim a feature is complete unless its real code path and validation exist.

## Architecture map

- `entrypoints/`: new-tab, popup, and service-worker entrypoints.
- `src/domain/`: models, URL rules, ordering, errors, and theme definitions.
- `src/db/`: versioned IndexedDB schema, migrations, defaults, and repository operations.
- `src/features/`: product workflows and UI components.
- `src/search/`: local MiniSearch index and ranking.
- `src/services/`: validated import/export formats.
- `src/sync/` and `docs/optional-sync/`: optional, disabled cloud adapter and RLS migration.
- `tests/`: unit/integration coverage using Vitest and fake IndexedDB.
- `e2e/`: serial Chromium tests loading the actual unpacked extension.
- `scripts/release.mjs`: deterministic release creation and manifest/security validation.

## Working rules

- Use Node.js 22 or newer and the pinned `package-lock.json` with `npm ci`.
- Keep TypeScript strict and avoid `any` unless an external boundary makes it unavoidable and documented.
- Put persistence changes behind repository methods and transactions; add a schema migration for stored-data shape changes.
- Validate imports, messages, URLs, and theme input at their trust boundaries.
- Keep service-worker behavior restart-safe; do not depend on long-lived in-memory background state.
- Keep drag-and-drop alternatives keyboard-accessible.
- Preserve reduced-motion behavior and focus visibility.
- Do not edit generated `.output/` or `release/` content by hand.
- Do not commit `.env`, credentials, `node_modules/`, Playwright output, or local browser profiles.

## Required checks

Run before handing off a change:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run release
```

If Chromium is not auto-detected, install it with Playwright and set `ASTERFOLD_CHROMIUM_PATH` to the executable. An environment that forbids Chromium sockets cannot run extension E2E; report that infrastructure limitation explicitly rather than marking E2E as passed.

The installable result is `release/chrome-unpacked/`. The portable archive is `release/chrome-unpacked.zip`.
