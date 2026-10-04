---
name: asterfold-task-routing
description: Route Asterfold work to the minimum necessary specialist agents and skills.
---

Use the minimum number of agents necessary. Keep at most two concurrent subagents; never let two agents edit the same files. Simple isolated changes stay with the main agent.

For bug fixes, new business logic, Dexie/data changes, behavior-changing features, and regression-sensitive refactors: understand the behavior and relevant Asterfold specialist constraints, then use test-driven-development for a failing test, minimal implementation, green run, and refactor. Use systematic-debugging when the cause or a failure is unclear. Asterfold specialist skills retain priority for MV3, security, data, UI, and release work; extension-testing-qa remains authoritative for Vitest, real-extension Playwright, accessibility, and stress testing. Finish with verification-before-completion. Do not invoke TDD for prose, README, assets, metadata, or clear configuration edits without executable behavior.

- Unknown bug: investigate with systematic-debugging, then TDD for the regression and implementation; use code_reviewer only if material and QA when behavior needs verification.
- Manifest, permissions, service worker, or messaging: chrome_mv3_architect, implementation, security auditor when sensitive, then QA.
- Dexie, migrations, import/export, or backup: dexie-data-integrity, architecture when needed, implementation, then QA.
- UI/UX: extension_ui_designer; optionally react-best-practices or ui-ux-pro-max; QA for meaningful behavior changes.
- Security-sensitive work: extension_security_auditor, implementation, code_reviewer, and QA when executable behavior changes.
- Store/release work: store_readiness_auditor; add security or QA when relevant.
- Dependency changes: dependency-change-review, relevant specialist, then tests.

Review agents inspect after implementation. Keep context narrow and do not spawn agents merely because they exist.
