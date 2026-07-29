# Asterfold 3.0.1 findings status

This file records the 3.0.1 release-candidate status. Post-release provenance closure is completed only after the published assets have been downloaded and independently verified.

| Finding | Status before merge | Closure condition |
|---|---|---|
| AF-REL-001 | PR GATES CLOSED | Final `main` CI/CodeQL green, annotated tag and GitHub Release published |
| AF-PROV-001 | IMPLEMENTED — RELEASE VERIFICATION PENDING | Published checksums, provenance and attestations verified after download |
| AF-DOC-001 | CLOSED | Version history, privacy, permissions, Store and release documentation reconciled |
| AF-SUP-001 | CLOSED | Production audit and development advisory baseline pass |
| AF-COV-001 | CLOSED | Global 91.86/83.73/91.10/95.50 coverage and 298 tests pass |
| AF-VAL-001 | AUTOMATED GATES CLOSED — DASHBOARD OWNER ONLY | Authenticated Chrome Web Store draft remains an owner-side action |
| AF-PKG-001 | CLOSED | Runtime-only Store ZIP passes package allowlist and byte reproducibility |
| AF-UX-001 | CLOSED | Localized first-use flow, existing-user onboarding suppression and accessibility gates pass |

## Release blockers

At candidate SHA `470943fe946cc277d80edfb103bd204a51614711`, no automated PR release blocker remained. The documentation-only evidence commits that follow must pass the same CI and CodeQL gates before merge.

## Non-blocking owner action

The Chrome Web Store Developer Dashboard requires an authenticated owner session. The exact published `Asterfold-Chrome.zip` may be uploaded and saved as a draft only. Submission for review is not authorized by this release procedure.
