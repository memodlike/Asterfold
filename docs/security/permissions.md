# Permission rationale

Asterfold 3.1.0 uses Manifest V3, `host_permissions: []`, no content scripts and no remotely hosted executable code.

| Permission | Purpose |
| --- | --- |
| `activeTab` | Read the current title and URL only after the user invokes Quick Save. |
| `alarms` | Run bounded Trash retention cleanup and clear transient action badges. |
| `contextMenus` | Provide Save page, Save link and Open Asterfold actions. |
| `favicon` | Use Chrome's browser-owned `_favicon` resource for URLs already saved by the user. |
| `storage` | Store only the temporary Privacy Mode flag in `chrome.storage.session`, so New Tab and popup share the same shoulder-surfing state. Session storage is cleared by Chrome when the browser session ends. Workspace records remain in IndexedDB. |

The optional `bookmarks` permission is requested only when the user selects Chrome bookmark import. Declining it does not affect the workspace or file import/export.

The release does not request `identity`, `tabs`, `history`, `scripting`, `webRequest`, `cookies`, clipboard-read, downloads or any host origin. Its extension-page CSP is exactly:

```text
script-src 'self'; object-src 'self'; base-uri 'self'
```

The deterministic release validator fails on unexpected permissions, host permissions, content scripts, source maps, environment files, remote scripts/imports/workers/WASM patterns, embedded executable data URLs, secrets and invalid icon dimensions.
