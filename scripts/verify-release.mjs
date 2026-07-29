import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const reproducibleArtifacts = ["Asterfold-Chrome.zip", "chrome-unpacked.zip", "extension-source.zip", "Asterfold-Store-Assets.zip", "sbom.spdx.json"];
const hash = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const run = () => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["scripts/release.mjs"], { stdio: "inherit", env: { ...process.env, GITHUB_RUN_ID: "reproducibility", GITHUB_RUN_ATTEMPT: "1" } });
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`release exited with ${code}`)));
});
await run();
const first = await Promise.all(reproducibleArtifacts.map((name) => hash(join("release", name))));
await run();
const second = await Promise.all(reproducibleArtifacts.map((name) => hash(join("release", name))));
if (first.some((value, index) => value !== second[index])) throw new Error("Release runtime/source/SBOM artifacts are not reproducible");
console.log("Reproducible release verified:", Object.fromEntries(reproducibleArtifacts.map((name, index) => [name, second[index]])));
