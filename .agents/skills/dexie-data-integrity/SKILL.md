---
name: dexie-data-integrity
description: Asterfold-specific IndexedDB and Dexie data-loss prevention guidance.
---

Cover Dexie transactions, schema migrations, atomic writes, ordering, import/export, backup restore, duplicate IDs, corrupt or partial input, interrupted migrations, concurrency, and transaction boundaries.

Never change a database schema or migration without proving upgrade safety for existing user data. Verify with migration tests, fake-indexeddb, backup/restore roundtrips, corrupt-input handling, and rollback or failure-state tests; use real extension verification when justified.
