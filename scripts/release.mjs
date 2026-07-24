import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

const root = resolve(process.cwd());
const output = resolve(root, ".output/chrome-mv3");
const release = resolve(root, "release");
const unpacked = join(release, "chrome-unpacked");
const fixedDosDate = 0x5021; // 2020-01-01
const fixedDosTime = 0;

function assertInside(path, parent, expectedBase) {
  const rel = relative(parent, path);
  if (basename(path) !== expectedBase || isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error(`Unsafe release path: ${path}`);
  }
}

assertInside(release, root, "release");
assertInside(unpacked, release, "chrome-unpacked");

async function walk(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink is forbidden in release input: ${path}`);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function writeDeterministicZip(destination, entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of [...entries].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const name = Buffer.from(entry.name.replaceAll("\\", "/"));
    const data = await readFile(entry.path);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(fixedDosTime, 10);
    local.writeUInt16LE(fixedDosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(fixedDosTime, 12);
    central.writeUInt16LE(fixedDosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(destination, Buffer.concat([...localParts, ...centralParts, end]));
}

async function validateUnpacked() {
  const manifest = JSON.parse(await readFile(join(unpacked, "manifest.json"), "utf8"));
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  if (manifest.manifest_version !== 3) throw new Error("Release manifest is not MV3");
  if (manifest.version !== packageJson.version) throw new Error("Package and manifest versions differ");
  if (manifest.chrome_url_overrides?.newtab !== "newtab.html") throw new Error("New-tab override is missing");
  if (manifest.action?.default_popup !== "popup.html") throw new Error("Popup entrypoint is missing");
  const allowedPermissions = new Set(["storage", "activeTab", "favicon", "alarms", "contextMenus"]);
  const allowedOptionalPermissions = new Set(["bookmarks"]);
  for (const permission of manifest.permissions ?? []) if (!allowedPermissions.has(permission)) throw new Error(`Unexpected release permission: ${permission}`);
  for (const permission of manifest.optional_permissions ?? []) if (!allowedOptionalPermissions.has(permission)) throw new Error(`Unexpected optional permission: ${permission}`);
  for (const origin of manifest.host_permissions ?? []) {
    if (!/^https:\/\/[^*]+\/\*$/u.test(origin)) throw new Error(`Non-exact HTTPS host permission: ${origin}`);
  }
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
    if (/<script[^>]+src=["']https?:|import\s*\(\s*["']https?:|new\s+Function\s*\(|\beval\s*\(/iu.test(text)) throw new Error(`Remote or dynamic code pattern found in ${file}`);
  }
}

async function checksum(path) {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return `${hash.digest("hex")}  ${basename(path)}`;
}

await stat(join(output, "manifest.json")).catch(() => { throw new Error("Production build is missing. Run npm run build first."); });
await rm(release, { recursive: true, force: true });
await mkdir(release, { recursive: true });
await cp(output, unpacked, { recursive: true, force: true });
await writeFile(join(unpacked, "HOW-TO-INSTALL.txt"), [
  "ASTERFOLD — INSTALL IN CHROME", "", "1. Open chrome://extensions", "2. Turn on Developer mode",
  "3. Click Load unpacked", "4. Select THIS folder (the one containing manifest.json)", "",
  "Do not select a ZIP file or GitHub's Source code archive.",
].join("\n"), "utf8");

for (const [source, outputName] of [
  ["docs/release/install.md", "INSTALL.md"], ["docs/security/permissions.md", "PERMISSIONS.md"],
  ["docs/security/privacy.md", "PRIVACY.md"], ["docs/release/release-notes.md", "RELEASE_NOTES.md"],
]) await cp(join(root, source), join(release, outputName));

await validateUnpacked();
const unpackedFiles = await walk(unpacked);
const unpackedEntries = unpackedFiles.map((path) => ({ path, name: relative(unpacked, path).replaceAll("\\", "/") }));
await writeDeterministicZip(join(release, "Asterfold-Chrome.zip"), unpackedEntries);
await writeDeterministicZip(join(release, "chrome-unpacked.zip"), unpackedFiles.map((path) => ({ path, name: `chrome-unpacked/${relative(unpacked, path).replaceAll("\\", "/")}` })));

const excludedRoots = new Set([".git", ".output", ".wxt", "coverage", "node_modules", "playwright-report", "release", "test-results"]);
const sourceFiles = [];
for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
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
await writeDeterministicZip(join(release, "extension-source.zip"), filteredSourceFiles.map((path) => ({ path, name: relative(root, path).replaceAll("\\", "/") })));

const archives = ["Asterfold-Chrome.zip", "chrome-unpacked.zip", "extension-source.zip"].map((name) => join(release, name));
await writeFile(join(release, "checksums.txt"), `${(await Promise.all(archives.map(checksum))).join("\n")}\n`, "utf8");
console.log(`Release ready: ${release}`);
