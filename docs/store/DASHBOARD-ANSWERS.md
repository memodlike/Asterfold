# Chrome Web Store Developer Dashboard Answers — Asterfold 3.8.0

This document provides the exact answers and disclosures to enter into the Chrome Web Store Developer Dashboard for **Asterfold 3.8.0**.

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

### Zero Permissions Policy
```text
Asterfold 3.8.0 operates with strictly ZERO permissions (permissions: [], optional_permissions: [], host_permissions: []). It requires no manifest permissions and triggers zero permission warnings upon installation.
```

### Removed Permissions Notice
Notice to Reviewer: Asterfold 3.8.0 does not request `activeTab`, `alarms`, `contextMenus`, `storage`, `favicon`, or `bookmarks`. The extension requests strictly zero permissions.

---

## 4. Package Upload
- File to upload: **`release/Asterfold-Chrome.zip`**
- Verify version is **`3.8.0`** and `manifest_version: 3`.
