# Asterfold — Chrome Web Store listing (English)

## Name

Asterfold — Visual Bookmark Workspace

## Short description

Turn Chrome New Tab into a visual bookmark workspace with Pages, Boards, search, Quick Save, and local-first storage.

Character count: 117 including spaces.

## Detailed description

Asterfold is a local-first visual bookmark workspace for Chrome New Tab.

It replaces each new tab with a visual workspace where bookmarks are organized into Pages and Boards, so frequently used links stay visible, structured and quick to open.

### Organize bookmarks visually

- Create Pages for work, study, personal projects or other contexts.
- Group related bookmarks in visual Boards.
- Reorder Boards and bookmarks with drag-and-drop or keyboard controls.
- Choose whether a bookmark opens in the current tab, a new tab or a new window.

### Find, save and import links

- Search the local workspace for saved bookmarks.
- Use Quick Save from the extension toolbar, keyboard shortcut or supported context-menu action.
- Import Chrome bookmarks only after you explicitly grant the optional `bookmarks` permission.
- Import browser-exported HTML bookmarks or a validated Asterfold backup.
- Export local backups and supported bookmark formats.
- Restore deleted Pages, Boards and bookmarks from Trash before permanent cleanup.

### Customize the New Tab workspace

- Use light, dark or system appearance.
- Choose a built-in background or a wallpaper stored locally in Asterfold.
- Adjust layout, opacity, blur, wallpaper and glass controls.
- Choose Auto, Maximum Quality or Smooth Glass rendering, with a separate Low Power option for weaker hardware.
- Select from 12 interface languages; rare untranslated strings in secondary locales may fall back to English.

### Local-first privacy model

Asterfold stores the primary workspace locally in the Chrome profile. No Asterfold account is required. The current release has no application backend, cloud synchronization, analytics, advertising or telemetry. It requests no host permissions and injects no content scripts into websites.

Quick Save reads the active page title and URL only after an explicit user action. Chrome bookmark access is optional and requested only when you choose to import Chrome bookmarks.

Privacy Mode hides bookmark titles in the interface and prevents local search indexing while it is active. It is visual shoulder-surfing protection, not database encryption.

Chrome itself may use the network when you open a destination page or when it provides its browser-owned favicon resource. Asterfold makes no application network requests in the reviewed default build.

Read the privacy policy before installation:

https://github.com/memodlike/Asterfold/blob/main/docs/security/privacy.md

## Permission summary

- `activeTab`: reads the active page title and URL only after a user-invoked save action.
- `favicon`: displays Chrome's browser-owned favicon resource for a saved URL.
- `alarms`: schedules local Trash cleanup using the selected retention period.
- `contextMenus`: adds user-invoked Save page, Save link and Open Asterfold commands.
- `storage`: stores the temporary Privacy Mode flag in `chrome.storage.session`.
- optional `bookmarks`: requested only when you choose Import Chrome bookmarks.

No browsing-history, cookies or host-origin access is requested.

## Support

Documentation and source: https://github.com/memodlike/Asterfold
Support and bug reports: https://github.com/memodlike/Asterfold/issues

## Recommended category

Workflow & Planning

## URLs

- Homepage: `https://github.com/memodlike/Asterfold`
- Support: `https://github.com/memodlike/Asterfold/issues`
- Privacy policy: `https://github.com/memodlike/Asterfold/blob/main/docs/security/privacy.md`
- Hosted policy, after public availability is verified: `https://memodlike.github.io/Asterfold/store/privacy.html`
