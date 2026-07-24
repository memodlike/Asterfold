# Privacy policy for Asterfold

Version 2.2.0 — 24 July 2026.

Asterfold is a local-first bookmark workspace. The default release has no account, cloud client, telemetry, analytics, advertising, affiliate tracking, payment code, application backend, content script, or host permission.

## Local data

IndexedDB stores Pages, Boards, bookmarks, order, settings, Trash timestamps, local snapshots and optional uploaded wallpaper assets. Legacy sync stores remain in the schema only to avoid deleting records during an update; no shipped code sends or processes them.

Search runs locally. JSON/HTML import preview runs in a local extension Worker. Export writes only the file explicitly requested by the user.

## Network behavior

The extension makes no application request in the default configuration. Chrome may fetch a destination when the user opens a bookmark and may resolve the browser-owned `_favicon` endpoint for a saved URL. Asterfold does not render or persist a remote favicon URL. Custom icons accept only bounded local raster data; SVG and remote URLs are rejected.

AF-PRIV-E001 intercepts the extension context and asserts zero remote favicon requests. The final default-network capture is recorded separately in `docs/audit/EVIDENCE.md`; an unavailable capture is never described as zero.

## Privacy Mode

Privacy Mode removes real bookmark titles from rendered text, title/accessibility attributes and context labels, disables clipboard actions, and does not construct the local search index. It is visual shoulder-surfing protection, not encryption. IndexedDB remains readable to the local Chrome profile, operating system and anyone who controls them.

## User controls

- Export a versioned JSON backup, Netscape HTML or Markdown.
- Preview imports before writes; replace restore creates a local safety snapshot.
- Restore from Trash or permanently delete records.
- Configure bounded 7/30/90-day cleanup or never.
- Remove extension site data to delete the local database. Export first if the records matter.

There is no cloud feature in version 2.2.0. Adding one later requires a separate threat model, live multi-user tests and an explicit privacy update.
