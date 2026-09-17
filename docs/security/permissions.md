# Permission rationale

Asterfold 3.5.2 uses Manifest V3, `host_permissions: []`, no content scripts and no remotely hosted executable code.

| Permission | Purpose |
| --- | --- |
| `storage` | Store only the temporary Privacy Mode flag in `chrome.storage.session`, so New Tab and popup share the same shoulder-surfing state. Session storage is cleared by Chrome when the browser session ends. Workspace records remain in IndexedDB. |
| `favicon` | Resolve a saved, validated HTTP(S) bookmark through Chrome's browser-owned `_favicon` resource. This requires no host permission, no remote favicon provider, no stored icon blobs, and no application network request. |

The optional `bookmarks` permission is requested only on-demand when the user selects Chrome bookmark import or refresh. It is immediately revoked via `browser.permissions.remove` as soon as the read completes. Declining it does not affect the workspace or file import/export.

Asterfold 3.5.2 does not request `activeTab`, `alarms`, or `contextMenus`. It performs zero active-tab queries, zero background polling alarms, zero context menus, and uses `_favicon` only for a saved, safe HTTP(S) URL. Privacy Mode never constructs or renders that URL, preventing favicon identity disclosure.

The release does not request `identity`, `tabs`, `history`, `scripting`, `webRequest`, `cookies`, clipboard-read, downloads or any host origin. Its extension-page CSP is exactly:

```text
script-src 'self'; object-src 'self'; base-uri 'self'
```

The deterministic release validator fails on unexpected permissions, host permissions, content scripts, source maps, environment files, remote scripts/imports/workers/WASM patterns, embedded executable data URLs, secrets and invalid icon dimensions.
