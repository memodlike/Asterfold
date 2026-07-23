# Threat model

Scope: Asterfold 2.1.1 local release and its disabled optional sync adapter. Primary assets are saved URLs/titles/descriptions, hierarchy/order, settings/wallpaper blobs, backups, optional cloud tokens, and user trust in browser navigation.

| Asset | Threat | Impact | Mitigation | Residual risk | Validation |
| --- | --- | --- | --- | --- | --- |
| Existing workspace | Malicious or malformed JSON/HTML import, prototype pollution, decompression-style resource exhaustion | Corruption, freeze, unexpected keys | 25 MB cap; Zod schemas; explicit records; unsafe key rejection; safe URL allowlist; complete preview before transaction; replace snapshot | A deliberately dense 25 MB file can still consume memory during parse | Corrupt/prototype/oversize/import tests; E2E preview/cancel |
| Browser navigation | Crafted `javascript:`, `data:`, credential-bearing, control-character, or deceptive URL | Code execution/navigation abuse or credential leakage | Central parser allows only `http:`, `https:`, `mailto:` as appropriate; strips credentials; normalizes; validates again in worker before open/save | Legitimate phishing HTTPS links remain possible because this is a user-managed bookmark tool | URL/domain tests and runtime-message E2E |
| Extension pages | XSS through title, description, URL, imported HTML, or favicon | Access to all local records/session | React text escaping; no `dangerouslySetInnerHTML`; Netscape parser extracts attributes/text; CSP self-only; favicon URL treated as untrusted and falls back; no remote script | A browser/React vulnerability remains outside app control | Static source scan, CSP release validation, hostile input tests |
| Cloud session | Stolen refresh/access token | Remote bookmark disclosure/modification | Cloud disabled by default; PKCE; no embedded client/service secret; token in extension storage; exact HTTPS origin; sign-out removal; RLS | Malware or a compromised browser profile can read extension data/tokens | Config tests; live token-revocation validation pending credentials |
| Cloud records | Broken or missing Row Level Security | Cross-user disclosure | SQL enables/forces RLS; every policy binds `user_id = auth.uid()`; RPC derives user from auth, not payload; service-role key forbidden | Owner could deploy a modified/incorrect migration | SQL review and protocol tests; two-user live isolation pending deployment |
| Ordering/entities | Multi-tab race or concurrent drag/edit | Lost ordering or stale field overwrite | IndexedDB transactions; version field; one local source; live queries; scoped rank recalculation; cloud expected versions | Two simultaneous local last-writer updates to the same scalar field resolve by commit order | Repository transactions, shared popup/new-tab E2E |
| Sync queue | Replay/duplicate delivery or reordering | Duplicate records, resurrection, divergent devices | Unique operation ID receipts; entity IDs; monotonic version checks; tombstones; ordered server cursor; finite backoff/checkpoint | Pathological offline conflicts may require user reconciliation in a future cloud UI | Protocol idempotency/conflict/tombstone tests |
| Shared content | Guessable/replayed share token | Unauthorized public disclosure | No share-token or public-sharing surface ships without a deployed hashing/expiry/revocation service | Feature is unavailable in local 2.1.1 | Release source/UI scan; parity marked N/A |
| Storage/quota | Oversized or hostile wallpaper | Quota exhaustion, decode cost, visual spoofing | Image MIME allowlist, 8 MB cap, browser decode, downscaled thumbnail, Blob in IndexedDB, object URL cleanup, no SVG upload | Complex compressed images can still be relatively expensive to decode | Repository validation tests and visual upload path review |
| Local database | Corruption or partial operation | Data loss or broken hierarchy | Atomic transactions; topology audit; safe starter repair; portable exports; snapshots before destructive replace; no automatic wipe | Physical profile corruption can defeat IndexedDB and snapshots in the same profile | Invariant, rollback, import, CRUD tests; Diagnostics UI |
| Existing installation | Failed update/migration or downgrade | Extension will not open or records become unreadable | Versioned Dexie upgrade transaction; sparse-setting merge; test fixture; same-path update instructions; backup first; no catch-and-wipe | Downgrade is not automatic; backup compatibility depends on older build | Migration test and install/rollback guide |
| Build/dependencies | Compromised dependency, remote code, leaked secret/source map | Full extension compromise or credential leak | Exact direct versions/lockfile; permissive-license list; audit gate; no runtime CDN; CSP; release scan for maps/private keys/service-role strings; cloud code lazy/disabled | Registry or maintainer compromise before a reviewed lockfile update | `npm audit`, production build scan, checksums, source review |

## Trust boundaries

- Web pages are untrusted; Asterfold does not inject scripts into them.
- Runtime messages are untrusted input even within the extension and pass a typed Zod parser plus sender-ID check.
- Imported files, bookmark-tree values, active-tab metadata, favicons, user wallpaper files, and sync payloads are all untrusted.
- Chrome's extension process, IndexedDB implementation, and an optional owner-controlled Supabase deployment are external trust dependencies.

## Security properties intentionally not claimed

Privacy Mode is visual masking, not encryption. Asterfold cannot protect against local malware, a compromised browser/OS profile, or a user explicitly opening a malicious saved site. The default release makes no claim about live cloud confidentiality because no cloud endpoint is configured.
