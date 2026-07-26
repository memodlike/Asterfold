# Asterfold — Chrome Web Store listing (English)

## Name

Asterfold

## Short description

Private, local-first visual workspace for organizing and opening bookmarks from every new Chrome tab.

Character count: 101 including spaces.

## Detailed description

Asterfold replaces the Chrome new tab with a calm visual workspace for the links you use every day.

Organize bookmarks into Pages and Boards, then open them directly from the new tab. Search, Quick Save, drag-and-drop, Trash, import and export all support the same purpose: keeping useful links easy to find without sending the workspace to an Asterfold server.

### Organize your workspace

- Create Pages for different areas such as work, study or personal projects.
- Group related bookmarks in visual Boards.
- Move Boards and bookmarks with drag-and-drop or keyboard controls.
- Choose how each bookmark opens: in the current tab, a new tab or a new window.

### Find and save links

- Search the local workspace by bookmark title or URL.
- Use Quick Save after an explicit toolbar, keyboard or context-menu action.
- Import the Chrome bookmark tree only when you choose to grant the optional permission.
- Export and restore versioned local backups.
- Recover deleted records from Trash before permanent cleanup.

### Make the new tab yours

- Use light, dark or system appearance.
- Choose a built-in background or a locally stored wallpaper.
- Adjust layout and glass effects.
- Use Balanced or Low Power rendering to match the device.
- Select one of 12 interface languages; uncommon untranslated strings in secondary locales may fall back to English.

### Privacy by design

Asterfold 2.2.2 is local-first. Workspace data is stored in the local Chrome profile. The default release has no application backend, account, analytics, advertising, telemetry, cloud synchronization, host permissions or content scripts, and it makes no application network requests.

Chrome may use the network when you open a destination page or when it supplies its browser-owned favicon resource. Privacy Mode hides bookmark titles in the interface and local search while active, but it is visual protection rather than database encryption.

Read the complete privacy policy before installation:

https://github.com/memodlike/Asterfold/blob/main/docs/security/privacy.md

## Permission summary

- `activeTab`: reads the page title and URL only after you invoke Quick Save or a supported save action.
- `favicon`: displays Chrome's browser-owned favicon for a URL you saved.
- `alarms`: schedules local Trash cleanup using your selected retention period.
- `contextMenus`: adds Save page, Save link and Open Asterfold commands.
- optional `bookmarks`: requested only if you choose Import Chrome bookmarks.

No access to browsing history, cookies, page contents across all sites or host origins is requested.

## Support

Documentation and source: https://github.com/memodlike/Asterfold  
Support and bug reports: https://github.com/memodlike/Asterfold/issues

## Recommended category

Productivity

## URLs

- Homepage: `https://github.com/memodlike/Asterfold`
- Support: `https://github.com/memodlike/Asterfold/issues`
- Privacy policy: `https://github.com/memodlike/Asterfold/blob/main/docs/security/privacy.md`
- Intended hosted policy after GitHub Pages availability is verified: `https://memodlike.github.io/Asterfold/store/privacy.html`
