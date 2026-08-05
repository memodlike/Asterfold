import { browser } from "wxt/browser";
import { ImportError } from "../../domain/errors";
import { IMPORT_LIMITS } from "../../domain/importLimits";
import type { ImportRecord } from "../../services/exportImport";

export interface ChromeBookmarkReadResult {
  status: "granted" | "denied";
  records: ImportRecord[];
  permissionRemoved: boolean;
}

export function flattenChromeBookmarks(nodes: chrome.bookmarks.BookmarkTreeNode[]): ImportRecord[] {
  const records: ImportRecord[] = [];
  const stack = [...nodes].reverse().map((node) => ({ node, path: [] as string[], depth: 0 }));
  let visited = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    visited += 1;
    if (visited > IMPORT_LIMITS.nodes) throw new ImportError("Chrome bookmark tree contains too many nodes");
    if (current.depth > IMPORT_LIMITS.depth) throw new ImportError("Chrome bookmark folder nesting is too deep");
    if (current.node.url) {
      if (records.length >= IMPORT_LIMITS.bookmarks) throw new ImportError("Chrome bookmark tree contains too many bookmarks");
      records.push({
        title: current.node.title.trim().slice(0, 240) || "Bookmark",
        url: current.node.url,
        description: null,
        folderPath: current.path,
      });
    }
    const childPath = current.node.title ? [...current.path, current.node.title.slice(0, 240)] : current.path;
    for (const child of [...(current.node.children ?? [])].reverse()) {
      stack.push({ node: child, path: childPath, depth: current.depth + 1 });
    }
  }
  return records;
}

export async function readChromeBookmarks(removePermissionAfterRead = true): Promise<ChromeBookmarkReadResult> {
  const granted = await browser.permissions.request({ permissions: ["bookmarks"] });
  if (!granted) return { status: "denied", records: [], permissionRemoved: false };

  let permissionRemoved = false;
  try {
    const records = flattenChromeBookmarks(await browser.bookmarks.getTree());
    if (removePermissionAfterRead) {
      permissionRemoved = await browser.permissions.remove({ permissions: ["bookmarks"] }).catch(() => false);
    }
    return { status: "granted", records, permissionRemoved };
  } catch (error) {
    if (removePermissionAfterRead) {
      await browser.permissions.remove({ permissions: ["bookmarks"] }).catch(() => false);
    }
    throw error;
  }
}
