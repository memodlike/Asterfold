# Privacy policy for Asterfold

Version 2.0.1 — 20 July 2026

Asterfold is a personal, local-first bookmark workspace. The default release has no account system, telemetry, analytics, advertising, affiliate tracking, payment code, or server endpoint.

## Data stored locally

Asterfold stores only information needed for features the user invokes:

- Pages, Boards, bookmarks, titles, saved URLs, descriptions, favicons references, and ordering;
- appearance and behavior settings, recent local search queries, Trash timestamps, and bounded backup snapshots;
- optional uploaded wallpaper blobs;
- optional cloud identity/session and sync metadata only in a separately configured cloud build.

Workspace records live in the extension's IndexedDB database. A cloud session, when enabled, uses isolated extension storage. Search runs in memory against local records.

## Data not collected

Asterfold does not collect or sell browsing history, page bodies, form contents, cookies, passwords, screenshots, clipboard history, advertising identifiers, usage analytics, or crash telemetry. It does not run on ordinary webpages.

## Network behavior

The default build has no host permission and no configured application backend. Opening a saved URL is an explicit browser navigation. Favicons are obtained through Chrome's own `_favicon` resource. Optional cloud code is disabled unless the owner supplies a Supabase HTTPS origin and publishable key and rebuilds the extension.

## User controls

- Export a complete versioned JSON backup, Netscape bookmark HTML, or readable Markdown at any time.
- Import is previewed before writes. Replace restore creates a safety snapshot first.
- Delete records to recoverable Trash; restore or permanently delete them; configure 7/30/90-day or never-retain cleanup.
- Privacy Mode masks saved titles/URLs/descriptions and disables search display. It is a shoulder-surfing protection, not database encryption.
- Removing the extension and its site data deletes its local database. Export first if the records are needed.

## Optional cloud build

The included Supabase adapter is opt-in and disabled in this release. When configured, its intended purpose is synchronization only. Row Level Security ties rows to the authenticated user, local IndexedDB remains the working source, and tombstones/outbox records support offline changes. The owner of that Supabase project controls its deployment and data-retention policy.

Because this is a private local build, there is no operator receiving personal data and no support server to contact. The source and threat model are included for inspection.
