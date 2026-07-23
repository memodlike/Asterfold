# Install Asterfold 2.1.2

## Requirements

- Chrome or a Chromium browser compatible with Chrome 120+.
- The downloaded and extracted `Asterfold-Chrome.zip` folder. No account or API key is required.

## Personal installation

1. On the GitHub release page, download **`Asterfold-Chrome.zip`**. Do **not** download `Source code (zip)`.
2. Extract `Asterfold-Chrome.zip` into a permanent folder, for example `Documents/Asterfold`.
3. Open `chrome://extensions`.
4. Turn on **Developer mode**.
5. Click **Load unpacked**.
6. Select the extracted folder that contains `manifest.json` and `HOW-TO-INSTALL.txt`.
7. Open a new tab. The Asterfold workspace should appear.
8. Pin Asterfold from the extensions menu to keep Quick Save available.

The extension works offline. Importing the existing Chrome bookmark tree asks for the optional `bookmarks` permission only when that command is selected.

## Verify the installation

- New tab opens the Pages → Boards workspace.
- The toolbar icon opens **Quick Save**.
- Creating a bookmark survives a page reload and browser restart.
- Settings → Import & Export can download a JSON backup.
- `chrome://extensions` shows no extension errors.

## Update

1. Export a JSON backup from **Settings → Import & Export**.
2. Keep the same absolute `chrome-unpacked` folder path. For an unpacked build without a published key, changing the path can produce another extension ID and therefore another IndexedDB namespace.
3. Replace the folder contents with the new release contents.
4. Open `chrome://extensions` and click **Reload** on Asterfold.
5. Open a new tab and verify the version and Diagnostics. Schema migrations run transactionally; the current release upgrades schema 1 to schema 5 without clearing existing data.

No private signing key is distributed or required.

## Rollback and recovery

- Keep the previous release archive and the pre-update JSON backup.
- A database schema downgrade is not automatic. To return to an older build, load it as a separate unpacked extension and restore a backup that version understands.
- If an import is interrupted or rejected, the existing workspace remains intact. Replace-mode restore creates a local snapshot before changing records.
- To start over intentionally, remove Asterfold from `chrome://extensions`, delete its local data when Chrome offers that option, then load the release again. Export first if any data matters.

## Development build

From the source directory with Node.js 22+:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run release
```

Load `.output/chrome-mv3` for development or `release/chrome-unpacked` for the validated release copy.
