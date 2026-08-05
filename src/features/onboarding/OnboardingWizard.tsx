import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  Bookmark,
  Check,
  ChevronRight,
  Chrome,
  FileJson,
  FileText,
  FolderOpen,
  LayoutGrid,
  Palette,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { LocalePreference, ThemeMode, ThemePresetId, WorkspaceData } from "../../domain/models";
import { IMPORT_LIMITS } from "../../domain/importLimits";
import { getThemePreset, THEME_PRESETS, validateTheme } from "../../domain/themes";
import { Button } from "../../components/Button";
import { LocaleFlag } from "../../components/LocaleFlag";
import { Modal } from "../../components/Modal";
import { SelectField, type SelectOption } from "../../components/SelectField";
import { localeOptions, translate } from "../../i18n";
import { parseBackupOffThread, parseHtmlOffThread } from "../../services/importWorker";
import { publishThemePreview } from "../appearance/themePreview";
import { BUILTIN_WALLPAPERS } from "../appearance/themeRuntime";
import { commitOnboardingPlan } from "./onboardingCommit";
import { onboardingText } from "./onboardingMessages";
import { readChromeBookmarks } from "./chromeBookmarkImport";
import {
  ONBOARDING_STEPS,
  backupPreview,
  canContinue,
  greetingPeriod,
  nextStep,
  previousStep,
  recordPreview,
  stepIndex,
  type OnboardingPlan,
  type OnboardingSource,
  type OnboardingStep,
} from "./onboardingState";

interface OnboardingWizardProps {
  workspace: WorkspaceData;
  onCompleted?: () => void;
}

const SOURCE_ICONS = {
  default: Sparkles,
  chrome: Chrome,
  html: FileText,
  backup: FileJson,
} as const;

export function OnboardingWizard({ workspace, onCompleted }: OnboardingWizardProps) {
  const initialLocale = workspace.settings.locale;
  const [step, setStep] = useState<OnboardingStep>("welcome");
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

  const t = (key: Parameters<typeof onboardingText>[1], params?: Record<string, string | number>): string =>
    onboardingText(plan.locale, key, params);

  const languageOptions = useMemo<ReadonlyArray<SelectOption>>(() => localeOptions.map((option) => ({
    value: option.value,
    label: option.label,
    icon: <LocaleFlag locale={option.value} />,
  })), []);

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

  const setPreset = (preset: ThemePresetId): void => {
    const selected = getThemePreset(preset);
    patchPlan({
      theme: validateTheme({
        ...selected,
        mode: plan.theme.mode,
        density: plan.theme.density,
        performanceMode: plan.theme.performanceMode,
        motion: plan.theme.motion,
      }),
    });
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

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (step === "review") {
      void finish(false);
      return;
    }
    if (canContinue(step, plan, parsing)) setStep(nextStep(step));
  };

  const finish = async (skip: boolean): Promise<void> => {
    if (finishGuardRef.current || busy) return;
    finishGuardRef.current = true;
    setBusy(true);
    setError(null);
    const finalPlan = skip ? {
      ...plan,
      locale: workspace.settings.locale,
      source: "default" as const,
      records: [],
      backup: null,
      preview: null,
      theme: workspace.settings.theme,
      workspaceLayoutMode: workspace.settings.workspaceLayoutMode,
      workspaceRows: workspace.settings.workspaceRows,
    } : plan;
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

  const handleStepKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "ArrowLeft" && event.altKey && stepIndex(step) > 0 && !busy) {
      event.preventDefault();
      setStep(previousStep(step));
    }
  };

  const sourceCards: Array<{ source: OnboardingSource; title: string; body: string }> = [
    { source: "default", title: t("import.default.title"), body: t("import.default.body") },
    { source: "chrome", title: t("import.chrome.title"), body: t("import.chrome.body") },
    { source: "html", title: t("import.html.title"), body: t("import.html.body") },
    { source: "backup", title: t("import.backup.title"), body: t("import.backup.body") },
  ];

  const renderWelcome = () => {
    const greeting = t(`greeting.${greetingPeriod(new Date().getHours())}` as Parameters<typeof onboardingText>[1]);
    return <section className="onboarding-step onboarding-welcome" aria-labelledby="onboarding-welcome-title">
      <div className="onboarding-hero-icon" aria-hidden="true"><Sparkles size={28} /></div>
      <p className="onboarding-eyebrow">{greeting}</p>
      <h3 id="onboarding-welcome-title">{t("welcome.title")}</h3>
      <p className="onboarding-lead">{t("welcome.body")}</p>
      <div className="onboarding-privacy"><ShieldCheck size={18} aria-hidden="true" /><span>{t("welcome.privacy")}</span></div>
      <label className="onboarding-field">
        <span>{t("welcome.language")}</span>
        <SelectField value={plan.locale} options={languageOptions} onChange={setLocale} label={t("welcome.language")} autoFocus />
      </label>
    </section>;
  };

  const renderImport = () => <section className="onboarding-step" aria-labelledby="onboarding-import-title">
    <div className="onboarding-section-heading">
      <div className="onboarding-heading-icon" aria-hidden="true"><FolderOpen size={20} /></div>
      <div><h3 id="onboarding-import-title">{t("import.title")}</h3><p>{t("import.body")}</p></div>
    </div>
    <div className="onboarding-source-grid" role="radiogroup" aria-label={t("import.title")}>
      {sourceCards.map((item) => {
        const Icon = SOURCE_ICONS[item.source];
        const selected = plan.source === item.source;
        return <button
          key={item.source}
          type="button"
          role="radio"
          aria-checked={selected}
          className={`onboarding-source-card ${selected ? "is-selected" : ""}`}
          onClick={() => selectSource(item.source)}
        >
          <span className="onboarding-source-icon" aria-hidden="true"><Icon size={20} /></span>
          <span><strong>{item.title}</strong><small>{item.body}</small></span>
          {selected ? <Check className="onboarding-source-check" size={17} aria-hidden="true" /> : null}
        </button>;
      })}
    </div>
    {plan.source === "chrome" ? <div className="onboarding-source-action">
      <p>{t("import.chrome.permission")}</p>
      <Button variant="primary" onClick={() => void loadChrome()} disabled={parsing}>{chromeDenied ? t("action.retry") : t("import.chrome.title")}</Button>
      {chromeDenied ? <p className="onboarding-warning" role="status">{t("import.chrome.denied")}</p> : null}
      {permissionRemoved ? <p className="onboarding-note" role="status">{translate(plan.locale, "settings.permissionOnDemand")}</p> : null}
    </div> : null}
    {plan.source === "html" ? <div className="onboarding-source-action">
      <Button variant="primary" onClick={() => htmlInputRef.current?.click()} disabled={parsing}>{t("import.html.title")}</Button>
      <input ref={htmlInputRef} type="file" accept=".html,.htm,text/html" hidden onChange={handleFile("html")} />
    </div> : null}
    {plan.source === "backup" ? <div className="onboarding-source-action">
      <Button variant="primary" onClick={() => backupInputRef.current?.click()} disabled={parsing}>{t("import.backup.title")}</Button>
      <input ref={backupInputRef} type="file" accept=".json,application/json" hidden onChange={handleFile("backup")} />
    </div> : null}
    {parsing ? <div className="onboarding-busy" role="status" aria-live="polite">{t("import.parsing")}</div> : null}
    {plan.preview ? <div className="onboarding-preview" aria-live="polite">
      <strong>{plan.preview.label}</strong>
      <span>{t("import.preview", plan.preview)}</span>
      {plan.preview.bookmarks === 0 ? <em>{t("import.empty")}</em> : null}
      {(plan.source === "chrome" || plan.source === "html") ? <div className="onboarding-inline-choice">
        <span>{t("review.duplicates")}</span>
        <div role="group" aria-label={t("review.duplicates")}>
          {(["skip", "allow"] as const).map((value) => <button key={value} type="button" aria-pressed={plan.duplicateStrategy === value} onClick={() => patchPlan({ duplicateStrategy: value })}>{translate(plan.locale, value === "skip" ? "settings.skip" : "settings.allow")}</button>)}
        </div>
      </div> : null}
    </div> : null}
  </section>;

  const renderAppearance = () => <section className="onboarding-step" aria-labelledby="onboarding-appearance-title">
    <div className="onboarding-section-heading">
      <div className="onboarding-heading-icon" aria-hidden="true"><Palette size={20} /></div>
      <div><h3 id="onboarding-appearance-title">{t("appearance.title")}</h3><p>{t("appearance.body")}</p></div>
    </div>
    <div className="onboarding-setting-group">
      <span>{translate(plan.locale, "settings.themeMode")}</span>
      <div className="onboarding-segmented" role="group" aria-label={translate(plan.locale, "settings.themeMode")}>
        {(["system", "light", "dark"] as const).map((mode) => <button key={mode} type="button" aria-pressed={plan.theme.mode === mode} onClick={() => setThemeMode(mode)}>{translate(plan.locale, mode === "system" ? "settings.auto" : mode === "light" ? "settings.light" : "settings.dark")}</button>)}
      </div>
    </div>
    <div className="onboarding-setting-group">
      <span>{t("appearance.preset")}</span>
      <div className="onboarding-preset-grid" role="radiogroup" aria-label={t("appearance.preset")}>
        {THEME_PRESETS.map((preset) => <button key={preset.id} type="button" role="radio" aria-checked={plan.theme.preset === preset.id} className={plan.theme.preset === preset.id ? "is-selected" : ""} onClick={() => setPreset(preset.id)}><span style={{ background: preset.config.canvas }} /><strong>{preset.name}</strong></button>)}
      </div>
    </div>
    <div className="onboarding-setting-grid">
      <div className="onboarding-setting-group">
        <span>{t("appearance.density")}</span>
        <div className="onboarding-segmented" role="group" aria-label={t("appearance.density")}>
          {(["compact", "comfortable", "spacious"] as const).map((density) => <button key={density} type="button" aria-pressed={plan.theme.density === density} onClick={() => patchPlan({ theme: validateTheme({ ...plan.theme, density }) })}>{t(`appearance.${density}` as Parameters<typeof onboardingText>[1])}</button>)}
        </div>
      </div>
      <div className="onboarding-setting-group">
        <span>{t("appearance.rows")}</span>
        <div className="onboarding-segmented" role="group" aria-label={t("appearance.rows")}>
          {([1, 2] as const).map((rows) => <button key={rows} type="button" aria-pressed={plan.workspaceRows === rows} onClick={() => patchPlan({ workspaceRows: rows })}>{translate(plan.locale, rows === 1 ? "settings.oneRow" : "settings.twoRows")}</button>)}
        </div>
      </div>
    </div>
    <div className="onboarding-setting-group">
      <span>{translate(plan.locale, "settings.backgroundWallpaper")}</span>
      <div className="onboarding-wallpaper-row" role="radiogroup" aria-label={translate(plan.locale, "settings.backgroundWallpaper")}>
        <button type="button" role="radio" aria-checked={!plan.theme.wallpaperId} className={!plan.theme.wallpaperId ? "is-selected" : ""} onClick={() => setWallpaper(null)}>{translate(plan.locale, "settings.noWallpaper")}</button>
        {BUILTIN_WALLPAPERS.map((wallpaper) => <button key={wallpaper.id} type="button" role="radio" aria-checked={plan.theme.wallpaperId === wallpaper.id} className={plan.theme.wallpaperId === wallpaper.id ? "is-selected" : ""} onClick={() => setWallpaper(wallpaper.id)}>{translate(plan.locale, wallpaper.labelKey)}</button>)}
      </div>
    </div>
  </section>;

  const sourceTitle = sourceCards.find((item) => item.source === plan.source)?.title ?? t("import.default.title");
  const localeTitle = localeOptions.find((item) => item.value === plan.locale)?.label ?? plan.locale;
  const renderReview = () => <section className="onboarding-step" aria-labelledby="onboarding-review-title">
    <div className="onboarding-section-heading">
      <div className="onboarding-heading-icon" aria-hidden="true"><LayoutGrid size={20} /></div>
      <div><h3 id="onboarding-review-title">{t("review.title")}</h3><p>{t("review.body")}</p></div>
    </div>
    <dl className="onboarding-summary">
      <div><dt>{t("review.language")}</dt><dd><LocaleFlag locale={plan.locale} />{localeTitle}</dd></div>
      <div><dt>{t("review.source")}</dt><dd>{sourceTitle}{plan.preview ? <small>{t("import.preview", plan.preview)}</small> : null}</dd></div>
      <div><dt>{t("review.theme")}</dt><dd>{THEME_PRESETS.find((preset) => preset.id === plan.theme.preset)?.name ?? plan.theme.preset}<small>{plan.theme.mode} · {t(`appearance.${plan.theme.density}` as Parameters<typeof onboardingText>[1])}</small></dd></div>
      <div><dt>{t("review.layout")}</dt><dd>{translate(plan.locale, plan.workspaceRows === 1 ? "settings.oneRow" : "settings.twoRows")}</dd></div>
      <div><dt>{t("review.duplicates")}</dt><dd>{translate(plan.locale, plan.duplicateStrategy === "skip" ? "settings.skip" : "settings.allow")}</dd></div>
    </dl>
  </section>;

  const currentBody = step === "welcome" ? renderWelcome() : step === "import" ? renderImport() : step === "appearance" ? renderAppearance() : renderReview();
  const currentTitle = t(`step.${step}` as Parameters<typeof onboardingText>[1]);

  if (confirmSkip) {
    return <Modal
      open
      size="small"
      className="onboarding-modal onboarding-confirm-modal"
      title={t("skip.title")}
      description={t("skip.body")}
      closeOnBackdrop={false}
      showCloseButton={false}
      onClose={() => setConfirmSkip(false)}
      footer={<>
        <Button onClick={() => setConfirmSkip(false)} disabled={busy}>{t("skip.continue")}</Button>
        <Button variant="danger" onClick={() => void finish(true)} disabled={busy}>{busy ? t("action.finishing") : t("skip.confirm")}</Button>
      </>}
    >
      <div className="onboarding-confirm-icon" aria-hidden="true"><ShieldCheck size={28} /></div>
      {error ? <p className="onboarding-error" role="alert">{error}</p> : null}
    </Modal>;
  }

  return <Modal
    open
    size="large"
    className="onboarding-modal"
    title={currentTitle}
    description={`${stepIndex(step) + 1} / ${ONBOARDING_STEPS.length}`}
    closeOnBackdrop={false}
    onClose={() => setConfirmSkip(true)}
    footer={<div className="onboarding-footer-content">
      <Button variant="ghost" onClick={() => setConfirmSkip(true)} disabled={busy}>{t("action.skip")}</Button>
      <div className="onboarding-footer-actions">
        {stepIndex(step) > 0 ? <Button onClick={() => setStep(previousStep(step))} disabled={busy || parsing}>{t("action.back")}</Button> : null}
        <Button variant="primary" type="submit" form="onboarding-form" disabled={busy || !canContinue(step, plan, parsing)}>{busy ? t("action.finishing") : step === "review" ? t("action.finish") : t("action.continue")}<ChevronRight size={15} aria-hidden="true" /></Button>
      </div>
    </div>}
  >
    <div className="onboarding-progress" aria-label={currentTitle}>
      {ONBOARDING_STEPS.map((item, index) => <span key={item} className={index <= stepIndex(step) ? "is-active" : ""}><i />{t(`step.${item}` as Parameters<typeof onboardingText>[1])}</span>)}
    </div>
    <form id="onboarding-form" onSubmit={submit} aria-busy={busy || parsing}>
      <div onKeyDown={handleStepKeyDown}>{currentBody}</div>
      <div className="onboarding-announcer" aria-live="polite" aria-atomic="true">{parsing ? t("import.parsing") : error ?? ""}</div>
      {error ? <p className="onboarding-error" role="alert">{error}</p> : null}
    </form>
  </Modal>;
}
