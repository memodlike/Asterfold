# Security review

## STATUS: CURRENT — Asterfold 3.6.0

Review date: 24 September 2026. Target: Asterfold 3.6.0 on `main`.

### Verified design controls

| Control | Implementation |
| --- | --- |
| Permission minimization | Strictly `permissions: ["storage", "favicon"]` with optional `bookmarks` on-demand. Zero `activeTab`, zero `alarms`, zero `contextMenus`, zero host permissions (`host_permissions: []`), zero content scripts. |
| Remote code and network isolation | Strict CSP (`script-src 'self'; object-src 'self'; base-uri 'self'`). Zero remote executable code, zero third-party network requests, zero analytics, telemetry, or remote backends. |
| Native Chrome Favicons & Privacy Isolation | Real site favicons render exclusively via `chrome.runtime.getURL("/_favicon/")` using Chrome's local browser cache with DPR scaling (16/32/48/64px). Legacy stored icon fields are ignored. In Privacy Mode, favicon URLs are never constructed or queried, rendering neutral local SVG vectors. |
| Cross-context Privacy Mode | Transient shoulder-surfing flag uses `chrome.storage.session` (cleared automatically by Chrome when the browser closes); persistent data stays in local IndexedDB. |
| Schema 10 & Data Integrity | IndexedDB Schema 10 introduces machine-readable `source` and `sourceId` on `Page` and `Board` entities. Chrome bookmark refreshes match target pages and boards idempotently without creating duplicate pages or losing user local renames. |
| Folder Identity Isolation | Chrome bookmark import groups by folder source ID (`chrome:<folderSourceId>`), preserving distinct boards for same-name folders under different parent trees and preventing URL cross-merging. |
| Robustness & Entity Parsing | HTML entity decoding strictly checks Unicode scalar value boundaries (`0x0000..0xD7FF`, `0xE000..0x10FFFF`) and rejects UTF-16 surrogates without uncaught `RangeError`. File imports are bounded upfront at 128 MB with a 30s cancellable Web Worker. |
| Clean Message Protocol | Bounded runtime message schemas with strict input validation. Dead message types (`QUICK_SAVE`, `INSTANT_SAVE`, `SET_BADGE`) and obsolete error codes removed. |
| Zero Vulnerability Dependency Status | Production and development dependencies report 0 vulnerabilities via `npm audit` and `npm audit --omit=dev --audit-level=high` (Vitest upgraded to 4.1.11). |
| Complete SBOM & Provenance | Full npm lockfile v3 dependency graph (461 packages) generated into SPDX 2.3 SBOM with package URLs (`purl`), validated via `scripts/validate-sbom.mjs`. Deterministic ZIPs and SLSA provenance generated on release. |

### Permission status

Asterfold 3.6.0 requires strictly `permissions: ["storage", "favicon"]`. The `storage` permission is restricted to `chrome.storage.session` for transient privacy state synchronization. The `favicon` permission accesses Chrome's local icon cache for user-saved bookmarks. The optional `bookmarks` permission is requested on-demand only when the user triggers Chrome bookmark import and is revoked immediately upon completion. Asterfold has zero host permissions, zero `activeTab`/`alarms`/`contextMenus`, and injects zero content scripts.

### Dependency status

The production and development dependency audits pass with zero vulnerabilities. All development dependencies have been updated to secure patched releases.

### Residual risk

Privacy Mode is visual shoulder-surfing protection, not cryptographic at-rest encryption. Local machine malware or an untrusted Chrome profile with direct filesystem access can inspect IndexedDB files. Outbound bookmark navigation opens third-party URLs outside Asterfold's security boundary.

---

## STATUS: HISTORICAL — Asterfold 3.1.0

Review date: 2 August 2026. Target: Asterfold 3.1.0 on `agent/final-store-readiness-v3.1.0`.

### Verified design controls

| Control | Implementation |
| --- | --- |
| URL and message boundaries | Strict URL parser in UI and service worker; strict bounded runtime messages |
| Remote code and network isolation | No host permissions, content scripts, remote executable code, analytics, telemetry or application backend |
| Cross-context Privacy Mode | Transient state uses `chrome.storage.session`; persistent state remains in local IndexedDB |
| Quick Save integrity | Page/Board pairs are validated in the popup UI and again immediately before persistence |
| Backup and restore | Only a complete `full` backup may replace a workspace; scoped backups are merge-only |
| Import hardening | File, depth, node and bookmark bounds; cancellable worker parsing; authoritative URL normalization |
| Repository integrity | IndexedDB transactions cover settings read-modify-write and free-grid swap/reorder |
| Release integrity | Deterministic ZIPs, SHA-256 checksums, strict Manifest/CSP/permission scan and remote-code pattern scan |

### Permission status

The 3.1.0 manifest requests `activeTab`, `favicon`, `alarms`, `contextMenus` and `storage`, with optional `bookmarks`. `storage` is used only for `chrome.storage.session`, which keeps temporary Privacy Mode consistent between New Tab and popup and is cleared by Chrome at the end of the browser session. There are no host permissions or content scripts.

### Dependency status

The production dependency audit is required to pass with zero high-severity runtime advisories. The complete development audit remains visible in CI and may report advisories confined to WXT, web-ext or ESLint tooling; those advisories are not represented as clean until upstream-compatible fixes exist.

### Residual risk

Privacy Mode is visual shoulder-surfing protection, not encryption. Local malware or a compromised Chrome profile can read extension data. Destination websites remain outside Asterfold's trust boundary. Chrome Web Store approval and representative low-end Windows GPU profiling are external validation steps.

Final command results and artifact hashes are recorded only after branch CI completes in `docs/audit/EVIDENCE.md`.
