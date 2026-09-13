---
name: dependency-change-review
description: Review dependency changes for Asterfold compatibility, risk, and release impact.
---

Use for package.json/package-lock.json and changes involving React, WXT, Vite, Dexie, dnd-kit, MiniSearch, Zod, Playwright, Vitest, ESLint, TypeScript, or Chrome tooling. Explain why the change is needed; inspect breaking changes and the lockfile delta; minimize transitive changes; check security, MV3, Node, release, SBOM, and provenance impact; run relevant tests. Do not upgrade merely because a newer version exists.
