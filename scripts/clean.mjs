import { rm } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = process.cwd();
const targets = [".output", ".wxt", "coverage", "playwright-report", "test-results", "release"];
for (const target of targets) {
  const path = resolve(root, target);
  if (basename(path) !== target || !path.startsWith(`${root}/`)) throw new Error(`Unsafe clean target: ${path}`);
  await rm(path, { recursive: true, force: true });
}
console.log("Generated build, test, and release artifacts removed.");
