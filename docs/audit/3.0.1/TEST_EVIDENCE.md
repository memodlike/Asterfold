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

The workflow committed the validated behavior suites and removed the temporary coverage transport.

## Locale-independent real MV3 validation

The first exact-SHA E2E run exposed a test-only localization assumption: a fresh Chromium profile selected English while the selector expected a Russian accessible name. The rendered first-use hint itself was visible, fully inside the 1280×720 viewport, and correctly localized.

The E2E test now targets stable semantic CSS hooks while separately requiring a non-empty accessible name. The same correction was applied to the forced-colors launcher visibility check.

- Validation workflow: `Fix locale-independent MV3 E2E selectors`
- Workflow run: `https://github.com/memodlike/Asterfold/actions/runs/30423714971`
- Validated source tree before ordinary commit: `ec1b853ee208565d52bb4e335291b5f8e414cf2c`
- Ordinary E2E fix commit: `9f323da596efbc054fdb5d60c7c178cfd0d5d855`
- Static validation: PASS
- Production extension build: PASS
- First-use real MV3 flow: PASS
- Accessibility/reduced-motion/forced-colors flow: PASS
- Temporary fix workflow, script, and trigger: removed

## Final release gate

The final release decision requires all ordinary CI and CodeQL checks to pass on the exact owner-authored Pull Request head SHA, including the complete real MV3 suite, exact `2.2.3 → 3.0.1` same-profile upgrade, and Linux/Windows byte comparison.
