import { readFileSync, writeFileSync } from "node:fs";

const version = "3.2.0";
const previous = "3.1.4";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, content) {
  writeFileSync(path, content, "utf8");
}

function promote(path) {
  let content = read(path);
  if (content.includes(previous)) content = content.replaceAll(previous, version);
  if (!content.includes(version)) throw new Error(`Version ${version} is missing from ${path}`);
  write(path, content);
}

const upgrade = read("e2e/upgrade.spec.ts");
if (!upgrade.includes("schemaVersion: 8,")) throw new Error("Upgrade fixture does not expect schema 8");

for (const path of [
  "docs/security/privacy.md",
  "docs/store/privacy.html",
  "docs/store/submission-checklist.md",
  "store-assets/listing/submission-values.md",
]) promote(path);

write("docs/store/privacy.html", read("docs/store/privacy.html").replace("Effective 3 August 2026", "Effective 5 August 2026"));

let install = read("docs/release/install.md").replaceAll(previous, version);
install = install.replace(
  "> Asterfold 3.2.0 is an unpublished test candidate. The latest public stable version remains 3.1.2 until the required physical Windows 11 / Radeon R5 230 verification is accepted. Do not treat a successful CI run as Chrome Web Store publication.",
  "> Asterfold 3.2.0 is the current release candidate. GitHub Release publication and Chrome Web Store publication are separate events; do not treat a successful CI run as Store approval.",
);
install = install.replace("[Asterfold 3.2.0 physical test plan](./3.1.4-test-plan.md)", "[Asterfold 3.2.0 physical test plan](./3.2.0-test-plan.md)");
if (!install.includes(version)) throw new Error("Install guide was not promoted to 3.2.0");
write("docs/release/install.md", install);

const testPlan = `${read("docs/release/3.1.4-test-plan.md").replaceAll(previous, version)}

## Guided first-run setup

- [ ] A genuinely fresh Chrome profile opens the localized four-step setup exactly once.
- [ ] An existing 2.2.3 or 3.1.x profile upgrades without showing the blocking setup.
- [ ] Chrome bookmark access is requested only after the user selects Chrome import and is removed after reading.
- [ ] HTML and Asterfold JSON imports show a validated preview before any workspace write.
- [ ] Skip requires explicit confirmation and preserves the default workspace.
- [ ] A failed final commit restores the recovery backup and leaves onboarding incomplete for retry.
`;
write("docs/release/3.2.0-test-plan.md", testPlan);

let readme = read("README.md");
readme = readme.replace("Asterfold 3.1.4 produces a reproducible", "Asterfold 3.2.0 produces a reproducible");
const oldStatus = "**Asterfold 3.1.4** makes every settings, editor, search and dropdown surface fully opaque; adds one accessible theme-aware dropdown system with cross-platform SVG flags; restores immediate Appearance live preview; and preserves strict Radeon R5 230/weak-PC compatibility.";
const newStatus = "**Asterfold 3.2.0** adds a localized, migration-safe guided first-run setup with Chrome, HTML and Asterfold-backup import previews; preserves existing profiles; commits setup atomically with recovery rollback; and retains the verified opaque, accessible and weak-PC-compatible runtime.";
if (readme.includes(oldStatus)) readme = readme.replace(oldStatus, newStatus);
if (!readme.includes(newStatus)) throw new Error("README current status was not promoted");
const historyMarker = "1. **v3.1.4 — Opaque settings and adaptive controls.**";
const historyEntry = "1. **v3.2.0 — Guided first-run setup.** Adds localized language selection, preview-only Chrome/HTML/backup imports, appearance setup, migration-safe existing-user behavior, explicit skip confirmation and recovery-backed atomic completion.\n";
if (!readme.includes("**v3.2.0 — Guided first-run setup.**")) {
  if (!readme.includes(historyMarker)) throw new Error("README version-history marker missing");
  readme = readme.replace(historyMarker, historyEntry + historyMarker);
}
write("README.md", readme);

const previousNotes = read("docs/release/release-notes.md");
if (!previousNotes.startsWith(`# Asterfold ${version}`)) {
  write("docs/release/release-notes.md", `# Asterfold ${version}

## Guided first-run setup

- Opens a localized four-step setup only for genuinely fresh installations.
- Lets users choose the interface language, import source, initial appearance and final review before any workspace write.
- Supports Chrome bookmarks, browser-exported HTML and validated Asterfold JSON backups.
- Keeps import parsing and preview local, abortable and off the main UI path.

## Safe upgrades and recovery

- Migrates every existing Asterfold database to schema 8 with onboarding already completed, so updates never display the blocking wizard.
- Requests the optional Chrome bookmarks permission only after an explicit user action and removes it after reading.
- Commits onboarding once, validates workspace invariants and restores a recovery backup on failure.
- Requires explicit confirmation before skipping guided setup.

## Appearance and accessibility

- Previews theme, mode, density, rows and bundled wallpaper choices without persisting them before Finish.
- Uses an opaque responsive dialog, trapped keyboard focus, reduced-motion support and localized accessible names.
- Preserves the existing flash-free startup path and weak-GPU compatibility mode.

## Verification

- Adds unit and integration coverage for onboarding state, migration, localization, Chrome permission handling, rollback and idempotency.
- Adds real unpacked-MV3 E2E coverage proving fresh-profile completion and non-reappearance.
- Retains strict typecheck, lint, coverage, security, CodeQL, deterministic Linux/Windows packaging, accessibility, Windows stress and exact 2.2.3 upgrade gates.

## Previous release details

${previousNotes}
`);
}
