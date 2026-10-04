import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Extracts the body of one version from docs/release/release-notes.md for the GitHub Release
 * description, so a release page shows only what changed in that version, not the full history.
 */
export function releaseNotesSection(markdown, version) {
  const lines = markdown.replace(/\r\n/gu, "\n").split("\n");
  const start = lines.indexOf(`# Asterfold ${version}`);
  if (start === -1) throw new Error(`No release notes for Asterfold ${version}`);
  const next = lines.findIndex((line, index) => index > start && line.startsWith("# Asterfold "));
  const body = lines.slice(start + 1, next === -1 ? undefined : next).join("\n").trim();
  if (!body) throw new Error(`No release notes for Asterfold ${version}`);
  return body;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) throw new Error("Usage: node scripts/release-notes-section.mjs <version>");
  const markdown = await readFile(resolve(fileURLToPath(new URL("..", import.meta.url)), "docs/release/release-notes.md"), "utf8");
  process.stdout.write(`${releaseNotesSection(markdown, version)}\n`);
}
