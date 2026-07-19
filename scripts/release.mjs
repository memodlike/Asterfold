import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const output = resolve(root, ".output/chrome-mv3");
const release = resolve(root, "release");
const unpacked = join(release, "chrome-unpacked");

if (basename(release) !== "release" || !release.startsWith(`${root}/`)) {
  throw new Error("Refusing to write outside the project release directory");
}

async function run(command, args, cwd) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", rejectPromise);
    child.once("exit", (code) => code === 0 ? resolvePromise() : rejectPromise(new Error(`${command} exited with ${code}`)));
  });
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

async function validateUnpacked() {
  const manifest = JSON.parse(await readFile(join(unpacked, "manifest.json"), "utf8"));
  if (manifest.manifest_version !== 3) throw new Error("Release manifest is not MV3");
  if (manifest.chrome_url_overrides?.newtab !== "newtab.html") throw new Error("New-tab override is missing");
  if (manifest.action?.default_popup !== "popup.html") throw new Error("Popup entrypoint is missing");
  const forbidden = new Set(["tabs", "history", "scripting", "webRequest", "cookies", "downloads", "clipboardRead"]);
  for (const permission of manifest.permissions ?? []) {
    if (forbidden.has(permission)) throw new Error(`Forbidden release permission: ${permission}`);
  }
  if ((manifest.host_permissions ?? []).some((origin) => origin.includes("*"))) throw new Error("Wildcard host permission found");

  const files = await walk(unpacked);
  if (files.some((file) => file.endsWith(".map"))) throw new Error("Source map found in release");
  const textFiles = files.filter((file) => /\.(?:html|js|json|css|svg)$/u.test(file));
  for (const file of textFiles) {
    const text = await readFile(file, "utf8");
    if (/service[_-]?role|SUPABASE_SERVICE|BEGIN (?:RSA |EC )?PRIVATE KEY/iu.test(text)) {
      throw new Error(`Potential secret found in ${file}`);
    }
  }
}

async function checksum(path) {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return `${hash.digest("hex")}  ${basename(path)}`;
}

try {
  await stat(join(output, "manifest.json"));
} catch {
  throw new Error("Production build is missing. Run npm run build first.");
}

await rm(release, { recursive: true, force: true });
await mkdir(release, { recursive: true });
await cp(output, unpacked, { recursive: true, force: true });

for (const [source, outputName] of [
  ["docs/release/install.md", "INSTALL.md"],
  ["docs/security/permissions.md", "PERMISSIONS.md"],
  ["docs/security/privacy.md", "PRIVACY.md"],
  ["docs/release/release-notes.md", "RELEASE_NOTES.md"],
]) {
  await cp(join(root, source), join(release, outputName));
}

await validateUnpacked();
await run("zip", ["-q", "-r", "chrome-unpacked.zip", "chrome-unpacked"], release);
await run("zip", [
  "-q", "-r", join(release, "extension-source.zip"), ".",
  "-x", ".git/*", "node_modules/*", ".output/*", ".wxt/*", "release/*", "coverage/*",
  "test-results/*", "playwright-report/*", ".env", ".env.local", ".env.production", "*.log",
], root);

const archives = [join(release, "extension-source.zip"), join(release, "chrome-unpacked.zip")];
await writeFile(join(release, "checksums.txt"), `${(await Promise.all(archives.map(checksum))).join("\n")}\n`, "utf8");
console.log(`Release ready: ${release}`);
