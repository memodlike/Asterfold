import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const sbomPath = resolve(process.argv[2] ?? "release/sbom.spdx.json");

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8"));
const sbom = JSON.parse(await readFile(sbomPath, "utf8"));

const failures = [];

if (sbom.spdxVersion !== "SPDX-2.3") failures.push(`Expected SPDX-2.3, got ${sbom.spdxVersion}`);
if (sbom.SPDXID !== "SPDXRef-DOCUMENT") failures.push(`Expected SPDXRef-DOCUMENT, got ${sbom.SPDXID}`);

const packages = sbom.packages ?? [];
if (packages.length <= 1 && Object.keys(lock.packages ?? {}).length > 1) {
  failures.push(`SBOM contains only ${packages.length} package(s), but lockfile contains dependencies.`);
}

const spdxIds = new Set();
const packageMap = new Map();

for (const pkg of packages) {
  if (!pkg.SPDXID) {
    failures.push("Package missing SPDXID");
    continue;
  }
  if (spdxIds.has(pkg.SPDXID)) {
    failures.push(`Duplicate SPDXID: ${pkg.SPDXID}`);
  }
  spdxIds.add(pkg.SPDXID);

  if (!pkg.name || !pkg.versionInfo) {
    failures.push(`Package ${pkg.SPDXID} missing name or versionInfo`);
  }

  if (!packageMap.has(pkg.name)) {
    packageMap.set(pkg.name, []);
  }
  packageMap.get(pkg.name).push(pkg);
}

// Invariant: every direct production dependency in package.json must appear in SBOM
for (const depName of Object.keys(packageJson.dependencies ?? {})) {
  const matches = packageMap.get(depName);
  if (!matches || matches.length === 0) {
    failures.push(`Direct dependency missing from SBOM: ${depName}`);
  }
}

// Invariant: every direct devDependency in package.json must appear in SBOM
for (const devDepName of Object.keys(packageJson.devDependencies ?? {})) {
  const matches = packageMap.get(devDepName);
  if (!matches || matches.length === 0) {
    failures.push(`Direct devDependency missing from SBOM: ${devDepName}`);
  }
}

// Invariant: relationships reference valid SPDX IDs
const relationships = sbom.relationships ?? [];
if (relationships.length === 0 && packages.length > 1) {
  failures.push("SBOM contains no dependency relationships");
}

for (const rel of relationships) {
  if (rel.spdxElementId !== "SPDXRef-DOCUMENT" && !spdxIds.has(rel.spdxElementId)) {
    failures.push(`Relationship references invalid source SPDXID: ${rel.spdxElementId}`);
  }
  if (rel.relatedSpdxElement !== "SPDXRef-DOCUMENT" && !spdxIds.has(rel.relatedSpdxElement)) {
    failures.push(`Relationship references invalid target SPDXID: ${rel.relatedSpdxElement}`);
  }
}

if (failures.length > 0) {
  throw new Error(`SBOM validation failed:\n- ${failures.join("\n- ")}`);
}

console.log(`SBOM validation passed: ${packages.length} packages, ${relationships.length} relationships verified.`);
