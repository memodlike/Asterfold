import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readZipEntries } from "../../scripts/release-lib.mjs";

const repository = "memodlike/Asterfold";
const sourceCommit = "642e921ca0fd47e56d0d82c5b9609e8986915c3c";
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
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const response = JSON.parse(run("gh", ["api", `repos/${repository}/actions/runs?head_sha=${sourceCommit}&per_page=100`]));
    const candidates = response.workflow_runs
      .filter((item) => item.head_sha === sourceCommit && item.event === "push")
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
    for (const name of ["CI", "CodeQL", "Deploy GitHub Pages"]) {
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
    const required = ["CI", "CodeQL"];
    const present = required.every((name) => report.mainRuns[name]);
    const complete = present && required.every((name) => report.mainRuns[name].status === "completed");
    if (complete) {
      const failures = required.filter((name) => report.mainRuns[name].conclusion !== "success");
      if (failures.length > 0) throw new Error(`Final main workflows failed: ${failures.join(", ")}`);
      return;
    }
    await sleep(15_000);
  }
  throw new Error("Timed out waiting for exact-SHA main CI and CodeQL runs");
}

function curlStatus(url, userAgent, destination) {
  return Number(run("curl", ["--location", "--silent", "--show-error", "--max-time", "30", "--user-agent", userAgent, "--header", "Cache-Control: no-cache", "--output", destination, "--write-out", "%{http_code}", url]));
}

async function verifyPrivacyPolicy() {
  const preferredUrl = "https://memodlike.github.io/Asterfold/store/privacy.html";
  const fallbackUrl = `https://github.com/${repository}/blob/${sourceCommit}/docs/security/privacy.md`;
  const fallbackRaw = `https://raw.githubusercontent.com/${repository}/${sourceCommit}/docs/security/privacy.md`;
  const agents = {
    desktop: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
    mobile: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  };

  for (let attempt = 1; attempt <= 24; attempt += 1) {
    const desktopFile = resolve(outputDirectory, "privacy-pages-desktop.html");
    const mobileFile = resolve(outputDirectory, "privacy-pages-mobile.html");
    const desktopStatus = curlStatus(preferredUrl, agents.desktop, desktopFile);
    const mobileStatus = curlStatus(preferredUrl, agents.mobile, mobileFile);
    const desktopBody = readFileSync(desktopFile, "utf8");
    const mobileBody = readFileSync(mobileFile, "utf8");
    if (desktopStatus === 200 && mobileStatus === 200
      && desktopBody.includes("Policy version: 3.0.1") && mobileBody.includes("Policy version: 3.0.1")
      && desktopBody.includes("Chrome Web Store User Data Policy, including the Limited Use requirements")
      && mobileBody.includes("Chrome Web Store User Data Policy, including the Limited Use requirements")) {
      report.privacyPolicy = {
        preferredUrl,
        selectedUrl: preferredUrl,
        mode: "github_pages",
        desktop: { httpStatus: desktopStatus, unauthenticated: true },
        mobile: { httpStatus: mobileStatus, unauthenticated: true },
        version: "3.0.1",
        limitedUse: true,
      };
      return;
    }
    await sleep(15_000);
  }

  const desktopFile = resolve(outputDirectory, "privacy-fallback-desktop.html");
  const mobileFile = resolve(outputDirectory, "privacy-fallback-mobile.html");
  const rawFile = resolve(outputDirectory, "privacy-fallback.md");
  const desktopStatus = curlStatus(fallbackUrl, agents.desktop, desktopFile);
  const mobileStatus = curlStatus(fallbackUrl, agents.mobile, mobileFile);
  const rawStatus = curlStatus(fallbackRaw, agents.desktop, rawFile);
  const rawBody = readFileSync(rawFile, "utf8");
  if (desktopStatus !== 200 || mobileStatus !== 200 || rawStatus !== 200
    || !rawBody.includes("Policy version: 3.0.1")
    || !rawBody.includes("Chrome Web Store User Data Policy, including the Limited Use requirements")) {
    throw new Error("Public Privacy Policy preferred and fallback verification failed");
  }
  report.privacyPolicy = {
    preferredUrl,
    selectedUrl: fallbackUrl,
    rawVerificationUrl: fallbackRaw,
    mode: "public_repository_fallback",
    desktop: { httpStatus: desktopStatus, unauthenticated: true },
    mobile: { httpStatus: mobileStatus, unauthenticated: true },
    raw: { httpStatus: rawStatus, unauthenticated: true },
    version: "3.0.1",
    limitedUse: true,
    pagesOwnerActionRequired: true,
  };
}

async function observeAnnotatedTag() {
  for (let attempt = 1; attempt <= 80; attempt += 1) {
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
  for (let attempt = 1; attempt <= 120; attempt += 1) {
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

  const storePath = join(publishedDirectory, "Asterfold-Chrome.zip");
  const storeBuffer = readFileSync(storePath);
  const entries = readZipEntries(storeBuffer);
  const names = entries.map((entry) => entry.name);
  const forbidden = [/(^|\/)HOW-TO-INSTALL\.txt$/u, /(^|\/)\.env(?:\.|$)/u, /\.map$/u, /(^|\/)(?:tests?|docs?|coverage|playwright-report|test-results|store-assets)(\/|$)/u, /(^|\/)\.git(\/|$)/u, /\.zip$/u];
  if (!names.includes("manifest.json") || names.some((name) => forbidden.some((pattern) => pattern.test(name))) || names.some((name) => name.startsWith("chrome-unpacked/"))) {
    throw new Error("Published Store ZIP package scan failed");
  }
  const manifest = JSON.parse(entries.find((entry) => entry.name === "manifest.json").data.toString("utf8"));
  const expectedPermissions = ["activeTab", "favicon", "alarms", "contextMenus", "storage"];
  const expectedOptional = ["bookmarks"];
  const sameSet = (actualValues, expectedValues) => actualValues.length === expectedValues.length && expectedValues.every((value) => actualValues.includes(value));
  if (manifest.manifest_version !== 3 || manifest.version !== "3.0.1"
    || !sameSet(manifest.permissions ?? [], expectedPermissions)
    || !sameSet(manifest.optional_permissions ?? [], expectedOptional)
    || (manifest.host_permissions ?? []).length !== 0 || manifest.content_scripts !== undefined
    || manifest.content_security_policy?.extension_pages !== "script-src 'self'; object-src 'self'; base-uri 'self'") {
    throw new Error("Published Store ZIP manifest policy failed");
  }
  report.packageScanPassed = true;
  report.storePackage = {
    filename: "Asterfold-Chrome.zip",
    size: statSync(storePath).size,
    sha256: sha256(storePath),
    manifestVersion: manifest.version,
    manifestV3: true,
    permissions: manifest.permissions,
    optionalPermissions: manifest.optional_permissions,
    hostPermissions: manifest.host_permissions ?? [],
    entries: entries.length,
  };

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
    provenanceCovered: provenance.artifacts.some((artifact) => artifact.name === name),
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
  console.error(error);
  process.exitCode = 1;
} finally {
  writeReport();
}
