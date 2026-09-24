# Architecture decision log

## ADR-001 — React, TypeScript, WXT, Manifest V3

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** The project needs typed React entrypoints, a new-tab override, popup, and short-lived service worker.  
**Options:** raw Chrome build; Vite with custom manifest copying; WXT.  
**Decision:** WXT 0.20.27, React 19.2, strict TypeScript 5.9, Manifest V3.  
**Reasons:** WXT models extension entrypoints and builds a deterministic MV3 folder while retaining normal Vite optimizations.  
**Consequences:** Build tooling is a dependency; generated output is validated independently. No remote code.  
**Performance/migration:** Heavy dialogs are lazy; no legacy extension migration is required.  
**Validation:** Typecheck, lint, production build, and Chromium load-unpacked E2E.

## ADR-002 — IndexedDB is the state boundary

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Records must survive reload/restart, support transactions/Blob data, and remain local-first.  
**Options:** React-only state; `localStorage`; Chrome storage; IndexedDB through Dexie.  
**Decision:** Dexie/IndexedDB is the record source of truth; React derives UI through narrow live queries. The production extension does not use the Chrome Storage API.
**Consequences:** Local writes complete before success feedback; popup and new tab share one extension database.  
**Security/privacy:** No entity is mirrored into webpage-accessible storage.  
**Validation:** CRUD, persistence, popup sharing, and repository tests.

## ADR-003 — Versioned normalized schema

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Hierarchy, Trash, backup, and future sync need explicit identity and migration.  
**Options:** nested document; flat unversioned rows; normalized versioned tables.  
**Decision:** Separate Page, Board, Bookmark, Settings, Wallpaper, Snapshot, Outbox, SyncState, and Diagnostic tables with parent/position/deletion/version fields. Schema version is separate from app SemVer.  
**Consequences:** Cascade operations span transactions; imports can validate topology.  
**Migration impact:** Schema 2 merges sparse schema-1 settings and adds compound indexes/outbox state without a wipe.  
**Validation:** `tests/migrations.test.ts` and invariant diagnostics.

## ADR-004 — Fractional string ordering

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Reordering should avoid rewriting an entire list.  
**Options:** integer array indexes; floating numbers; lexicographic fractional rank strings.  
**Decision:** Persist lexicographic rank keys and rebalance a scoped sibling set only when rank space is exhausted.  
**Consequences:** Reorders usually update one entity; positions remain deterministic across reloads.  
**Validation:** ordering unit tests and real cross-board drag E2E.

## ADR-005 — Local MiniSearch index

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Search needs fuzzy/prefix/exact matching without sending saved text to a server.  
**Options:** table scans; custom fuzzy matcher; MiniSearch.  
**Decision:** Build a bounded in-memory MiniSearch index from active bookmark fields and apply hierarchy scopes outside the index.  
**Consequences:** Rebuild is cheap at tested workspace sizes; results are capped and Privacy Mode disables visible search.  
**Performance:** 10,000-record index/query benchmark is part of the suite.  
**Validation:** ranking, typo, scope, exact, and benchmark tests.

## ADR-006 — dnd-kit with explicit alternatives

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Multiple sortable containers require pointer and keyboard access.  
**Options:** native HTML drag; custom pointer math; dnd-kit.  
**Decision:** dnd-kit sensors and sortable transforms for bookmark moves; every move is also available through menus/dialogs.  
**Consequences:** Reliable cross-board collision handling without making drag the only path.  
**Validation:** pointer drag E2E, persistent target assertion, keyboard-focus review.

## ADR-007 — Least-privilege permissions

**Date:** 2026-07-17  
**Status:** Superseded by ADR-019

**Context:** Quick Save and import must work without browsing-history or page-content access.  
**Options:** broad tabs/host permissions; narrow event-scoped access.  
**Decision:** Required `activeTab`, `alarms`, `contextMenus`, `favicon`, and `storage`; optional `bookmarks`; no `identity`, wildcard hosts or content scripts. `storage` is restricted to `chrome.storage.session` for the transient cross-context Privacy Mode flag; workspace data remains in IndexedDB.
**Security/privacy:** Reduces compromise impact and install warnings.  
**References:** Chrome action, activeTab, permissions, favicon, commands, and contextMenus documentation.  
**Validation:** manifest E2E and release permission scanner.

## ADR-008 — Original optimized wallpaper assets

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Themes need calm premium backgrounds without copied artwork or a large initial bundle.  
**Options:** remote images; CSS-only gradients; generated original WebP plus local uploaded Blob.  
**Decision:** Bundle four original 1600×1000 WebP images; validate uploaded image MIME/size and store Blob/thumbnail in IndexedDB with object-URL cleanup.  
**Consequences:** Offline, no tracking, <100 KB for all built-ins; user uploads consume local quota.  
**Validation:** build asset scan and visual QA.

## ADR-009 — Previewed transactional import

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Malformed or huge imports must not corrupt existing data.  
**Options:** stream directly into DB; parse then write; worker pipeline.  
**Decision:** Cap at 25 MB, parse/validate/prototype-check first, show mapping/count preview, then transact; report invalid/duplicate counts.  
**Consequences:** Very large valid files occupy memory during preview, bounded by the size cap.  
**Validation:** hostile input tests and JSON/HTML round-trip tests.

## ADR-010 — Portable backups and atomic restore

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Personal data needs an account-free recovery path.  
**Options:** proprietary binary; JSON only; JSON plus interoperable formats.  
**Decision:** Versioned complete JSON backup, Netscape HTML and Markdown. Replace is accepted only for a complete full backup and commits atomically. Version 2.2.3 creates no hidden recovery snapshots; the legacy IndexedDB store remains only for migration compatibility.  
**Consequences:** Theme/wallpaper metadata is portable; raw uploaded wallpaper blobs are intentionally not embedded in lightweight text exports.  
**Validation:** serialize/parse/merge/replace/round-trip tests and E2E backup preview.

## ADR-011 — Multi-tab convergence through IndexedDB

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Popup, new tabs, and worker can mutate one workspace.  
**Options:** central long-lived worker; BroadcastChannel authority; transactional IndexedDB plus liveQuery.  
**Decision:** Database transactions are authoritative; Dexie liveQuery refreshes views, and a typed change message is only a wake-up hint.  
**Consequences:** No service-worker lifetime assumption and no last in-memory writer.  
**Validation:** shared popup/new-tab E2E and repository transaction tests.

## ADR-012 — Cloud remains optional and local-first

**Date:** 2026-07-17  
**Status:** Superseded by ADR-018

**Context:** No Supabase credentials were supplied, but the specification calls for a real optional path.  
**Options:** block local release; fake cloud UI; real disabled adapter.  
**Decision:** Compile-time-disabled Supabase adapter, SQL migration, and protocol tests; exact origin added only for configured builds. IndexedDB always accepts local writes.  
**Consequences:** Local product is complete; live two-device behavior remains deployment-dependent and explicitly unverified.  
**Validation:** sync protocol unit tests and disabled-status UI/message tests.

## ADR-013 — PKCE OAuth through `chrome.identity`

**Date:** 2026-07-17  
**Status:** Superseded by ADR-018

**Context:** An MV3 worker cannot safely keep a client secret.  
**Options:** embedded secret; implicit redirect; Supabase PKCE browser flow.  
**Decision:** Request optional `identity`, use `launchWebAuthFlow`, Supabase PKCE, publishable key only, and a stable extension redirect ID.  
**Security/privacy:** No service-role key or OAuth client secret can enter the bundle. Tokens remain isolated in extension storage.  
**Validation:** config/protocol tests; live provider callback awaits owner credentials.

## ADR-014 — Idempotent outbox and monotonic conflicts

**Date:** 2026-07-17  
**Status:** Superseded by ADR-018

**Context:** Offline edits, retries, and duplicate delivery must converge.  
**Options:** last request wins; timestamp wins; operation receipts plus versions/cursor.  
**Decision:** Durable operation IDs, server receipts, expected versions, monotonic entity versions, ordered server cursor, tombstones, and finite exponential retry.  
**Consequences:** Conflicting stale operations are reported and retained for retry/diagnosis instead of silently erasing local data.  
**Validation:** duplicate, ordering, retry, tombstone, and conflict protocol tests.

## ADR-015 — No sharing surface without an authorization service

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Secure Page/Board share/revoke/expiry requires deployed policy, token hashing, and multi-user testing.  
**Options:** unsafe local token links; placeholder buttons; omit from credential-free release.  
**Decision:** Do not ship fake or insecure sharing UI. Document it as optional-cloud N/A in the local release.  
**Consequences:** No public sharing in 2.0.0; core local parity is unaffected.
**Security/privacy:** Eliminates guessable-token and accidental-public-data risks from an undeployed feature.

## ADR-016 — Semantic theme tokens with portable custom theme JSON

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Six presets and live user customization must share one maintainable component system.  
**Options:** per-theme CSS copies; runtime class overrides; validated semantic variables.  
**Decision:** One tokenized CSS system, six validated presets, live bounded controls, contrast warning, reset, JSON save/import, and reduced-motion handling.  
**Consequences:** A custom theme is the current autosaved configuration and a portable JSON file rather than a second theme database.  
**Validation:** theme/domain tests, E2E Graphite computed-color assertion, screenshots.

## ADR-017 — Release folder identity and validation

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Personal unpacked installation needs predictable upgrades without publishing a private key.  
**Options:** ship a signing key; accept path-derived ID; Web Store publish.  
**Decision:** Never ship a private key; instruct users to keep the same absolute release path. Validate/copy the production output, archive source/unpacked folders, and checksum both.  
**Consequences:** Moving the unpacked folder may create a fresh extension identity.  
**Validation:** E2E loads the final release copy and the release script scans manifest, assets, secrets, maps, and permissions.

## ADR-018 — Cloud is not shipped in the default release

**Date:** 2026-07-24
**Status:** Accepted

**Context:** The optional adapter lacked the complete live two-user/two-device release gate required for a production privacy claim.
**Decision:** Remove the Supabase dependency, runtime, host/identity permission, messages, setup UI/docs and sync claims from 2.2.0. Retain legacy IndexedDB stores only so upgrades are lossless.
**Consequences:** Default build has no application backend. A future cloud feature is a new reviewed product boundary, not a compile-time toggle.

## ADR-019 — Browser-owned favicons with privacy-safe rendering

**Date:** 2026-09-16  
**Status:** Superseded by ADR-020

**Context:** Asterfold 3.4.1 removed all favicon rendering to minimize permissions, leaving letter monograms as the normal bookmark identity. The product needs real site icons without host access, third-party icon providers, or application network requests.
**Options:** retain monograms; call an external favicon service; fetch arbitrary sites; use Chrome's favicon resource.
**Decision:** Request only Chrome's `favicon` permission beside `storage`, validate saved HTTP(S) URLs, and render `chrome-extension://…/_favicon/` at a normalized DPR-aware size. Keep `bookmarks` optional, `host_permissions` empty, and all other former permissions absent. Privacy Mode never constructs or renders a site favicon; unavailable or failed resources use a neutral local vector icon.
**Consequences:** Chrome's own favicon cache/policy determines whether a site icon is available. Asterfold stores no favicon binary and makes no third-party request. Bookmark hover motion is isolated to an inner visual surface so dnd-kit retains ownership of the outer drag transform.
**Validation:** URL, privacy, manifest, card fallback, real MV3 E2E, reduced-motion, low-power, and reproducible-package tests.

## ADR-020 — Restore Chrome-native site favicons and refined bookmark motion

**Date:** 2026-09-18  
**Status:** Accepted

**Context:** Asterfold 3.5.3 removed the `favicon` permission to publish with zero permission warnings on the Chrome Web Store. Users and product requirements accept the standard low-privilege `favicon` permission ("Read the icons of the websites you visit") to restore real website branding on New Tab bookmark cards, the editor preview, and search results.
**Options:**
1. Retain zero-favicon configuration with neutral SVG icons only.
2. Third-party favicon APIs (Google S2, DuckDuckGo, etc.) — REJECTED: violates zero-telemetry policy.
3. Direct `fetch()` to `/favicon.ico` — REJECTED: violates empty `host_permissions: []` invariant.
4. Chrome Manifest V3 native `_favicon` API — ACCEPTED: resolves through browser-managed cache with zero network calls from extension code.
**Decision:**
1. Request standard Manifest V3 `favicon` permission beside `storage` (`permissions: ["storage", "favicon"]`).
2. Construct browser-owned `chrome.runtime.getURL("/_favicon/?pageUrl=...&size=...")` with safe URL validation (`http:` and `https:` only, credentials/control chars rejected).
3. Normalize resource sizes to DPR-aware Chrome buckets `[16, 32, 48, 64]`.
4. Render real favicons across BookmarkCard, BookmarkEditor, and SearchPalette (with monogram fallback).
5. Ensure zero-CLS with bounded layout containers and local neutral SVG `<Globe />` fallback on failure or in Privacy Mode.
6. Refine bookmark motion with micro-scale (`scale(1.05)`) on `.favicon`, keeping dnd-kit transform isolated to outer `.bookmark-card`. Strictly disable transforms in reduced-motion and low-spec performance profiles.
**Consequences:** Asterfold makes 0 third-party network requests and stores 0 favicon binaries. Chrome Web Store submission includes explicit justification for the `favicon` permission.
**Validation:** Unit tests (`browserApi.test.ts`, `browserFavicon.test.tsx`, `bookmarkCardIntegration.test.tsx`), manifest policy tests, E2E Playwright tests, reproducible release validation.

## ADR-021 — One glass material with four rendering tiers

**Date:** 2026-09-24  
**Status:** Accepted

**Context:** Boards were translucent glass, but every overlay (launcher, Settings, search, Trash, dialogs, menus) was forced opaque grey by `opaque-ui.css` with `!important`, so the product looked like two applications. The Glass blur slider was not wired to anything, the GPU probe created a WebGL context on every new tab, and choosing the solid "Software" mode also set the legacy low-power flag, which resolved to the compatibility tier instead.
**Options:** keep opaque overlays; blur every overlay surface individually; one tokenised material resolved per rendering tier.
**Decision:**
1. `src/styles/material.css` defines one material (tint density per surface: menu, sheet, tile, pill) and resolves it per `<html data-performance>` tier: **quality** (live backdrop blur on small surfaces plus one blurred scrim), **balanced** (short blur radius, no full-screen blur), **compatibility** (tint only, no `backdrop-filter`), **software** (solid surfaces, no transparency, fade-only motion). `prefers-reduced-transparency` overrides any glass tier.
2. The rendering tier is stored in the startup snapshot (v3) and applied before first paint, so weak GPUs never render a frame of live blur.
3. Settings is a single-screen bento of tiles over one blurred scrim; tiles never carry their own `backdrop-filter`. The scrim animates on `::before` so the backdrop element never becomes a Chrome backdrop root that would hide the page from child glass.
4. Search is a floating spotlight; matches on the active page are marked in place with DOM data attributes batched per animation frame (no board re-render).
5. Accent colour follows the background (measured built-in wallpaper accents, the most vivid gradient point, or a 48×32 sample of an upload) unless the user picks one, and is lightness-shifted to ≥ 3:1 against the surface.
6. Only `transform` and `opacity` animate, via one spring token (`linear()` easing); tests reject heavy-property transitions and `transition: all` in every stylesheet.
7. The WebGL renderer string is cached for a week per browser build and the probe context is released immediately.
**Consequences:** Nine settings tiles cost one blur pass in the quality tier and none below it. The GPU probe no longer runs on every new tab. "No transparency" now really selects the solid tier.
**Validation:** `performanceStress.test.ts` (tier tokens, compositor-only motion, single scrim blur, software precedence), `renderingSignals.test.ts`, `accent.test.ts`, `spotlightHighlights.test.tsx`, updated Settings/launcher suites, and real MV3 Playwright runs.
