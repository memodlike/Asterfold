# Asterfold 3.0.1 final release report

## Candidate verdict before merge

```text
GitHub Release: PENDING FINAL MAIN AND TAG GATES
Chrome Web Store package: PR CANDIDATE GO
Chrome Web Store Dashboard: OWNER ACTION REQUIRED
Chrome Web Store submission: READY AFTER VERIFIED RELEASE — NOT SUBMITTED
```

## Repository state

- Repository: `memodlike/Asterfold`
- Original main SHA: `d8bed284f487142c2fe16d4b34b3df80bd45679b`
- Working branch: `agent/asterfold-v3-store-hardening`
- Pull request: `https://github.com/memodlike/Asterfold/pull/9`
- Green pre-evidence candidate SHA: `470943fe946cc277d80edfb103bd204a51614711`
- Version: `3.0.1`
- Intended annotated tag: `v3.0.1`
- `v3.0.0`: intentionally not created or published

## Validation summary

- Production dependency audit: PASS
- Development advisory baseline: PASS
- Source security scan: PASS
- Typecheck: PASS
- Zero-warning lint: PASS
- Coverage: 91.86% statements / 83.73% branches / 91.10% functions / 95.50% lines
- Unit/integration tests: 298 passed / 0 failed
- Chrome Web Store validation: PASS
- Linux deterministic release: PASS
- Windows deterministic release: PASS
- Cross-platform byte comparison: PASS
- Real MV3 E2E: 7 passed / 0 failed
- Axe serious violations: 0
- Axe critical violations: 0
- Reduced motion / forced colors: PASS
- Application network requests in automated locale audit: 0
- Exact `2.2.3 → 3.0.1` upgrade: PASS
- Upgrade tests: 1 passed / 0 failed
- CodeQL: PASS

Evidence runs:

- CI: `https://github.com/memodlike/Asterfold/actions/runs/30425528170`
- CodeQL: `https://github.com/memodlike/Asterfold/actions/runs/30425528214`

## Findings

```text
AF-REL-001 — PR GATES CLOSED; MAIN/RELEASE VERIFICATION PENDING
AF-PROV-001 — IMPLEMENTED; RELEASE VERIFICATION PENDING
AF-DOC-001 — CLOSED
AF-SUP-001 — CLOSED
AF-COV-001 — CLOSED
AF-VAL-001 — AUTOMATED GATES CLOSED; DASHBOARD OWNER ONLY
AF-PKG-001 — CLOSED
AF-UX-001 — CLOSED
```

## Exact Chrome Web Store candidate

- Filename: `Asterfold-Chrome.zip`
- Candidate SHA-256: `bae6ec2422fdb557bd1a1fb3cbcb59f89582bcece6dadebb313f15d586f197f1`
- Manifest version: `3.0.1`
- Manifest V3: yes
- Runtime-only package scan: PASS
- Linux/Windows byte identity: PASS

The final upload package must be downloaded from the published GitHub Release `v3.0.1`; this pre-release candidate file must not be substituted for the post-publication verified asset.

## Privacy Policy gate

Preferred URL: `https://memodlike.github.io/Asterfold/store/privacy.html`

Public repository fallback: `https://github.com/memodlike/Asterfold/blob/main/docs/security/privacy.md`

The repository includes a GitHub Pages deployment workflow for the static `docs` directory. If the repository owner has not enabled Pages with **Source = GitHub Actions**, the workflow reports the owner-side setting and does not claim a successful deployment. The tag gate first waits for unauthenticated desktop/mobile HTTP 200 responses from the preferred Pages URL. If Pages is still unavailable, it verifies the exact-commit public repository fallback and raw source for Policy version 3.0.1 and the Chrome Web Store Limited Use disclosure. This fallback is temporary; the preferred Pages URL must be enabled before Chrome Web Store submission.

## Remaining owner action

After the GitHub Release is cryptographically verified, enable GitHub Pages with **Source = GitHub Actions** if the preferred Privacy Policy URL is not yet public, then re-run the Pages workflow. Open the authenticated Chrome Web Store Developer Dashboard, upload the exact published `Asterfold-Chrome.zip`, complete or review the prepared English/Russian listing and privacy declarations, resolve warnings and save a draft. Do not submit for review without separate explicit authorization.

## Finalization rule

This documentation-only evidence series must pass the complete PR CI and CodeQL gates. After merge, the final main SHA must pass the same gates before the annotated tag is created. The release is GO only after the tag-triggered workflow publishes and re-downloads all assets and validates checksums, provenance and attestations.
