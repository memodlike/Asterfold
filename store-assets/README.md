# Asterfold Chrome Web Store assets

This directory contains deterministic publication assets for Asterfold.

## Contents

- `icon/icon-128.png` — the production Folded Asterisk extension icon, 128×128 PNG with transparent corners.
- `promo/small-promo-440x280.png` — 440×280 small promotional tile: the name and one line beside a crop of the real workspace. This is the tile people see in Store search and category lists.
- `promo/small-promo-source.svg` — editable source: vector text and mark over one embedded capture of the workspace.
- `promo/marquee-1400x560.png` — 1400×560 marquee.
- `promo/marquee-source.svg` — editable source for the marquee, built the same way.
- `screenshots/` — five 1280×800 store screenshots. Each one is a short caption above an unedited capture of the running production extension with neutral demonstration data: workspace, search, welcome screen, appearance settings, Privacy Mode.

## Brand and content rules

- The Folded Asterisk geometry is reused from `public/icons/mark-monochrome.svg`.
- Promo exports use Asterfold’s Graphite Dark and Frost Light visual language.
- Assets contain no ratings, user counts, awards, endorsements, Chrome ownership implication, or other unverified claims.
- The product area of every screenshot and tile is an unedited capture of the production UI: no browser frame, DevTools, personal data, or mocked-up UI. Only the caption band and the brand text around it are added.
- Captions state what a person can do, in plain words, and make no claim the product does not deliver.
- Store assets are publication collateral and must not be included in the extension ZIP.

## Rebuild and validate

Everything above except the icon is produced by one script from the current build:

```sh
npm run build
ASTERFOLD_CHROMIUM_PATH="<Chromium or Chrome for Testing binary>" node scripts/capture-store-screenshots.mjs
```

Branded Google Chrome ignores `--load-extension`, so point `ASTERFOLD_CHROMIUM_PATH` at Chromium or Chrome for Testing (for example the copy Playwright keeps in its cache). The demo workspace comes from `tests/storeDemoSeed.test.ts`; site icons are fetched from the demo sites, so run it online.


The SVG files are the editable promo sources. Export them at their declared canvas dimensions without cropping or transparency.

Run:

```sh
node scripts/validate-store-assets.mjs
```

The validator checks required files, PNG signatures and dimensions, SVG canvas dimensions, screenshot count, allowed extensions, zero-byte files, and fully opaque promo PNG exports.
