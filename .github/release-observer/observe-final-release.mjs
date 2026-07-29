import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readZipEntries } from "../../scripts/release-lib.mjs";

const repository = "memodlike/Asterfold";
const sourceCommit = "1ba41271bd09028cbc081ee5791b8ab1a3a64c2e";
const tag = "v3.0.1";
const root = process.cwd();
const outputDirectory = resolve(root, ".release-observer-output");
const publishedDirectory = resolve(outputDirectory, "published-release");
const reportPath = resolve(outputDirectory, "final-release-status.json");
const expectedAssets = [
  "Asterfold-Chrome.zip",
  "chrome-unpacked.zip",
  "extension-source.zip",
  "Asterfold-Store-Assets.zip",
  "checksums.txt",
  "provenance.json",
  "sbom.spdx.json",
];
const deterministicAssets = [
  "Asterfold-Chrome.zip",
  "chrome-unpacked.zip",
  "extension-source.zip",
  "Asterfold-Store-Assets.zip",
  "sbom.spdx.json",
];
const report = {
  repository,
  sourceCommit,
  tag,
  observedAt: null,
  status: "IN_PROGRESS",
  mainRuns: {},
  privacyPolicy: {},
  tagVerification: {},
  release: {},
  assets: [],
  checksumsVerified: false,
  provenanceVerified: false,
  attestationsVerified: false,
  packageScanPassed: false,
  blockers: [],
  observerRunId: process.env.GITHUB_RUN_ID ?? null,
};

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const writeReport = () => {
  mkdirSync(outputDirectory, { recursive: true });
  report.observedAt = new Date().toISOString();
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
};

async function observeMainRuns() {
  for (let attempt = 1; attempt <= 80; attempt += 1) {
    const response = JSON.parse(run("gh", ["api", `repos/${repository}/actions/runs?head_sha=${sourceCommit}&per_page=100`]));
    const candidates = response.workflow_runs
      .filter((item) => item.head_sha === sourceCommit && item.event === "push" && ["CI", "CodeQL"].includes(item.name))
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
    for (const name of ["CI", "CodeQL"]) {
      const item = candidates.find((candidate) => candidate.name === name);
      report.mainRuns[name] = item ? {
        id: item.id,
        status: item.status,
        conclusion: item.conclusion,
        event: item.event,
        headSha: item.head_sha,
        headBranch: item.head_branch,
        url: item.html_url,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      } : null;
    }
    const present = ["CI", "CodeQL"].every((name) => report.mainRuns[name]);
    const complete = present && ["CI", "CodeQL"].every((name) => report.mainRuns[name].status === "completed");
    if (complete) {
      const failures = ["CI", "CodeQL"].filter((name) => report.mainRuns[name].conclusion !== "success");
      if (failures.length > 0) throw new Error(`Final main workflows failed: ${failures.join(", ")}`);
      return;
    }
    await sleep(15_000);
  }
  throw new Error("Timed out waiting for exact-SHA main CI and CodeQL runs");
}

async function verifyPrivacyPolicy() {
  const url = "https://memodlike.github.io/Asterfold/store/privacy.html";
  const agents = {
    desktop: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
    mobile: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  };
  const results = {};
  for (const [name, userAgent] of Object.entries(agents)) {
    const destination = resolve(outputDirectory, `privacy-${name}.html`);
    const status = run("curl", ["--location", "--silent", "--show-error", "--max-time", "30", "--user-agent", userAgent, "--header", "Cache-Control: no-cache", "--output", destination, "--write-out", "%{http_code}", url]);
    const body = readFileSync(destination, "utf8");
    results[name] = {
      httpStatus: Number(status),
      versionFound: body.includes("Policy version: 3.0.1"),
      limitedUseFound: body.includes("Chrome Web Store User Data Policy, including the Limited Use requirements"),
      unauthenticated: true,
    };
  }
  report.privacyPolicy = { url, ...results };
  if (![results.desktop, results.mobile].every((item) => item.httpStatus === 200 && item.versionFound && item.limitedUseFound)) {
    throw new Error("Public Privacy Policy desktop/mobile verification failed");
  }
}

async function observeAnnotatedTag() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const fetch = spawnSync("git", ["fetch", "--force", "origin", `refs/tags/${tag}:refs/tags/${tag}`], { cwd: root, encoding: "utf8" });
    if (fetch.status === 0) {
      const objectType = run("git", ["cat-file", "-t", tag]);
      const targetCommit = run("git", ["rev-list", "-n", "1", tag]);
      report.tagVerification = { objectType, targetCommit };
      if (objectType !== "tag") throw new Error(`${tag} is not annotated`);
      if (targetCommit !== sourceCommit) throw new Error(`${tag} targets ${targetCommit}, expected ${sourceCommit}`);
      return;
    }
    await sleep(15_000);
  }
  throw new Error(`Timed out waiting for annotated tag ${tag}`);
}

async function observeRelease() {
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const result = spawnSync("gh", ["release", "view", tag, "--repo", repository, "--json", "tagName,targetCommitish,isDraft,isPrerelease,url,assets,publishedAt,name"], { cwd: root, encoding: "utf8" });
    if (result.status === 0) {
      const release = JSON.parse(result.stdout);
      report.release = release;
      if (release.tagName !== tag || release.isDraft || release.isPrerelease) throw new Error("Published release metadata is invalid");
      if (![sourceCommit, tag, "main"].includes(release.targetCommitish)) throw new Error(`Release target mismatch: ${release.targetCommitish}`);
      return;
    }
    await sleep(15_000);
  }
  throw new Error(`Timed out waiting for GitHub Release ${tag}`);
}

function verifyDownloadedRelease() {
  rmSync(publishedDirectory, { recursive: true, force: true });
  mkdirSync(publishedDirectory, { recursive: true });
  run("gh", ["release", "download", tag, "--repo", repository, "--dir", publishedDirectory]);
  const actual = readdirSync(publishedDirectory).sort();
  const expected = [...expectedAssets].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Release asset set mismatch: ${actual.join(", ")}`);

  const checksumLines = readFileSync(join(publishedDirectory, "checksums.txt"), "utf8").trim().split(/\r?\n/u);
  const checksumMap = new Map(checksumLines.map((line) => {
    const match = /^([a-f0-9]{64})  (.+)$/u.exec(line);
    if (!match) throw new Error(`Invalid checksum line: ${line}`);
    return [match[2], match[1]];
  }));
  for (const [name, expectedSha] of checksumMap) {
    const path = join(publishedDirectory, name);
    if (sha256(path) !== expectedSha) throw new Error(`Checksum mismatch: ${name}`);
  }
  report.checksumsVerified = true;

  const provenance = JSON.parse(readFileSync(join(publishedDirectory, "provenance.json"), "utf8"));
  if (provenance.sourceCommit !== sourceCommit || provenance.tag !== tag || provenance.packageVersion !== "3.0.1" || provenance.manifestVersion !== "3.0.1") {
    throw new Error("Provenance identity mismatch");
  }
  for (const artifact of provenance.artifacts) {
    const path = join(publishedDirectory, artifact.name);
    if (statSync(path).size !== artifact.size || sha256(path) !== artifact.sha256) throw new Error(`Provenance artifact mismatch: ${artifact.name}`);
  }
  report.provenanceVerified = true;

  const storeBuffer = readFileSync(join(publishedDirectory, "Asterfold-Chrome.zip"));
  const entries = readZipEntries(storeBuffer);
  const names = entries.map((entry) => entry.name);
  const forbidden = [/(^|\/)HOW-TO-INSTALL\.txt$/u, /(^|\/)\.env(?:\.|$)/u, /\.map$/u, /(^|\/)(?:tests?|docs?|coverage|playwright-report|test-results|store-assets)(\/|$)/u, /(^|\/)\.git(\/|$)/u, /\.zip$/u];
  if (!names.includes("manifest.json") || names.some((name) => forbidden.some((pattern) => pattern.test(name))) || names.some((name) => name.startsWith("chrome-unpacked/"))) {
    throw new Error("Published Store ZIP package scan failed");
  }
  const manifest = JSON.parse(entries.find((entry) => entry.name === "manifest.json").data.toString("utf8"));
  if (manifest.manifest_version !== 3 || manifest.version !== "3.0.1" || (manifest.host_permissions ?? []).length !== 0 || manifest.content_scripts !== undefined) {
    throw new Error("Published Store ZIP manifest policy failed");
  }
  report.packageScanPassed = true;

  const attestationTargets = [...checksumMap.keys(), "checksums.txt"];
  for (const name of attestationTargets) {
    const verification = spawnSync("gh", ["attestation", "verify", join(publishedDirectory, name), "--repo", repository], { cwd: root, encoding: "utf8" });
    if (verification.status !== 0) throw new Error(`Attestation verification failed: ${name}\n${verification.stderr}`);
  }
  report.attestationsVerified = true;

  report.assets = expectedAssets.map((name) => ({
    name,
    size: statSync(join(publishedDirectory, name)).size,
    sha256: sha256(join(publishedDirectory, name)),
    checksumCovered: checksumMap.has(name),
    attested: attestationTargets.includes(name),
  }));
}

try {
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });
  await observeMainRuns();
  await verifyPrivacyPolicy();
  await observeAnnotatedTag();
  await observeRelease();
  verifyDownloadedRelease();
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.blockers.push(error instanceof Error ? error.message : String(error));
  writeReport();
  console.error(error);
  process.exitCode = 1;
} finally {
  writeReport();
}
