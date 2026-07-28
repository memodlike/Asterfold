# Chrome Web Store submission values — Asterfold 3.0.0

Current version: 3.0.0
Copy these values into the owner Dashboard only after checking them against the final release ZIP.

## Core values

| Field | English value | Russian value |
| --- | --- | --- |
| Name | Asterfold | Asterfold |
| Single purpose | Asterfold replaces the Chrome new tab with a private, local-first visual workspace for organizing and opening bookmarks. | Asterfold заменяет новую вкладку Chrome локальным визуальным рабочим пространством для организации и открытия закладок. |
| Short description | Private, local-first visual workspace for organizing and opening bookmarks from every new Chrome tab. | Локальное визуальное пространство для организации и открытия закладок в каждой новой вкладке Chrome. |
| Category | Productivity | Продуктивность |
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

### `activeTab`

> Reads the current page title and URL only after the user invokes Quick Save or a supported save action, so the selected page can be added to the local bookmark workspace.

### `favicon`

> Displays Chrome's browser-owned `_favicon` resource for a URL already saved by the user. Asterfold does not request or store a remote favicon URL.

### `alarms`

> Schedules local Trash cleanup according to the retention period selected by the user.

### `contextMenus`

> Adds the user-invoked Save page, Save link and Open Asterfold commands.

### `storage`

> Stores only the temporary Privacy Mode flag in `chrome.storage.session`, allowing popup and New Tab to share the same visual-protection state. Chrome clears this session value when the browser session ends; bookmark workspace data remains in IndexedDB.

### Optional `bookmarks`

> Requested only when the user selects Import Chrome bookmarks. The Chrome bookmark tree is read and processed locally to create an import preview; declining does not affect normal use.

## Remote code

Answer **No**. The release uses only code packaged with the extension. Bookmark destination URLs are opened as user-selected web pages and are not executable code loaded into the extension context.

## Host permissions

Answer **None** for the reviewed default build. Stop submission if the final manifest or Dashboard shows a host origin.

## Data use

Disclose:

- **Web history** for user-selected bookmark URLs and titles, with the clarification that general browsing history is not collected;
- **Website content** for active-page title/URL or selected-link data read only after a user-invoked save action.

Do not select authentication, location, financial, health, personal communications or general user-activity collection. See `docs/store/privacy-practices.md` for the detailed rationale and verify the current Dashboard category definitions.

## Limited Use

> The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

Do not edit or paraphrase this English sentence.

## Distribution

Distribution, visibility, regions and pricing are owner decisions. The repository does not assert that the extension has been submitted, approved or published in Chrome Web Store.

## Official references checked

- [Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing) — the item summary limit is 132 characters.
- [Privacy Policies](https://developer.chrome.com/docs/webstore/program-policies/privacy) — an accurate, current privacy policy is required when the product handles user data.
- [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use) — source of the exact affirmative disclosure used in this package.
