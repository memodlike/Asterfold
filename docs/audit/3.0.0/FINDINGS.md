# Findings status — Asterfold 3.0.0

Statuses in this file are implementation statuses. A finding is not `CLOSED` until the exact branch/main/tag workflow has produced successful evidence.

## Baseline findings

| ID | Baseline | Current status | Remediation | Verification gate | Residual risk |
|---|---:|---|---|---|---|
| AF-REL-001 | HIGH | IMPLEMENTED — CI pending | Tag-only publishing; tag/package/manifest equality; exact release SHA must equal current `origin/main`; exact-SHA CI and CodeQL push runs must be successful; existing release mismatch is fatal | workflow tests, PR CI, main CI, tag workflow | GitHub Release remains blocked until all observed checks are green |
| AF-PROV-001 | HIGH | IMPLEMENTED — CI pending | Deterministic runtime/source/Store archives, SPDX SBOM, source commit/tree provenance, checksums, GitHub artifact/SBOM attestations, post-publication download and byte comparison | provenance/package tests, reproducibility jobs, tag workflow | Attestation proves build origin and digest, not absence of defects |
| AF-DOC-001 | MEDIUM | IMPLEMENTED — CI pending | Versioned 3.0.0 audit set; historical 2.2.3 evidence retained and labelled; current version validation | documentation scan, version validator | Dashboard state cannot be represented as completed without owner evidence |
| AF-SUP-001 | MEDIUM | IMPLEMENTED — CI pending | Production audit remains unconditional; dev high/critical advisories require explicit non-expired baseline entries and drift checks; Dependabot covers npm and Actions | production audit, development baseline, dependency review | Accepted advisories, if any appear, remain explicit residual risk |
| AF-COV-001 | MEDIUM | IMPLEMENTED — threshold evidence pending | Global thresholds set to 85% lines/functions/statements and 80% branches; behavior-focused tests added for new and baseline risks | Vitest coverage | Metrics must be taken from exact PR/main run; threshold is not considered met before CI |
| AF-VAL-001 | MEDIUM | PARTIAL — automatable work implemented | Exact-ZIP validator, real MV3 E2E, Axe, reduced motion, forced colors, network request capture, exact 2.2.3→3.0.0 profile upgrade test, privacy/submission copy | PR/main CI, public privacy URL check, release download verification | Authenticated Chrome Web Store Dashboard remains owner-only; no Store submission is performed |
| AF-PKG-001 | LOW | IMPLEMENTED — CI pending | Store ZIP is created before `HOW-TO-INSTALL.txt`; guide remains only in unpacked distribution; exact runtime allowlist rejects docs/tests/maps/archives/traversal/duplicates/executables | package validator, reproducibility | None after exact published ZIP verification |
| AF-UX-001 | LOW | IMPLEMENTED — visual evidence pending | Localized, non-modal first-use launcher hint; keyboard controls; reduced-motion/forced-colors styles; v5→v6 migration marks existing installations complete without resetting data | component, i18n, migration, first-use E2E, exact upgrade E2E | Store screenshot set is not claimed refreshed until real final-build capture is observed |

## Additional confirmed findings from the complete production review

| ID | Severity | Status | Confirmed problem | Remediation and regression evidence |
|---|---:|---|---|---|
| AF-INT-001 | LOW | IMPLEMENTED — CI pending | Reusable `Button` inherited HTML `submit` behavior inside forms | Defaults to `type="button"`; form regression test |
| AF-A11Y-001 | LOW | IMPLEMENTED — CI pending | Logo had no explicit image semantics | `role="img"` and localized accessible label |
| AF-A11Y-002 | MEDIUM | IMPLEMENTED — CI pending | Modal focus trap allowed Tab to leave a dialog with no enabled focusable descendants | Modal panel retains focus; keyboard regression test |
| AF-A11Y-003 | MEDIUM | IMPLEMENTED — CI pending | Pointer leave could restart toast expiry while keyboard focus remained inside the toast | Resume only when focus is outside; fake-timer regression test |
| AF-INT-002 | MEDIUM | IMPLEMENTED — CI pending | Search palette parent key handler treated Enter/Arrow keys on filters and action buttons as result activation/navigation | Keyboard result navigation is scoped to the search input; regression test |
| AF-STATE-001 | MEDIUM | IMPLEMENTED — CI pending | Import preview state changes re-ran Settings initialization and reset the active section to Appearance | Initialization effect no longer depends on preview state; import-preview regression test |
| AF-RACE-001 | MEDIUM | IMPLEMENTED — CI pending | Rapid Bookmark Editor submits could start duplicate database writes before React disabled-state propagation | Synchronous ref gate; concurrency regression test |
| AF-RACE-002 | MEDIUM | IMPLEMENTED — CI pending | Rapid popup Quick Save activation could start duplicate writes | Synchronous ref gate; real popup E2E and branch CI |

## Review completion

- Baseline tracked files: 164.
- Final working tree inventory: 188 files before generated release output.
- Handwritten production/configuration files manually reviewed: 58, including all 29 files left unreviewed by the 2.2.3 audit.
- Static scan: completed for all text files; binary assets are covered by metadata/dimension/Store validators.
- File-level record: `COVERAGE_LEDGER.csv`.
