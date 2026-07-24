# Permission rationale

Asterfold 2.2.0 uses Manifest V3, `host_permissions: []`, no content scripts and no remote code.

| Permission | Purpose |
| --- | --- |
| `activeTab` | Read the current title and URL only after the user invokes Quick Save. |
| `alarms` | Run bounded Trash retention cleanup on startup and daily. |
| `contextMenus` | Provide Save page, Save link and Open Asterfold actions. |
| `favicon` | Use Chrome's browser-owned `_favicon` resource for URLs already saved by the user. |
| `storage` | Retained for narrow extension preference compatibility; workspace records remain in IndexedDB. |

The optional `bookmarks` permission is requested only when the user selects Chrome bookmark import. Declining it does not affect the workspace or file import/export.

The release does not request `identity`, `tabs`, `history`, `scripting`, `webRequest`, `cookies`, clipboard-read, downloads or any host origin. Its extension-page CSP is exactly:

```text
script-src 'self'; object-src 'self'; base-uri 'self'
```

The deterministic release validator fails on unexpected permissions, non-exact/non-HTTPS hosts, source maps, environment files, remote code patterns and invalid icon dimensions.
