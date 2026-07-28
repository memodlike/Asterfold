# Test matrix — Asterfold 3.0.0

| Area | Automated evidence | Manual/owner evidence |
|---|---|---|
| Manifest and permissions | manifest policy tests, version validator, release validator | Dashboard permission declarations |
| Release provenance | deterministic packaging tests, provenance verifier, exact-SHA workflow verifier, attestations | independent verification of published attestation URL/record |
| Upgrade 2.2.3 → 3.0.0 | exact audited 2.2.3 ZIP hash check; same Chrome profile and unchanged unpacked-extension path; page/board/bookmarks/open modes/Trash/settings/theme/privacy preservation | optional Chrome Stable owner smoke on the installed production identity |
| First use | launcher discovery component/a11y/i18n tests; 1280×720 real-extension E2E; existing-user suppression in exact upgrade | final screenshot review |
| Privacy Mode | session, search, clipboard and persistence tests; popup/new-tab E2E | restart and Incognito enablement owner smoke |
| Import/export | malformed, prototype pollution, future schema, size/depth, cancellation, rollback and golden fixture tests | representative user files |
| Service worker | manifest/source assertions and real MV3 worker/navigation/popup E2E | DevTools terminate/restart observation where Chrome automation cannot expose the control |
| Accessibility | semantic component tests, Axe E2E, reduced motion and forced colors | screen reader and 200% zoom owner confirmation |
| Network | source scanner and real-extension capture separating HTTP(S) application traffic from extension/internal resources | optional DevTools Network inspection |
| Store package | exact runtime allowlist, duplicate/traversal/executable scan, two-build and cross-OS byte comparison | upload only the published `Asterfold-Chrome.zip` hash |
| Optional bookmarks permission | denied/granted behavior tests and user-invoked request path | Chrome permission prompt and revoke-from-extension-settings smoke |
