# Asterfold 3.0.1 network evidence

## Automated production-extension audit

- Candidate SHA: `470943fe946cc277d80edfb103bd204a51614711`
- CI run: `https://github.com/memodlike/Asterfold/actions/runs/30425528170`
- Browser: Chromium loaded with the exact production Manifest V3 unpacked build
- Result: PASS

The E2E suite captured HTTP(S) requests while loading and switching through all selectable locales. The observed application request list was empty.

The core-flow test also poisoned a bookmark with remote `faviconUrl` and `customIcon` values pointing to `tracker.invalid`. Reloading and rendering the bookmark produced no request to that host. Unsafe navigation payloads were rejected by the service worker before Chrome navigation APIs were used.

## Covered runtime paths

- New Tab production entrypoint
- Popup production entrypoint
- First-use flow
- Locale switching
- Privacy Mode propagation to popup
- Bookmark creation and rendering
- Bookmark navigation-message validation
- Search and core workspace persistence
- Browser restart/persistent-profile behavior through the upgrade test

## Policy result

- Analytics: none observed
- Telemetry: none observed
- Advertising: none observed
- Developer backend: none observed
- Remote executable code: rejected by source/package scans
- External favicon provider: none observed; Chrome-local `_favicon` is the supported runtime source
- Unexpected application HTTP(S) requests in the automated audit: 0

## Scope limitation

The automated audit records browser requests exercised by the production MV3 scenarios above. It is not a packet capture of Chrome-owned update, DevTools or operating-system traffic. Such browser-internal traffic is outside the extension application boundary and is not attributed to Asterfold.
