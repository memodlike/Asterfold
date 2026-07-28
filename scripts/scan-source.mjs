import { readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const roots = ["src", "entrypoints"];
const patterns = [
  ["dynamic code", /\beval\s*\(|new\s+Function\s*\(/u],
  ["remote executable code", /(?:<script[^>]+src=["']https?:|import\s*\(\s*["']https?:|importScripts\s*\(\s*["']https?:|new\s+(?:Shared)?Worker\s*\(\s*["']https?:)/iu],
  ["dangerous HTML sink", /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write/u],
  ["forbidden broad Chrome API", /chrome\.(?:tabs|history|scripting|webRequest|cookies)\b/u],
  ["development endpoint", /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/u],
  ["private key", /BEGIN (?:RSA |EC )?PRIVATE KEY/u]
];
const allowlistedChromeTabsFiles = new Set(["src/browser/api.ts", "entrypoints/background.ts", "entrypoints/popup/App.tsx"]);
const failures = [];
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if ([".ts", ".tsx", ".js", ".mjs", ".html", ".css"].includes(extname(path))) {
      const rel = relative(root, path).replaceAll("\\", "/");
      const text = await readFile(path, "utf8");
      for (const [label, pattern] of patterns) {
        if (!pattern.test(text)) continue;
        if (label === "forbidden broad Chrome API" && allowlistedChromeTabsFiles.has(rel) && !/chrome\.(?:history|scripting|webRequest|cookies)\b/u.test(text)) continue;
        failures.push(`${rel}: ${label}`);
      }
    }
  }
}
for (const directory of roots) await walk(resolve(root, directory));
if (failures.length) throw new Error(`Source security scan failed:\n- ${failures.join("\n- ")}`);
console.log("Source security scan passed: no remote executable code, dynamic code, dangerous HTML sinks, secrets, or unapproved broad APIs");
