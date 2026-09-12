---
name: chrome-mv3-architecture
description: Google Chrome Extension Manifest V3 architecture, Service Worker lifecycle, background messaging, storage synchronization, and WXT build tooling. Use when designing MV3 background tasks, cross-context messaging, alarms, port connections, or extension entrypoints.
license: MIT
metadata:
  target-platforms: "Google Chrome 120+, Manifest V3"
  framework: "WXT + Vite + React 19"
---

# Chrome Manifest V3 Architecture & Systems Engineering

## Service Worker Lifecycle & State Ephemerality
- **Zero In-Memory Assumptions**: MV3 Background Service Workers terminate automatically after 30 seconds of inactivity or when idle.
  - Never store operational state in module-level global variables.
  - Persist intermediate work and cache to `chrome.storage.local` or IndexedDB before yielding.
  - Re-hydrate state upon waking up from an event or message.
- **Chrome Alarms over Timers**:
  - `setTimeout` and `setInterval` are paused or wiped when the Service Worker enters suspended state.
  - Use `chrome.alarms.create(name, options)` for delayed or recurring tasks.
  - Listen via `chrome.alarms.onAlarm.addListener((alarm) => { ... })`.

## Cross-Context Messaging Architecture
- **Sender Validation**:
  - Always validate incoming messages in `chrome.runtime.onMessage`:
    ```typescript
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Reject any message not originating from our own extension ID
      if (sender.id !== chrome.runtime.id) return false;
      // Handle strictly typed message payload
    });
    ```
- **Async Response Discipline**:
  - When returning an asynchronous response, the message listener must explicitly `return true;` to keep the message channel open until `sendResponse(...)` is invoked.
- **Port-based Streaming**:
  - For long-lived or chunked data exchange (such as massive bookmark imports or live sync), prefer `chrome.runtime.connect` ports over single-shot messages.

## Manifest & WXT Configuration
- Maintain strict separation of entrypoints:
  - `entrypoints/background.ts`: headless Service Worker, context menu initialization, alarm handling.
  - `entrypoints/newtab/`: full-page visual workspace, IndexedDB direct connection.
  - `entrypoints/popup/`: compact Quick Save utility, reactive to current active tab.
- Keep `wxt.config.ts` declarative with explicit versioning linked to `package.json`.
