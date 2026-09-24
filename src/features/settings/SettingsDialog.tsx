import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { readSessionPrivacy, writeSessionPrivacy } from "../../browser/privacySession";
import { IMPORT_LIMITS } from "../../domain/importLimits";
import { WALLPAPER_FILE_ACCEPT } from "../../domain/wallpaperFormats";
import { AlignCenter, AlignLeft, AlignRight, Brush, Check, CheckCircle2, Database, Download, FileJson, FileText, Gauge, Grid2X2, ImageIcon, Languages, Moon, RotateCcw, Search, Sparkles, Sun, Trash2, TriangleAlert, Upload, Wind } from "lucide-react";
import type { AppSettings, ThemeConfig, Wallpaper, WorkspaceData } from "../../domain/models";
import { validateTheme } from "../../domain/themes";
import { auditInvariants, getWallpaper, saveWallpaper, updateSettings } from "../../db/repository";
import { createDefaultSettings } from "../../db/defaults";
import {
  createBackup,
  CURRENT_BACKUP_FORMAT_VERSION,
  downloadText,
  importRecords,
  restoreBackup,
  serializeBackup,
  toMarkdown,
  toNetscapeHtml,
  type AsterfoldBackup,
  type ImportRecord,
} from "../../services/exportImport";
import { parseBackupOffThread, parseHtmlOffThread } from "../../services/importWorker";
import { Button } from "../../components/Button";
import { LocaleFlag } from "../../components/LocaleFlag";
import { Modal } from "../../components/Modal";
import { SelectField, type SelectOption } from "../../components/SelectField";
import { localeOptions, useI18n } from "../../i18n";
import { publishThemePreview } from "../appearance/themePreview";
import { ACCENT_SWATCHES, accentFromImageBlob } from "../appearance/accent";
import { BUILTIN_WALLPAPERS, isDarkTheme } from "../appearance/themeRuntime";
import { browserPerformanceSignals, classifyPerformanceMode, recommendPerformanceProfile } from "../performance/performanceProfile";
import { readChromeBookmarks } from "../onboarding/chromeBookmarkImport";
import { GradientEditor } from "./GradientEditor";
import "./settings.css";

export type SettingsSection = "appearance" | "layout" | "language" | "data-privacy";

type TileId = "background" | "glass" | "theme" | "layout" | "performance" | "motion" | "data" | "language" | "diagnostics";

const SECTION_TILE: Record<SettingsSection, TileId> = {
  appearance: "background",
  layout: "layout",
  language: "language",
  "data-privacy": "data",
};

const TIER_BARS: Record<string, number> = { quality: 3, balanced: 2, compatibility: 1, software: 0 };

interface SettingsDialogProps {
  open: boolean;
  initialSection?: SettingsSection;
  workspace: WorkspaceData;
  onClose: () => void;
  onUpdated: (message: string) => void;
  onError: (message: string) => void;
  onOpenTrash: () => void;
}

function formatBytes(value: number | undefined): string {
  if (value === undefined) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

export function SettingsDialog(props: SettingsDialogProps) {
  const { t } = useI18n();
  const settings = props.workspace.settings;
  const [filter, setFilter] = useState("");
  const [attention, setAttention] = useState<TileId | null>(null);
  const [storage, setStorage] = useState<StorageEstimate>();
  const [wallpaperInfo, setWallpaperInfo] = useState<Wallpaper | null>(null);
  const [themeDraft, setThemeDraft] = useState(settings.theme);
  const [invariants, setInvariants] = useState<string[]>([]);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [importRecordsPreview, setImportRecordsPreview] = useState<ImportRecord[]>([]);
  const [backupPreview, setBackupPreview] = useState<AsterfoldBackup | null>(null);
  const [importSource, setImportSource] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importParsing, setImportParsing] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "allow">("skip");
  const [importPageTitle, setImportPageTitle] = useState(t("settings.importedBookmarks"));
  const importInputRef = useRef<HTMLInputElement>(null);
  const importParseControllerRef = useRef<AbortController | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const themeCommitRef = useRef<number | null>(null);
  const pendingThemeRef = useRef<ThemeConfig | null>(null);
  const themeDirtyRef = useRef(false);
  const performanceSignals = useMemo(() => browserPerformanceSignals(), []);
  const resolvedPerformanceMode = useMemo(() => classifyPerformanceMode(themeDraft.performanceMode, themeDraft.lowPowerMode, performanceSignals), [performanceSignals, themeDraft.lowPowerMode, themeDraft.performanceMode]);
  const recommendation = useMemo(() => recommendPerformanceProfile(performanceSignals), [performanceSignals]);
  const expensiveEffectsDisabled = resolvedPerformanceMode === "compatibility" || resolvedPerformanceMode === "software";
  const resolvedPerformanceLabel = t(resolvedPerformanceMode === "quality"
    ? "settings.performanceQuality"
    : resolvedPerformanceMode === "balanced"
      ? "settings.performanceBalanced"
      : resolvedPerformanceMode === "software"
        ? "settings.performanceSoftware"
        : "settings.performanceCompatibility");
  const recommendationModeLabel = t(recommendation.recommendedMode === "quality"
    ? "settings.performanceQuality"
    : recommendation.recommendedMode === "balanced"
      ? "settings.performanceBalanced"
      : recommendation.recommendedMode === "software"
        ? "settings.performanceSoftware"
        : "settings.performanceCompatibility");
  const recommendationReasonLabel = t(recommendation.reason === "software"
    ? "settings.performanceReasonSoftware"
    : recommendation.reason === "legacyGpu"
      ? "settings.performanceReasonLegacyGpu"
      : recommendation.reason === "reducedTransparency"
        ? "settings.performanceReasonReducedTransparency"
        : recommendation.reason === "constrainedHardware"
          ? "settings.performanceReasonConstrainedHardware"
          : "settings.performanceReasonHardwareAccelerated");
  const counts = useMemo(() => ({ pages: props.workspace.pages.length, boards: props.workspace.boards.length, bookmarks: props.workspace.bookmarks.length }), [props.workspace]);
  const duplicateOptions = useMemo<ReadonlyArray<SelectOption>>(() => [
    { value: "skip", label: t("settings.skip") },
    { value: "allow", label: t("settings.allow") },
  ], [t]);
  const retentionOptions = useMemo<ReadonlyArray<SelectOption>>(() => [
    { value: "7", label: t("settings.days", { count: 7 }) },
    { value: "30", label: t("settings.days", { count: 30 }) },
    { value: "90", label: t("settings.days", { count: 90 }) },
    { value: "never", label: t("settings.never") },
  ], [t]);
  const languageOptions = useMemo<ReadonlyArray<SelectOption>>(() => localeOptions.map((item) => ({
    value: item.value,
    label: item.value === "auto" ? t("settings.languageAuto") : item.label,
    icon: <span className="settings-flag" aria-hidden="true"><LocaleFlag locale={item.value} /></span>,
  })), [t]);

  useEffect(() => {
    if (!props.open) return;
    setFilter("");
    const target = props.initialSection && props.initialSection !== "appearance" ? SECTION_TILE[props.initialSection] : null;
    setAttention(target);
    let attentionTimer: number | undefined;
    if (target) {
      window.requestAnimationFrame?.(() => document.getElementById(`settings-tile-${target}`)?.scrollIntoView?.({ block: "center" }));
      attentionTimer = window.setTimeout(() => setAttention(null), 1600);
    }
    setImportPageTitle(t("settings.importedBookmarks"));
    themeDirtyRef.current = false;
    pendingThemeRef.current = null;
    if (navigator.storage?.estimate) void navigator.storage.estimate().then(setStorage).catch(() => setStorage(undefined));
    void auditInvariants().then(setInvariants).catch(() => setInvariants([]));
    return () => { if (attentionTimer !== undefined) window.clearTimeout(attentionTimer); };
  }, [props.initialSection, props.open, t]);
  useEffect(() => {
    if (!props.open || !themeDraft.wallpaperId) { setWallpaperInfo(null); return; }
    void getWallpaper(themeDraft.wallpaperId).then(setWallpaperInfo).catch(() => setWallpaperInfo(null));
  }, [props.open, themeDraft.wallpaperId]);
  useEffect(() => {
    setThemeDraft(settings.theme);
  }, [settings.theme]);
  useEffect(() => () => {
    if (themeCommitRef.current !== null) window.clearTimeout(themeCommitRef.current);
    importParseControllerRef.current?.abort();
  }, []);

  const patchSettings = async (patch: Partial<Omit<AppSettings, "id" | "schemaVersion">>, message = t("generic.save")): Promise<void> => {
    try {
      await updateSettings(patch);
      props.onUpdated(message);
    } catch {
      props.onError(t("error.updateSettings"));
    }
  };
  const setPrivacyPersistence = async (enabled: boolean): Promise<void> => {
    try {
      if (enabled) {
        const sessionEnabled = await readSessionPrivacy();
        await updateSettings({ privacyPersist: true, privacyEnabled: sessionEnabled });
      } else {
        await writeSessionPrivacy(settings.privacyEnabled);
        await updateSettings({ privacyPersist: false, privacyEnabled: false });
      }
      props.onUpdated(t("generic.save"));
    } catch {
      props.onError(t("error.updateSettings"));
    }
  };
  const patchTheme = (patch: Partial<ThemeConfig>): void => {
    const next = validateTheme({ ...themeDraft, ...patch });
    setThemeDraft(next);
    publishThemePreview(next);
    themeDirtyRef.current = true;
    pendingThemeRef.current = next;
    if (themeCommitRef.current !== null) window.clearTimeout(themeCommitRef.current);
    themeCommitRef.current = window.setTimeout(() => {
      themeCommitRef.current = null;
      void updateSettings({ theme: next }).then(() => {
        if (pendingThemeRef.current === next) {
          pendingThemeRef.current = null;
          themeDirtyRef.current = false;
        }
      }).catch(() => props.onError(t("error.updateSettings")));
    }, 200);
  };
  const closeSettings = (): void => {
    importParseControllerRef.current?.abort();
    importParseControllerRef.current = null;
    setImportParsing(false);
    if (themeCommitRef.current !== null) window.clearTimeout(themeCommitRef.current);
    themeCommitRef.current = null;
    const shouldCommitTheme = themeDirtyRef.current || pendingThemeRef.current !== null;
    const finalTheme = themeDraft;
    pendingThemeRef.current = null;
    themeDirtyRef.current = false;
    props.onClose();
    if (shouldCommitTheme) {
      void updateSettings({ theme: finalTheme }).catch(() => props.onError(t("error.updateSettings"))).finally(() => publishThemePreview(null));
    } else {
      publishThemePreview(null);
    }
  };
  const exportAll = async (format: "json" | "html" | "markdown"): Promise<void> => {
    try {
      const backup = await createBackup();
      if (format === "json") downloadText(`asterfold-backup-v${CURRENT_BACKUP_FORMAT_VERSION}-${new Date().toISOString().slice(0, 10)}.json`, serializeBackup(backup), "application/json");
      if (format === "html") downloadText("asterfold-bookmarks.html", toNetscapeHtml(backup), "text/html");
      if (format === "markdown") downloadText("asterfold-bookmarks.md", toMarkdown(backup), "text/markdown");
      props.onUpdated(t("settings.exported", { format: format.toUpperCase() }));
    } catch {
      props.onError(t("error.exportFailed"));
    }
  };
  const readImportFile = async (file: File): Promise<void> => {
    if (file.size > IMPORT_LIMITS.fileBytes) { props.onError(t("error.importTooLarge")); return; }
    importParseControllerRef.current?.abort();
    const controller = new AbortController();
    importParseControllerRef.current = controller;
    setImportParsing(true);
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        setBackupPreview(await parseBackupOffThread(text, controller.signal));
        setImportRecordsPreview([]);
      } else {
        setImportRecordsPreview(await parseHtmlOffThread(text, controller.signal));
        setBackupPreview(null);
      }
      setImportSource(file.name);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) props.onError(t("error.importPreviewFailed"));
    } finally {
      if (importParseControllerRef.current === controller) {
        importParseControllerRef.current = null;
        setImportParsing(false);
      }
    }
  };
  const cancelImportParsing = (): void => {
    importParseControllerRef.current?.abort();
    importParseControllerRef.current = null;
    setImportParsing(false);
  };

  const requestChromeImport = async (): Promise<void> => {
    try {
      const result = await readChromeBookmarks(true);
      if (result.status !== "granted") return;
      setImportRecordsPreview(result.records);
      setBackupPreview(null);
      setImportSource(t("settings.chromeBookmarks"));
    } catch {
      props.onError(t("error.chromeBookmarksUnavailable"));
    }
  };
  const commitRecordImport = async (): Promise<void> => {
    setImportBusy(true);
    try {
      const isChrome = importSource === t("settings.chromeBookmarks") || (importRecordsPreview.length > 0 && importRecordsPreview.every((r) => r.source === "chrome"));
      const destination = isChrome
        ? { pageTitle: importPageTitle, source: "chrome" as const, sourceId: "chrome" }
        : { pageTitle: importPageTitle };
      const summary = await importRecords(importRecordsPreview, destination, duplicateStrategy);
      props.onUpdated(t("settings.imported", { count: summary.imported }));
      setImportRecordsPreview([]);
      setImportSource("");
      closeSettings();
    } catch { props.onError(t("error.importFailed")); }
    finally { setImportBusy(false); }
  };
  const commitBackupRestore = async (strategy: "merge" | "replace"): Promise<void> => {
    if (!backupPreview) return;
    if (strategy === "replace" && backupPreview.scope !== "full") { props.onError(t("error.restoreFailed")); return; }
    if (strategy === "replace" && !window.confirm(t("settings.restoreConfirmation"))) return;
    setImportBusy(true);
    try {
      await restoreBackup(backupPreview, strategy);
      props.onUpdated(t("settings.backupRestored"));
      setBackupPreview(null);
      setImportSource("");
    } catch { props.onError(t("error.restoreFailed")); }
    finally { setImportBusy(false); }
  };
  const saveUploadedWallpaper = async (file: File): Promise<void> => {
    try {
      const wallpaper = await saveWallpaper(file, file.name);
      // The accent of an uploaded image is measured once here; builtins and gradients are resolved at runtime.
      const accent = themeDraft.accentMode === "custom" ? null : await accentFromImageBlob(wallpaper.thumbnail ?? file);
      patchTheme({ wallpaperId: wallpaper.id, backgroundMode: "wallpaper", ...(accent ? { accent } : {}) });
    } catch { props.onError(t("error.wallpaperSaveFailed")); }
  };
  const repeatDiagnostics = async (): Promise<void> => {
    if (diagnosticsBusy) return;
    setDiagnosticsBusy(true);
    try {
      const issues = await auditInvariants();
      setInvariants(issues);
      props.onUpdated(t("settings.diagnosticsRepeated"));
    } catch {
      props.onError(t("error.actionFailed"));
    } finally {
      setDiagnosticsBusy(false);
    }
  };
  const restartOnboarding = async (): Promise<void> => {
    try {
      await updateSettings({ onboardingComplete: false });
      closeSettings();
      props.onUpdated(t("settings.rerunOnboarding"));
    } catch {
      props.onError(t("error.updateSettings"));
    }
  };
  const resetDefaults = async (): Promise<void> => {
    if (!window.confirm(t("settings.resetDefaultsConfirm"))) return;
    try {
      const defaults = createDefaultSettings();
      await updateSettings({
        workspaceLayoutMode: defaults.workspaceLayoutMode,
        workspaceRows: defaults.workspaceRows,
        workspaceAlignment: defaults.workspaceAlignment,
        theme: defaults.theme,
        quickSaveMode: defaults.quickSaveMode,
        duplicateStrategy: defaults.duplicateStrategy,
        trashRetentionDays: defaults.trashRetentionDays,
      });
      setThemeDraft(defaults.theme);
      publishThemePreview(null);
      props.onUpdated(t("settings.resetDefaultsSuccess"));
    } catch {
      props.onError(t("error.updateSettings"));
    }
  };


  const expensiveHint = expensiveEffectsDisabled ? t("settings.glassUnavailable") : undefined;
  const followsBackground = themeDraft.accentMode !== "custom";
  const performanceOptions = [
    { value: "auto", label: t("settings.performanceAuto"), hint: t("settings.tierAutoHint") },
    { value: "quality", label: t("settings.performanceQuality"), hint: t("settings.tierQualityHint") },
    { value: "balanced", label: t("settings.performanceBalanced"), hint: t("settings.tierBalancedHint") },
    { value: "compatibility", label: t("settings.performanceCompatibility"), hint: t("settings.tierSmoothHint") },
    { value: "software", label: t("settings.performanceSoftware"), hint: t("settings.tierSoftwareHint") },
    ...(themeDraft.performanceMode === "custom" ? [{ value: "custom", label: t("settings.performanceCustom"), hint: t("settings.performanceReasonReducedTransparency") }] : []),
  ];

  const tiles: Array<{ id: TileId; title: string; icon: ReactNode; span: "wide" | "half" | "third" | "narrow"; keywords: string[]; body: ReactNode }> = [
    {
      id: "background", title: t("settings.background"), icon: <ImageIcon size={16} />, span: "wide",
      keywords: [t("settings.appearance"), t("settings.backgroundWallpaper"), t("settings.backgroundGradient"), t("settings.backgroundSolid"), t("settings.backgroundAuto"), t("settings.wallpaperDim"), t("settings.wallpaperBlur"), t("settings.wallpaperSaturation"), t("settings.uploadWallpaper"), ...BUILTIN_WALLPAPERS.map((item) => t(item.labelKey))],
      body: <>
        <div className="settings-preview" aria-hidden="true">
          <div className="settings-preview__boards">{[0, 1, 2, 3].map((index) => <span key={index} className="settings-preview__board"><i /><i /><i /></span>)}</div>
          <span className="settings-preview__tag"><i />{t("settings.preview")}</span>
        </div>
        <Segmented
          label={t("settings.background")}
          value={themeDraft.backgroundMode}
          items={[
            { value: "auto", label: t("settings.backgroundAuto") },
            { value: "solid", label: t("settings.backgroundSolid") },
            { value: "gradient", label: t("settings.backgroundGradient") },
            { value: "wallpaper", label: t("settings.backgroundWallpaper") },
          ]}
          onChange={(value) => patchTheme({ backgroundMode: value as ThemeConfig["backgroundMode"] })}
        />
        {themeDraft.backgroundMode === "solid" ? <label className="settings-inline"><span>{t("settings.solidColor")}</span><input type="color" value={themeDraft.canvas} onChange={(event) => patchTheme({ canvas: event.target.value })} /></label> : null}
        {themeDraft.backgroundMode === "gradient" ? <GradientEditor gradient={themeDraft.gradient} dark={isDarkTheme(themeDraft)} onChange={(gradient) => patchTheme({ gradient, backgroundMode: "gradient" })} /> : null}
        {themeDraft.backgroundMode === "wallpaper" || themeDraft.backgroundMode === "auto" ? <div className="settings-walls">
          <button type="button" aria-pressed={!themeDraft.wallpaperId} className={!themeDraft.wallpaperId ? "is-active" : ""} onClick={() => patchTheme({ wallpaperId: null, backgroundMode: "auto" })}><span className="settings-walls__thumb settings-walls__thumb--none" /><span className="settings-walls__name">{t("settings.noWallpaper")}</span></button>
          {BUILTIN_WALLPAPERS.map((item) => <button type="button" key={item.id} aria-pressed={themeDraft.wallpaperId === item.id} className={themeDraft.wallpaperId === item.id ? "is-active" : ""} onClick={() => patchTheme({ wallpaperId: item.id, backgroundMode: "wallpaper" })}><span className="settings-walls__thumb" style={{ backgroundImage: item.compatibilityValue }} /><span className="settings-walls__name">{t(item.labelKey)}</span></button>)}
          <button type="button" onClick={() => wallpaperInputRef.current?.click()}><span className="settings-walls__thumb settings-walls__thumb--upload"><Upload size={18} /></span><span className="settings-walls__name">{t("settings.uploadWallpaper")}</span></button>
        </div> : null}
        {wallpaperInfo?.width && wallpaperInfo.height && themeDraft.backgroundMode === "wallpaper" ? <p className="settings-note">{wallpaperInfo.width} × {wallpaperInfo.height} · {formatBytes(wallpaperInfo.storedBytes)}</p> : null}
        {themeDraft.backgroundMode === "wallpaper" || themeDraft.backgroundMode === "gradient" ? <div className="settings-ranges">
          <Range label={t("settings.wallpaperDim")} min={0} max={80} value={Math.round(themeDraft.wallpaperDim * 100)} suffix="%" onChange={(value) => patchTheme({ wallpaperDim: value / 100 })} />
          {themeDraft.backgroundMode === "wallpaper" ? <>
            <Range disabled={expensiveEffectsDisabled} title={expensiveHint} label={t("settings.wallpaperBlur")} min={0} max={20} value={themeDraft.wallpaperBlur} suffix="px" onChange={(value) => patchTheme({ wallpaperBlur: value })} />
            <Range disabled={expensiveEffectsDisabled} title={expensiveHint} label={t("settings.wallpaperSaturation")} min={0} max={180} value={Math.round(themeDraft.wallpaperSaturation * 100)} suffix="%" onChange={(value) => patchTheme({ wallpaperSaturation: value / 100 })} />
          </> : null}
        </div> : null}
        <input ref={wallpaperInputRef} hidden type="file" accept={WALLPAPER_FILE_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; if (file) void saveUploadedWallpaper(file); event.currentTarget.value = ""; }} />
      </>,
    },
    {
      id: "glass", title: t("settings.glass"), icon: <Wind size={16} />, span: "narrow",
      keywords: [t("settings.glassStyle"), t("settings.transparency"), t("settings.blur"), t("settings.glassRegular"), t("settings.glassClear")],
      body: <>
        <Segmented label={t("settings.glassStyle")} disabled={expensiveEffectsDisabled} title={expensiveHint} value={themeDraft.glassVariant} items={[{ value: "regular", label: t("settings.glassRegular") }, { value: "clear", label: t("settings.glassClear") }]} onChange={(value) => patchTheme({ glassVariant: value as ThemeConfig["glassVariant"], surfaceOpacity: value === "clear" ? 0.34 : 0.62 })} />
        <Range disabled={expensiveEffectsDisabled} title={expensiveHint} label={t("settings.transparency")} min={4} max={80} value={Math.round((1 - themeDraft.surfaceOpacity) * 100)} suffix="%" onChange={(value) => patchTheme({ surfaceOpacity: 1 - value / 100 })} />
        <Range disabled={expensiveEffectsDisabled} title={expensiveHint} label={t("settings.blur")} min={0} max={32} value={themeDraft.blur} suffix="px" onChange={(value) => patchTheme({ blur: value })} />
        {expensiveEffectsDisabled ? <p className="settings-note">{expensiveHint}</p> : null}
      </>,
    },
    {
      id: "theme", title: t("settings.themeMode"), icon: <Moon size={16} />, span: "narrow",
      keywords: [t("settings.light"), t("settings.dark"), t("settings.auto"), t("settings.matchSystem"), t("settings.accent"), t("settings.accentAuto")],
      body: <>
        <div className="settings-themes">
          <button type="button" className={`settings-themes__light ${themeDraft.mode === "light" ? "is-active" : ""}`} aria-pressed={themeDraft.mode === "light"} onClick={() => patchTheme({ mode: "light" })}><Sun size={20} /><span>{t("settings.light")}</span></button>
          <button type="button" className={`settings-themes__dark ${themeDraft.mode === "dark" ? "is-active" : ""}`} aria-pressed={themeDraft.mode === "dark"} onClick={() => patchTheme({ mode: "dark" })}><Moon size={20} /><span>{t("settings.dark")}</span></button>
        </div>
        <SettingRow label={t("settings.matchSystem")}><Switch label={t("settings.matchSystem")} checked={themeDraft.mode === "system"} onChange={(checked) => patchTheme({ mode: checked ? "system" : isDarkTheme(themeDraft) ? "dark" : "light" })} /></SettingRow>
        <div className="settings-accents" role="group" aria-label={t("settings.accent")}>
          <span className="settings-accents__label">{t("settings.accent")}</span>
          <button type="button" className={`settings-accents__auto ${followsBackground ? "is-active" : ""}`} aria-pressed={followsBackground} onClick={() => patchTheme({ accentMode: "auto" })}>{t("settings.accentAuto")}</button>
          {ACCENT_SWATCHES.map((color) => <button type="button" key={color} className={`settings-accents__swatch ${!followsBackground && themeDraft.accent === color ? "is-active" : ""}`} style={{ "--swatch": color } as CSSProperties} aria-label={`${t("settings.accent")} ${color}`} aria-pressed={!followsBackground && themeDraft.accent === color} onClick={() => patchTheme({ accent: color, accentMode: "custom" })} />)}
        </div>
      </>,
    },
    {
      id: "layout", title: t("settings.layout"), icon: <Grid2X2 size={16} />, span: "third",
      keywords: [t("settings.layoutMode"), t("settings.layoutAuto"), t("settings.layoutFree"), t("settings.rows"), t("settings.alignment"), t("settings.left"), t("settings.center"), t("settings.right")],
      body: <>
        <div className="settings-align" role="group" aria-label={t("settings.alignment")}>
          {(["left", "center", "right"] as const).map((value) => <button type="button" key={value} aria-pressed={settings.workspaceAlignment === value} className={`settings-align__option settings-align__option--${value} ${settings.workspaceAlignment === value ? "is-active" : ""}`} onClick={() => void patchSettings({ workspaceAlignment: value })}><span className="settings-align__diagram" aria-hidden="true"><i /><i /><i /></span><span className="settings-align__label">{value === "left" ? <AlignLeft size={13} /> : value === "center" ? <AlignCenter size={13} /> : <AlignRight size={13} />}{t(value === "left" ? "settings.left" : value === "center" ? "settings.center" : "settings.right")}</span></button>)}
        </div>
        <SettingRow label={t("settings.layoutMode")}><Segmented label={t("settings.layoutMode")} value={settings.workspaceLayoutMode} items={[{ value: "auto", label: t("settings.layoutAuto") }, { value: "free", label: t("settings.layoutFree") }]} onChange={(value) => void patchSettings({ workspaceLayoutMode: value as AppSettings["workspaceLayoutMode"] })} /></SettingRow>
        <SettingRow label={t("settings.rows")}><Segmented label={t("settings.rows")} value={String(settings.workspaceRows)} items={[{ value: "1", label: t("settings.oneRow") }, { value: "2", label: t("settings.twoRows") }]} onChange={(value) => void patchSettings({ workspaceRows: Number(value) as 1 | 2 })} /></SettingRow>
      </>,
    },
    {
      id: "performance", title: t("settings.performance"), icon: <Gauge size={16} />, span: "half",
      keywords: [t("settings.performanceMode"), ...performanceOptions.map((item) => item.label), t("settings.lowPower")],
      body: <>
        <div className="settings-tiers" role="group" aria-label={t("settings.performanceMode")}>
          {performanceOptions.map((item) => {
            const bars = TIER_BARS[item.value === "auto" || item.value === "custom" ? resolvedPerformanceMode : item.value] ?? 0;
            const activeTier = themeDraft.performanceMode === item.value;
            return <button type="button" key={item.value} aria-label={item.label} aria-pressed={activeTier} aria-describedby={`settings-tier-${item.value}`} className={activeTier ? "is-active" : ""} onClick={() => patchTheme({ performanceMode: item.value as ThemeConfig["performanceMode"], lowPowerMode: item.value === "compatibility" || item.value === "software" })}>
              <span className="settings-tiers__bars" aria-hidden="true">{[1, 2, 3].map((level) => <i key={level} className={level <= bars ? "is-on" : ""} />)}</span>
              <span className="settings-tiers__label">{item.label}</span>
              <span className="settings-tiers__hint" id={`settings-tier-${item.value}`}>{item.hint}</span>
            </button>;
          })}
        </div>
        <p className="settings-note settings-resolved-mode">{t("settings.performanceMode")}: {resolvedPerformanceLabel} · {t("settings.performanceRecommendation", { mode: recommendationModeLabel, reason: recommendationReasonLabel })}</p>
      </>,
    },
    {
      id: "motion", title: t("settings.animations"), icon: <Sparkles size={16} />, span: "narrow",
      keywords: [t("settings.motionAll"), t("settings.motionHover"), t("settings.motionMenus"), t("settings.motionDrag")],
      body: <>
        <SettingRow label={t("settings.motionAll")}><Switch label={t("settings.motionAll")} checked={themeDraft.motion} onChange={(motion) => patchTheme({ motion })} /></SettingRow>
        {themeDraft.motion ? <>
          <SettingRow label={t("settings.motionHover")}><Switch label={t("settings.motionHover")} checked={themeDraft.bookmarkHoverMotion} onChange={(bookmarkHoverMotion) => patchTheme({ bookmarkHoverMotion })} /></SettingRow>
          <SettingRow label={t("settings.motionMenus")}><Switch label={t("settings.motionMenus")} checked={themeDraft.menuMotion} onChange={(menuMotion) => patchTheme({ menuMotion })} /></SettingRow>
          <SettingRow label={t("settings.motionDrag")}><Switch label={t("settings.motionDrag")} checked={themeDraft.dragMotion} onChange={(dragMotion) => patchTheme({ dragMotion })} /></SettingRow>
        </> : null}
      </>,
    },
    {
      id: "data", title: t("settings.dataPrivacy"), icon: <Database size={16} />, span: "wide",
      keywords: [t("settings.exportJson"), t("settings.exportHtml"), t("settings.exportMarkdown"), t("settings.importFile"), t("settings.importChrome"), t("settings.privacyPersist"), t("settings.retention"), t("settings.openTrash"), t("settings.rerunOnboarding")],
      body: <>
        <div className="settings-actions">
          <button type="button" onClick={() => void exportAll("json")}><FileJson size={17} /><strong>{t("settings.exportJson")}</strong><span>{t("settings.backupVersion")}</span></button>
          <button type="button" onClick={() => void exportAll("html")}><Download size={17} /><strong>{t("settings.exportHtml")}</strong><span>{t("settings.exportHtmlHint")}</span></button>
          <button type="button" onClick={() => void exportAll("markdown")}><FileText size={17} /><strong>{t("settings.exportMarkdown")}</strong><span>.md</span></button>
          <button type="button" disabled={importParsing} onClick={() => importInputRef.current?.click()}><Upload size={17} /><strong>{t("settings.importFile")}</strong><span>{t("settings.importFileHint")}</span></button>
          <button type="button" onClick={() => void requestChromeImport()}><Download size={17} /><strong>{t("settings.importChrome")}</strong><span>{t("settings.permissionOnDemand")}</span></button>
        </div>
        <input ref={importInputRef} hidden type="file" accept="application/json,text/html,.json,.html,.htm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImportFile(file); event.currentTarget.value = ""; }} />
        {importParsing ? <div className="import-preview" role="status"><p>{t("settings.importParsing")}</p><Button onClick={cancelImportParsing}>{t("generic.cancel")}</Button></div> : null}
        {importRecordsPreview.length > 0 ? <div className="import-preview"><h3>{importSource}</h3><p>{t("settings.importPreview", { count: importRecordsPreview.length })}</p><div className="form-row"><label>{t("settings.defaultPage")}<input value={importPageTitle} maxLength={240} onChange={(event) => setImportPageTitle(event.target.value)} /></label><label>{t("settings.duplicates")}<SelectField value={duplicateStrategy} options={duplicateOptions} label={t("settings.duplicates")} onChange={(value) => setDuplicateStrategy(value as "skip" | "allow")} /></label></div><div className="button-row"><Button onClick={() => setImportRecordsPreview([])}>{t("generic.cancel")}</Button><Button variant="primary" disabled={importBusy} onClick={() => void commitRecordImport()}>{t("generic.create")}</Button></div></div> : null}
        {backupPreview ? <div className="import-preview"><h3>{importSource}</h3><p>{t("settings.backupSummary", { version: backupPreview.exportVersion, pages: backupPreview.entities.pages.length, boards: backupPreview.entities.boards.length, bookmarks: backupPreview.entities.bookmarks.length })}</p><div className="button-row"><Button onClick={() => setBackupPreview(null)}>{t("generic.cancel")}</Button><Button disabled={importBusy} onClick={() => void commitBackupRestore("merge")}>{t("settings.merge")}</Button>{backupPreview.scope === "full" ? <Button variant="danger" disabled={importBusy} onClick={() => void commitBackupRestore("replace")}>{t("settings.replace")}</Button> : null}</div></div> : null}
        <div className="settings-split">
          <SettingRow label={t("settings.privacyPersist")}><Switch label={t("settings.privacyPersist")} checked={settings.privacyPersist} onChange={(enabled) => void setPrivacyPersistence(enabled)} /></SettingRow>
          <SettingRow label={t("settings.retention")}><SelectField compact value={settings.trashRetentionDays === null ? "never" : String(settings.trashRetentionDays)} options={retentionOptions} label={t("settings.retention")} onChange={(value) => void patchSettings({ trashRetentionDays: value === "never" ? null : Number(value) as 7 | 30 | 90 })} /></SettingRow>
        </div>
        <div className="button-row">
          <Button icon={<Trash2 size={15} />} onClick={props.onOpenTrash}>{t("settings.openTrash")}</Button>
          <Button icon={<Sparkles size={15} />} title={t("settings.rerunOnboardingDescription")} onClick={() => void restartOnboarding()}>{t("settings.rerunOnboarding")}</Button>
        </div>
      </>,
    },
    {
      id: "language", title: t("settings.language"), icon: <Languages size={16} />, span: "narrow",
      keywords: [t("settings.languageDescription"), ...localeOptions.map((item) => item.label)],
      body: <>
        <SelectField value={settings.locale} options={languageOptions} label={t("settings.language")} onChange={(value) => void patchSettings({ locale: value as AppSettings["locale"] })} />
        <p className="settings-note">{t("settings.languageDescription")}</p>
      </>,
    },
    {
      id: "diagnostics", title: t("settings.diagnostics"), icon: invariants.length ? <TriangleAlert size={16} /> : <CheckCircle2 size={16} />, span: "narrow",
      keywords: [t("settings.healthy"), t("settings.repeatDiagnostics"), t("settings.resetDefaults")],
      body: <>
        <div className={`settings-health ${invariants.length ? "is-warning" : "is-healthy"}`}>
          <span className="settings-health__icon">{invariants.length ? <TriangleAlert size={18} /> : <Check size={18} />}</span>
          <div><strong>{invariants.length ? t("settings.issues", { count: invariants.length }) : t("settings.healthy")}</strong><span>{counts.pages} / {counts.boards} / {counts.bookmarks} · {formatBytes(storage?.usage)}</span></div>
        </div>
        <div className="button-row">
          <Button icon={<CheckCircle2 size={15} />} disabled={diagnosticsBusy} onClick={() => void repeatDiagnostics()}>{t("settings.repeatDiagnostics")}</Button>
          <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={() => void resetDefaults()}>{t("settings.resetDefaults")}</Button>
        </div>
      </>,
    },
  ];

  const needle = filter.trim().toLocaleLowerCase();
  const visibleTiles = needle ? tiles.filter((tile) => [tile.title, ...tile.keywords].some((word) => word.toLocaleLowerCase().includes(needle))) : tiles;

  return (
    <Modal
      open={props.open}
      size="fullscreen"
      className="settings-modal"
      backdropClassName="modal-backdrop--settings"
      title={t("settings.title")}
      headerExtra={<label className="settings-find"><Search size={15} aria-hidden="true" /><input type="search" value={filter} maxLength={80} placeholder={t("settings.find")} aria-label={t("settings.find")} onChange={(event) => setFilter(event.target.value)} /></label>}
      onClose={closeSettings}
    >
      <div className="settings-bento">
        {visibleTiles.map((tile, index) => (
          <section key={tile.id} id={`settings-tile-${tile.id}`} className={`settings-tile settings-tile--${tile.span} ${attention === tile.id ? "is-attention" : ""}`} style={{ "--i": index } as CSSProperties} aria-labelledby={`settings-tile-${tile.id}-title`}>
            <header className="settings-tile__header"><span className="settings-tile__icon" aria-hidden="true">{tile.icon}</span><h3 id={`settings-tile-${tile.id}-title`}>{tile.title}</h3></header>
            <div className="settings-tile__body">{tile.body}</div>
          </section>
        ))}
        {visibleTiles.length === 0 ? <p className="settings-empty" role="status"><Brush size={18} aria-hidden="true" />{t("settings.noResults", { query: filter.trim() })}</p> : null}
      </div>
    </Modal>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="setting-row"><strong>{label}</strong><div className="setting-row__control">{children}</div></div>;
}

function Segmented({ label, value, items, onChange, disabled = false, title }: { label: string; value: string; items: Array<{ value: string; label: string }>; onChange: (value: string) => void; disabled?: boolean; title?: string | undefined }) {
  return <div className={`segmented ${disabled ? "is-disabled" : ""}`} role="group" aria-label={label} title={disabled ? title : undefined}>{items.map((item) => <button type="button" key={item.value} disabled={disabled} aria-pressed={item.value === value} className={item.value === value ? "is-active" : ""} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}

function Range({ label, min, max, value, suffix, onChange, disabled = false, title }: { label: string; min: number; max: number; value: number; suffix: string; onChange: (value: number) => void; disabled?: boolean; title?: string | undefined }) {
  const progress = max === min ? 0 : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const style = { "--range-progress": `${progress}%` } as CSSProperties;
  return <label className={`range-control ${disabled ? "is-disabled" : ""}`} title={disabled ? title : undefined}><span><strong>{label}</strong><span className="range-control__value" aria-hidden="true">{Math.round(value)}{suffix}</span></span><input type="range" aria-label={label} min={min} max={max} value={value} aria-valuetext={`${Math.round(value)}${suffix}`} disabled={disabled} style={style} onInput={(event) => onChange(Number(event.currentTarget.value))} /></label>;
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="switch"><input aria-label={label} type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span /></label>;
}
