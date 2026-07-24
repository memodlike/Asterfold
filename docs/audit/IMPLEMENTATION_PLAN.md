# Asterfold hardening implementation plan

Audit base: `eeb0fe52804c6da9431260390837cd4c4302093f`
Working branch: `audit/hardening-2-2`
Started: 2026-07-24 (Asia/Almaty)

## Invariants

- Preserve Pages → Boards → Bookmarks, the lower-left launcher, Frost Light, Graphite Dark, and the recognizable workspace composition.
- Preserve bookmark data, ordering, `openMode`, settings, and lossless backup semantics.
- The default MV3 release remains local-first with no telemetry, ads, affiliate tracking, remote scripts, wildcard hosts, or shipped cloud claims.
- Add a regression test before each fix. Do not weaken assertions or document an unexecuted result.
- Data migrations require versioned fixtures, transaction rollback coverage, idempotency, and explicit lossless evidence.
- Performance and security claims require measurements or test IDs on the commit being described.

## Execution order and gates

| Phase | Scope | Required gate before next phase | Planned commit |
| --- | --- | --- | --- |
| 0 | Baseline, evidence, migration fixtures, golden backups | Unit/type/lint/build/release green; E2E infrastructure failure documented and resolved before Phase 1 | `test: capture hardening baseline` |
| 1 | URL policy, runtime messages, background navigation | URL and navigation regression suite + real-extension E2E | `fix(security): centralize safe bookmark navigation` |
| 2 | `_favicon`, local custom icons, Privacy Mode | Network interception + DOM/a11y privacy snapshots | `fix(privacy): eliminate remote favicon requests and harden privacy mode` |
| 3 | DB/backup migrations and lossless restore | v1–v5 fixtures, rollback, idempotency, deep-equal round trip | `fix(data): preserve bookmark behavior across migration and restore` |
| 4 | Atomic ordering service | 1k append, 10k moves, corruption, concurrency, rollback | `fix(data): make ordering self-rebalancing and atomic` |
| 5 | Repository invariants | Fault injection, cascade, exactly-one-default, atomic bulk operations | `fix(data): enforce workspace invariants transactionally` |
| 6 | Strict schemas/import/diagnostics | Bounds, semantics, worker failure, cancel and rollback | `feat(data): add strict import and invariant validation` |
| 7 | Wallpaper pipeline | MIME/decode/quota/cancel/GC browser tests | `fix(performance): bound and optimize wallpaper storage` |
| 8 | Renderer profiles and measured performance | Before/after traces and budgets on target datasets | `perf: add balanced renderer and remove scaling bottlenecks` |
| 9 | Accessibility patterns | axe, keyboard E2E, snapshots, reduced preferences, contrast | `fix(a11y): align interactions with accessible patterns` |
| 10 | Functional settings matrix | Every visible setting has persistence, effect, export, migration and test | `fix(ux): make every visible setting functional` |
| 11 | Cloud decision | Default release contains no incomplete cloud UI/bundle/claim | `chore(sync): remove incomplete cloud path from default release` |
| 12 | Tokens and folded-asterisk identity | Optical icon tests, dimensions, contrast and visual snapshots | `feat(brand): unify Asterfold with folded asterisk identity` |
| 13 | Deterministic release and CI | Two-build reproducibility, security scan, Windows smoke, real MV3 E2E | `ci: enforce real extension security and release gates` |
| 14 | Documentation truth | Every current claim links to evidence on the described commit | `docs: align security and quality claims with verified behavior` |
| 15 | Clean final validation | All mandatory commands from a clean tree; no P0; no failing E2E | Final release commit/tag only after owner approval |

## Current stop condition

Phase 1 is blocked. The baseline real-extension E2E cannot launch Chromium in the managed macOS environment because Crashpad attempts to access a protected user-library path. The teardown also dereferences an uninitialized context. Both facts are recorded in `EVIDENCE.md`; neither is treated as a product test success.
