# Chrome Web Store Privacy Practices — Asterfold 3.5.4

Prepared for the Asterfold 3.5.4 release. These are recommended dashboard answers for the reviewed default release. Recheck every answer against the final uploaded ZIP before submission.

## Single purpose

> Asterfold replaces the Chrome new tab with a private, local-first visual workspace for organizing and opening bookmarks.

Pages, Boards, search, Trash, import/export, appearance and Privacy Mode directly support that bookmark-workspace purpose.

## Data-use disclosure

In the Chrome Web Store Developer Dashboard under **Privacy Practices → Data Usage**:

Declare that the extension **does not collect or transmit user data** to external servers. All bookmark records, workspace hierarchy, and user preferences are stored strictly locally in the browser's IndexedDB.

Category breakdown for the Dashboard:

| Dashboard category | Declare | Explanation |
| --- | --- | --- |
| Web history | No | Asterfold does not monitor, record, collect, or transmit the user's browsing history. User bookmarks in IndexedDB are user-curated local links, not browsing history. Declaring "Yes" here causes Chrome to display false warnings that the extension reads historical records / browsing history. |
| Website content | No | Asterfold does not read, parse, or scrape website content. Asterfold has zero content scripts, zero active-tab queries, and zero DOM access to web pages. |
| Personally identifiable information | No | Asterfold does not collect name, email, address, identifier or account data. |
| Authentication information | No | There is no account, sign-in, password or token flow. |
| Personal communications | No | Asterfold does not read email, chat or communications. |
| Location | No | No location data is requested or inferred. |
| Financial and payment information | No | No payment or financial flow exists. |
| Health information | No | No health feature exists. |
| User activity | No | Asterfold does not record clicks, keystrokes, mouse movement, scrolling or general browsing activity for analytics or profiling. Workspace edits are stored only as local records needed to provide the requested feature. |

## Data handling certifications

The owner can certify the following for the reviewed 3.5.4 default build:

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
| `storage` | Stores only the temporary Privacy Mode flag in `chrome.storage.session`, allowing popup and New Tab to share the same visual-protection state without writing to disk. Chrome clears session storage when the browser session ends; bookmark workspace data remains in IndexedDB. |
| `favicon` | Displays website icons for saved bookmarks on New Tab bookmark cards, the editor preview, and the search palette using `chrome.runtime.getURL("/_favicon/")`. Icons are retrieved from the local browser cache without network calls to external servers. |
| optional `bookmarks` | Requested only on-demand when the user selects Import Chrome bookmarks or Refresh from Chrome. The Chrome bookmark tree is read locally to create or update bookmarks and the permission is immediately revoked via `browser.permissions.remove`; declining does not affect normal use. |

Asterfold 3.5.4 does NOT request `activeTab`, `alarms`, or `contextMenus`. The final 3.5.4 manifest must list only `permissions: ["storage", "favicon"]` and optional `bookmarks`; it must not list host permissions, content scripts, `tabs`, `history`, `identity`, `scripting`, `webRequest`, cookies or clipboard-read. If the final ZIP differs, stop submission and reconcile the manifest and disclosures.

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
