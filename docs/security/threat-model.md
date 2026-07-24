# Threat model

Scope: Asterfold 2.2.0 default local-first MV3 release.

| Asset | Threat | Mitigation | Residual risk |
| --- | --- | --- | --- |
| Saved URLs and navigation | Script/data/file URLs, credentials, controls or poisoned IndexedDB/import | Central `SafeNavigationUrl`; validate before save and again in background before Chrome API | A valid HTTPS destination can still be malicious |
| Workspace hierarchy/order | Partial write, dense/corrupt ranks, multi-tab mutation | Explicit Dexie transactions, scoped allocator/rebalance, typed diagnostics and rollback tests | Same-field local last writer wins |
| Backup/import | Unknown fields, duplicates, orphan/deleted hierarchy, huge input | Strict bounded schemas, semantic preview, Worker parse, snapshot and atomic commit | Dense allowed input still consumes bounded local resources |
| Privacy Mode | Titles leak through DOM/a11y/menu/search/clipboard | Neutral rendered/a11y labels, no private index, clipboard disabled | Database is not encrypted |
| Favicon/custom icon | Third-party request or active SVG/remote payload | Chrome `_favicon`; remote source ignored; bounded decoded local raster only | Chrome controls its internal favicon resolution |
| Wallpaper | MIME spoof, decode bomb, quota exhaustion | Signature sniff, decode/pixel/byte caps, resize, WebP/thumbnail, quota estimate and GC | Codec and quota estimates are browser dependencies |
| Extension pages | XSS/remote code | React escaping, no dangerous HTML, self-only CSP, release scan | Browser/runtime compromise is out of scope |
| Build/archive | Secret/map/env inclusion, dependency compromise, nondeterministic package | Exact lockfile, source allowlist, scans, SHA-pinned CI actions, reproducible ZIP and checksums | Seven high dev-tool advisories remain upstream |
| Cloud data | Accidental upload or misleading sync claim | Cloud code/dependency/permission/host/UI removed from default release | Legacy sync stores remain dormant for lossless upgrades |

Trust boundaries are Chrome APIs, imported files, active-tab metadata, local image decoding, IndexedDB and user-selected destinations. Asterfold does not inject into ordinary web pages.
