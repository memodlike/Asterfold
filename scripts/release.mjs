import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { checksumLine, writeDeterministicZip } from "./release-lib.mjs";

const root = resolve(process.cwd());
const output = resolve(root, ".output/chrome-mv3");
const release = resolve(root, "release");
const unpacked = join(release, "chrome-unpacked");
const storeAssets = resolve(root, "store-assets");

function assertInside(path, parent, expectedBase) {
  const rel = relative(parent, path);
  if (basename(path) !== expectedBase || isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) throw new Error(`Unsafe release path: ${path}`);
}
assertInside(release, root, "release");
assertInside(unpacked, release, "chrome-unpacked");

async function walk(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink is forbidden in release input: ${path}`);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

async function validateRuntime() {
  const manifest = JSON.parse(await readFile(join(unpacked, "manifest.json"), "utf8"));
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  if (manifest.manifest_version !== 3) throw new Error("Release manifest is not MV3");
  if (manifest.version !== packageJson.version) throw new Error("Package and manifest versions differ");
  if (manifest.chrome_url_overrides?.newtab !== "newtab.html") throw new Error("New-tab override is missing");
  if (manifest.action?.default_popup !== "popup.html") throw new Error("Popup entrypoint is missing");
  const expectedPermissions = ["activeTab", "favicon", "alarms", "contextMenus", "storage"];
  const expectedOptionalPermissions = ["bookmarks"];
  const sameSet = (actual, expected) => actual.length === expected.length && expected.every((permission) => actual.includes(permission));
  if (!sameSet(manifest.permissions ?? [], expectedPermissions)) throw new Error("Release permissions differ from the least-privilege policy");
  if (!sameSet(manifest.optional_permissions ?? [], expectedOptionalPermissions)) throw new Error("Release optional permissions differ from policy");
  if ((manifest.host_permissions ?? []).length !== 0) throw new Error("Release must not request host permissions");
  if (manifest.content_scripts !== undefined) throw new Error("Release must not contain content scripts");
  if (manifest.content_security_policy?.extension_pages !== "script-src 'self'; object-src 'self'; base-uri 'self'") throw new Error("Unexpected extension CSP");
  for (const size of [16, 32, 48, 128]) {
    const icon = await readFile(join(unpacked, `icons/icon-${size}.png`));
    if (icon.readUInt32BE(16) !== size || icon.readUInt32BE(20) !== size) throw new Error(`Invalid ${size}px icon`);
  }
  const files = await walk(unpacked);
  if (files.some((file) => file.endsWith(".map") || basename(file).startsWith(".env"))) throw new Error("Forbidden generated or environment file found");
  for (const file of files.filter((path) => /\.(?:html|js|json|css|svg)$/u.test(path))) {
    const text = await readFile(file, "utf8");
    if (/service[_-]?role|SUPABASE_SERVICE|BEGIN (?:RSA |EC )?PRIVATE KEY/iu.test(text)) throw new Error(`Potential secret found in ${file}`);
    if (/<script[^>]+src=["']https?:|<iframe[^>]+src=["']https?:|import\s*\(\s*["']https?:|importScripts\s*\(\s*["']https?:|new\s+(?:Shared)?Worker\s*\(\s*["']https?:|WebAssembly\.(?:instantiateStreaming|compileStreaming)\s*\([^)]*fetch\s*\(\s*["']https?:|data:text\/(?:javascript|html)|new\s+Function\s*\(|\beval\s*\(/iu.test(text)) throw new Error(`Remote or dynamic code pattern found in ${file}`);
  }
}

await stat(join(output, "manifest.json")).catch(() => { throw new Error("Production build is missing. Run npm run build first."); });
await rm(release, { recursive: true, force: true });
await mkdir(release, { recursive: true });
await cp(output, unpacked, { recursive: true, force: true });
for (const [source, outputName] of [
  ["docs/release/install.md", "INSTALL.md"], ["docs/security/permissions.md", "PERMISSIONS.md"],
  ["docs/security/privacy.md", "PRIVACY.md"], ["docs/release/release-notes.md", "RELEASE_NOTES.md"],
]) await cp(join(root, source), join(release, outputName));

await validateRuntime();
const runtimeFiles = await walk(unpacked);
const runtimeEntries = runtimeFiles.map((path) => ({ path, name: relative(unpacked, path).replaceAll("\\", "/") }));
await writeDeterministicZip(join(release, "Asterfold-Chrome.zip"), runtimeEntries, writeFile);

// The installation guide belongs only to the unpacked distribution, never the Chrome Web Store package.
await writeFile(join(unpacked, "HOW-TO-INSTALL.txt"), [
  "ASTERFOLD — INSTALL IN CHROME", "", "1. Open chrome://extensions", "2. Turn on Developer mode",
  "3. Click Load unpacked", "4. Select THIS folder (the one containing manifest.json)", "",
  "Do not select a ZIP file or GitHub's Source code archive.",
].join("\n"), "utf8");
const unpackedFiles = await walk(unpacked);
await writeDeterministicZip(join(release, "chrome-unpacked.zip"), unpackedFiles.map((path) => ({ path, name: `chrome-unpacked/${relative(unpacked, path).replaceAll("\\", "/")}` })), writeFile);

const excludedRoots = new Set([".git", ".output", ".upgrade", ".wxt", "coverage", "node_modules", "playwright-report", "release", "test-results"]);
const sourceFiles = [];
for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
  if (excludedRoots.has(entry.name) || entry.isSymbolicLink()) continue;
  const path = join(root, entry.name);
  if (entry.isDirectory()) sourceFiles.push(...await walk(path));
  else sourceFiles.push(path);
}
const filteredSourceFiles = sourceFiles.filter((path) => {
  const rel = relative(root, path).replaceAll("\\", "/");
  const first = rel.split("/")[0];
  return !excludedRoots.has(first) && !basename(path).startsWith(".env") && !path.endsWith(".log") && !path.endsWith(".DS_Store");
});
await writeDeterministicZip(join(release, "extension-source.zip"), filteredSourceFiles.map((path) => ({ path, name: relative(root, path).replaceAll("\\", "/") })), writeFile);

const storeFiles = await walk(storeAssets);
const storeDocumentation = [
  ["docs/store/privacy.html", "documentation/privacy.html"],
  ["docs/store/privacy-practices.md", "documentation/privacy-practices.md"],
  ["docs/store/submission-checklist.md", "documentation/submission-checklist.md"],
  ["docs/security/permissions.md", "documentation/permission-rationale.md"],
].map(([source, name]) => ({ path: join(root, source), name }));
await writeDeterministicZip(join(release, "Asterfold-Store-Assets.zip"), [
  ...storeFiles.map((path) => ({ path, name: relative(storeAssets, path).replaceAll("\\", "/") })),
  ...storeDocumentation,
], writeFile);

const { spawnSync } = await import("node:child_process");
for (const [script, args = []] of [["scripts/generate-sbom.mjs"], ["scripts/generate-provenance.mjs"]]) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: "inherit", env: process.env });
  if (result.status !== 0) throw new Error(`${script} failed with ${result.status}`);
}
const checksumNames = ["Asterfold-Chrome.zip", "chrome-unpacked.zip", "extension-source.zip", "Asterfold-Store-Assets.zip", "sbom.spdx.json", "provenance.json"];
await writeFile(join(release, "checksums.txt"), `${(await Promise.all(checksumNames.map((name) => checksumLine(join(release, name))))).join("\n")}\n`, "utf8");
for (const [script, args = []] of [["scripts/validate-release-package.mjs"], ["scripts/verify-provenance.mjs"]]) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: "inherit", env: process.env });
  if (result.status !== 0) throw new Error(`${script} failed with ${result.status}`);
}
console.log(`Release ready: ${release}`);
