import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  Check,
  Chrome,
  FileJson,
  FileText,
  FolderOpen,
  Languages,
  Moon,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import type { Density, LocalePreference, ThemeMode, WorkspaceData } from "../../domain/models";
import { IMPORT_LIMITS } from "../../domain/importLimits";
import { validateTheme } from "../../domain/themes";
import { Button } from "../../components/Button";
import { LocaleFlag } from "../../components/LocaleFlag";
import { Modal } from "../../components/Modal";
import { SelectField, type SelectOption } from "../../components/SelectField";
import { localeOptions, translate } from "../../i18n";
import { parseBackupOffThread, parseHtmlOffThread } from "../../services/importWorker";
import { publishThemePreview } from "../appearance/themePreview";
import { BUILTIN_WALLPAPERS } from "../appearance/themeRuntime";
import { readChromeBookmarks } from "./chromeBookmarkImport";
import { commitOnboardingPlan } from "./onboardingCommit";
import { onboardingText, type OnboardingMessageKey } from "./onboardingMessages";
import {
  backupPreview,
  canContinue,
  recordPreview,
  type OnboardingPlan,
  type OnboardingSource,
} from "./onboardingState";

interface OnboardingWizardProps {
  workspace: WorkspaceData;
  onCompleted?: () => void;
}

const SOURCE_ORDER: readonly OnboardingSource[] = ["default", "chrome", "html", "backup"];

export function OnboardingWizard({ workspace, onCompleted }: OnboardingWizardProps) {
  const initialLocale = workspace.settings.locale;
  const [plan, setPlan] = useState<OnboardingPlan>(() => ({
    locale: initialLocale,
    source: "default",
    records: [],
    backup: null,
    preview: null,
    duplicateStrategy: "skip",
    importPageTitle: translate(initialLocale, "settings.importedBookmarks"),
    theme: workspace.settings.theme,
    workspaceLayoutMode: workspace.settings.workspaceLayoutMode,
    workspaceRows: workspace.settings.workspaceRows,
  }));
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chromeDenied, setChromeDenied] = useState(false);
  const [permissionRemoved, setPermissionRemoved] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const htmlInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const parseControllerRef = useRef<AbortController | null>(null);
  const finishGuardRef = useRef(false);

  const t = (key: OnboardingMessageKey, params?: Record<string, string | number>): string =>
    onboardingText(plan.locale, key, params);

  const languageOptions = useMemo<ReadonlyArray<SelectOption>>(
    () => localeOptions.map((option) => ({
      value: option.value,
      label: option.label,
      icon: <LocaleFlag locale={option.value} />,
    })),
    [],
  );

  useEffect(() => {
    publishThemePreview(plan.theme);
  }, [plan.theme]);

  useEffect(() => () => {
    parseControllerRef.current?.abort();
    publishThemePreview(null);
  }, []);

  const patchPlan = (patch: Partial<OnboardingPlan>): void => {
    setPlan((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const selectSource = (source: OnboardingSource): void => {
    parseControllerRef.current?.abort();
    setParsing(false);
    setChromeDenied(false);
    setPermissionRemoved(false);
    patchPlan({ source, records: [], backup: null, preview: null });
  };

  const setLocale = (value: string): void => {
    const locale = value as LocalePreference;
    patchPlan({ locale, importPageTitle: translate(locale, "settings.importedBookmarks") });
  };

  const loadChrome = async (): Promise<void> => {
    setError(null);
    setChromeDenied(false);
    setParsing(true);
    try {
      const result = await readChromeBookmarks(true);
      if (result.status === "denied") {
        setChromeDenied(true);
        patchPlan({ source: "chrome", records: [], backup: null, preview: null });
        return;
      }
      setPermissionRemoved(result.permissionRemoved);
      patchPlan({
        source: "chrome",
        records: result.records,
        backup: null,
        preview: recordPreview("chrome", t("import.chrome.title"), result.records),
      });
    } catch {
      setError(t("status.error"));
    } finally {
      setParsing(false);
    }
  };

  const parseFile = async (file: File, kind: "html" | "backup"): Promise<void> => {
    if (file.size > IMPORT_LIMITS.fileBytes) {
      setError(t("status.error"));
      return;
    }
    parseControllerRef.current?.abort();
    const controller = new AbortController();
    parseControllerRef.current = controller;
    setParsing(true);
    setError(null);
    try {
      const text = await file.text();
      if (kind === "html") {
        const records = await parseHtmlOffThread(text, controller.signal);
        patchPlan({
          source: "html",
          records,
          backup: null,
          preview: recordPreview("html", file.name, records, file.size),
        });
      } else {
        const backup = await parseBackupOffThread(text, controller.signal);
        patchPlan({
          source: "backup",
          records: [],
          backup,
          preview: backupPreview(file.name, backup, file.size),
        });
      }
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(t("status.error"));
    } finally {
      if (parseControllerRef.current === controller) {
        parseControllerRef.current = null;
        setParsing(false);
      }
    }
  };

  const handleFile = (kind: "html" | "backup") => (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void parseFile(file, kind);
  };

  const setThemeMode = (mode: ThemeMode): void => {
    patchPlan({ theme: validateTheme({ ...plan.theme, mode }) });
  };

  const setDensity = (density: Density): void => {
    patchPlan({ theme: validateTheme({ ...plan.theme, density }) });
  };

  const setWallpaper = (wallpaperId: string | null): void => {
    patchPlan({
      theme: validateTheme({
        ...plan.theme,
        wallpaperId,
        backgroundMode: wallpaperId ? "wallpaper" : "auto",
      }),
    });
  };

  // Choosing a source starts it in the same click: Chrome's permission prompt and the file
  // picker both require the user gesture, so nothing may await before them.
  const chooseSource = (source: OnboardingSource): void => {
    if (source === "chrome") {
      selectSource("chrome");
      void loadChrome();
      return;
    }
    selectSource(source);
    if (source === "html") htmlInputRef.current?.click();
    if (source === "backup") backupInputRef.current?.click();
  };

  const ready = canContinue("import", plan, parsing);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (ready) void finish(false);
  };

  const finish = async (skip: boolean): Promise<void> => {
    if (finishGuardRef.current || busy) return;
    finishGuardRef.current = true;
    setBusy(true);
    setError(null);
    const finalPlan: OnboardingPlan = skip
      ? {
          ...plan,
          locale: workspace.settings.locale,
          source: "default",
          records: [],
          backup: null,
          preview: null,
          theme: workspace.settings.theme,
          workspaceLayoutMode: workspace.settings.workspaceLayoutMode,
          workspaceRows: workspace.settings.workspaceRows,
        }
      : plan;
    try {
      await commitOnboardingPlan(finalPlan);
      publishThemePreview(null);
      onCompleted?.();
    } catch {
      publishThemePreview(null);
      setError(t("status.error"));
      setConfirmSkip(false);
    } finally {
      finishGuardRef.current = false;
      setBusy(false);
    }
  };

  const sources: Record<OnboardingSource, { title: string; body: string; icon: typeof Sparkles }> = {
    default: { title: t("import.default.title"), body: t("import.default.body"), icon: Sparkles },
    chrome: { title: t("import.chrome.title"), body: t("import.chrome.body"), icon: Chrome },
    html: { title: t("import.html.title"), body: t("import.html.body"), icon: FileText },
    backup: { title: t("import.backup.title"), body: t("import.backup.body"), icon: FileJson },
  };
  const wallpaperLabel = translate(plan.locale, "settings.backgroundWallpaper");
  const themeLabel = translate(plan.locale, "settings.themeMode");

  const renderImportStatus = () => {
    if (parsing) return <p className="onboarding-status" role="status">{t("import.parsing")}</p>;
    if (plan.source === "chrome" && chromeDenied) {
      return (
        <div className="onboarding-status is-warning" role="status">
          <span>{t("import.chrome.denied")}</span>
          <button type="button" className="onboarding-link" onClick={() => void loadChrome()}><RotateCcw size={14} aria-hidden="true" />{t("action.retry")}</button>
        </div>
      );
    }
    if (!plan.preview) return plan.source === "chrome" ? <p className="onboarding-status">{t("import.chrome.permission")}</p> : null;
    return (
      <div className="onboarding-status is-ready" aria-live="polite">
        <span className="onboarding-status__title"><Check size={15} aria-hidden="true" /><strong>{plan.preview.label}</strong></span>
        <span>{t("import.summary", { bookmarks: plan.preview.bookmarks, boards: plan.preview.boards })}</span>
        {plan.preview.bookmarks === 0 ? <em>{t("import.empty")}</em> : null}
        {permissionRemoved ? <span className="onboarding-status__note">{translate(plan.locale, "settings.permissionOnDemand")}</span> : null}
        {plan.source === "chrome" || plan.source === "html" ? (
          <label className="onboarding-switch">
            <span>{t("import.skipDuplicates")}</span>
            <input type="checkbox" role="switch" checked={plan.duplicateStrategy === "skip"} onChange={(event) => patchPlan({ duplicateStrategy: event.target.checked ? "skip" : "allow" })} />
            <i aria-hidden="true" />
          </label>
        ) : null}
      </div>
    );
  };

  if (confirmSkip) {
    return (
      <Modal
        open
        size="small"
        className="onboarding-confirm-modal"
        title={t("skip.title")}
        description={t("skip.body")}
        closeOnBackdrop={false}
        showCloseButton={false}
        onClose={() => setConfirmSkip(false)}
        footer={(
          <>
            <Button onClick={() => setConfirmSkip(false)} disabled={busy}>{t("skip.continue")}</Button>
            <Button variant="danger" onClick={() => void finish(true)} disabled={busy}>{busy ? t("action.finishing") : t("skip.confirm")}</Button>
          </>
        )}
      >
        <div className="onboarding-confirm-icon" aria-hidden="true"><ShieldCheck size={28} /></div>
        {error ? <p className="onboarding-error" role="alert">{error}</p> : null}
      </Modal>
    );
  }

  return (
    <Modal
      open
      size="fullscreen"
      className="onboarding-modal"
      backdropClassName="modal-backdrop--onboarding"
      title={t("welcome.title")}
      description={t("welcome.summary")}
      closeOnBackdrop={false}
      showCloseButton={false}
      headerExtra={<button type="button" className="onboarding-link onboarding-skip" onClick={() => setConfirmSkip(true)}>{t("action.skip")}</button>}
      onClose={() => setConfirmSkip(true)}
      footer={(
        <>
          <p className="onboarding-footnote">{t("import.body")}</p>
          <Button variant="primary" className="onboarding-open" type="submit" form="onboarding-form" disabled={busy || !ready}>
            {busy ? t("action.finishing") : t("action.open")}
          </Button>
        </>
      )}
    >
      <form id="onboarding-form" className="onboarding-grid" onSubmit={submit} aria-busy={busy || parsing}>
        <section className="onboarding-tile" aria-labelledby="onboarding-language-title">
          <header className="onboarding-tile__header"><span className="onboarding-tile__icon" aria-hidden="true"><Languages size={16} /></span><h3 id="onboarding-language-title">{t("welcome.language")}</h3></header>
          <SelectField value={plan.locale} options={languageOptions} onChange={setLocale} label={t("welcome.language")} autoFocus />
          <p className="onboarding-privacy"><ShieldCheck size={16} aria-hidden="true" />{t("welcome.privacy")}</p>
        </section>

        <section className="onboarding-tile" aria-labelledby="onboarding-import-title">
          <header className="onboarding-tile__header"><span className="onboarding-tile__icon" aria-hidden="true"><FolderOpen size={16} /></span><h3 id="onboarding-import-title">{t("step.import")}</h3></header>
          <div className="onboarding-sources" role="radiogroup" aria-labelledby="onboarding-import-title">
            {SOURCE_ORDER.map((source) => {
              const item = sources[source];
              const Icon = item.icon;
              const selected = plan.source === source;
              return (
                <button key={source} type="button" role="radio" aria-checked={selected} className={`onboarding-source ${selected ? "is-selected" : ""}`} disabled={busy} onClick={() => chooseSource(source)}>
                  <span className="onboarding-source__icon" aria-hidden="true"><Icon size={18} /></span>
                  <span className="onboarding-source__text"><strong>{item.title}</strong><small>{item.body}</small></span>
                  {selected ? <span className="onboarding-source__check" aria-hidden="true"><Check size={13} /></span> : null}
                </button>
              );
            })}
          </div>
          {renderImportStatus()}
          <input ref={htmlInputRef} type="file" accept=".html,.htm,text/html" hidden onChange={handleFile("html")} />
          <input ref={backupInputRef} type="file" accept=".json,application/json" hidden onChange={handleFile("backup")} />
        </section>

        <section className="onboarding-tile" aria-labelledby="onboarding-appearance-title">
          <header className="onboarding-tile__header"><span className="onboarding-tile__icon" aria-hidden="true"><Palette size={16} /></span><h3 id="onboarding-appearance-title">{t("step.appearance")}</h3></header>
          <div className="onboarding-preview" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => <span key={index} className="onboarding-preview__board"><i /><i /><i /></span>)}
          </div>
          <div className="onboarding-walls" role="radiogroup" aria-label={wallpaperLabel}>
            <button type="button" role="radio" aria-checked={!plan.theme.wallpaperId} className={!plan.theme.wallpaperId ? "is-selected" : ""} onClick={() => setWallpaper(null)}>
              <span className="onboarding-walls__thumb onboarding-walls__thumb--none" /><span>{translate(plan.locale, "settings.noWallpaper")}</span>
            </button>
            {BUILTIN_WALLPAPERS.map((wallpaper) => (
              <button key={wallpaper.id} type="button" role="radio" aria-checked={plan.theme.wallpaperId === wallpaper.id} className={plan.theme.wallpaperId === wallpaper.id ? "is-selected" : ""} onClick={() => setWallpaper(wallpaper.id)}>
                <span className="onboarding-walls__thumb" style={{ backgroundImage: wallpaper.compatibilityValue } as CSSProperties} /><span>{translate(plan.locale, wallpaper.labelKey)}</span>
              </button>
            ))}
          </div>
          <div className="onboarding-row">
            <span>{themeLabel}</span>
            <div className="segmented" role="group" aria-label={themeLabel}>
              {(["light", "dark", "system"] as const).map((mode) => (
                <button key={mode} type="button" aria-pressed={plan.theme.mode === mode} className={plan.theme.mode === mode ? "is-active" : ""} onClick={() => setThemeMode(mode)}>
                  {mode === "light" ? <Sun size={13} aria-hidden="true" /> : mode === "dark" ? <Moon size={13} aria-hidden="true" /> : null}
                  {translate(plan.locale, mode === "system" ? "settings.auto" : mode === "light" ? "settings.light" : "settings.dark")}
                </button>
              ))}
            </div>
          </div>
          <div className="onboarding-row">
            <span>{t("appearance.density")}</span>
            <div className="segmented" role="group" aria-label={t("appearance.density")}>
              {(["compact", "comfortable", "spacious"] as const).map((density) => (
                <button key={density} type="button" aria-pressed={plan.theme.density === density} className={plan.theme.density === density ? "is-active" : ""} onClick={() => setDensity(density)}>
                  {t(`appearance.${density}`)}
                </button>
              ))}
            </div>
          </div>
        </section>
        <div className="onboarding-announcer" aria-live="polite" aria-atomic="true">{parsing ? t("import.parsing") : error ?? ""}</div>
      </form>
      {error ? <p className="onboarding-error" role="alert">{error}</p> : null}
    </Modal>
  );
}
