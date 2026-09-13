---
name: asterfold-task-routing
description: Route Asterfold work to the minimum necessary specialist agents and skills.
---

Use the minimum number of agents necessary. Keep at most two concurrent subagents; never let two agents edit the same files. Simple isolated changes stay with the main agent.

- Unknown bug: systematic-debugging, implement, then code_reviewer only if material; use QA when behavior needs verification.
- Manifest, permissions, service worker, or messaging: chrome_mv3_architect, implementation, security auditor when sensitive, then QA.
- Dexie, migrations, import/export, or backup: dexie-data-integrity, architecture when needed, implementation, then QA.
- UI/UX: extension_ui_designer; optionally react-best-practices or ui-ux-pro-max; QA for meaningful behavior changes.
- Security-sensitive work: extension_security_auditor, implementation, code_reviewer, and QA when executable behavior changes.
- Store/release work: store_readiness_auditor; add security or QA when relevant.
- Dependency changes: dependency-change-review, relevant specialist, then tests.

Review agents inspect after implementation. Keep context narrow and do not spawn agents merely because they exist.
