# QA report

> Historical evidence notice: sections describing 2.2.3 and earlier are retained as historical records. Current 3.0.1 remediation status is maintained under `docs/audit/3.0.1/`.

Machine-generated command evidence belongs in `EVIDENCE.md`; this file is the reviewer summary.

## Asterfold 2.2.3 scope

Branch `agent/final-store-readiness-v2.2.3` closes the remaining Store-readiness findings from the independent 2.2.2 review:

- popup Quick Save clears and rejects stale Page/Board destinations;
- temporary Privacy Mode is shared between New Tab and popup through `chrome.storage.session`;
- scoped backups are merge-only and cannot remove global settings or wallpaper assets;
- imported titles, descriptions, nesting, values and bookmark counts are bounded;
- backup URL-derived fields are rebuilt from the authoritative URL;
- Netscape HTML descriptions survive export/import round trips;
- free-grid placement and ordering move in one transaction;
- settings updates use transactional read-modify-write;
- old default Pages receive correct version metadata;
- inaccessible runtime snapshots are no longer created; the legacy store is retained only for upgrade compatibility;
- release validation covers the exact 2.2.3 permission set and additional remote-code patterns.

## Required acceptance gate

The branch is not considered release-ready until GitHub Actions passes typecheck, lint, unit/integration coverage, Store asset validation, deterministic release generation, real unpacked-MV3 Playwright tests, production dependency audit, Windows reproducibility and CodeQL. Exact results and hashes will be appended to `EVIDENCE.md` after the run.

Not claimed before that gate: Chrome Web Store approval, public listing publication, representative low-end Windows GPU traces or a clean full development-tool audit where upstream advisories remain.
