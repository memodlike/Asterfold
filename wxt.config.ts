import { defineConfig } from "wxt";

const supabaseUrl = process.env.WXT_SUPABASE_URL;
const cloudOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: ".",
  manifestVersion: 3,
  manifest: {
    name: "Asterfold",
    short_name: "Asterfold",
    description: "A private, local-first visual bookmark workspace.",
    version: "2.0.0",
    minimum_chrome_version: "120",
    permissions: ["storage", "activeTab", "favicon", "alarms", "contextMenus"],
    optional_permissions: ["bookmarks", "identity"],
    host_permissions: cloudOrigin ? [`${cloudOrigin}/*`] : [],
    action: {
      default_title: "Quick Save to Asterfold",
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
    commands: {
      "quick-save": {
        suggested_key: {
          default: "Ctrl+Shift+Y",
          mac: "Command+Shift+Y"
        },
        description: "Save the current page to Asterfold"
      }
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'"
    }
  }
});
