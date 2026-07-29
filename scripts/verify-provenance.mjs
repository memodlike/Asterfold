import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { readZipEntries, sha256File } from "./release-lib.mjs";

const root = resolve(process.cwd());
const release = resolve(process.argv[2] ?? "release");
const provenance = JSON.parse(await readFile(resolve(release, "provenance.json"), "utf8"));
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (provenance.schemaVersion !== 1) throw new Error("Unsupported provenance schema");
if (provenance.repository !== "memodlike/Asterfold") throw new Error("Unexpected provenance repository");
if (provenance.packageVersion !== packageJson.version) throw new Error("Package/provenance version mismatch");
if (provenance.tag !== `v${packageJson.version}`) throw new Error("Tag/provenance version mismatch");
if (process.env.EXPECTED_SOURCE_SHA && provenance.sourceCommit !== process.env.EXPECTED_SOURCE_SHA) throw new Error("Provenance source commit mismatch");
if (process.env.EXPECTED_TAG && provenance.tag !== process.env.EXPECTED_TAG) throw new Error("Provenance tag mismatch");
if (provenance.lockfileSha256 !== await sha256File(resolve(root, "package-lock.json"))) throw new Error("Lockfile digest mismatch");
for (const artifact of provenance.artifacts) {
  const path = resolve(release, artifact.name);
  const info = await stat(path);
  if (info.size !== artifact.size) throw new Error(`Artifact size mismatch: ${artifact.name}`);
  if (await sha256File(path) !== artifact.sha256) throw new Error(`Artifact digest mismatch: ${artifact.name}`);
}
const storeEntries = readZipEntries(await readFile(resolve(release, "Asterfold-Chrome.zip")));
const manifestEntry = storeEntries.find((entry) => entry.name === "manifest.json");
if (!manifestEntry) throw new Error("Store ZIP manifest.json missing");
const manifest = JSON.parse(manifestEntry.data.toString("utf8"));
if (manifest.version !== packageJson.version || manifest.version !== provenance.manifestVersion) throw new Error("Manifest version mismatch");
console.log(`Provenance verified for ${provenance.sourceCommit} (${provenance.tag})`);
