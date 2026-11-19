# Chrome Web Store submission values — Asterfold 3.9.2

Current version: 3.9.2
Copy these values into the owner Dashboard only after checking them against the final release ZIP.

## Core values

| Field | English value | Russian value |
| --- | --- | --- |
| Name | Asterfold — Bookmarks New Tab & Visual Speed Dial | Asterfold — закладки на новой вкладке и визуальный Speed Dial |
| Single purpose | Asterfold replaces Chrome New Tab with a local-first visual bookmark workspace for organizing, searching, and opening user-saved bookmarks in Pages and Boards. | Asterfold заменяет новую вкладку Chrome локальным визуальным пространством закладок для организации, поиска и открытия сохранённых закладок со Страницами и Блоками. |
| Short description | Turn every new tab into visual boards of your bookmarks: speed dial, instant search, wallpapers. No account, no tracking. | Новая вкладка с визуальными досками закладок: экспресс-панель, быстрый поиск, обои. Без аккаунта и без слежки. |
| Category | Workflow & Planning | Workflow & Planning |
| Localized name and summary | Shipped in the package: `public/_locales/<locale>/messages.json` (16 locales). The Store reads them from the manifest; do not retype them per language. | |
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

The manifest requests no permissions: `permissions`, `optional_permissions` and `host_permissions` are all empty. Leave every justification field empty. If the Dashboard still shows `storage`, `favicon`, `bookmarks`, `activeTab`, `alarms` or `contextMenus` from an older upload, stop: the uploaded ZIP is not the current release.

Chrome bookmarks are imported from the HTML file Chrome itself exports, so no `bookmarks` permission is needed.

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
