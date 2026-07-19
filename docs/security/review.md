# Security review

Review date: 17 July 2026. Scope: source tree, production manifest and bundles, local data paths, import/export, runtime messaging, dependencies, and release packaging.

## Outcome

The local-only release passes the implemented security gate. It has no host permission, content script, remote code, telemetry endpoint, embedded secret, source map, or known dependency advisory at the recorded audit run.

| Control | Result | Evidence |
| --- | --- | --- |
| Manifest V3 | Pass | Built manifest and live worker assertion |
| Required/optional permissions | Pass | Exact lists documented; unused notification permission removed |
| Wildcard hosts | Pass | `host_permissions: []`; release validator rejects wildcards |
| CSP / remote executable code | Pass | Self-only extension CSP; no CDN/remote script; no inline executable script |
| URL safety | Pass | Central protocol/credential/control-character validation before persistence and navigation |
| Import safety | Pass | Size cap, structured schema, prototype-key rejection, preview, transaction, snapshot |
| Message safety | Pass | Zod discriminated union, safe URL validation, same-extension sender check, async response contract |
| XSS | Pass | React escaping, no dangerous HTML insertion, Netscape parser treated as data |
| Destructive actions | Pass | Soft delete, undo/restore, confirmations, safety snapshot before replace, bounded purge |
| Secrets/maps | Pass | Release tree scanner and source/archive exclusions |
| Supply chain | Pass | Lockfile, pinned direct versions, permissive licenses, zero reported audit vulnerabilities |
| Cloud isolation | Design/test pass; live pending | RLS/RPC migration and protocol tests exist; two-user live validation requires a user-owned project |

## Security defects found during implementation

1. A Chrome runtime listener originally returned a Promise, causing the message port to close in real Chromium. It now uses the native callback contract, validates the sender, returns `true`, and has an E2E regression assertion.
2. An unused optional notification permission was removed after final permission review.
3. Dexie seeding inside a live query attempted a write through a read-only transaction. Initialization is now a separate effect, eliminating both the runtime failure and an ambiguous transaction boundary.

## Residual risk and deployment note

Live cloud auth/RLS, provider revocation, and two-device conflict testing are not claimed. Enabling sync changes the network trust boundary and must follow `docs/SYNC_SETUP.md`, use only a publishable key, deploy the checked RLS migration, and run two-user isolation tests. Public sharing remains absent rather than simulated insecurely.
