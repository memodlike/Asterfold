# Agent and skill sources

Local Asterfold skills and agents are maintained in `.agents/` and follow the repository `AGENTS.md` and `.agents/rules/AGENTS.md`.

The following skills are installed globally under `/Users/memodlike/.codex/skills` and are available to Codex:

| Local skill | Upstream | Commit | License | Source path |
|---|---|---|---|---|
| systematic-debugging | `obra/superpowers` | `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` | MIT | `skills/systematic-debugging` |
| verification-before-completion | `obra/superpowers` | `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` | MIT | `skills/verification-before-completion` |
| react-best-practices | `vercel-labs/agent-skills` | `063bee94c3f4df8453406c830b0a7df0f2860278` | MIT | `skills/react-best-practices` |
| ui-ux-pro-max | `nextlevelbuilder/ui-ux-pro-max-skill` | `7f69fed6a2717900085f1bc3b263721f8ba025e2` | MIT | `.claude/skills/ui-ux-pro-max` |
| chrome-extensions | `GoogleChrome/modern-web-guidance` | `8dd064139b76a47d960c8e4422b73755d33bf6a0` | Apache-2.0 | `skills/chrome-extensions` |

Installation date: 2026-09-12. No local modifications were made to the installed external skills. The existing Asterfold-local skills remain authoritative where they impose stricter extension or security rules.
