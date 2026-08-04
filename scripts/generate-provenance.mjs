import { execFileSync } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { sha256File } from "./release-lib.mjs";

const root = resolve(process.cwd());
const release = resolve(root, "release");
const destination = resolve(process.argv[2] ?? "release/provenance.json");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(release, "chrome-unpacked/manifest.json"), "utf8"));
const git = (...args) => {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return "unknown"; }
};
const resolveNpmVersion = () => {
  const userAgentVersion = process.env.npm_config_user_agent?.match(/npm\/([^ ]+)/u)?.[1];
  if (userAgentVersion) return userAgentVersion;
  if (process.env.NPM_VERSION) return process.env.NPM_VERSION;
  try {
    const command = process.platform === "win32" ? "npm.cmd" : "npm";
    return execFileSync(command, ["--version"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
};
const sourceCommit = process.env.GITHUB_SHA || git("rev-parse", "HEAD");
const sourceTree = git("rev-parse", `${sourceCommit}^{tree}`);
const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : process.env.RELEASE_TAG || `v${packageJson.version}`;
const artifactNames = ["Asterfold-Chrome.zip", "chrome-unpacked.zip", "extension-source.zip", "Asterfold-Store-Assets.zip", "sbom.spdx.json"];
const artifacts = [];
for (const name of artifactNames) {
  const path = resolve(release, name);
  const info = await stat(path);
  artifacts.push({ name: basename(path), sha256: await sha256File(path), size: info.size });
}
const provenance = {
  schemaVersion: 1,
  repository: process.env.GITHUB_REPOSITORY || "memodlike/Asterfold",
  sourceCommit,
  sourceTree,
  branch: "main",
  tag,
  packageVersion: packageJson.version,
  manifestVersion: manifest.version,
  nodeVersion: process.version,
  npmVersion: resolveNpmVersion(),
  lockfileSha256: await sha256File(resolve(root, "package-lock.json")),
  workflowRunId: process.env.GITHUB_RUN_ID || "local",
  workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT || "local",
  builder: process.env.GITHUB_ACTIONS === "true" ? "github-actions" : "local",
  artifacts
};
await writeFile(destination, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
console.log(`Provenance written: ${destination}`);
