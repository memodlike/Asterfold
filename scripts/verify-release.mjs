import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const artifacts = ["Asterfold-Chrome.zip", "chrome-unpacked.zip", "extension-source.zip"];
const hash = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const run = () => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["scripts/release.mjs"], { stdio: "inherit" });
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`release exited with ${code}`)));
});

await run();
const first = await Promise.all(artifacts.map((name) => hash(join("release", name))));
await run();
const second = await Promise.all(artifacts.map((name) => hash(join("release", name))));
if (first.some((value, index) => value !== second[index])) throw new Error("Release archives are not reproducible");
console.log("Reproducible release verified:", Object.fromEntries(artifacts.map((name, index) => [name, second[index]])));
