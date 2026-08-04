import { readFile, writeFile, rm } from "node:fs/promises";

async function replace(path, pairs) {
  let text = await readFile(path, "utf8");
  for (const [from, to] of pairs) text = text.replaceAll(from, to);
  await writeFile(path, text);
}

await replace("docs/security/privacy.md", [
  ["Policy version: 3.1.2", "Policy version: 3.1.3"],
  ["Applies to: Asterfold 3.1.2", "Applies to: Asterfold 3.1.3"],
]);
await replace("docs/store/privacy.html", [
  ["Policy version: 3.1.2", "Policy version: 3.1.3"],
  ["Asterfold 3.1.2", "Asterfold 3.1.3"],
]);
await replace("docs/store/submission-checklist.md", [["Current version: 3.1.2", "Current version: 3.1.3"]]);
await replace("store-assets/listing/submission-values.md", [["Current version: 3.1.2", "Current version: 3.1.3"]]);
await replace("docs/release/install.md", [["Install Asterfold 3.1.2", "Install Asterfold 3.1.3"]]);
await replace("docs/security/permissions.md", [["Asterfold 3.1.2", "Asterfold 3.1.3"]]);
await replace("docs/security/review.md", [["Asterfold 3.1.2", "Asterfold 3.1.3"]]);

const releasePath = "docs/release/release-notes.md";
let release = await readFile(releasePath, "utf8");
if (!release.startsWith("# Asterfold 3.1.3")) {
  release = release.replace("# Asterfold 3.1.2", "## 3.1.2 — Original-quality uploaded wallpapers");
  release = `# Asterfold 3.1.3

## Flash-free new-tab startup

- Paints a dark critical surface before React and the main stylesheet load.
- Restores a strictly validated local visual snapshot for the canvas and bundled wallpaper.
- Keeps React hidden until IndexedDB, the selected theme and wallpaper resolve, then reveals the final workspace once.
- Applies final theme variables before the first visible React frame and keeps a five-second failure fallback.

## Entrance motion

- Fades the final wallpaper without animating blur or filters.
- Introduces a restrained board stagger and launcher rise using opacity and transform only.
- Runs only during initial startup and respects both reduced-motion and the Asterfold motion preference.

## Verification

- Adds unit/static coverage for snapshot validation, denied storage, critical resource ordering and reduced-motion behavior.
- Adds a real unpacked-MV3 frame-sampled regression for white flashes, visible loading frames and opacity reversals.
- Retains audit, source scan, typecheck, lint, coverage, Store validation, deterministic packaging, MV3 E2E, stress and exact upgrade checks.

## Previous release details

${release}`;
  await writeFile(releasePath, release);
}

const readmePath = "README.md";
let readme = await readFile(readmePath, "utf8");
readme = readme.replace("Asterfold 3.1.2 produces a reproducible", "Asterfold 3.1.3 produces a reproducible");
readme = readme.replace(
  "**Asterfold 3.1.2** preserves user-uploaded wallpapers at their exact original resolution, format and byte quality, while keeping a separate Full HD software-rendering fallback and the verified local-first release pipeline.",
  "**Asterfold 3.1.3** removes new-tab white/dark flashing with a critical first-paint surface, waits for the final theme and wallpaper before revealing React, and adds a restrained reduced-motion-aware entrance sequence while retaining the 3.1.2 original-quality wallpaper pipeline.",
);
if (!readme.includes("**v3.1.3 — Flash-free new-tab startup.**")) {
  const marker = "## Version history\n\n";
  const start = readme.indexOf(marker) + marker.length;
  const end = readme.indexOf("\n\nThe newest published build", start);
  const prior = readme.slice(start, end).split("\n").map((line) => {
    const match = /^(\d+)\.\s+(.*)$/.exec(line);
    return match ? `${Number(match[1]) + 1}. ${match[2]}` : line;
  });
  const current = "1. **v3.1.3 — Flash-free new-tab startup.** Adds a critical dark first paint, validated visual snapshot, layout-timed theme application, one-time compositor-safe entrance motion, reduced-motion support, and a frame-sampled MV3 regression.";
  readme = `${readme.slice(0, start)}${current}\n${prior.join("\n")}${readme.slice(end)}`;
}
await writeFile(readmePath, readme);

const versioningPath = "docs/release/versioning.md";
let versioning = await readFile(versioningPath, "utf8");
const anchor = "`3.1.2` is the original-quality wallpaper patch release. It follows the 3.1.1 wallpaper/UI polish build and preserves uploaded raster sources without changing extension permissions or the local-first data model.\n";
if (!versioning.includes("`3.1.3` is the flash-free")) {
  versioning = versioning.replace(anchor, `${anchor}\n\`3.1.3\` is the flash-free new-tab startup patch. It adds a critical first-paint surface, waits for the resolved theme and wallpaper before revealing the workspace, and keeps entrance motion compositor-safe and reduced-motion-aware.\n`);
}
versioning = versioning.replace("for example `v3.1.2`", "for example `v3.1.3`").replace("numeric version `3.1.2`", "numeric version `3.1.3`");
await writeFile(versioningPath, versioning);

const runtimePath = "tests/runtimeCoverage.test.ts";
let runtime = await readFile(runtimePath, "utf8");
const cleanupAnchor = '    document.documentElement.removeAttribute("data-performance");\n';
if (!runtime.includes('removeAttribute("data-asterfold-ready")')) {
  runtime = runtime.replace(cleanupAnchor, `${cleanupAnchor}    document.documentElement.removeAttribute("data-asterfold-ready");\n    document.documentElement.removeAttribute("data-asterfold-entering");\n    document.documentElement.removeAttribute("data-asterfold-boot");\n    localStorage.removeItem("asterfold:startup-theme:v1");\n`);
  await writeFile(runtimePath, runtime);
}

await rm(".github/transport/lock-3.1.3", { recursive: true, force: true });
await rm("scripts/prepare-3.1.3-preview.mjs", { force: true });
