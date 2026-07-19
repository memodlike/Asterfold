# Research log

Research date: 17 July 2026. Public competitor material was used only to identify common workflows; no source, name, logo, image, or exact layout was copied.

## R-01 — Current Manifest V3 entrypoints and active-tab capture

**Question:** Can new tab, popup, command/context capture, and URL opening work without `tabs` or wildcard hosts?  
**Sources:** [Chrome action API](https://developer.chrome.com/docs/extensions/reference/api/action), [activeTab concept](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs), [new-tab override](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome).  
**Finding/decision:** User invocation grants bounded active-tab access; creating/updating tabs does not itself require `tabs`. Use `activeTab`, no host wildcard/content script.  
**Risk/impact:** The active URL is unavailable on restricted Chrome pages; UI returns a safe error.

## R-02 — Commands, context menus, alarms, favicon, optional permissions

**Question:** Which APIs and lifecycle patterns are current?  
**Sources:** [commands](https://developer.chrome.com/docs/extensions/reference/api/commands), [contextMenus](https://developer.chrome.com/docs/extensions/reference/api/contextMenus), [alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms), [favicon](https://developer.chrome.com/docs/extensions/how-to/ui/favicons), [permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions).  
**Finding/decision:** Register menus idempotently, keep worker handlers short, use daily alarms, Chrome `_favicon`, and request bookmark-tree access at the import gesture.  
**Risk/impact:** Chrome owns final shortcut conflicts and favicon availability; fallbacks are required.

## R-03 — WXT MV3 build and entrypoints

**Question:** How should React entrypoints map to extension pages and worker?  
**Sources:** [WXT entrypoints](https://wxt.dev/guide/essentials/entrypoints.html), [WXT manifest](https://wxt.dev/guide/essentials/config/manifest.html).  
**Finding/decision:** WXT page folders plus `background.ts` produce the expected override, action popup, worker, chunks, and manifest. Independently validate output instead of trusting generation alone.  
**Risk/impact:** Framework upgrades can change output; versions are pinned and E2E loads the folder.

## R-04 — Dexie transactions, migrations, and live queries

**Question:** How can local data remain durable across multiple extension surfaces?  
**Sources:** [Dexie best practices](https://dexie.org/docs/Tutorial/Best-Practices), [Dexie version upgrades](https://dexie.org/docs/Version/Version.upgrade()).  
**Finding/decision:** Keep writes inside explicit transactions, never write from a live-query callback, use versioned upgrade functions, and let liveQuery observe committed records.  
**Risk/impact:** Earlier QA exposed a liveQuery `ReadOnlyError`; seeding moved to an effect and a regression E2E covers it.

## R-05 — Multiple-container accessible drag

**Question:** How should cross-board drag work with keyboard parity?  
**Sources:** [dnd-kit sortable overview](https://dndkit.com/legacy/presets/sortable/overview), [dnd-kit accessibility](https://docs.dndkit.com/guides/accessibility).  
**Finding/decision:** Use pointer/keyboard sensors, sortable contexts, drag handles, transform animation, and an explicit move dialog for equivalent non-drag access.  
**Risk/impact:** Dense 1,000-card virtualization is not enabled; content visibility and bounded rendering are preferred for the personal-use target.

## R-06 — Local fuzzy search

**Question:** Which search library provides prefix/fuzzy ranking without a server?  
**Sources:** [MiniSearch API](https://lucaong.github.io/minisearch/classes/MiniSearch.MiniSearch.html), [MiniSearch repository](https://github.com/lucaong/minisearch).  
**Finding/decision:** MiniSearch 7.2 (MIT) indexes selected fields in memory, with exact normalization and hierarchy scoping in application code.  
**Risk/impact:** Full rebuild cost grows with data; a 10k benchmark guards current limits.

## R-07 — Supabase OAuth and RLS for an extension

**Question:** How can optional sync avoid embedded secrets and cross-user leakage?  
**Sources:** [Supabase Google auth](https://supabase.com/docs/guides/auth/social-login/auth-google), [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Chrome identity](https://developer.chrome.com/docs/extensions/reference/api/identity).  
**Finding/decision:** PKCE through `launchWebAuthFlow`, publishable key only, exact configured host, per-row `auth.uid()` policy, durable operation receipts.  
**Risk/impact:** Redirect allowlists and two-user isolation must be verified in the owner's live project; default build disables the path.

## R-08 — React quality and lazy boundaries

**Question:** Which current React behavior affects extension development?  
**Sources:** [React StrictMode](https://react.dev/reference/react/StrictMode), [lazy](https://react.dev/reference/react/lazy).  
**Finding/decision:** Treat development effects as repeatable and lazy-load Settings, Search, Trash, and editors. Popup stays a separate light entrypoint.  
**Risk/impact:** Shared Dexie code remains a large cached chunk but is not duplicated.

## R-09 — Visual language and accessibility

**Question:** How can the UI feel calm/premium without copying a reference product?  
**Sources:** [Apple HIG typography](https://developer.apple.com/design/human-interface-guidelines/typography), [WCAG contrast understanding](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), public productivity/new-tab examples reviewed only at a pattern level.  
**Finding/decision:** Original Asterfold mark, 8px-derived spacing, restrained translucent surfaces, semantic tokens, strong focus, reduced motion, six distinct presets, and original generated wallpapers.  
**Risk/impact:** Uploaded user color combinations can reduce contrast, so the editor reports accent/canvas contrast.

## R-10 — Functional reference and legal separation

**Question:** Which LumiList behaviors are publicly claimed, and is public source available?  
**Sources:** [LumiList website](https://lumilist.in/), [Chrome Web Store listing](https://chromewebstore.google.com/detail/lumilist-smart-bookmark-m/pcekakljniocipfpmjmpmgaleigcbhlh), [public feedback repository](https://github.com/sat008sat/lumilist-feedback).  
**Finding/decision:** Public material identifies common bookmark-manager workflows. No official public implementation repository was found in the reviewed sources. Implement behavior independently under Asterfold branding.  
**Risk/impact:** Similarity is limited to standard concepts such as pages, boards, search, and quick save; code/assets/layout are original.

## R-11 — Brand-name screening

**Question:** Which original name avoids an obvious bookmark-extension collision?  
**Candidates:** Asterfold, Arcweave, Pinloom, Foldmark, Linkharbor, Nestory, Shelfstar, Latticebox, Tuckline, Atlasdeck.  
**Sources:** General web and Chrome Web Store searches on 17 July 2026.  
**Finding/decision:** “Asterfold” had no obvious active bookmark-manager product conflict in the checked results and supports an original folding-star mark.  
**Risk/impact:** This is a practical conflict screen, not a trademark opinion; a commercial launch would need formal jurisdictional clearance.

## R-12 — Dependency and license selection

**Question:** Can the product use maintained permissive dependencies without copying reference-source code?  
**Sources:** installed package metadata and upstream package repositories.  
**Finding/decision:** Direct dependencies are MIT, ISC, or Apache-2.0; no GPL/AGPL/MPL application code was imported. `package-lock.json` and exact direct versions are committed.  
**Risk/impact:** Transitive advisories can change; `npm audit` is part of the final gate and overrides pin fixed transitive versions.
