# Asterfold 3.0.1 test evidence

## Coverage expansion validation

The release coverage expansion was validated before it was committed to the ordinary source tree.

- Validation workflow: `Validate and apply coverage expansion v2`
- Workflow run: `https://github.com/memodlike/Asterfold/actions/runs/30423033833`
- Validation source SHA: `86e5843db950f620c5e3e11eae342d4181d6e4bb`
- Result: PASS
- Test files: 41 passed / 41 total
- Tests: 296 passed / 296 total
- Tests failed: 0
- Duration: 75.18 seconds

### Global coverage

| Metric | Result | Required | Status |
|---|---:|---:|---|
| Statements | 91.86% | 85% | PASS |
| Branches | 83.73% | 80% | PASS |
| Functions | 91.10% | 85% | PASS |
| Lines | 95.50% | 85% | PASS |

The workflow committed the validated behavior suites and removed the temporary coverage transport. The final release decision still requires the same tests and thresholds to pass through ordinary CI and CodeQL on the exact owner-authored Pull Request head SHA.

## Release blockers

Merge, tag, and release remain blocked until ordinary exact-SHA CI completes Store validation, deterministic Linux and Windows packaging, real Manifest V3 E2E, accessibility and visual validation, exact `2.2.3 → 3.0.1` upgrade validation, cross-platform byte comparison, and CodeQL.
