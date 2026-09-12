---
name: chrome-extension-security-privacy
description: Security, privacy, Content Security Policy (CSP), permission minimization, and Chrome Web Store policy compliance for Manifest V3 extensions. Use when auditing permissions, reviewing data storage, sanitizing user input, checking against DOM XSS sinks, or preparing privacy manifests.
license: MIT
metadata:
  target-platforms: "Google Chrome 120+, Manifest V3"
  framework: "WXT + Vite + React 19"
---

# Chrome Extension Security, Privacy & Web Store Compliance

## Zero-Telemetry & Air-Gapped Invariants
- **No Data Exfiltration**: Never send bookmarks, page titles, URLs, tags, search queries, or user preferences over the network.
- **No Third-Party Analytics**: Do not embed Google Analytics, Mixpanel, Sentry, or any external analytics SDK.
- **Complete Offline Functionality**: All features (searching, categorizing, layout rearrangement, themes, export/import) must execute 100% locally via browser IndexedDB.

## Content Security Policy (CSP) & XSS Defenses
- **Manifest V3 CSP**:
  - `extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'"`
  - Never add `'unsafe-eval'`, `'wasm-unsafe-eval'`, or external host origins.
- **Dangerous DOM Sinks (Strictly Forbidden)**:
  - `element.innerHTML = ...`
  - `element.outerHTML = ...`
  - `element.insertAdjacentHTML(...)`
  - `document.write(...)`
  - React `dangerouslySetInnerHTML`
- **Safe Content Rendering**:
  - Render text content only through React text nodes or `element.textContent = ...`.
  - For rich text or bookmarks, parse into safe structured JSON before rendering.

## URL & Scheme Validation
- **Executable Scheme Neutralization**:
  - Never allow links or bookmarks with dangerous schemes: `javascript:`, `vbscript:`, `data:text/html`.
  - Strictly enforce allowlisted bookmark schemes: `http:`, `https:`, `chrome:`, `chrome-extension:`, `file:`.
  - Validate URLs with standard `new URL(rawUrl)` inside safe parsing boundaries.

## Permission Minimization & Storage Security
- **Manifest Permissions**:
  - Never request broad match patterns like `<all_urls>`, `http://*/*`, or `https://*/*`.
  - Only use scoped, defensible permissions: `activeTab` (for popup quick-saving), `favicon` (for local icon resolution), `alarms` (for scheduling), `contextMenus` (for right-click quick save), `storage` (for settings sync).
  - Request sensitive capabilities like `bookmarks` strictly as `optional_permissions` upon explicit user action.
