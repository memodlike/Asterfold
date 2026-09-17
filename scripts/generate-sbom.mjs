import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(process.cwd());
const destination = resolve(process.argv[2] ?? "release/sbom.spdx.json");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8"));
const created = "2020-01-01T00:00:00Z";

function extractPackageName(packagePath, metadata) {
  if (metadata?.name) return metadata.name;
  if (!packagePath.startsWith("node_modules/")) return null;
  const parts = packagePath.split("node_modules/");
  const name = parts[parts.length - 1];
  return name || null;
}

const idFor = (name, version, path) =>
  `SPDXRef-Package-${createHash("sha256").update(`${path}:${name}:${version}`).digest("hex").slice(0, 32)}`;

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
  primaryPackagePurpose: "APPLICATION",
});

const pathToId = new Map();
pathToId.set("", rootId);

const sortedEntries = Object.entries(lock.packages ?? {})
  .filter(([path]) => Boolean(path))
  .sort(([a], [b]) => a.localeCompare(b, "en"));

for (const [path, metadata] of sortedEntries) {
  const name = extractPackageName(path, metadata);
  if (!name || !metadata?.version) continue;

  const id = idFor(name, metadata.version, path);
  pathToId.set(path, id);

  packages.push({
    SPDXID: id,
    name,
    versionInfo: metadata.version,
    downloadLocation: metadata.resolved ?? "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: typeof metadata.license === "string" ? metadata.license : "NOASSERTION",
    copyrightText: "NOASSERTION",
    primaryPackagePurpose: "LIBRARY",
    externalRefs: metadata.integrity
      ? [
          {
            referenceCategory: "PACKAGE-MANAGER",
            referenceType: "purl",
            referenceLocator: `pkg:npm/${encodeURIComponent(name).replace(/%40/g, "@")}@${metadata.version}`,
          },
        ]
      : undefined,
  });
}

for (const [path, metadata] of sortedEntries) {
  const id = pathToId.get(path);
  if (!id) continue;

  const lastIndex = path.lastIndexOf("/node_modules/");
  let parentId = rootId;
  if (lastIndex !== -1) {
    const parentPath = path.slice(0, lastIndex);
    parentId = pathToId.get(parentPath) ?? rootId;
  }

  const relationshipType = metadata.dev && parentId === rootId ? "DEV_DEPENDENCY_OF" : "DEPENDENCY_OF";
  relationships.push({
    spdxElementId: id,
    relationshipType,
    relatedSpdxElement: parentId,
  });
}

const document = {
  spdxVersion: "SPDX-2.3",
  dataLicense: "CC0-1.0",
  SPDXID: "SPDXRef-DOCUMENT",
  name: `Asterfold-${packageJson.version}-SBOM`,
  documentNamespace: `https://github.com/memodlike/Asterfold/releases/tag/v${packageJson.version}/sbom-${createHash("sha256").update(JSON.stringify(lock)).digest("hex")}`,
  creationInfo: { created, creators: ["Tool: Asterfold generate-sbom.mjs"] },
  packages,
  relationships: [
    { spdxElementId: "SPDXRef-DOCUMENT", relationshipType: "DESCRIBES", relatedSpdxElement: rootId },
    ...relationships,
  ],
};

await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify(document, null, 2)}\n`, "utf8");
console.log(`SPDX SBOM written: ${destination} (${packages.length} packages)`);
