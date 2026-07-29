# Exact Asterfold 2.2.3 to 3.0.1 upgrade evidence

## Source packages

- Published baseline: GitHub Release `v2.2.3` / `Asterfold-Chrome.zip`
- Baseline SHA-256: `e666c0e40ca2bcd1631b04e3b9087e38b26f71336664ecfc475ee8b4d610920a`
- Target candidate SHA: `470943fe946cc277d80edfb103bd204a51614711`
- CI run: `https://github.com/memodlike/Asterfold/actions/runs/30425528170`

## Method

The published 2.2.3 package was downloaded and checksum-verified. It was loaded as an unpacked extension in a persistent Chromium profile, populated with version-5 IndexedDB records and customized settings, then replaced in the same extension path with the exact 3.0.1 Store package. The profile and extension identity were retained.

## Seeded state

- Non-default Page with custom position, icon, accent and version metadata
- Board with free-grid coordinates, bookmark columns and version metadata
- Active Bookmark with `new-window` opening mode, description and order
- Deleted Bookmark in Trash with a batch identifier
- English locale
- Free workspace layout and alignment
- Quick Save destinations
- Dark theme and built-in wallpaper parameters
- Persisted Privacy Mode enabled
- Legacy `onboardingComplete: false` fixture representing the old schema

## Post-upgrade result

- Database opened and schema migrated to version 6: PASS
- Extension ID preserved: PASS
- Page record preserved: PASS
- Board record preserved: PASS
- Active Bookmark and opening mode preserved: PASS
- Trash record and batch preserved: PASS
- Order and version metadata preserved: PASS
- Locale, layout and Quick Save settings preserved: PASS
- Theme and wallpaper settings preserved: PASS
- Persisted Privacy Mode preserved: PASS
- Hidden bookmark semantics correct while Privacy Mode remained enabled: PASS
- Bookmark became visible after turning Privacy Mode off through the real launcher UI: PASS
- Search found the migrated bookmark: PASS
- Existing profile did not receive the fresh-user first-use hint: PASS
- Console/page errors: 0

## Test result

- Upgrade tests: 1 passed / 0 failed
- Duration: 4.4 seconds
- Verdict: PASS — no detected data loss or onboarding regression
