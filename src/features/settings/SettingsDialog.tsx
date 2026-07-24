import { useEffect, useMemo, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { Archive, Brush, Check, CheckCircle2, Database, Download, FileJson, FileText, Grid2X2, Languages, Shield, Trash2, Upload, Zap } from "lucide-react";
import type { AppSettings, ThemeConfig, Wallpaper, WorkspaceData } from "../../domain/models";
import { validateTheme } from "../../domain/themes";
import { auditInvariants, createSnapshot, ensureStarterWorkspace, getWallpaper, saveWallpaper, updateSettings } from "../../db/repository";
import {
  createBackup,
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
import { Modal } from "../../components/Modal";
import { localeOptions, useI18n } from "../../i18n";
import { BUILTIN_WALLPAPERS } from "../appearance/themeRuntime";

export type SettingsSection = "appearance" | "layout" | "language" | "quick-save" | "data-privacy";

interface SettingsDialogProps {
  open: boolean;
  initialSection?: SettingsSection;
  workspace: WorkspaceData;
  onClose: () => void;
  onUpdated: (message: string) => void;
  onError: (message: string) => void;
  onOpenTrash: () => void;
}

type ChromeNode = chrome.bookmarks.BookmarkTreeNode;

function flattenChromeBookmarks(nodes: ChromeNode[], path: string[] = []): ImportRecord[] {
  const records: ImportRecord[] = [];
  for (const node of nodes) {
    if (node.url) records.push({ title: node.title || new URL(node.url).hostname, url: node.url, description: null, folderPath: path });
    if (node.children) records.push(...flattenChromeBookmarks(node.children, node.title ? [...path, node.title] : path));
  }
  return records;
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
  const [section, setSection] = useState<SettingsSection>(props.initialSection ?? "appearance");
  const [shortcut, setShortcut] = useState("—");
  const [storage, setStorage] = useState<StorageEstimate>();
  const [wallpaperInfo, setWallpaperInfo] = useState<Wallpaper | null>(null);
  const [themeDraft, setThemeDraft] = useState(settings.theme);
  const [invariants, setInvariants] = useState<string[]>([]);
  const [importRecordsPreview, setImportRecordsPreview] = useState<ImportRecord[]>([]);
  const [backupPreview, setBackupPreview] = useState<AsterfoldBackup | null>(null);
  const [importSource, setImportSource] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "allow">("skip");
  const [importPageTitle, setImportPageTitle] = useState(t("settings.importedBookmarks"));
  const importInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const themeCommitRef = useRef<number | null>(null);
  const counts = useMemo(() => ({ pages: props.workspace.pages.length, boards: props.workspace.boards.length, bookmarks: props.workspace.bookmarks.length }), [props.workspace]);
  const sections: Array<{ id: SettingsSection; label: string; icon: typeof Brush }> = [
    { id: "appearance", label: t("settings.appearance"), icon: Brush },
    { id: "layout", label: t("settings.layout"), icon: Grid2X2 },
    { id: "language", label: t("settings.language"), icon: Languages },
    { id: "quick-save", label: t("settings.quickSave"), icon: Zap },
    { id: "data-privacy", label: t("settings.dataPrivacy"), icon: Shield },
  ];

  useEffect(() => {
    if (!props.open) return;
    setSection(props.initialSection ?? "appearance");
    if (!importRecordsPreview.length && !backupPreview) setImportPageTitle(t("settings.importedBookmarks"));
    if (browser.commands?.getAll) void browser.commands.getAll().then((commands) => setShortcut(commands.find((command) => command.name === "quick-save")?.shortcut || "—")).catch(() => setShortcut("—"));
    if (navigator.storage?.estimate) void navigator.storage.estimate().then(setStorage).catch(() => setStorage(undefined));
    void auditInvariants().then(setInvariants);
  }, [backupPreview, importRecordsPreview.length, props.initialSection, props.open, t]);
  useEffect(() => {
    if (!props.open || !themeDraft.wallpaperId) { setWallpaperInfo(null); return; }
    void getWallpaper(themeDraft.wallpaperId).then(setWallpaperInfo).catch(() => setWallpaperInfo(null));
  }, [props.open, themeDraft.wallpaperId]);
  useEffect(() => {
    setThemeDraft(settings.theme);
  }, [settings.theme]);
  useEffect(() => () => {
    if (themeCommitRef.current !== null) window.clearTimeout(themeCommitRef.current);
  }, []);

  const patchSettings = async (patch: Partial<Omit<AppSettings, "id" | "schemaVersion">>, message = t("generic.save")): Promise<void> => {
    try {
      await updateSettings(patch);
      props.onUpdated(message);
    } catch {
      props.onError(t("error.updateSettings"));
    }
  };
  const patchTheme = (patch: Partial<ThemeConfig>): void => {
    const next = validateTheme({ ...themeDraft, ...patch });
    setThemeDraft(next);
    if (themeCommitRef.current !== null) window.clearTimeout(themeCommitRef.current);
    themeCommitRef.current = window.setTimeout(() => {
      themeCommitRef.current = null;
      void updateSettings({ theme: next }).catch(() => props.onError(t("error.updateSettings")));
    }, 200);
  };
  const exportAll = async (format: "json" | "html" | "markdown"): Promise<void> => {
    try {
      const backup = await createBackup();
      if (format === "json") downloadText(`asterfold-backup-v2-${new Date().toISOString().slice(0, 10)}.json`, serializeBackup(backup), "application/json");
      if (format === "html") downloadText("asterfold-bookmarks.html", toNetscapeHtml(backup), "text/html");
      if (format === "markdown") downloadText("asterfold-bookmarks.md", toMarkdown(backup), "text/markdown");
      props.onUpdated(`${format.toUpperCase()} ✓`);
    } catch {
      props.onError(t("error.exportFailed"));
    }
  };
  const readImportFile = async (file: File): Promise<void> => {
    if (file.size > 25 * 1024 * 1024) { props.onError(t("error.importTooLarge")); return; }
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        setBackupPreview(await parseBackupOffThread(text));
        setImportRecordsPreview([]);
      } else {
        setImportRecordsPreview(await parseHtmlOffThread(text));
        setBackupPreview(null);
      }
      setImportSource(file.name);
    } catch {
      props.onError(t("error.importPreviewFailed"));
    }
  };
  const requestChromeImport = async (): Promise<void> => {
    try {
      const granted = await browser.permissions.request({ permissions: ["bookmarks"] });
      if (!granted) return;
      setImportRecordsPreview(flattenChromeBookmarks(await browser.bookmarks.getTree()));
      setBackupPreview(null);
      setImportSource(t("settings.chromeBookmarks"));
    } catch {
      props.onError(t("error.chromeBookmarksUnavailable"));
    }
  };
  const commitRecordImport = async (): Promise<void> => {
    setImportBusy(true);
    try {
      const summary = await importRecords(importRecordsPreview, { pageTitle: importPageTitle }, duplicateStrategy);
      props.onUpdated(t("settings.imported", { count: summary.imported }));
      setImportRecordsPreview([]);
      setImportSource("");
    } catch { props.onError(t("error.importFailed")); }
    finally { setImportBusy(false); }
  };
  const commitBackupRestore = async (strategy: "merge" | "replace"): Promise<void> => {
    if (!backupPreview) return;
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
      patchTheme({ wallpaperId: wallpaper.id, backgroundMode: "wallpaper" });
    } catch { props.onError(t("error.wallpaperSaveFailed")); }
  };

  return (
    <Modal open={props.open} size="fullscreen" title={t("settings.title")} onClose={props.onClose}>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t("settings.title")}>{sections.map((item) => <button key={item.id} className={section === item.id ? "is-active" : ""} onClick={() => setSection(item.id)}><item.icon size={17} />{item.label}</button>)}</nav>
        <div className="settings-content">
          {section === "appearance" ? <SettingsSection title={t("settings.appearance")} description={t("settings.appearanceDescription")}>
            <SettingRow label={t("settings.themeMode")}><Segmented value={themeDraft.mode} items={[{ value: "system", label: t("settings.auto") }, { value: "light", label: t("settings.light") }, { value: "dark", label: t("settings.dark") }]} onChange={(value) => patchTheme({ mode: value as ThemeConfig["mode"] })} /></SettingRow>
            <SettingRow label={t("settings.background")}><Segmented value={themeDraft.backgroundMode} items={[{ value: "auto", label: t("settings.backgroundAuto") }, { value: "solid", label: t("settings.backgroundSolid") }, { value: "wallpaper", label: t("settings.backgroundWallpaper") }]} onChange={(value) => patchTheme({ backgroundMode: value as ThemeConfig["backgroundMode"] })} /></SettingRow>
            {themeDraft.backgroundMode === "solid" ? <SettingRow label={t("settings.solidColor")}><input type="color" value={themeDraft.canvas} onChange={(event) => patchTheme({ canvas: event.target.value })} /></SettingRow> : null}
            <SettingRow label={t("settings.glassStyle")}><Segmented value={themeDraft.glassVariant} items={[{ value: "regular", label: t("settings.glassRegular") }, { value: "clear", label: t("settings.glassClear") }]} onChange={(value) => patchTheme({ glassVariant: value as ThemeConfig["glassVariant"], surfaceOpacity: value === "clear" ? 0.34 : 0.62 })} /></SettingRow>
            <div className="settings-range-grid">
              <Range label={t("settings.transparency")} min={4} max={80} value={Math.round((1 - themeDraft.surfaceOpacity) * 100)} suffix="%" onChange={(value) => patchTheme({ surfaceOpacity: 1 - value / 100 })} />
              <Range label={t("settings.blur")} min={0} max={32} value={themeDraft.blur} suffix="px" onChange={(value) => patchTheme({ blur: value })} />
              <Range label={t("settings.wallpaperDim")} min={0} max={80} value={Math.round(themeDraft.wallpaperDim * 100)} suffix="%" onChange={(value) => patchTheme({ wallpaperDim: value / 100 })} />
              <Range label={t("settings.wallpaperBlur")} min={0} max={20} value={themeDraft.wallpaperBlur} suffix="px" onChange={(value) => patchTheme({ wallpaperBlur: value })} />
              <Range label={t("settings.wallpaperSaturation")} min={0} max={180} value={Math.round(themeDraft.wallpaperSaturation * 100)} suffix="%" onChange={(value) => patchTheme({ wallpaperSaturation: value / 100 })} />
            </div>
            <div className="wallpaper-grid"><button className={!themeDraft.wallpaperId ? "is-active" : ""} onClick={() => patchTheme({ wallpaperId: null, backgroundMode: "auto" })}><span className="wallpaper-none" />{t("settings.noWallpaper")}</button>{BUILTIN_WALLPAPERS.map((item) => <button key={item.id} className={themeDraft.wallpaperId === item.id ? "is-active" : ""} onClick={() => patchTheme({ wallpaperId: item.id, backgroundMode: "wallpaper" })}><span style={{ background: item.value }} />{item.name}</button>)}<button onClick={() => wallpaperInputRef.current?.click()}><span className="wallpaper-upload"><Upload size={19} /></span>{t("settings.uploadWallpaper")}</button></div>
            {wallpaperInfo?.width && wallpaperInfo.height ? <p>{wallpaperInfo.width} × {wallpaperInfo.height} · {formatBytes(wallpaperInfo.storedBytes)}</p> : null}
            <input ref={wallpaperInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void saveUploadedWallpaper(file); event.currentTarget.value = ""; }} />
            <div className="settings-control-group">
              <h3>{t("settings.performance")}</h3>
              <SettingRow label={t("settings.lowPower")}><Switch label={t("settings.lowPower")} checked={themeDraft.lowPowerMode} onChange={(lowPowerMode) => patchTheme({ lowPowerMode })} /></SettingRow>
              <p>{t("settings.lowPowerDescription")}</p>
            </div>
            <div className="settings-control-group">
              <h3>{t("settings.animations")}</h3>
              <SettingRow label={t("settings.motionAll")}><Switch label={t("settings.motionAll")} checked={themeDraft.motion} onChange={(motion) => patchTheme({ motion })} /></SettingRow>
              {themeDraft.motion ? <>
                <SettingRow label={t("settings.motionHover")}><Switch label={t("settings.motionHover")} checked={themeDraft.bookmarkHoverMotion} onChange={(bookmarkHoverMotion) => patchTheme({ bookmarkHoverMotion })} /></SettingRow>
                <SettingRow label={t("settings.motionMenus")}><Switch label={t("settings.motionMenus")} checked={themeDraft.menuMotion} onChange={(menuMotion) => patchTheme({ menuMotion })} /></SettingRow>
                <SettingRow label={t("settings.motionDrag")}><Switch label={t("settings.motionDrag")} checked={themeDraft.dragMotion} onChange={(dragMotion) => patchTheme({ dragMotion })} /></SettingRow>
              </> : null}
              <p>{t("settings.animationsDescription")}</p>
            </div>
          </SettingsSection> : null}

          {section === "layout" ? <SettingsSection title={t("settings.layout")} description={t("settings.layoutDescription")}>
            <SettingRow label={t("settings.layoutMode")}><Segmented value={settings.workspaceLayoutMode} items={[{ value: "auto", label: t("settings.layoutAuto") }, { value: "free", label: t("settings.layoutFree") }]} onChange={(value) => void patchSettings({ workspaceLayoutMode: value as AppSettings["workspaceLayoutMode"] })} /></SettingRow>
            <SettingRow label={t("settings.rows")}><Segmented value={String(settings.workspaceRows)} items={[{ value: "1", label: t("settings.oneRow") }, { value: "2", label: t("settings.twoRows") }]} onChange={(value) => void patchSettings({ workspaceRows: Number(value) as 1 | 2 })} /></SettingRow>
            <SettingRow label={t("settings.alignment")}><Segmented value={settings.workspaceAlignment} items={[{ value: "left", label: t("settings.left") }, { value: "center", label: t("settings.center") }, { value: "right", label: t("settings.right") }]} onChange={(value) => void patchSettings({ workspaceAlignment: value as AppSettings["workspaceAlignment"] })} /></SettingRow>
          </SettingsSection> : null}

          {section === "language" ? <SettingsSection title={t("settings.language")} description={t("settings.languageDescription")}>
            <div className="language-options">{localeOptions.map((item) => <button key={item.value} className={settings.locale === item.value ? "is-active" : ""} onClick={() => void patchSettings({ locale: item.value })}><span>{item.value === "auto" ? t("settings.languageAuto") : item.label}</span>{settings.locale === item.value ? <Check size={17} /> : null}</button>)}</div>
          </SettingsSection> : null}

          {section === "quick-save" ? <SettingsSection title={t("settings.quickSave")} description={t("settings.quickSaveDescription")}>
            <SettingRow label={t("settings.saveBehavior")}><select value={settings.quickSaveMode} onChange={(event) => void patchSettings({ quickSaveMode: event.target.value as AppSettings["quickSaveMode"] })}><option value="ask">{t("settings.askDestination")}</option><option value="instant">{t("settings.instantSave")}</option></select></SettingRow>
            <SettingRow label={t("settings.defaultPage")}><select value={settings.quickSaveDefaultPageId ?? ""} onChange={(event) => { const pageId = event.target.value; const board = props.workspace.boards.find((item) => item.pageId === pageId); void patchSettings({ quickSaveDefaultPageId: pageId, quickSaveDefaultBoardId: board?.id ?? null }); }}>{props.workspace.pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}</select></SettingRow>
            <SettingRow label={t("settings.defaultBoard")}><select value={settings.quickSaveDefaultBoardId ?? ""} onChange={(event) => void patchSettings({ quickSaveDefaultBoardId: event.target.value })}>{props.workspace.pages.map((page) => <optgroup key={page.id} label={page.title}>{props.workspace.boards.filter((board) => board.pageId === page.id).map((board) => <option key={board.id} value={board.id}>{board.title}</option>)}</optgroup>)}</select></SettingRow>
            <SettingRow label={t("settings.shortcut")}><div className="shortcut-value"><kbd>{shortcut}</kbd><Button onClick={() => void browser.tabs.create({ url: "chrome://extensions/shortcuts" })}>{t("settings.configure")}</Button></div></SettingRow>
          </SettingsSection> : null}

          {section === "data-privacy" ? <SettingsSection title={t("settings.dataPrivacy")} description={t("settings.dataDescription")}>
            <div className="action-grid"><button onClick={() => void exportAll("json")}><FileJson /><strong>{t("settings.exportJson")}</strong><span>{t("settings.backupVersion")}</span></button><button onClick={() => void exportAll("html")}><Download /><strong>{t("settings.exportHtml")}</strong><span>{t("settings.exportHtmlHint")}</span></button><button onClick={() => void exportAll("markdown")}><FileText /><strong>{t("settings.exportMarkdown")}</strong><span>.md</span></button><button onClick={() => importInputRef.current?.click()}><Upload /><strong>{t("settings.importFile")}</strong><span>{t("settings.importFileHint")}</span></button><button onClick={() => void requestChromeImport()}><Download /><strong>{t("settings.importChrome")}</strong><span>{t("settings.permissionOnDemand")}</span></button><button onClick={() => void createSnapshot("manual").then(() => props.onUpdated(t("settings.snapshotCreated")))}><Archive /><strong>{t("settings.snapshot")}</strong><span>{t("settings.snapshotHint")}</span></button></div>
            <input ref={importInputRef} hidden type="file" accept="application/json,text/html,.json,.html,.htm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImportFile(file); event.currentTarget.value = ""; }} />
            {importRecordsPreview.length > 0 ? <div className="import-preview"><h3>{importSource}</h3><p>{t("settings.importPreview", { count: importRecordsPreview.length })}</p><div className="form-row"><label>{t("settings.defaultPage")}<input value={importPageTitle} onChange={(event) => setImportPageTitle(event.target.value)} /></label><label>{t("settings.duplicates")}<select value={duplicateStrategy} onChange={(event) => setDuplicateStrategy(event.target.value as "skip" | "allow")}><option value="skip">{t("settings.skip")}</option><option value="allow">{t("settings.allow")}</option></select></label></div><div className="button-row"><Button onClick={() => setImportRecordsPreview([])}>{t("generic.cancel")}</Button><Button variant="primary" disabled={importBusy} onClick={() => void commitRecordImport()}>{t("generic.create")}</Button></div></div> : null}
            {backupPreview ? <div className="import-preview"><h3>{importSource}</h3><p>{t("settings.backupSummary", { version: backupPreview.exportVersion, pages: backupPreview.entities.pages.length, boards: backupPreview.entities.boards.length, bookmarks: backupPreview.entities.bookmarks.length })}</p><div className="button-row"><Button onClick={() => setBackupPreview(null)}>{t("generic.cancel")}</Button><Button disabled={importBusy} onClick={() => void commitBackupRestore("merge")}>{t("settings.merge")}</Button><Button variant="danger" disabled={importBusy} onClick={() => void commitBackupRestore("replace")}>{t("settings.replace")}</Button></div></div> : null}
            <SettingRow label={t("settings.privacyPersist")}><label className="switch"><input type="checkbox" checked={settings.privacyPersist} onChange={(event) => void patchSettings({ privacyPersist: event.target.checked, ...(event.target.checked ? {} : { privacyEnabled: false }) })} /><span /></label></SettingRow>
            <SettingRow label={t("settings.retention")}><select value={settings.trashRetentionDays ?? "never"} onChange={(event) => void patchSettings({ trashRetentionDays: event.target.value === "never" ? null : Number(event.target.value) as 7 | 30 | 90 })}><option value="7">{t("settings.days", { count: 7 })}</option><option value="30">{t("settings.days", { count: 30 })}</option><option value="90">{t("settings.days", { count: 90 })}</option><option value="never">{t("settings.never")}</option></select></SettingRow>
            <div className="data-footer"><Button icon={<Trash2 size={16} />} onClick={props.onOpenTrash}>{t("settings.openTrash")}</Button><div className="diagnostic-summary"><Database size={17} /><span>{counts.pages} / {counts.boards} / {counts.bookmarks}</span><span>{formatBytes(storage?.usage)}</span><strong className={invariants.length ? "is-warning" : "is-healthy"}>{invariants.length ? t("settings.issues", { count: invariants.length }) : t("settings.healthy")}</strong></div><Button icon={<CheckCircle2 size={16} />} onClick={() => void ensureStarterWorkspace().then(() => auditInvariants()).then((issues) => { setInvariants(issues); props.onUpdated(t("settings.repair")); })}>{t("settings.repair")}</Button></div>
          </SettingsSection> : null}
        </div>
      </div>
    </Modal>
  );
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="settings-section"><header><h2>{title}</h2><p>{description}</p></header><div className="settings-section__body">{children}</div></section>;
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="setting-row"><strong>{label}</strong><div className="setting-row__control">{children}</div></div>;
}

function Segmented({ value, items, onChange }: { value: string; items: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <div className="segmented">{items.map((item) => <button key={item.value} className={item.value === value ? "is-active" : ""} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}

function Range({ label, min, max, value, suffix, onChange }: { label: string; min: number; max: number; value: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="range-control"><span><strong>{label}</strong><output>{Math.round(value)}{suffix}</output></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="switch"><input aria-label={label} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span /></label>;
}
