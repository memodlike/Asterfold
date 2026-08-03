# Asterfold privacy policy

Effective date: 2 August 2026<br>
Policy version: 3.1.1<br>
Applies to: Asterfold 3.1.1 for Chrome

Asterfold replaces the Chrome new tab with a local-first visual workspace for organizing and opening bookmarks. It processes the information needed for those features on the user's device. It does not claim that no data is processed.

## Information Asterfold processes

Asterfold may process and store:

- bookmark URLs, titles, custom labels, opening mode and order;
- Pages, Boards, layout choices and other workspace settings;
- Trash records and retention settings;
- Quick Save destination settings and the title and URL of the page the user explicitly chooses to save;
- bookmark data from a file selected by the user, or the Chrome bookmark tree after the user chooses that import and grants the optional permission;
- local backup and restore data;
- a wallpaper image selected by the user, plus a resized local copy, thumbnail and technical metadata such as dimensions and stored size;
- legacy custom raster icon values when present in an imported Asterfold backup; version 3.1.1 does not provide a UI for adding or rendering them.

This information may include personal or sensitive content if the user puts such content in bookmark names, URLs, imported files or images. Asterfold uses it only to provide the requested bookmark-workspace features.

## Where information is stored

Workspace records and uploaded assets are stored locally in the user's Chrome profile, primarily in IndexedDB. Search indexes and import previews are created locally. Older installations may retain legacy diagnostic snapshot records created by an earlier version; version 3.1.1 does not create new snapshots. The temporary Privacy Mode state is stored in `chrome.storage.session` so popup and New Tab stay consistent; Chrome clears that value when the browser session ends.

Asterfold 3.1.1 has no application backend, account system or cloud synchronization. The default build has no host permissions and makes no application network requests. Data is not sent to the developer.

Chrome itself may use the network when the user opens a destination page or when Chrome supplies its browser-owned `_favicon` resource for a saved URL. Those browser actions are separate from an application request by Asterfold. Asterfold does not store or render a remote favicon URL.

## How information is used

Local information is used to:

- display and organize Pages, Boards and bookmarks;
- open a bookmark in the user-selected mode;
- search the local workspace;
- perform Quick Save after an explicit user action;
- import, export, restore and diagnose local data;
- show an optional local wallpaper;
- move deleted items to Trash and apply the selected retention period.

The information is not used for advertising, profiling, credit decisions or any purpose unrelated to the extension's single purpose.

## Sharing, sale and human access

Asterfold does not:

- transmit user data to the developer;
- sell user data;
- share user data with third parties;
- use advertising, affiliate tracking, analytics, telemetry or behavioral profiling;
- allow the developer or its personnel to read the user's local workspace;
- use remote scripts or executable code.

The local Chrome profile, operating system, browser sync settings outside Asterfold and destinations opened by the user remain subject to their own security and privacy behavior.

## Quick Save and permissions

Quick Save reads the active page's URL and title only after the user invokes the toolbar action, keyboard command or supported context-menu action. The information is saved to the user's local workspace.

The optional `bookmarks` permission is requested only after the user chooses **Import Chrome bookmarks**. If granted, Asterfold reads the Chrome bookmark tree locally to create an import preview and imports the records the user confirms. Declining the permission does not affect the normal workspace or file import/export.

The required permissions are limited to the functions described in [Permission rationale](permissions.md). The `storage` permission is used only for the transient Privacy Mode flag in `chrome.storage.session`; workspace data is not migrated to Chrome sync storage.

## Import, backup and deletion

File import and validation run locally. Asterfold does not upload an imported file.

The user can export a versioned JSON backup or bookmark data in supported text formats. An exported file is saved only to the location chosen through the browser. A backup can contain bookmark URLs, titles, workspace structure, settings and supported local assets; it should be protected like any other personal file.

Users can delete individual items, restore them from Trash, permanently empty Trash, or remove the extension and its local site data. Before removal or replacement, export a backup if the data matters.

## Wallpapers and legacy icon values

Uploaded wallpapers are decoded, bounded and stored locally. Remote wallpaper URLs are not accepted. Legacy custom raster icon values may remain inside imported backups for data compatibility, but version 3.1.1 does not render them or provide a UI for adding them. Removing or replacing a wallpaper may remove unreferenced local copies during cleanup.

## Privacy Mode

Privacy Mode hides bookmark titles in the rendered interface, removes them from accessible labels and context actions, disables clipboard actions, and prevents construction of the local search index while the mode is active.

Privacy Mode is shoulder-surfing protection, not encryption. The underlying local database is not encrypted by Asterfold and may be accessible to the Chrome profile, operating system or anyone who controls the device.

## Children

Asterfold is a general-purpose productivity tool and is not directed specifically to children. It does not knowingly collect information through a developer-operated service because no such service exists in version 3.1.1.

## Limited Use

> The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

Русский перевод: использование информации, полученной через API Google, соответствует политике пользовательских данных Chrome Web Store, включая требования Limited Use. Точная обязательная английская формулировка приведена выше без изменений.

## Changes to this policy

If a future release adds a backend, cloud synchronization, telemetry or another material data practice, this policy must be updated before that feature is released. The effective date and policy version will change when the policy changes materially.

## Contact

Questions and privacy requests can be submitted through the public project issue tracker:

<https://github.com/memodlike/Asterfold/issues>

Repository: <https://github.com/memodlike/Asterfold>
