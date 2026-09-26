# Chrome Web Store submission values — Asterfold 3.6.2

Current version: 3.6.2
Copy these values into the owner Dashboard only after checking them against the final release ZIP.

## Core values

| Field | English value | Russian value |
| --- | --- | --- |
| Name | Asterfold — Visual Bookmark Workspace | Asterfold — Visual Bookmark Workspace |
| Single purpose | Asterfold replaces Chrome New Tab with a local-first visual bookmark workspace for organizing, searching, and opening user-saved bookmarks in Pages and Boards. | Asterfold заменяет новую вкладку Chrome локальным визуальным пространством закладок для организации, поиска и открытия сохранённых закладок со Страницами и Блоками. |
| Short description | Turn Chrome New Tab into a visual bookmark workspace with Pages, Boards, search, and local-first storage. | Новая вкладка Chrome как визуальное пространство закладок со Страницами, Блоками, поиском и локальным хранением. |
| Category | Workflow & Planning | Workflow & Planning |
| Language | English | Русский |

## URLs

| Field | Value |
| --- | --- |
| Homepage | `https://github.com/memodlike/Asterfold` |
| Support | `https://github.com/memodlike/Asterfold/issues` |
| Privacy policy, repository | `https://github.com/memodlike/Asterfold/blob/main/docs/security/privacy.md` |
| Privacy policy, preferred after publication check | `https://memodlike.github.io/Asterfold/store/privacy.html` |

Use only a privacy URL that has been opened publicly without authentication. The preferred URL assumes GitHub Pages is configured to publish the repository's `/docs` directory and must not be entered before that is verified.

## Permission justifications

### `storage`

> The storage permission is used only for the temporary Privacy Mode state in chrome.storage.session so the New Tab page and extension popup can share the same visual privacy state. Chrome clears this session value when the browser session ends. Asterfold bookmark workspace data remains stored locally in IndexedDB.

### `favicon`

> The favicon permission is required to display website icons for URLs that the user has explicitly saved as bookmarks in Asterfold. Asterfold uses Chrome's built-in Manifest V3 favicon resource only for visual bookmark identification. Asterfold does not read page content or browsing history, does not request host permissions, does not contact third-party favicon services, and does not store or transmit favicon data.

### Optional `bookmarks`

> The bookmarks permission is requested only after the user explicitly chooses Import Chrome bookmarks or Refresh from Chrome. Asterfold reads the Chrome bookmark tree locally to import or refresh the user's selected bookmark workspace, then immediately removes the permission. Declining this permission does not affect normal Asterfold use.

### Removed permissions (`activeTab`, `alarms`, `contextMenus`)

> Asterfold 3.6.2 does not request or require `activeTab`, `alarms`, or `contextMenus`. No active-tab URLs/titles are queried, and no background alarm loops run.

## Remote code

Answer **No**. The release uses only code packaged with the extension. Bookmark destination URLs are opened as user-selected web pages and are not executable code loaded into the extension context.

## Host permissions

Answer **None** for the reviewed default build. Stop submission if the final manifest or Dashboard shows a host origin.

## Data use

Answer **No** (the extension does not collect or transmit user data).

In the Developer Dashboard under **Privacy Practices → Data Usage**:
- **Do NOT declare "Web history"**: Asterfold is a local-first visual bookmark workspace. It stores only user-created bookmarks locally in IndexedDB. It does NOT track, monitor, or collect browsing history. Selecting "Web history" causes Chrome and the Web Store to show false warnings that the extension reads historical records / browsing history (*"читает исторические записи"* / *"собирает историю просмотров"*).
- **Do NOT declare "Website content"**: Asterfold does not scrape or read page content. Bookmark URLs are created, imported, or edited locally by the user; no active tab is inspected.
- Do NOT select authentication, location, financial, health, personal communications or general user-activity collection.
- Confirm that data is not sold, transferred to third parties, or used for creditworthiness/advertising.

## Limited Use

> The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

Do not edit or paraphrase this English sentence.

## Distribution

Distribution, visibility, regions and pricing are owner decisions. The repository does not assert that the extension has been submitted, approved or published in Chrome Web Store.

## Official references checked

- [Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing) — the item summary limit is 132 characters.
- [Privacy Policies](https://developer.chrome.com/docs/webstore/program-policies/privacy) — an accurate, current privacy policy is required when the product handles user data.
- [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use) — source of the exact affirmative disclosure used in this package.
