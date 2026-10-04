# Agent and skill sources

Local Asterfold skills and agents are maintained in `.agents/` and follow the repository `AGENTS.md` and `.agents/rules/AGENTS.md`.

The following skills are installed globally under `/Users/memodlike/.codex/skills` and are available to Codex:

| Skill | Upstream repository | Commit | License | Source path | Installed |
|---|---|---|---|---|---|
| systematic-debugging | `obra/superpowers` | `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` | MIT | `skills/systematic-debugging` | 2026-09-12 |
| verification-before-completion | `obra/superpowers` | `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` | MIT | `skills/verification-before-completion` | 2026-09-12 |
| react-best-practices | `vercel-labs/agent-skills` | `063bee94c3f4df8453406c830b0a7df0f2860278` | MIT | `skills/react-best-practices` | 2026-09-12 |
| ui-ux-pro-max | `nextlevelbuilder/ui-ux-pro-max-skill` | `7f69fed6a2717900085f1bc3b263721f8ba025e2` | MIT | `.claude/skills/ui-ux-pro-max` | 2026-09-12 |
| chrome-extensions | `GoogleChrome/modern-web-guidance` | `8dd064139b76a47d960c8e4422b73755d33bf6a0` | Apache-2.0 | `skills/chrome-extensions` | 2026-09-12 |
| test-driven-development | `obra/superpowers` | `8ca22dba9a94f28898bbce59f2537ff4d87c747d` | MIT | `skills/test-driven-development` | 2026-09-28 |

The existing Asterfold-local skills remain authoritative where they impose stricter extension or security rules.

Audit note (2026-09-28): the existing `ui-ux-pro-max` installation is not byte-identical to its recorded commit; its `SKILL.md` matches the earlier `e3a7f270ff22b135863321fc72e4dc157a8543a7`, while some bundled data and scripts differ. Its provenance remains unresolved, and this audit did not modify it.
