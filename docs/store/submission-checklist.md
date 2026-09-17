# Chrome Web Store submission checklist — Asterfold 3.5.2

Current version: 3.5.2
This checklist separates repository readiness from the owner-only action of submitting through the Chrome Web Store Developer Dashboard. Check an item only after verifying it against the exact ZIP being uploaded.

## Identity and listing

- [ ] Product name is **Asterfold — Visual Bookmark Workspace** and `short_name` remains **Asterfold**.
- [ ] Single purpose matches `store-assets/listing/submission-values.md`.
- [ ] Category is **Workflow & Planning**.
- [ ] English listing is copied from `store-assets/listing/store-listing-en.md`.
- [ ] Russian localized listing is copied from `store-assets/listing/store-listing-ru.md`.
- [ ] Short descriptions fit the current Dashboard limit.
- [ ] Homepage is `https://github.com/memodlike/Asterfold`.
- [ ] Support is `https://github.com/memodlike/Asterfold/issues`.
- [ ] No claim says the extension is already published, certified by Google, the best, completely anonymous or perfectly secure.

## Privacy

- [ ] Public privacy URL opens without authentication on desktop and mobile.
- [ ] Published policy matches `docs/security/privacy.md` and `docs/store/privacy.html`.
- [ ] Policy version is 3.5.2 and effective date is 17 September 2026.
- [ ] Exact English Limited Use sentence is present.
- [ ] Dashboard certifies that the extension does not collect or transmit user data.
- [ ] **Web history** is NOT declared (Asterfold stores only local user bookmarks, not browsing history; declaring Web history triggers false browser warnings).
- [ ] **Website content** is NOT declared (Asterfold does not scrape website content).
- [ ] No browsing-history collection is claimed or performed.
- [ ] No transfer, sale, advertising, analytics, authentication, backend or cloud is declared.
- [ ] Privacy Mode is described as visual protection, not encryption.
- [ ] The owner completes all current User Data Policy and Limited Use certifications truthfully.

## Permissions and MV3

- [ ] Uploaded ZIP has `manifest_version: 3` and version `3.5.2`.
- [ ] Background runs as a service worker.
- [ ] New-tab override, popup and all required icons are present.
- [ ] Required permissions are exactly `storage`, `favicon`.
- [ ] `favicon` is used only for Chrome's browser-owned `_favicon` resource for saved safe HTTP(S) URLs; Privacy Mode shows a neutral icon instead.
- [ ] `bookmarks` is optional, requested on-demand only during Chrome import or refresh, and immediately revoked post-import.
- [ ] `storage` is used only for the transient Privacy Mode flag in `chrome.storage.session`.
- [ ] `host_permissions` is empty.
- [ ] No content scripts or unnecessary web-accessible resources exist.
- [ ] Extension-page CSP remains strict.
- [ ] Dashboard permission explanations match `docs/store/privacy-practices.md`.

## Package security

- [ ] Upload the validated `Asterfold-Chrome.zip`, not GitHub's Source code ZIP.
- [ ] `manifest.json` is at the archive root.
- [ ] No source maps, `.env` files, secrets, private keys or nested source archive exist.
- [ ] No external script, remote import, `eval`, `new Function`, remote worker or remote WASM exists.
- [ ] Store screenshots and promo assets are not inside the extension ZIP.
- [ ] SHA-256 matches `release/checksums.txt`.
- [ ] Production dependency audit and release validator pass on the release commit.
- [ ] Two clean release builds produce identical checksums.

## Store assets

- [ ] Icon is PNG, exactly 128×128 and readable on light and dark backgrounds.
- [ ] At least one real product screenshot is exactly 1280×800.
- [ ] Every screenshot uses neutral demonstration data and contains no browser chrome, desktop, DevTools or personal information.
- [ ] Screenshots remain legible at 640×400.
- [ ] Small promo tile is exactly 440×280 and remains legible at 220×140.
- [ ] Marquee, if uploaded, is exactly 1400×560.
- [ ] No asset contains ratings, awards, user counts, Google affiliation or invented features.
- [ ] Store asset validation script passes.
- [ ] `Asterfold-Store-Assets.zip` contains listings and submission values but is not used as the extension upload.

## Functional smoke test on the exact package

- [ ] Install the unpacked contents in Chrome 120 or later with a clean temporary profile.
- [ ] New Tab opens Pages → Boards → Bookmarks.
- [ ] Create, edit, move, delete and restore a Page, Board and bookmark.
- [ ] Current-tab, new-tab and new-window bookmark modes behave as selected.
- [ ] Search works and builds no index while Privacy Mode is active.
- [ ] Chrome bookmark import requests `bookmarks` only on demand.
- [ ] JSON export and restore preserve Pages, Boards, bookmarks, settings, order, opening mode and supported wallpaper data.
- [ ] Uploaded wallpaper persists after restart.
- [ ] Trash retention and manual emptying work.
- [ ] Light, dark, high-contrast, reduced-motion and Low Power states remain usable.
- [ ] Popup and New Tab console contain no errors.
- [ ] Network capture shows zero third-party application requests in the default build; Chrome's browser-owned favicon resource is the only favicon path.

## Owner-only Dashboard steps

- [ ] Sign in to the correct Chrome Web Store developer account.
- [ ] Create or select the Asterfold item.
- [ ] Upload the exact validated `Asterfold-Chrome.zip`.
- [ ] Upload icon, screenshots and promotional images.
- [ ] Enter English and Russian listings.
- [ ] Enter the public privacy URL and support links.
- [ ] Complete Privacy Practices and permission justifications from the reviewed answers.
- [ ] Review distribution, visibility and regions.
- [ ] Save the draft and resolve every Dashboard warning.
- [ ] Submit for review.

Submission is complete only when the Dashboard confirms submission. Publication may be claimed only after Chrome Web Store moderation has approved and published the item.
