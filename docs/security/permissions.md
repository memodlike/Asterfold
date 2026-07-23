# Permission rationale

Asterfold 2.1.2 uses Manifest V3, no wildcard host access, no content scripts, and no remote code. Permissions are deliberately narrow.

## Required permissions

| Permission | Why it is needed | What it does not allow Asterfold to do |
| --- | --- | --- |
| `activeTab` | Read the title, URL, and favicon of the user-invoked active tab for Quick Save and the shortcut. | It does not grant persistent browsing-history access or arbitrary background access to every tab. |
| `alarms` | Run bounded Trash-retention cleanup after startup and once per day. | It does not wake continuously or send data anywhere. |
| `contextMenus` | Add “Save page,” “Save link,” and “Open Asterfold” user actions. | It does not inspect page content. |
| `favicon` | Render Chrome's built-in `_favicon` resource for URLs the user saved. | It does not read history; the requested page URL is already stored by the user. |
| `storage` | Store an optional cloud-auth session when cloud sync is explicitly compiled and configured. Core records remain in IndexedDB. | It does not add network access or expose storage to websites. |

Chrome's extension APIs permit creating tabs/windows without the broad `tabs` permission. Asterfold therefore does not request `tabs`, `history`, `scripting`, `webRequest`, `cookies`, clipboard-read, downloads, or any wildcard host permission.

## Optional permissions

| Permission | When requested | Declining it |
| --- | --- | --- |
| `bookmarks` | Only after selecting **Chrome bookmarks** under Import & Export. | File import/export and every local workspace feature continue to work. |
| `identity` | Only by an explicitly enabled optional Supabase PKCE sign-in flow. It is never requested in the default local-only UI. | The extension remains fully functional offline and locally. |

## Hosts and Content Security Policy

The default production release has `host_permissions: []`. A custom cloud build may add exactly the configured HTTPS Supabase origin; it never adds `*://*/*`. Extension pages use:

```text
script-src 'self'; object-src 'self'; base-uri 'self'
```

All JavaScript is bundled locally. There are no remotely loaded scripts, inline executable scripts, content scripts, or `eval`-based application code.
