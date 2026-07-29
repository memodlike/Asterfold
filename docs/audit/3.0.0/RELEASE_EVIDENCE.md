# Release evidence — Asterfold 3.0.0

This file is updated only with observed results. It does not claim Chrome Web Store approval.

## Pre-release

- Original `main`: `d8bed284f487142c2fe16d4b34b3df80bd45679b`
- Working branch: `agent/asterfold-v3-store-hardening`
- Package target: `3.0.0`
- Permissions target: unchanged required `activeTab`, `favicon`, `alarms`, `contextMenus`, `storage`; optional `bookmarks`; no host permissions or content scripts.
- Exact upgrade baseline: `Asterfold-Chrome.zip` 2.2.3, SHA-256 `e666c0e40ca2bcd1631b04e3b9087e38b26f71336664ecfc475ee8b4d610920a`.

## Local static evidence

- Version consistency script: passed for current source tree.
- Source security scanner: passed for current source tree.
- JavaScript release scripts: syntax checked.
- `git diff --check`: passed.
- Full dependency install, TypeScript, ESLint, coverage, build, Playwright, cross-OS reproducibility and CodeQL are intentionally recorded only from GitHub Actions because the execution container has no npm network/cache.

## CI, merge, tag and release

Pending exact GitHub PR run, merge, main push runs, tag workflow and published-asset verification. These fields must be replaced after observation; a pending field is not release evidence.
