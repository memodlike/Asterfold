import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const destination = resolve(process.argv[2] ?? "release/sbom.spdx.json");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8"));
const created = "2020-01-01T00:00:00Z";
const idFor = (name, version, path) => `SPDXRef-Package-${createHash("sha256").update(`${path}:${name}:${version}`).digest("hex").slice(0, 20)}`;
const packages = [];
const relationships = [];
const rootId = "SPDXRef-Package-Asterfold";
packages.push({
  SPDXID: rootId,
  name: packageJson.name,
  versionInfo: packageJson.version,
  downloadLocation: "NOASSERTION",
  filesAnalyzed: false,
  licenseConcluded: "NOASSERTION",
  licenseDeclared: "NOASSERTION",
  copyrightText: "NOASSERTION",
  primaryPackagePurpose: "APPLICATION"
});
for (const [path, metadata] of Object.entries(lock.packages ?? {}).sort(([a], [b]) => a.localeCompare(b, "en"))) {
  if (!path || !metadata?.name || !metadata?.version) continue;
  const id = idFor(metadata.name, metadata.version, path);
  packages.push({
    SPDXID: id,
    name: metadata.name,
    versionInfo: metadata.version,
    downloadLocation: metadata.resolved ?? "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: typeof metadata.license === "string" ? metadata.license : "NOASSERTION",
    copyrightText: "NOASSERTION",
    primaryPackagePurpose: metadata.dev ? "LIBRARY" : "LIBRARY",
    externalRefs: metadata.integrity ? [{ referenceCategory: "PACKAGE-MANAGER", referenceType: "purl", referenceLocator: `pkg:npm/${encodeURIComponent(metadata.name)}@${metadata.version}` }] : undefined
  });
  relationships.push({ spdxElementId: rootId, relationshipType: metadata.dev ? "DEV_DEPENDENCY_OF" : "DEPENDENCY_OF", relatedSpdxElement: id });
}
const document = {
  spdxVersion: "SPDX-2.3",
  dataLicense: "CC0-1.0",
  SPDXID: "SPDXRef-DOCUMENT",
  name: `Asterfold-${packageJson.version}-SBOM`,
  documentNamespace: `https://github.com/memodlike/Asterfold/releases/tag/v${packageJson.version}/sbom-${createHash("sha256").update(JSON.stringify(lock)).digest("hex")}`,
  creationInfo: { created, creators: ["Tool: Asterfold generate-sbom.mjs"] },
  packages,
  relationships: [{ spdxElementId: "SPDXRef-DOCUMENT", relationshipType: "DESCRIBES", relatedSpdxElement: rootId }, ...relationships]
};
await writeFile(destination, `${JSON.stringify(document, null, 2)}\n`, "utf8");
console.log(`SPDX SBOM written: ${destination} (${packages.length} packages)`);
