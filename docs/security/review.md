# Security review

Review date: 27 July 2026. Target: Asterfold 2.2.3 on `agent/final-store-readiness-v2.2.3`.

## Verified design controls

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

## Permission status

The 2.2.3 manifest requests `activeTab`, `favicon`, `alarms`, `contextMenus` and `storage`, with optional `bookmarks`. `storage` is used only for `chrome.storage.session`, which keeps temporary Privacy Mode consistent between New Tab and popup and is cleared by Chrome at the end of the browser session. There are no host permissions or content scripts.

## Dependency status

The production dependency audit is required to pass with zero high-severity runtime advisories. The complete development audit remains visible in CI and may report advisories confined to WXT, web-ext or ESLint tooling; those advisories are not represented as clean until upstream-compatible fixes exist.

## Residual risk

Privacy Mode is visual shoulder-surfing protection, not encryption. Local malware or a compromised Chrome profile can read extension data. Destination websites remain outside Asterfold's trust boundary. Chrome Web Store approval and representative low-end Windows GPU profiling are external validation steps.

Final command results and artifact hashes are recorded only after branch CI completes in `docs/audit/EVIDENCE.md`.
