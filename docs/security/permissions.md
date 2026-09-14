# Permission rationale

Asterfold 3.4.1 uses Manifest V3, `host_permissions: []`, no content scripts and no remotely hosted executable code.

| Permission | Purpose |
| --- | --- |
| `storage` | Store only the temporary Privacy Mode flag in `chrome.storage.session`, so New Tab and popup share the same shoulder-surfing state. Session storage is cleared by Chrome when the browser session ends. Workspace records remain in IndexedDB. |

The optional `bookmarks` permission is requested only on-demand when the user selects Chrome bookmark import or refresh. It is immediately revoked via `browser.permissions.remove` as soon as the read completes. Declining it does not affect the workspace or file import/export.

Asterfold 3.4.1 does not request `activeTab`, `alarms`, `contextMenus`, or `favicon`. Asterfold performs zero active-tab queries, zero background polling alarms, zero context menus, and zero external or internal `_favicon` requests.

The release does not request `identity`, `tabs`, `history`, `scripting`, `webRequest`, `cookies`, clipboard-read, downloads or any host origin. Its extension-page CSP is exactly:

```text
script-src 'self'; object-src 'self'; base-uri 'self'
```

The deterministic release validator fails on unexpected permissions, host permissions, content scripts, source maps, environment files, remote scripts/imports/workers/WASM patterns, embedded executable data URLs, secrets and invalid icon dimensions.
