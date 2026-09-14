import { defineConfig } from "wxt";
import { version as packageVersion } from "./package.json";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: ".",
  manifestVersion: 3,
  manifest: {
    name: "Asterfold — Visual Bookmark Workspace",
    short_name: "Asterfold",
    description: "Turn Chrome New Tab into a visual bookmark workspace with Pages, Boards, search, and local-first storage.",
    version: packageVersion,
    minimum_chrome_version: "120",
    permissions: ["storage"],
    optional_permissions: ["bookmarks"],
    host_permissions: [],
    action: {
      default_title: "Asterfold",
      default_icon: {
        "16": "icons/icon-16.png",
        "32": "icons/icon-32.png",
        "48": "icons/icon-48.png",
        "128": "icons/icon-128.png"
      }
    },
    icons: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'"
    }
  }
});
