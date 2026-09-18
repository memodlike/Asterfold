# Chrome Web Store Developer Dashboard Answers — Asterfold 3.5.5

This document provides the exact answers and disclosures to enter into the Chrome Web Store Developer Dashboard for **Asterfold 3.5.5**.

---

## 1. Store Listing Tab

### Product Details
- **Extension Name**: `Asterfold — Visual Bookmark Workspace`
- **Short Name**: `Asterfold`
- **Summary / Short Description**:
  ```text
  Turn Chrome New Tab into a visual bookmark workspace with Pages, Boards, search, and local-first storage.
  ```
- **Category**: `Workflow & Planning`
- **Primary Language**: `English`

---

## 2. Privacy Practices Tab

### Single Purpose
Enter:
```text
Asterfold replaces Chrome New Tab with a local-first visual bookmark workspace for organizing, searching, and opening user-saved bookmarks in Pages and Boards.
```

### Data Usage Declarations
Under **Data Usage**, answer **No** to all categories:

| Category | Answer | Note |
|---|---|---|
| **Personally identifiable information** | **No** | No names, email addresses, phone numbers, or user IDs are collected. |
| **Health information** | **No** | No health data is accessed. |
| **Financial and payment information** | **No** | No financial transactions or details. |
| **Authentication information** | **No** | No login, accounts, passwords, or tokens. |
| **Personal communications** | **No** | No emails, chats, or messages are read. |
| **Location** | **No** | No geolocation is accessed. |
| **Web history** | **No** | Asterfold does NOT track or monitor browsing history. Local bookmarks are user-curated links stored in IndexedDB. |
| **User activity** | **No** | No clicks, page navigation, or analytics are recorded. |
| **Website content** | **No** | Asterfold does NOT scrape, read, or parse website content. Zero content scripts or tab inspection. |

### Data Handling Certifications
Check all required certification boxes:
1. [x] **I do not sell user data to third parties.**
2. [x] **I do not use or transfer user data for purposes unrelated to the extension's single purpose.**
3. [x] **I do not use or transfer user data to determine creditworthiness or for lending purposes.**

### Limited Use Disclosure
Enter the exact required English wording:
```text
The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.
```

---

## 3. Permission Justifications

### `favicon`
```text
The favicon permission is required to display website icons for URLs that the user has explicitly saved as bookmarks in Asterfold. Asterfold uses Chrome's built-in Manifest V3 favicon resource only for visual bookmark identification. Asterfold does not read page content or browsing history, does not request host permissions, does not contact third-party favicon services, and does not store or transmit favicon data.
```

### `storage`
Under Chrome Web Store rules, the `storage` permission typically requires **0 justifications** (it is a standard low-risk permission). If a justification prompt is displayed for `storage`:
```text
The storage permission is used only for the temporary Privacy Mode state in chrome.storage.session so the New Tab page and extension popup can share the same visual privacy state. Chrome clears this session value when the browser session ends. Asterfold bookmark workspace data remains stored locally in IndexedDB.
```

### Optional `bookmarks`
If the Chrome Web Store dashboard displays a justification prompt for `bookmarks`:
```text
The bookmarks permission is requested only after the user explicitly chooses Import Chrome bookmarks or Refresh from Chrome. Asterfold reads the Chrome bookmark tree locally to import or refresh the user's selected bookmark workspace, then immediately removes the permission. Declining this permission does not affect normal Asterfold use.
```

### Removed Permissions Notice
Notice to Reviewer: Asterfold 3.5.5 does not request `activeTab`, `alarms`, or `contextMenus`. The extension requests strictly `storage` and `favicon`. The optional `bookmarks` permission is requested on-demand only if the user explicitly triggers Chrome bookmark import, and is revoked immediately upon completion.

---

## 4. Package Upload
- File to upload: **`release/Asterfold-Chrome.zip`**
- Verify version is **`3.5.5`** and `manifest_version: 3`.
