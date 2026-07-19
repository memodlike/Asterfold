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
**Decision:** Dexie/IndexedDB is the record source of truth; React derives UI through narrow live queries. Chrome storage is reserved for optional auth.  
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
**Status:** Accepted

**Context:** Quick Save and import must work without browsing-history or page-content access.  
**Options:** broad tabs/host permissions; narrow event-scoped access.  
**Decision:** Required `activeTab`, `alarms`, `contextMenus`, `favicon`, `storage`; optional `bookmarks`, `identity`; no wildcard hosts/content scripts.  
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

## ADR-010 — Portable backups and safety snapshots

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** Personal data needs an account-free recovery path.  
**Options:** proprietary binary; JSON only; JSON plus interoperable formats.  
**Decision:** Versioned complete JSON backup, Netscape HTML, Markdown, and bounded local snapshots. Replace restore snapshots first.  
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
**Status:** Accepted

**Context:** No Supabase credentials were supplied, but the specification calls for a real optional path.  
**Options:** block local release; fake cloud UI; real disabled adapter.  
**Decision:** Compile-time-disabled Supabase adapter, SQL migration, and protocol tests; exact origin added only for configured builds. IndexedDB always accepts local writes.  
**Consequences:** Local product is complete; live two-device behavior remains deployment-dependent and explicitly unverified.  
**Validation:** sync protocol unit tests and disabled-status UI/message tests.

## ADR-013 — PKCE OAuth through `chrome.identity`

**Date:** 2026-07-17  
**Status:** Accepted

**Context:** An MV3 worker cannot safely keep a client secret.  
**Options:** embedded secret; implicit redirect; Supabase PKCE browser flow.  
**Decision:** Request optional `identity`, use `launchWebAuthFlow`, Supabase PKCE, publishable key only, and a stable extension redirect ID.  
**Security/privacy:** No service-role key or OAuth client secret can enter the bundle. Tokens remain isolated in extension storage.  
**Validation:** config/protocol tests; live provider callback awaits owner credentials.

## ADR-014 — Idempotent outbox and monotonic conflicts

**Date:** 2026-07-17  
**Status:** Accepted

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
**Consequences:** No public sharing in 1.0.0; core local parity is unaffected.  
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
