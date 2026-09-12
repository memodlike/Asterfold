# Workspace Rules for Asterfold (Chrome Extension Manifest V3)

You are operating inside **Asterfold**, a high-performance, local-first visual bookmark workspace for Google Chrome New Tab built with Manifest V3, WXT, Vite, React 19, and IndexedDB (Dexie).

## 1. Google Chrome Manifest V3 Invariants
- **No Remote Executable Code**: Never load external scripts, `eval()`, `new Function()`, or dynamic imports from remote URLs (`https://...`). All code must be bundled locally.
- **Service Worker Ephemeral Lifecycle**: Background Service Workers in MV3 terminate when idle. Never rely on global in-memory variables for persistent state; persist critical state to `chrome.storage.local` or IndexedDB. Use `chrome.alarms` instead of long-running `setInterval`.
- **Minimum Permissions Principle**:
  - Only use explicitly declared permissions: `["activeTab", "favicon", "alarms", "contextMenus", "storage"]`.
  - Single optional permission: `["bookmarks"]` (requested on-demand via `chrome.permissions.request`).
  - Keep `host_permissions: []` empty. Never introduce broad URL match patterns (`<all_urls>`, `*://*/*`).
- **Strict Content Security Policy**:
  - CSP must strictly enforce: `extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'"`.

## 2. Security, Privacy & Zero-Telemetry Invariants
- **Zero-Telemetry Policy**: Never collect, transmit, or exfiltrate user data, bookmarks, search queries, or analytics. No network calls to third-party tracking services.
- **Dangerous DOM Sinks**: Never use `dangerouslySetInnerHTML`, `element.innerHTML =`, `outerHTML =`, `insertAdjacentHTML`, or `document.write`. Always render via safe React JSX bindings or `textContent`.
- **Input & URI Sanitization**:
  - Disallow or sanitize executable URI schemes (`javascript:`, `vbscript:`, unsanitized `data:text/html`). Only safe schemes (`http:`, `https:`, `chrome:`, `chrome-extension:`, `file:`) are permissible for bookmark links.
  - Bound user input length (titles, descriptions, search queries) to prevent UI denial-of-service.
- **File Import Bounds**:
  - Enforce bounds on imported files (max size, max bookmarks count) and sanitize filenames during backup import/export.

## 3. Extension UI/UX & Performance Invariants
- **Zero-Flash New Tab Startup**:
  - Critical dark/light theme CSS and startup theme snapshot must apply synchronously before React hydrates, preventing white-screen flashes upon opening new tabs.
- **GPU & Low-Spec PC Compatibility**:
  - Support tiered rendering profiles: `Quality` (backdrop-filter blur), `Compatibility` (opaque surfaces without expensive live CSS filters), and `Software` (high-performance fallback).
  - Use compositor-only CSS properties (`transform`, `opacity`) for animations. Never animate heavy box-shadows, layout dimensions, or large full-screen blurs.
- **Accessibility & Contrast**:
  - Maintain WCAG AA contrast (minimum 4.5:1 for body text, 3:1 for large display elements) in both Light and Dark modes.
  - Interactive elements must be keyboard-accessible with visible focus rings and valid ARIA roles.
  - Respect `prefers-reduced-motion` across all transitions.

## 4. Release & Web Store Compliance
- **Single Purpose Policy**: Asterfold's single purpose is a visual workspace for bookmark organization on Chrome New Tab. Any feature diverging from this core mission violates CWS policies.
- **Deterministic Packaging**: Release artifacts must be reproducible across platforms with byte-for-byte verifiable hashes, SBOM, and provenance metadata.
- **Runtime-Only ZIP**: Never include source files, tests, scripts, `.git`, or markdown documentation in the production Chrome Web Store ZIP archive.
