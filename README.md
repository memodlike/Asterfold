# Asterfold

Asterfold is an original, local-first Chrome/Chromium bookmark workspace. It replaces the new tab with Pages → Boards → Bookmarks, provides a lightweight Quick Save popup, fast local search, drag-and-drop, import/export, Trash, Privacy Mode, and a six-preset theme system.

## Repository status

This is the complete Asterfold 1.0.0 source project. AI agents and contributors must read [AGENTS.md](AGENTS.md) before editing. The implementation, architecture, security, parity, QA, performance, release, and installation evidence is committed alongside the code so work can continue without relying on chat history.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

The local-only build requires no account, API key, host permission, analytics, payment, or network service. See [INSTALL.md](INSTALL.md) for personal installation; architecture, security, QA, performance, and parity evidence live in the root reports and `docs/`.

## Install the finished build

1. Open `chrome://extensions` and enable **Developer mode**.
2. Select **Load unpacked**.
3. Choose `release/chrome-unpacked`.

The release directory also contains portable source and unpacked ZIP archives plus SHA-256 checksums.

## Data ownership

IndexedDB is the source of truth. JSON, Netscape HTML, and Markdown export remain available without sign-in. Optional Supabase files are included but disabled unless explicitly configured.

## Release gate

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run release
```

The browser test loads the actual Manifest V3 folder in Chromium and exercises persistence, drag-and-drop, search, Privacy Mode, themes, backup round-trip, Trash, background messaging, and popup storage sharing.

## Legal independence

The code, Asterfold name, mark, themes, UI, and assets are original. Public descriptions of other bookmark tools were used only to understand standard user workflows; no proprietary source code, brand asset, or exact layout is included.
