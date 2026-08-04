import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8"));
const version = packageJson.version;
const failures = [];
if (lock.version !== version || lock.packages?.[""]?.version !== version) failures.push("package-lock.json");
if (typeof packageJson.packageManager !== "string" || !/^npm@\d+\.\d+\.\d+$/u.test(packageJson.packageManager)) failures.push("package.json: packageManager must pin an exact npm version");
const currentVersionFiles = [
  ["docs/security/privacy.md", [`Policy version: ${version}`, `Applies to: Asterfold ${version}`]],
  ["docs/store/privacy.html", [`Policy version: ${version}`, `Asterfold ${version}`]],
  ["docs/store/submission-checklist.md", [`Current version: ${version}`]],
  ["store-assets/listing/submission-values.md", [`Current version: ${version}`]],
  ["docs/release/release-notes.md", [`# Asterfold ${version}`]],
  ["README.md", [`Asterfold ${version}`]]
];
for (const [path, needles] of currentVersionFiles) {
  const text = await readFile(resolve(root, path), "utf8");
  for (const needle of needles) if (!text.includes(needle)) failures.push(`${path}: missing ${JSON.stringify(needle)}`);
}
const tag = process.env.RELEASE_TAG || (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : "");
if (tag && tag !== `v${version}`) failures.push(`tag ${tag} != v${version}`);
const manifestPath = resolve(root, ".output/chrome-mv3/manifest.json");
try {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.version !== version) failures.push(`generated manifest ${manifest.version} != ${version}`);
} catch (error) {
  if (process.env.REQUIRE_GENERATED_MANIFEST === "true") failures.push(`generated manifest unavailable: ${error instanceof Error ? error.message : String(error)}`);
}
if (failures.length) throw new Error(`Version consistency failed:\n- ${failures.join("\n- ")}`);
console.log(`Version consistency passed: ${version}`);
