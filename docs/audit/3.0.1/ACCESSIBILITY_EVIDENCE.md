# Asterfold 3.0.1 accessibility and visual evidence

## Automated production MV3 result

- Candidate SHA: `470943fe946cc277d80edfb103bd204a51614711`
- CI run: `https://github.com/memodlike/Asterfold/actions/runs/30425528170`
- Result: PASS

The exact production extension was loaded into Chromium and evaluated with Axe.

- Serious Axe violations: 0
- Critical Axe violations: 0
- Forced-colors serious/critical violations: 0
- Reduced-motion transition duration gate: PASS
- First-use hint within 1280×720 viewport: PASS
- First-use dismiss control has a non-empty accessible name: PASS
- Launcher visible in forced-colors mode: PASS
- Popup and New Tab production entrypoints loaded successfully: PASS
- 100-bookmark workspace fit at 1440×900 without desktop page scroll: PASS

## Keyboard and focus coverage

Component and integration suites cover modal focus trapping/restoration, Search Palette keyboard routing, toast focus behavior, button semantics and Settings state transitions. The real MV3 suite exercises role/name-based controls for launcher, menus, dialogs, Page/Board/Bookmark creation, popup destinations and privacy controls.

## Visual QA scope

Automated visual acceptance verifies the first-use layout at 1280×720, the production workspace at 1440×900, reduced motion, forced colors, popup rendering and dense bookmark fit. Chrome Web Store screenshots are real production-extension captures, not generated interface mockups.

## Limitation

No claim is made that automated Chromium fully substitutes for manual assistive-technology testing on every browser/OS combination. The release blocker is defined as zero serious/critical Axe violations plus successful semantic keyboard-driven production flows, all of which passed.
