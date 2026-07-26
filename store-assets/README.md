# Asterfold Chrome Web Store assets

This directory contains deterministic publication assets for Asterfold.

## Contents

- `icon/icon-128.png` — the production Folded Asterisk extension icon, 128×128 PNG with transparent corners.
- `promo/small-promo-440x280.png` — filled 440×280 small promotional tile.
- `promo/small-promo-source.svg` — editable source for the small promotional tile.
- `promo/marquee-1400x560.png` — filled 1400×560 marquee.
- `promo/marquee-source.svg` — editable source for the marquee.
- `screenshots/` — real 1280×800 captures from the unpacked production extension using neutral demonstration data.

## Brand and content rules

- The Folded Asterisk geometry is reused from `public/icons/mark-monochrome.svg`.
- Promo exports use Asterfold’s Graphite Dark and Frost Light visual language.
- Assets contain no ratings, user counts, awards, endorsements, Chrome ownership implication, or other unverified claims.
- Store screenshots must show the production UI only: no browser frame, desktop wallpaper, DevTools, personal data, or synthetic UI compositing.
- Store assets are publication collateral and must not be included in the extension ZIP.

## Rebuild and validate

The SVG files are the editable promo sources. Export them at their declared canvas dimensions without cropping or transparency.

Run:

```sh
node scripts/validate-store-assets.mjs
```

The validator checks required files, PNG signatures and dimensions, SVG canvas dimensions, screenshot count, allowed extensions, zero-byte files, and fully opaque promo PNG exports.
