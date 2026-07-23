# Asterfold versioning

Asterfold uses the simple `MAJOR.MINOR.PATCH` format.

- **`2.0.0`** — a major redesign or a change that can affect the way people use the extension, data migration, or installation.
- **`2.1.0`** — new useful features that do not break existing bookmarks or settings.
- **`2.1.1`** — fixes that preserve existing bookmarks, settings, and workflows.
- **`2.1.2`** — visual and usability fixes that preserve existing bookmarks, settings, and workflows.

The first number changes only for a genuinely large product step. The second changes when a new capability appears. The third changes for fixes.

The redesign is **2.0.0** because it replaced the main workspace, settings, visual system, release structure, and verification suite. Version **2.0.1** fixed the Chrome installation archive, **2.0.2** introduced the low-power renderer, and **2.0.3** fixed context-menu layering. Version **2.1.0** adds a multilingual interface and makes the standard bookmark click stay in the current tab. Version **2.1.1** makes context menus receive the active theme even though they render above the workspace, and replaces the blue extension fallback in the tab with a neutral Chrome-like document icon. The current **2.1.2** redesigns Search and Trash as responsive, theme-aware dialog surfaces.
