# Chrome Web Store Privacy Practices — Asterfold 3.0.0

Prepared on 28 July 2026. These are proposed dashboard answers for the reviewed default release. Recheck every answer against the final uploaded ZIP before submission.

## Single purpose

> Asterfold replaces the Chrome new tab with a private, local-first visual workspace for organizing and opening bookmarks.

Pages, Boards, search, Quick Save, Trash, import/export, appearance and Privacy Mode directly support that bookmark-workspace purpose.

## Data-use disclosure

Do **not** select a blanket answer that says the extension handles no user data. Asterfold processes data locally even though it does not transmit it.

Recommended transparent declarations:

| Dashboard category | Declare | Explanation |
| --- | --- | --- |
| Web history | Yes | The workspace stores user-selected bookmark URLs and titles. It does not collect the user's general browsing history. |
| Website content | Yes | After an explicit Quick Save or supported context-menu action, Asterfold may read the active page URL/title or selected link information needed to save that bookmark. |
| Personally identifiable information | No by default | Asterfold does not ask for name, email, address, identifier or account. A user can nevertheless place personal text in a bookmark title or URL; that user-authored content remains local. |
| Authentication information | No | There is no account, sign-in, password or token flow. |
| Personal communications | No | Asterfold does not read email, chat or communications. |
| Location | No | No location data is requested or inferred. |
| Financial and payment information | No | No payment or financial flow exists. |
| Health information | No | No health feature exists. |
| User activity | No | Asterfold does not record clicks, keystrokes, mouse movement, scrolling or general browsing activity for analytics or profiling. Workspace edits are stored only as the records needed to provide the requested feature. |

If the Dashboard wording or examples change, use the broader disclosure when a category is ambiguous.

## Data handling certifications

The owner can certify the following for the reviewed 3.0.0 default build:

- data is used only to provide the extension's single bookmark-workspace purpose;
- workspace data is stored locally in the user's Chrome profile;
- user data is not transmitted to the developer or third parties;
- user data is not sold;
- user data is not used or transferred for personalized advertising;
- user data is not used for creditworthiness or lending;
- user data is not used for unrelated profiling;
- humans working for the developer do not read the local workspace;
- there is no analytics, telemetry, advertising or affiliate tracking;
- there is no authentication, backend or cloud synchronization;
- there is no remote hosted code;
- there are no host permissions or content scripts in the default release.

## Limited Use certification

Use this exact English disclosure:

> The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

The public policy containing the same statement is:

- canonical repository policy: <https://github.com/memodlike/Asterfold/blob/main/docs/security/privacy.md>
- intended GitHub Pages policy, after Pages publication is verified: <https://memodlike.github.io/Asterfold/store/privacy.html>

Do not submit the intended Pages URL until it opens publicly without authentication.

## Permission justifications

| Permission | Dashboard justification |
| --- | --- |
| `activeTab` | Reads the current page title and URL only after the user invokes Quick Save or a supported save action, so the selected page can be added to the local bookmark workspace. |
| `favicon` | Displays Chrome's browser-owned `_favicon` resource for a URL already saved by the user. Asterfold does not request or store a remote favicon URL. |
| `alarms` | Schedules local Trash cleanup according to the retention period selected by the user. |
| `contextMenus` | Adds the user-invoked Save page, Save link and Open Asterfold commands. |
| `storage` | Stores only the temporary Privacy Mode flag in `chrome.storage.session`, allowing popup and New Tab to share the same visual-protection state. Chrome clears session storage when the browser session ends; bookmark workspace data remains in IndexedDB. |
| optional `bookmarks` | Requested only when the user selects Import Chrome bookmarks. The Chrome bookmark tree is read and processed locally to create an import preview; declining does not affect normal use. |

The final 3.0.0 manifest must list only `activeTab`, `favicon`, `alarms`, `contextMenus`, `storage` and optional `bookmarks`; it must not list host permissions, content scripts, `tabs`, `history`, `identity`, `scripting`, `webRequest`, cookies or clipboard-read. If the final ZIP differs, stop submission and reconcile the manifest and disclosures.

## Privacy policy URL

Preferred after public availability is confirmed:

`https://memodlike.github.io/Asterfold/store/privacy.html`

Repository fallback for review:

`https://github.com/memodlike/Asterfold/blob/main/docs/security/privacy.md`

The Dashboard should contain one URL that is public, stable, readable without sign-in and identical in substance to the policy in this repository.

## Official policy references checked

- <https://developer.chrome.com/docs/webstore/program-policies/privacy>
- <https://developer.chrome.com/docs/webstore/program-policies/limited-use>
- <https://developer.chrome.com/docs/webstore/program-policies/user-data-faq>

Chrome's official guidance treats locally stored information as handled user data and requires a privacy policy when sensitive user information is handled locally. These answers therefore disclose local URL/title processing instead of selecting a misleading “no user data” position.
