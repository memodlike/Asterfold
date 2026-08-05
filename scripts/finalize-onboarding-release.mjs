import { readFileSync, writeFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const write = (path, value) => writeFileSync(path, value.endsWith("\n") ? value : `${value}\n`);
const replaceRequired = (value, search, replacement, label) => {
  if (value.includes(replacement)) return value;
  if (!value.includes(search)) throw new Error(`Unable to patch ${label}`);
  return value.replace(search, replacement);
};

for (const path of ["package.json", "package-lock.json"]) {
  const json = JSON.parse(read(path));
  json.version = "3.2.0";
  if (path === "package-lock.json") {
    if (!json.packages?.[""]) throw new Error("package-lock root package is missing");
    json.packages[""].version = "3.2.0";
  }
  write(path, `${JSON.stringify(json, null, 2)}\n`);
}

{
  const path = "src/features/settings/SettingsDialog.tsx";
  let value = read(path);
  if (!value.includes('from "../onboarding/chromeBookmarkImport"')) {
    value = replaceRequired(
      value,
      'import { parseBackupOffThread, parseHtmlOffThread } from "../../services/importWorker";',
      'import { parseBackupOffThread, parseHtmlOffThread } from "../../services/importWorker";\nimport { flattenChromeBookmarks } from "../onboarding/chromeBookmarkImport";',
      path,
    );
  }
  const localStart = value.indexOf("\ntype ChromeNode = chrome.bookmarks.BookmarkTreeNode;");
  const localEnd = value.indexOf("\nfunction formatBytes", localStart);
  if (localStart >= 0 && localEnd > localStart) value = value.slice(0, localStart) + value.slice(localEnd);
  write(path, value);
}

{
  const path = "src/services/exportImport.ts";
  let value = read(path);
  if (!value.includes('const installationSettings = await database.settings.get("app");')) {
    value = replaceRequired(
      value,
      "  const wallpaperAssets = await prepareWallpaperAssets(validated);\n  await database.transaction",
      '  const wallpaperAssets = await prepareWallpaperAssets(validated);\n  const installationSettings = await database.settings.get("app");\n  await database.transaction',
      path,
    );
  }
  value = replaceRequired(
    value,
    "    if (validated.settings && strategy === \"replace\") await database.settings.put(validated.settings);",
    "    if (validated.settings && strategy === \"replace\") {\n      await database.settings.put({\n        ...validated.settings,\n        onboardingVersion: installationSettings?.onboardingVersion ?? validated.settings.onboardingVersion,\n        onboardingComplete: installationSettings?.onboardingComplete ?? validated.settings.onboardingComplete,\n      });\n    }",
    path,
  );
  write(path, value);
}

{
  const path = "src/features/onboarding/onboardingMessages.ts";
  let value = read(path);
  const additions = {
    es: {
      preview: '"import.preview": "{bookmarks} marcadores · {folders} carpetas · {pages} páginas · {boards} tableros",\n  "import.empty": "No se encontraron marcadores en esta fuente.",\n  "import.parsing": "Validando el archivo seleccionado…",\n  ',
      review: '"review.source": "Fuente de datos", "review.language": "Idioma", "review.theme": "Tema", "review.layout": "Diseño", "review.duplicates": "Duplicados",\n  ',
    },
    de: {
      preview: '"import.preview": "{bookmarks} Lesezeichen · {folders} Ordner · {pages} Seiten · {boards} Bereiche",\n  "import.empty": "In dieser Quelle wurden keine Lesezeichen gefunden.",\n  "import.parsing": "Ausgewählte Datei wird geprüft…",\n  ',
      review: '"review.source": "Datenquelle", "review.language": "Sprache", "review.theme": "Design", "review.layout": "Layout", "review.duplicates": "Duplikate",\n  ',
    },
    fr: {
      preview: '"import.preview": "{bookmarks} favoris · {folders} dossiers · {pages} pages · {boards} tableaux",\n  "import.empty": "Aucun favori trouvé dans cette source.",\n  "import.parsing": "Validation du fichier sélectionné…",\n  ',
      review: '"review.source": "Source de données", "review.language": "Langue", "review.theme": "Thème", "review.layout": "Disposition", "review.duplicates": "Doublons",\n  ',
    },
    it: {
      preview: '"import.preview": "{bookmarks} preferiti · {folders} cartelle · {pages} pagine · {boards} bacheche",\n  "import.empty": "Nessun preferito trovato in questa fonte.",\n  "import.parsing": "Convalida del file selezionato…",\n  ',
      review: '"review.source": "Fonte dati", "review.language": "Lingua", "review.theme": "Tema", "review.layout": "Layout", "review.duplicates": "Duplicati",\n  ',
    },
    pt: {
      preview: '"import.preview": "{bookmarks} favoritos · {folders} pastas · {pages} páginas · {boards} painéis",\n  "import.empty": "Não foram encontrados favoritos nesta fonte.",\n  "import.parsing": "A validar o ficheiro selecionado…",\n  ',
      review: '"review.source": "Fonte de dados", "review.language": "Idioma", "review.theme": "Tema", "review.layout": "Disposição", "review.duplicates": "Duplicados",\n  ',
    },
    pl: {
      preview: '"import.preview": "Zakładki: {bookmarks} · foldery: {folders} · strony: {pages} · tablice: {boards}",\n  "import.empty": "W tym źródle nie znaleziono zakładek.",\n  "import.parsing": "Sprawdzanie wybranego pliku…",\n  ',
      review: '"review.source": "Źródło danych", "review.language": "Język", "review.theme": "Motyw", "review.layout": "Układ", "review.duplicates": "Duplikaty",\n  ',
    },
    uk: {
      preview: '"import.preview": "Закладок: {bookmarks} · папок: {folders} · сторінок: {pages} · дощок: {boards}",\n  "import.empty": "У цьому джерелі закладки не знайдено.",\n  "import.parsing": "Перевіряємо вибраний файл…",\n  ',
      review: '"review.source": "Джерело даних", "review.language": "Мова", "review.theme": "Тема", "review.layout": "Компонування", "review.duplicates": "Дублікати",\n  ',
    },
    tr: {
      preview: '"import.preview": "{bookmarks} yer imi · {folders} klasör · {pages} sayfa · {boards} pano",\n  "import.empty": "Bu kaynakta yer imi bulunamadı.",\n  "import.parsing": "Seçilen dosya doğrulanıyor…",\n  ',
      review: '"review.source": "Veri kaynağı", "review.language": "Dil", "review.theme": "Tema", "review.layout": "Düzen", "review.duplicates": "Yinelenenler",\n  ',
    },
    nl: {
      preview: '"import.preview": "{bookmarks} bladwijzers · {folders} mappen · {pages} pagina’s · {boards} borden",\n  "import.empty": "In deze bron zijn geen bladwijzers gevonden.",\n  "import.parsing": "Geselecteerd bestand wordt gevalideerd…",\n  ',
      review: '"review.source": "Gegevensbron", "review.language": "Taal", "review.theme": "Thema", "review.layout": "Indeling", "review.duplicates": "Duplicaten",\n  ',
    },
  };
  const order = ["es", "de", "fr", "it", "pt", "pl", "uk", "tr", "nl"];
  for (let index = 0; index < order.length; index += 1) {
    const locale = order[index];
    const start = value.indexOf(`const ${locale}: Dictionary`);
    const next = index + 1 < order.length ? value.indexOf(`const ${order[index + 1]}: Dictionary`, start) : value.indexOf("const dictionaries:", start);
    if (start < 0 || next < 0) throw new Error(`Unable to locate ${locale} onboarding dictionary`);
    let segment = value.slice(start, next);
    if (!segment.includes('"import.preview"')) segment = segment.replace('"appearance.title"', `${additions[locale].preview}"appearance.title"`);
    if (!segment.includes('"review.source"')) segment = segment.replace('"action.continue"', `${additions[locale].review}"action.continue"`);
    value = value.slice(0, start) + segment + value.slice(next);
  }
  write(path, value);
}

write("src/features/onboarding/OnboardingGate.tsx", `import { lazy, Suspense, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles } from "lucide-react";
import { WorkspaceApp } from "../../app/WorkspaceApp";
import { Button } from "../../components/Button";
import { db } from "../../db/database";
import { ensureStarterWorkspace, getWorkspaceData } from "../../db/repository";
import type { LocalePreference } from "../../domain/models";
import { I18nProvider, translate } from "../../i18n";
import { useThemeRuntime } from "../appearance/useThemeRuntime";
import { onboardingText } from "./onboardingMessages";
import { shouldShowOnboarding } from "./onboardingState";

const OnboardingWizard = lazy(() => import("./OnboardingEntry"));

export function OnboardingGate() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [completionLocale, setCompletionLocale] = useState<LocalePreference | null>(null);

  useEffect(() => {
    let active = true;
    setReady(false);
    setFailed(false);
    void ensureStarterWorkspace(db)
      .then(() => { if (active) setReady(true); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (!completionLocale) return;
    const frame = window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".launcher-trigger")?.focus());
    const timer = window.setTimeout(() => setCompletionLocale(null), 4_500);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [completionLocale]);

  const settings = useLiveQuery(async () => ready ? db.settings.get("app") : undefined, [ready, attempt], undefined);

  if (failed) {
    return <div className="app-loading">
      <span>{translate("auto", "error.actionFailed")}</span>
      <Button onClick={() => setAttempt((current) => current + 1)}>{translate("auto", "generic.retry")}</Button>
    </div>;
  }
  if (!settings) return <div className="app-loading"><Sparkles size={22} /><span>{translate("auto", "loading.opening")}</span></div>;
  if (!shouldShowOnboarding(settings)) return <>
    <WorkspaceApp />
    {completionLocale ? <div className="onboarding-success-toast" role="status" aria-live="polite">{onboardingText(completionLocale, "status.ready")}</div> : null}
  </>;
  return <PendingOnboarding onCompleted={setCompletionLocale} />;
}

function PendingOnboarding({ onCompleted }: { onCompleted: (locale: LocalePreference) => void }) {
  const workspace = useLiveQuery(() => getWorkspaceData(db, false), [], undefined);
  useThemeRuntime(workspace?.settings.theme);
  if (!workspace) return <div className="app-loading"><Sparkles size={22} /><span>{translate("auto", "loading.opening")}</span></div>;
  return <I18nProvider preference={workspace.settings.locale} documentTitle="tab.title">
    <div className="onboarding-shell" aria-hidden="true">
      <div className="onboarding-shell__wallpaper" />
      <div className="onboarding-shell__preview"><span /><span /><span /><span /><span /><span /></div>
    </div>
    <Suspense fallback={<div className="app-loading"><Sparkles size={22} /><span>{translate(workspace.settings.locale, "loading.opening")}</span></div>}>
      <OnboardingWizard workspace={workspace} onCompleted={onCompleted} />
    </Suspense>
  </I18nProvider>;
}
`);

{
  const path = "src/features/onboarding/OnboardingWizard.tsx";
  let value = read(path);
  value = value.replace("onCompleted?: () => void;", "onCompleted?: (locale: LocalePreference) => void;");
  value = value.replace("onCompleted?.();", "onCompleted?.(finalPlan.locale);");
  write(path, value);
}

{
  const path = "src/features/onboarding/onboarding.css";
  let value = read(path);
  if (!value.includes(".onboarding-success-toast")) value += `
.onboarding-success-toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 500;
  max-width: min(360px, calc(100vw - 40px));
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--color-success) 32%, transparent);
  border-radius: 12px;
  color: var(--color-text);
  background: var(--color-surface-solid, #fbfbfc);
  box-shadow: var(--shadow-panel, 0 18px 48px rgb(20 22 28 / .16));
  font-size: 13px;
  font-weight: 700;
}
`;
  write(path, value);
}

{
  const path = "e2e/onboarding.spec.ts";
  let value = read(path);
  const marker = '    await expect(page.locator(".app-shell")).toBeVisible();\n';
  if (!value.includes('page.locator(".onboarding-success-toast")')) {
    value = replaceRequired(value, marker, `${marker}    await expect(page.locator(".onboarding-success-toast")).toBeVisible();\n    await expect(page.locator(".launcher-trigger")).toBeFocused();\n`, path);
  }
  write(path, value);
}

{
  const path = "tests/onboardingMessages.test.ts";
  let value = read(path);
  const marker = '  it("interpolates preview counts';
  if (!value.includes("localizes the extended preview")) {
    const block = `  it.each(locales.filter((locale) => locale !== "en"))("localizes the extended preview and review surface for %s", (locale) => {
    for (const key of ["import.preview", "import.empty", "import.parsing", "review.source", "review.language", "review.theme", "review.layout", "review.duplicates"] as const) {
      expect(onboardingText(locale, key, { bookmarks: 2, folders: 1, pages: 1, boards: 1 }), `${locale}:${key}`).not.toBe(
        onboardingText("en", key, { bookmarks: 2, folders: 1, pages: 1, boards: 1 }),
      );
    }
  });

`;
    value = replaceRequired(value, marker, `${block}${marker}`, path);
  }
  write(path, value);
}

write("tests/onboardingRestoreLifecycle.test.ts", `import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { ensureStarterWorkspace, getWorkspaceData, updateSettings } from "../src/db/repository";
import { CURRENT_ONBOARDING_VERSION } from "../src/features/onboarding/onboardingState";
import { createBackup, restoreBackup } from "../src/services/exportImport";

const databaseNames: string[] = [];

async function database(prefix: string): Promise<AsterfoldDatabase> {
  const name = `${prefix}-${crypto.randomUUID()}`;
  databaseNames.push(name);
  const instance = new AsterfoldDatabase(name);
  await ensureStarterWorkspace(instance);
  return instance;
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

describe("backup restore onboarding lifecycle", () => {
  it("preserves a configured installation lifecycle when replacing from a full backup", async () => {
    const source = await database("onboarding-restore-source");
    await updateSettings({ onboardingVersion: 0, onboardingComplete: false, locale: "ru" }, source);
    const backup = await createBackup({}, source);
    source.close();

    const target = await database("onboarding-restore-target");
    await updateSettings({ onboardingVersion: CURRENT_ONBOARDING_VERSION, onboardingComplete: true, locale: "en" }, target);
    await restoreBackup(backup, "replace", target);

    const settings = (await getWorkspaceData(target)).settings;
    expect(settings.locale).toBe("ru");
    expect(settings.onboardingVersion).toBe(CURRENT_ONBOARDING_VERSION);
    expect(settings.onboardingComplete).toBe(true);
    target.close();
  });

  it("keeps a fresh installation pending until the encompassing onboarding commit succeeds", async () => {
    const source = await database("onboarding-restore-fresh-source");
    await updateSettings({ onboardingVersion: CURRENT_ONBOARDING_VERSION, onboardingComplete: true }, source);
    const backup = await createBackup({}, source);
    source.close();

    const target = await database("onboarding-restore-fresh-target");
    expect((await getWorkspaceData(target)).settings.onboardingComplete).toBe(false);
    await restoreBackup(backup, "replace", target);

    const after = (await getWorkspaceData(target)).settings;
    expect(after.onboardingVersion).toBe(CURRENT_ONBOARDING_VERSION);
    expect(after.onboardingComplete).toBe(false);
    target.close();
  });
});
`);

{
  const path = "README.md";
  let value = read(path).replace("<h1>Asterfold</h1>", "<h1>Asterfold 3.2.0</h1>");
  value = value.replace("Asterfold 3.1.4 produces", "Asterfold 3.2.0 produces").replace("**Asterfold 3.1.4**", "**Asterfold 3.2.0**");
  value = value.replace(
    "| Import and export | Supports Asterfold JSON backups, Netscape HTML, and optional Chrome bookmark import |",
    "| Guided first-run setup | On fresh installations, configures language, safe import, theme, density, and layout before the first workspace commit |\n| Import and export | Supports Asterfold JSON backups, Netscape HTML, and optional Chrome bookmark import with local previews |",
  );
  value = value.replace(
    "| 12 interface languages | Full English, Russian, and Kazakh coverage with safe English fallback for rare strings |",
    "| 12 interface languages | Complete guided-setup coverage for English, Russian, Kazakh, Spanish, German, French, Italian, Portuguese, Polish, Ukrainian, Turkish, and Dutch |",
  );
  value = value.replace(
    "- Chrome bookmark access is optional and requested only from the explicit import action.",
    "- Chrome bookmark access is optional and requested only from the explicit import action.\n- Fresh-install setup choices remain drafts until Finish; existing upgraded profiles are migrated past the blocking wizard.",
  );
  if (!value.includes("## Guided first-run setup")) {
    value = value.replace("## Product flow\n", `## Guided first-run setup

A genuinely fresh 3.2.0 installation opens a four-step local wizard before normal workspace interaction:

1. choose the interface language;
2. keep the starter workspace, read Chrome bookmarks after explicit optional permission, select a Netscape HTML file, or validate an Asterfold JSON backup;
3. preview theme, density, wallpaper, and row layout without persisting them;
4. review and commit the complete plan once.

No import or appearance choice is written before **Finish setup**. A failed final commit restores the recovery backup and leaves onboarding pending. Explicit skip keeps defaults. Existing profiles upgraded from earlier versions are marked complete by the schema migration and do not receive an unexpected blocking wizard.

## Product flow
`);
  }
  write(path, value);
}

for (const path of ["docs/security/privacy.md", "docs/store/privacy.html", "docs/store/submission-checklist.md", "store-assets/listing/submission-values.md"]) {
  let value = read(path).replaceAll("3.1.4", "3.2.0").replaceAll("Asterfold 3.1.2", "Asterfold 3.2.0").replaceAll("version 3.1.2", "version 3.2.0");
  if (path === "docs/security/privacy.md") {
    value = value.replace(
      "Declining the permission does not affect the normal workspace or file import/export.",
      "Declining the permission does not affect the normal workspace or file import/export. During guided setup, Asterfold removes the optional permission after the bookmark tree has been read when Chrome permits removal; no import occurs until the user finishes setup.",
    );
    value = value.replace(
      "File import and validation run locally. Asterfold does not upload an imported file.",
      "File import and validation run locally. Asterfold does not upload an imported file. Guided-setup previews remain in memory and are not written to the workspace before the final confirmed commit.",
    );
  }
  write(path, value);
}

{
  const path = "docs/release/release-notes.md";
  const previous = read(path);
  const marker = "## Previous release details";
  const history = previous.includes(marker) ? previous.slice(previous.indexOf(marker)) : previous;
  write(path, `# Asterfold 3.2.0

## Guided first-run setup

- Adds a localized four-step setup flow for language, bookmark source, appearance, workspace density and final review.
- Shows the blocking wizard only for genuinely fresh 3.2.0 installations. Existing profiles are migrated to onboarding version 1 as already complete.
- Keeps every choice as a draft or visual preview until **Finish setup**. Explicit skip retains the starter workspace and defaults.

## Safe local import

- Reuses the production import pipeline for Chrome bookmarks, Netscape HTML and Asterfold JSON backups.
- Requests the optional \`bookmarks\` permission only after an explicit action and removes it after reading when Chrome allows removal.
- Validates files off the UI thread, supports cancellation, previews counts and preserves duplicate handling, URL safety and import limits.
- Protects the final operation with a recovery backup, invariant checks, an in-flight guard and compensating rollback.
- Preserves installation-local onboarding lifecycle values during normal full-backup restore.

## Appearance and accessibility

- Previews system, light and dark modes, presets, built-in wallpapers, density and one/two-row layout without leaking uncommitted settings.
- Uses an opaque responsive dialog with focus containment, visible focus, semantic selected states, reduced-motion support and a controlled close/skip confirmation.
- Restores focus to the Asterfold launcher and announces a localized success status after completion.
- Includes complete guided-setup strings for all 12 supported selectable locales.

## Privacy and compatibility

- Keeps all onboarding state, imported data and appearance selections local to the browser profile.
- Adds no required permissions, host permissions, content scripts, telemetry, accounts or remote executable code.
- Lazy-loads first-run implementation and styles so configured users avoid a permanent first-run UI cost.
- Retains adaptive Compatibility Glass and the flash-free startup runtime.

## Verification

- Adds lifecycle, migration, permission, parser, localization, idempotency, rollback and restore tests.
- Adds real unpacked-MV3 first-profile coverage for Axe, keyboard focus, 1280×720 fit, reduced motion, explicit skip, persistence and non-reappearance.
- Retains strict coverage thresholds, production/development audits, source scan, Store validation, deterministic Linux/Windows packaging, stress and exact 2.2.3 upgrade gates.

${history}`);
}

console.log("Asterfold 3.2.0 branch finalization applied.");
