import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const reportPath = resolve(process.argv[2] ?? "npm-audit.json");
const baselinePath = resolve(process.argv[3] ?? "security/npm-audit-baseline.json");
const report = JSON.parse(await readFile(reportPath, "utf8"));
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const allowed = new Map((baseline.advisories ?? []).map((entry) => [String(entry.advisoryId), entry]));
const failures = [];
for (const entry of allowed.values()) {
  if (!entry.reason || !entry.owner || !entry.reviewedDate || !entry.expiryDate || !entry.acceptedResidualRisk) failures.push(`Incomplete baseline entry ${entry.advisoryId}`);
  if (entry.expiryDate < today) failures.push(`Expired baseline entry ${entry.advisoryId}`);
}
const vulnerabilities = report.vulnerabilities ?? {};
for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (!["high", "critical"].includes(vulnerability.severity)) continue;
  const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
  const advisoryIds = via.filter((item) => typeof item === "object" && item !== null).map((item) => String(item.source));
  if (!advisoryIds.length) advisoryIds.push(`package:${name}`);
  for (const advisoryId of advisoryIds) {
    const waiver = allowed.get(advisoryId);
    if (!waiver) { failures.push(`New ${vulnerability.severity} advisory ${advisoryId} for ${name}`); continue; }
    if (waiver.severity !== vulnerability.severity) failures.push(`Severity changed for ${advisoryId}: ${waiver.severity} -> ${vulnerability.severity}`);
    if (waiver.affectedPackage !== name) failures.push(`Affected package changed for ${advisoryId}: ${waiver.affectedPackage} -> ${name}`);
    if (vulnerability.isDirect && waiver.direct !== true) failures.push(`Direct dependency status changed for ${advisoryId}`);
    if (vulnerability.fixAvailable && vulnerability.fixAvailable.isSemVerMajor !== true) failures.push(`Non-breaking fix is available for waived advisory ${advisoryId}`);
  }
}
if (failures.length) throw new Error(`Development audit baseline failed:\n- ${failures.join("\n- ")}`);
console.log(`Development audit baseline passed: ${allowed.size} reviewed high/critical waiver(s)`);
