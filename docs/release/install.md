# Install Asterfold 3.2.0 test candidate

> Asterfold 3.2.0 is the current release candidate. GitHub Release publication and Chrome Web Store publication are separate events; do not treat a successful CI run as Store approval.

## Requirements

- Chrome or a Chromium browser compatible with Chrome 120+.
- The verified `Asterfold-Chrome.zip` runtime package from the latest successful PR #38 `release-linux` workflow artifact.
- Runtime package SHA-256: `d1708fa43b41a6695c7b8eac7748a065e19d263ab2fa587476374930349743ad`.
- No account or API key is required.

## Personal test installation

1. Open the latest successful CI run for PR #38 and download the **`release-linux`** artifact. Do not download GitHub's automatically generated `Source code (zip)` archive.
2. Extract the downloaded workflow artifact.
3. Locate the inner **`Asterfold-Chrome.zip`** file and verify its SHA-256 against the value above.
4. Extract `Asterfold-Chrome.zip` into a permanent folder, for example `Documents/Asterfold-3.2.0-test`.
5. Open `chrome://extensions`.
6. Turn on **Developer mode**.
7. Click **Load unpacked**.
8. Select the extracted folder that directly contains `manifest.json`.
9. Verify that Chrome shows Asterfold version `3.2.0` and no extension errors.
10. Open several new tabs and confirm the workspace appears without a white or dark startup flash.
11. Pin Asterfold from the extensions menu to keep Quick Save available.

The extension works offline. Importing the existing Chrome bookmark tree asks for the optional `bookmarks` permission only when that command is selected.

## Verify the installation

- New tab opens the Pages → Boards workspace without a visible startup flash.
- Settings, Search, Rename, Add Bookmark, Move, launcher, context menus and Quick Save use opaque interactive surfaces.
- The toolbar icon opens Quick Save.
- Custom dropdowns remain inside the viewport and work with pointer, Arrow keys, Home, End, Enter, Space, Escape, Tab and typeahead.
- Language controls show deterministic local SVG flags with readable text labels.
- Appearance controls preview immediately and remain correct after Settings closes, reopens and the new tab reloads.
- Creating or moving a bookmark survives a page reload and browser restart.
- Settings → Data and privacy can download a JSON backup.
- `chrome://extensions` shows no extension errors.

## Update an existing unpacked installation

1. Export a JSON backup from **Settings → Data and privacy**.
2. Keep the same absolute unpacked extension folder path. Changing the path can produce another extension ID and therefore another IndexedDB namespace.
3. Keep a copy of the previous stable runtime package and the pre-update JSON backup.
4. Replace the existing unpacked folder contents with the extracted 3.2.0 runtime contents.
5. Open `chrome://extensions` and click **Reload** on Asterfold.
6. Open a new tab and verify version `3.2.0`, existing Pages, Boards, Bookmarks, wallpaper, locale, privacy state and Quick Save destinations.
7. Review Diagnostics and `chrome://extensions` for errors.

Schema migrations run transactionally. Automated CI verifies the exact 2.2.3 → 3.2.0 profile upgrade, but this does not replace the required physical hardware test.

No private signing key is distributed or required.

## Rollback and recovery

- Keep the previous stable archive and the pre-update JSON backup.
- A database schema downgrade is not automatic. To return to an older build safely, load it as a separate unpacked extension and restore a backup that version understands.
- New settings introduced by 3.2.0 may be ignored by an older version; do not assume backward migration of the database schema.
- If an import is interrupted or rejected, the existing workspace remains intact. Replace mode accepts only a complete full backup and commits its records atomically; export a separate backup first when the current workspace matters.
- To start over intentionally, remove Asterfold from `chrome://extensions`, delete its local data when Chrome offers that option, then load the runtime again. Export first if any data matters.

## Development build

From the source directory with Node.js 22+:

```bash
npm ci
npm run validate:version
npm run audit:production
npm run scan:source
npm run typecheck
npm run lint
npm run test:coverage
npm run release:repro
npm run test:e2e
npm run test:stress
npm run test:upgrade
```

Use `package.json` as the authoritative command list if scripts change. Load `.output/chrome-mv3` for development or the extracted `Asterfold-Chrome.zip` contents for the validated test candidate.

## Chrome Web Store status

Preparing listing text and Store assets does not mean Asterfold has been reviewed or published by Chrome Web Store. Store submission requires separate explicit owner authorization.

- [Asterfold 3.2.0 physical test plan](./3.2.0-test-plan.md)
- [Privacy policy](../security/privacy.md)
- [Chrome Web Store submission checklist](../store/submission-checklist.md)
- [English Store listing](../../store-assets/listing/store-listing-en.md)
- [Russian Store listing](../../store-assets/listing/store-listing-ru.md)
