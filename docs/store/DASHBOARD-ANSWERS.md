# Chrome Web Store Developer Dashboard Answers — Asterfold 3.5.2

This document provides the exact answers and disclosures to enter into the Chrome Web Store Developer Dashboard for **Asterfold 3.5.2**.

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
Asterfold replaces Chrome New Tab with a local-first visual bookmark workspace organized into Pages and Boards.
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

### `storage` (Required)
```text
Stores only the temporary visual Privacy Mode flag in chrome.storage.session, allowing popup and New Tab to share the same visual-protection state without writing to disk. Chrome clears this session value when the browser session ends; all bookmark workspace data remains in local IndexedDB.
```

### `favicon` (Required)
```text
Displays Chrome's browser-owned favicon resource for a saved, validated HTTP(S) bookmark. Asterfold does not use a third-party favicon service, make direct site requests, request host access, or store favicon blobs. Privacy Mode renders a neutral icon instead.
```

### `bookmarks` (Optional)
```text
Requested only on-demand when the user selects Import Chrome bookmarks or Refresh from Chrome. The Chrome bookmark tree is read locally to create or update bookmarks and the permission is immediately revoked via browser.permissions.remove; declining does not affect normal use.
```

### Removed Permissions Notice
Notice to Reviewer: Asterfold 3.5.2 does not request `activeTab`, `alarms`, or `contextMenus`. The extension does not query active tabs, does not read page titles/URLs from tabs, and does not run background alarm loops. It uses the minimum `favicon` permission only for Chrome's local `_favicon` resource for saved safe HTTP(S) bookmarks.

---

## 4. Package Upload
- File to upload: **`release/Asterfold-Chrome.zip`**
- Verify version is **`3.5.2`** and `manifest_version: 3`.
