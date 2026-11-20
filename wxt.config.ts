import { defineConfig } from "wxt";
import { version as packageVersion } from "./package.json";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: ".",
  manifestVersion: 3,
  manifest: {
    // Localized in public/_locales so the Chrome Web Store shows and searches the name in each language.
    name: "__MSG_extName__",
    short_name: "__MSG_extShortName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    version: packageVersion,
    minimum_chrome_version: "120",
    permissions: [],
    optional_permissions: [],
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
