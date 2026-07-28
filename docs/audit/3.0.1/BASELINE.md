# Asterfold 3.0.1 release baseline

## Status

Asterfold 3.0.0 was an internal, unreleased release candidate. It was superseded before publication. The first public 3.x release candidate is 3.0.1.

The finalized ordinary source tree is validated only through owner-authored exact-SHA CI and CodeQL runs. Automation-authored commits are not accepted as release evidence because GitHub suppresses recursive workflow execution for commits pushed with `GITHUB_TOKEN`.

The final coverage regression corrections were independently typechecked and linted before this owner-authored exact-SHA validation trigger.

## Source baseline

- Published predecessor: `v2.2.3`
- Working branch: `agent/asterfold-v3-store-hardening`
- Pull request: `#9`
- Target release: `v3.0.1`
- Chrome Web Store upload asset: `Asterfold-Chrome.zip`

## Release constraints

- No permission expansion.
- No host permissions or content scripts.
- No remote executable code.
- No Chrome Web Store submission without separate owner authorization.
- Merge, tag and release remain blocked until exact-SHA CI, CodeQL, upgrade, accessibility, network and reproducibility gates pass.
