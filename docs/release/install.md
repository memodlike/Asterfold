# Install Asterfold

GitHub Release publication and Chrome Web Store publication are separate events. A successful GitHub release does not mean Chrome Web Store review or publication is complete.

## Requirements

- Chrome or a Chromium browser compatible with Chrome 120+.
- The verified `Asterfold-Chrome.zip` from the latest GitHub Release.
- No Asterfold account or API key is required.

## Verify the release package

1. Open the latest Asterfold GitHub Release.
2. Download `Asterfold-Chrome.zip` and `checksums.txt`. Do not use GitHub's automatically generated source archive as the extension package.
3. Verify the SHA-256 entry for `Asterfold-Chrome.zip` against `checksums.txt`.
4. Use `provenance.json` and `sbom.spdx.json` when release provenance or dependency review is required.

## Personal unpacked installation

1. Extract `Asterfold-Chrome.zip` into a permanent folder.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted folder that directly contains `manifest.json`.
6. Verify the displayed Asterfold version matches the GitHub Release and that Chrome reports no extension errors.
7. Open a new tab and verify the Pages → Boards → Bookmarks workspace.
8. Pin Asterfold from the extensions menu if you want Quick Save available from the toolbar.

The extension works with local workspace data. Importing the Chrome bookmark tree asks for the optional `bookmarks` permission only when that command is selected.

## Update an existing unpacked installation

1. Export a JSON backup from **Settings → Data and privacy**.
2. Keep the same absolute unpacked extension folder path. Changing the path can produce another extension ID and therefore another IndexedDB namespace.
3. Keep the previous stable package and the pre-update backup until verification is complete.
4. Replace the existing unpacked folder contents with the new release contents.
5. Open `chrome://extensions` and click **Reload** on Asterfold.
6. Open a new tab and verify the new version, existing Pages, Boards, bookmarks, wallpaper, locale and Quick Save destinations.
7. Review Diagnostics and `chrome://extensions` for errors.

Schema migrations run transactionally. Automated CI verifies the exact 2.2.3 upgrade path, but release testing does not replace normal backup discipline.

## Development validation

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

Use `package.json` as the authoritative command list if scripts change. Load `.output/chrome-mv3` for development or the extracted `Asterfold-Chrome.zip` contents for the validated release package.

## Chrome Web Store status

Preparing listing text and Store assets does not mean Asterfold has been reviewed or published by Chrome Web Store. Store submission remains a separate owner action unless an explicitly configured publishing workflow exists.

- [Privacy policy](../security/privacy.md)
- [Chrome Web Store submission checklist](../store/submission-checklist.md)
- [English Store listing](../../store-assets/listing/store-listing-en.md)
- [Russian Store listing](../../store-assets/listing/store-listing-ru.md)
