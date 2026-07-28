import { readFile, readdir } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { readZipEntries } from "./release-lib.mjs";

const root = resolve(process.cwd());
const storeZip = resolve(process.argv[2] ?? "release/Asterfold-Chrome.zip");
const unpacked = resolve(root, "release/chrome-unpacked");
const buffer = await readFile(storeZip);
const entries = readZipEntries(buffer);
const names = entries.map((entry) => entry.name);
const forbidden = [
  /(^|\/)HOW-TO-INSTALL\.txt$/u, /(^|\/)\.env(?:\.|$)/u, /\.map$/u, /(^|\/)(?:tests?|docs?|coverage|playwright-report|test-results|store-assets)(\/|$)/u,
  /(^|\/)\.git(\/|$)/u, /\.zip$/u, /(^|\/)(?:desktop\.ini|Thumbs\.db|\.DS_Store)$/u
];
for (const name of names) if (forbidden.some((pattern) => pattern.test(name))) throw new Error(`Forbidden Store ZIP entry: ${name}`);
if (!names.includes("manifest.json")) throw new Error("manifest.json must be at the Store ZIP root");
if (names.some((name) => name.startsWith("chrome-unpacked/"))) throw new Error("Store ZIP has an outer directory");
const runtimeFiles = [];
async function walk(directory) {
  const dirents = await readdir(directory, { withFileTypes: true });
  for (const dirent of dirents) {
    const path = resolve(directory, dirent.name);
    if (dirent.isSymbolicLink()) throw new Error(`Runtime symlink is forbidden: ${path}`);
    if (dirent.isDirectory()) await walk(path);
    else if (basename(path) !== "HOW-TO-INSTALL.txt") runtimeFiles.push(relative(unpacked, path).replaceAll("\\", "/"));
  }
}
await walk(unpacked);
runtimeFiles.sort();
const sortedNames = [...names].sort();
if (JSON.stringify(runtimeFiles) !== JSON.stringify(sortedNames)) {
  const missing = runtimeFiles.filter((name) => !names.includes(name));
  const unexpected = names.filter((name) => !runtimeFiles.includes(name));
  throw new Error(`Store ZIP allowlist mismatch; missing=${missing.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"}`);
}
const manifest = JSON.parse(entries.find((entry) => entry.name === "manifest.json").data.toString("utf8"));
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (manifest.manifest_version !== 3 || manifest.version !== packageJson.version) throw new Error("Store ZIP manifest/package mismatch");
console.log(`Store ZIP validated: ${entries.length} runtime-only entries, ${buffer.length} bytes`);
