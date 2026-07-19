import { useEffect, useMemo, useRef, useState } from "react";
import { browser } from "wxt/browser";
import {
  Activity,
  Archive,
  BookOpen,
  Brush,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileJson,
  FileText,
  Gauge,
  Info,
  Keyboard,
  LockKeyhole,
  RefreshCcw,
  Search,
  Settings2,
  Shield,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import type { AppSettings, ThemeConfig, WorkspaceData } from "../../domain/models";
import { getThemePreset, THEME_PRESETS, validateTheme } from "../../domain/themes";
import { auditInvariants, createSnapshot, ensureStarterWorkspace, saveWallpaper, updateSettings } from "../../db/repository";
import {
  createBackup,
  downloadText,
  importRecords,
  parseBackup,
  parseNetscapeHtml,
  restoreBackup,
  serializeBackup,
  themeSchema,
  toMarkdown,
  toNetscapeHtml,
  type AsterfoldBackup,
  type ImportRecord,
} from "../../services/exportImport";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { BUILTIN_WALLPAPERS } from "../appearance/themeRuntime";

type SettingsSection = "general" | "appearance" | "quick-save" | "search" | "import-export" | "trash" | "sync" | "privacy" | "keyboard" | "about" | "diagnostics";

interface SettingsDialogProps {
  open: boolean;
  initialSection?: SettingsSection;
  workspace: WorkspaceData;
  onClose: () => void;
  onUpdated: (message: string) => void;
  onError: (message: string) => void;
  onOpenTrash: () => void;
}

const sections: Array<{ id: SettingsSection; label: string; icon: typeof Settings2 }> = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "appearance", label: "Appearance", icon: Brush },
  { id: "quick-save", label: "Quick Save", icon: Zap },
  { id: "search", label: "Search", icon: Search },
  { id: "import-export", label: "Import & Export", icon: Download },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "sync", label: "Sync", icon: Cloud },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "keyboard", label: "Keyboard", icon: Keyboard },
  { id: "about", label: "About", icon: Info },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
];

type ChromeNode = chrome.bookmarks.BookmarkTreeNode;

function flattenChromeBookmarks(nodes: ChromeNode[], path: string[] = []): ImportRecord[] {
  const records: ImportRecord[] = [];
  for (const node of nodes) {
    if (node.url) {
      records.push({ title: node.title || new URL(node.url).hostname, url: node.url, description: null, folderPath: path });
    }
    if (node.children) records.push(...flattenChromeBookmarks(node.children, node.title ? [...path, node.title] : path));
  }
  return records;
}

function formatBytes(value: number | undefined): string {
  if (value === undefined) return "Unavailable";
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

function colorContrast(first: string, second: string): number {
  const luminance = (hex: string): number => {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

export function SettingsDialog(props: SettingsDialogProps) {
  const [section, setSection] = useState<SettingsSection>(props.initialSection ?? "general");
  const [shortcut, setShortcut] = useState("Not assigned");
  const [storage, setStorage] = useState<StorageEstimate>();
  const [invariants, setInvariants] = useState<string[]>([]);
  const [importRecordsPreview, setImportRecordsPreview] = useState<ImportRecord[]>([]);
  const [backupPreview, setBackupPreview] = useState<AsterfoldBackup | null>(null);
  const [importSource, setImportSource] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "allow">("skip");
  const [importPageTitle, setImportPageTitle] = useState("Imported bookmarks");
  const importInputRef = useRef<HTMLInputElement>(null);
  const themeInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const settings = props.workspace.settings;
  const accentContrast = colorContrast(settings.theme.accent, settings.theme.canvas);
  const counts = useMemo(() => ({ pages: props.workspace.pages.length, boards: props.workspace.boards.length, bookmarks: props.workspace.bookmarks.length }), [props.workspace]);

  useEffect(() => {
    if (!props.open) return;
    setSection(props.initialSection ?? "general");
    void browser.commands.getAll().then((commands) => setShortcut(commands.find((command) => command.name === "quick-save")?.shortcut || "Not assigned"));
    void navigator.storage.estimate().then(setStorage);
    void auditInvariants().then(setInvariants);
  }, [props.initialSection, props.open]);

  const patchSettings = async (patch: Partial<Omit<AppSettings, "id" | "schemaVersion">>, message = "Settings saved"): Promise<void> => {
    try {
      await updateSettings(patch);
      props.onUpdated(message);
    } catch (error) { props.onError(error instanceof Error ? error.message : "Unable to update settings"); }
  };
  const patchTheme = (patch: Partial<ThemeConfig>): void => {
    void patchSettings({ theme: validateTheme({ ...settings.theme, ...patch }) }, "Appearance updated");
  };
  const exportAll = async (format: "json" | "html" | "markdown"): Promise<void> => {
    try {
      const backup = await createBackup();
      if (format === "json") downloadText(`asterfold-backup-${new Date().toISOString().slice(0, 10)}.json`, serializeBackup(backup), "application/json");
      if (format === "html") downloadText("asterfold-bookmarks.html", toNetscapeHtml(backup), "text/html");
      if (format === "markdown") downloadText("asterfold-bookmarks.md", toMarkdown(backup), "text/markdown");
      props.onUpdated(`${format.toUpperCase()} export created`);
    } catch (error) { props.onError(error instanceof Error ? error.message : "Export failed"); }
  };
  const readImportFile = async (file: File): Promise<void> => {
    if (file.size > 25 * 1024 * 1024) { props.onError("Import file must be 25 MB or smaller"); return; }
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        const backup = parseBackup(text);
        setBackupPreview(backup);
        setImportRecordsPreview([]);
        setImportSource(file.name);
      } else {
        const records = parseNetscapeHtml(text);
        setImportRecordsPreview(records);
        setBackupPreview(null);
        setImportSource(file.name);
      }
    } catch (error) { props.onError(error instanceof Error ? error.message : "Import preview failed"); }
  };
  const requestChromeImport = async (): Promise<void> => {
    try {
      const granted = await browser.permissions.request({ permissions: ["bookmarks"] });
      if (!granted) { props.onError("Chrome bookmark permission was not granted"); return; }
      const records = flattenChromeBookmarks(await browser.bookmarks.getTree());
      setImportRecordsPreview(records);
      setBackupPreview(null);
      setImportSource("Chrome bookmarks");
    } catch (error) { props.onError(error instanceof Error ? error.message : "Unable to read Chrome bookmarks"); }
  };
  const commitRecordImport = async (): Promise<void> => {
    setImportBusy(true);
    try {
      const summary = await importRecords(importRecordsPreview, { pageTitle: importPageTitle }, duplicateStrategy);
      props.onUpdated(`Imported ${summary.imported}; skipped ${summary.skippedDuplicates}; invalid ${summary.invalid.length}`);
      setImportRecordsPreview([]);
      setImportSource("");
    } catch (error) { props.onError(error instanceof Error ? error.message : "Import failed"); }
    finally { setImportBusy(false); }
  };
  const commitBackupRestore = async (strategy: "merge" | "replace"): Promise<void> => {
    if (!backupPreview) return;
    if (strategy === "replace" && !window.confirm("Replace local workspace with this backup? A safety snapshot will be created first.")) return;
    setImportBusy(true);
    try {
      await restoreBackup(backupPreview, strategy);
      props.onUpdated(`Backup ${strategy === "replace" ? "restored" : "merged"}`);
      setBackupPreview(null);
      setImportSource("");
    } catch (error) { props.onError(error instanceof Error ? error.message : "Restore failed"); }
    finally { setImportBusy(false); }
  };
  const saveUploadedWallpaper = async (file: File): Promise<void> => {
    try {
      const wallpaper = await saveWallpaper(file, file.name);
      patchTheme({ wallpaperId: wallpaper.id });
    } catch (error) { props.onError(error instanceof Error ? error.message : "Wallpaper could not be saved"); }
  };

  return (
    <Modal open={props.open} size="fullscreen" title="Settings" onClose={props.onClose}>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">{sections.map((item) => <button key={item.id} className={section === item.id ? "is-active" : ""} onClick={() => setSection(item.id)}><item.icon size={17} />{item.label}</button>)}</nav>
        <div className="settings-content">
          {section === "general" ? <SettingsSection title="General" description="Choose the default workspace behavior.">
            <SettingRow label="Page navigation" description="Keep names visible or use a compact icon rail."><select value={settings.navigationMode} onChange={(event) => void patchSettings({ navigationMode: event.target.value as AppSettings["navigationMode"] })}><option value="expanded">Expanded</option><option value="rail">Icon rail</option></select></SettingRow>
            <SettingRow label="Active Page" description="The Page restored when a new tab opens."><select value={settings.activePageId ?? ""} onChange={(event) => void patchSettings({ activePageId: event.target.value })}>{props.workspace.pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}</select></SettingRow>
            <SettingRow label="Onboarding" description="Reopen the short local-first introduction."><Button onClick={() => void patchSettings({ onboardingComplete: false }, "Onboarding will reopen")}>Show again</Button></SettingRow>
          </SettingsSection> : null}

          {section === "appearance" ? <SettingsSection title="Appearance" description="Six complete presets share the same accessible component system.">
            <div className="theme-grid">{THEME_PRESETS.map((preset) => <button key={preset.id} className={`theme-tile theme-tile--${preset.id} ${settings.theme.preset === preset.id ? "is-active" : ""}`} onClick={() => void patchSettings({ theme: preset.config }, `${preset.name} applied`)}><span className="theme-tile__preview"><i /><i /><i /></span><strong>{preset.name}</strong>{settings.theme.preset === preset.id ? <CheckCircle2 size={16} /> : null}</button>)}</div>
            <div className="appearance-grid">
              <label>Accent color<input type="color" value={settings.theme.accent} onChange={(event) => patchTheme({ accent: event.target.value })} /></label>
              <label>Canvas color<input type="color" value={settings.theme.canvas} onChange={(event) => patchTheme({ canvas: event.target.value })} /></label>
              <label>Surface opacity <output>{Math.round(settings.theme.surfaceOpacity * 100)}%</output><input type="range" min="45" max="100" value={settings.theme.surfaceOpacity * 100} onChange={(event) => patchTheme({ surfaceOpacity: Number(event.target.value) / 100 })} /></label>
              <label>Blur <output>{settings.theme.blur}px</output><input type="range" min="0" max="40" value={settings.theme.blur} onChange={(event) => patchTheme({ blur: Number(event.target.value) })} /></label>
              <label>Radius <output>{settings.theme.radius}px</output><input type="range" min="4" max="28" value={settings.theme.radius} onChange={(event) => patchTheme({ radius: Number(event.target.value) })} /></label>
              <label>Density<select value={settings.theme.density} onChange={(event) => patchTheme({ density: event.target.value as ThemeConfig["density"] })}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></label>
              <label>Card variant<select value={settings.theme.cardVariant} onChange={(event) => patchTheme({ cardVariant: event.target.value as ThemeConfig["cardVariant"] })}><option value="minimal">Minimal</option><option value="standard">Standard</option><option value="visual">Visual</option></select></label>
              <label>Board width <output>{settings.theme.boardWidth}px</output><input type="range" min="280" max="520" step="10" value={settings.theme.boardWidth} onChange={(event) => patchTheme({ boardWidth: Number(event.target.value) })} /></label>
              <label>Font scale <output>{settings.theme.fontScale.toFixed(2)}×</output><input type="range" min="90" max="125" value={settings.theme.fontScale * 100} onChange={(event) => patchTheme({ fontScale: Number(event.target.value) / 100 })} /></label>
              <label>Favicon size <output>{settings.theme.faviconSize}px</output><input type="range" min="20" max="48" value={settings.theme.faviconSize} onChange={(event) => patchTheme({ faviconSize: Number(event.target.value) })} /></label>
              <label className="checkbox-row"><input type="checkbox" checked={settings.theme.showHostname} onChange={(event) => patchTheme({ showHostname: event.target.checked })} />Show hostnames</label>
              <label className="checkbox-row"><input type="checkbox" checked={settings.theme.showDescription} onChange={(event) => patchTheme({ showDescription: event.target.checked })} />Show descriptions</label>
              <label className="checkbox-row"><input type="checkbox" checked={settings.theme.motion} onChange={(event) => patchTheme({ motion: event.target.checked })} />Interface motion</label>
            </div>
            <p className={accentContrast >= 3 ? "status-good" : "contrast-warning"}>{accentContrast >= 3 ? `Accent/canvas contrast ${accentContrast.toFixed(1)}:1` : `Low accent/canvas contrast ${accentContrast.toFixed(1)}:1 — increase it for visible controls.`}</p>
            <h3>Wallpapers</h3><div className="wallpaper-grid"><button className={!settings.theme.wallpaperId ? "is-active" : ""} onClick={() => patchTheme({ wallpaperId: null })}><span className="wallpaper-none" />None</button>{BUILTIN_WALLPAPERS.map((item) => <button key={item.id} className={settings.theme.wallpaperId === item.id ? "is-active" : ""} onClick={() => patchTheme({ wallpaperId: item.id })}><span style={{ background: item.value }} />{item.name}</button>)}<button onClick={() => wallpaperInputRef.current?.click()}><span className="wallpaper-upload"><Upload size={20} /></span>Upload image</button></div>
            <input ref={wallpaperInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void saveUploadedWallpaper(file); event.currentTarget.value = ""; }} />
            {settings.theme.wallpaperId ? <div className="appearance-grid"><label>Wallpaper dim <output>{Math.round(settings.theme.wallpaperDim * 100)}%</output><input type="range" min="0" max="80" value={settings.theme.wallpaperDim * 100} onChange={(event) => patchTheme({ wallpaperDim: Number(event.target.value) / 100 })} /></label><label>Wallpaper blur <output>{settings.theme.wallpaperBlur}px</output><input type="range" min="0" max="30" value={settings.theme.wallpaperBlur} onChange={(event) => patchTheme({ wallpaperBlur: Number(event.target.value) })} /></label><label>Wallpaper zoom <output>{settings.theme.wallpaperZoom.toFixed(1)}×</output><input type="range" min="100" max="200" value={settings.theme.wallpaperZoom * 100} onChange={(event) => patchTheme({ wallpaperZoom: Number(event.target.value) / 100 })} /></label><label>Wallpaper saturation <output>{settings.theme.wallpaperSaturation.toFixed(1)}×</output><input type="range" min="0" max="180" value={settings.theme.wallpaperSaturation * 100} onChange={(event) => patchTheme({ wallpaperSaturation: Number(event.target.value) / 100 })} /></label><label>Wallpaper position<select value={settings.theme.wallpaperPosition} onChange={(event) => patchTheme({ wallpaperPosition: event.target.value })}><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select></label></div> : null}
            <div className="button-row"><Button icon={<RefreshCcw size={16} />} onClick={() => void patchSettings({ theme: getThemePreset(settings.theme.preset) }, "Preset reset")}>Reset preset</Button><Button icon={<Download size={16} />} onClick={() => downloadText("asterfold-custom-theme.json", JSON.stringify(settings.theme, null, 2), "application/json")}>Save custom theme</Button><Button icon={<Upload size={16} />} onClick={() => themeInputRef.current?.click()}>Import theme</Button><input ref={themeInputRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then((text) => { const parsed = themeSchema.parse(JSON.parse(text) as unknown); return patchSettings({ theme: parsed }, "Theme imported"); }).catch((error: unknown) => props.onError(error instanceof Error ? error.message : "Invalid theme")); event.currentTarget.value = ""; }} /></div>
          </SettingsSection> : null}

          {section === "quick-save" ? <SettingsSection title="Quick Save" description="Capture the current tab without reading page content.">
            <SettingRow label="Save behavior" description="Ask for a destination or instantly use the default Board."><select value={settings.quickSaveMode} onChange={(event) => void patchSettings({ quickSaveMode: event.target.value as AppSettings["quickSaveMode"] })}><option value="ask">Ask destination</option><option value="instant">Instant save</option></select></SettingRow>
            <SettingRow label="Default Page"><select value={settings.quickSaveDefaultPageId ?? ""} onChange={(event) => { const pageId = event.target.value; const board = props.workspace.boards.find((item) => item.pageId === pageId); void patchSettings({ quickSaveDefaultPageId: pageId, quickSaveDefaultBoardId: board?.id ?? null }); }}>{props.workspace.pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}</select></SettingRow>
            <SettingRow label="Default Board"><select value={settings.quickSaveDefaultBoardId ?? ""} onChange={(event) => void patchSettings({ quickSaveDefaultBoardId: event.target.value })}>{props.workspace.pages.map((page) => <optgroup key={page.id} label={page.title}>{props.workspace.boards.filter((board) => board.pageId === page.id).map((board) => <option key={board.id} value={board.id}>{board.title}</option>)}</optgroup>)}</select></SettingRow>
            <SettingRow label="Keyboard shortcut" description="Chrome controls the final key binding."><div className="shortcut-value"><kbd>{shortcut}</kbd><Button onClick={() => void browser.tabs.create({ url: "chrome://extensions/shortcuts" })}>Configure</Button></div></SettingRow>
          </SettingsSection> : null}

          {section === "search" ? <SettingsSection title="Search" description="Local full-text index; saved text never leaves the browser.">
            <SettingRow label="Indexed fields" description="Title, hostname, URL, description, Page, and Board."><span className="status-good">MiniSearch local index</span></SettingRow>
            <SettingRow label="Recent queries" description={settings.recentQueries.length ? settings.recentQueries.join(" · ") : "No recent queries saved."}><Button disabled={settings.recentQueries.length === 0} onClick={() => void patchSettings({ recentQueries: [] }, "Recent searches cleared")}>Clear history</Button></SettingRow>
            <SettingRow label="Privacy behavior" description="Search results and query content are hidden while Privacy Mode is enabled."><LockKeyhole size={20} /></SettingRow>
          </SettingsSection> : null}

          {section === "import-export" ? <SettingsSection title="Import & Export" description="Portable backups are always available without an account.">
            <div className="action-grid"><button onClick={() => void exportAll("json")}><FileJson /><strong>JSON backup</strong><span>Complete versioned workspace</span></button><button onClick={() => void exportAll("html")}><BookOpen /><strong>Netscape HTML</strong><span>Compatible bookmark file</span></button><button onClick={() => void exportAll("markdown")}><FileText /><strong>Markdown</strong><span>Readable link outline</span></button><button onClick={() => importInputRef.current?.click()}><Upload /><strong>Import a file</strong><span>JSON or bookmark HTML</span></button><button onClick={() => void requestChromeImport()}><Download /><strong>Chrome bookmarks</strong><span>Permission requested only now</span></button><button onClick={() => void createSnapshot("manual").then(() => props.onUpdated("Local snapshot created"))}><Archive /><strong>Create snapshot</strong><span>Stored locally, bounded history</span></button></div>
            <input ref={importInputRef} hidden type="file" accept="application/json,text/html,.json,.html,.htm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImportFile(file); event.currentTarget.value = ""; }} />
            {importRecordsPreview.length > 0 ? <div className="import-preview"><h3>Preview: {importSource}</h3><p>{importRecordsPreview.length} valid links across {new Set(importRecordsPreview.map((record) => record.folderPath.at(-1) || "Imported bookmarks")).size} folders. No changes have been written yet.</p><div className="form-row"><label>New Page name<input value={importPageTitle} onChange={(event) => setImportPageTitle(event.target.value)} /></label><label>Duplicates<select value={duplicateStrategy} onChange={(event) => setDuplicateStrategy(event.target.value as "skip" | "allow")}><option value="skip">Skip in same Board</option><option value="allow">Allow copies</option></select></label></div><div className="button-row"><Button onClick={() => { setImportRecordsPreview([]); setImportSource(""); }}>Cancel</Button><Button variant="primary" disabled={importBusy} onClick={() => void commitRecordImport()}>Import {importRecordsPreview.length} links</Button></div></div> : null}
            {backupPreview ? <div className="import-preview"><h3>Backup preview: {importSource}</h3><p>{backupPreview.entities.pages.length} Pages, {backupPreview.entities.boards.length} Boards, {backupPreview.entities.bookmarks.length} Bookmarks. Exported {new Date(backupPreview.exportedAt).toLocaleString()}.</p><div className="button-row"><Button onClick={() => { setBackupPreview(null); setImportSource(""); }}>Cancel</Button><Button disabled={importBusy} onClick={() => void commitBackupRestore("merge")}>Merge</Button><Button variant="danger" disabled={importBusy} onClick={() => void commitBackupRestore("replace")}>Replace local data</Button></div></div> : null}
          </SettingsSection> : null}

          {section === "trash" ? <SettingsSection title="Trash" description="Soft deletion protects against accidental loss.">
            <SettingRow label="Automatic cleanup" description="Choose how long deleted items remain recoverable."><select value={settings.trashRetentionDays ?? "never"} onChange={(event) => void patchSettings({ trashRetentionDays: event.target.value === "never" ? null : Number(event.target.value) as 7 | 30 | 90 })}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="never">Never</option></select></SettingRow>
            <SettingRow label="Review deleted items" description="Restore or permanently delete individual entities."><Button icon={<Trash2 size={16} />} onClick={props.onOpenTrash}>Open Trash</Button></SettingRow>
          </SettingsSection> : null}

          {section === "sync" ? <SettingsSection title="Sync" description="Optional cloud mode never blocks the local workspace.">
            <div className="feature-status"><Cloud size={28} /><div><strong>Local-only mode is active</strong><p>No cloud endpoint or credential is bundled. Every core function remains available offline.</p></div><span>Disabled safely</span></div>
            <SettingRow label="Optional Supabase setup" description="The repository includes PKCE/RLS configuration and migrations. Enabling it requires your own project URL and publishable key."><code>WXT_ENABLE_CLOUD_SYNC=true</code></SettingRow>
            <SettingRow label="Local source of truth" description="Cloud errors never make this workspace read-only."><CheckCircle2 className="success-icon" /></SettingRow>
          </SettingsSection> : null}

          {section === "privacy" ? <SettingsSection title="Privacy" description="A local-only product with no ads, analytics, or history collection.">
            <SettingRow label="Persist Privacy Mode" description="Otherwise protection resets when a browser session ends."><label className="switch"><input type="checkbox" checked={settings.privacyPersist} onChange={(event) => void patchSettings({ privacyPersist: event.target.checked, ...(event.target.checked ? {} : { privacyEnabled: false }) })} /><span /></label></SettingRow>
            <SettingRow label="Stored data" description="Only user-saved URL, title, description, placement, appearance, and optional sync identity."><Database size={20} /></SettingRow>
            <SettingRow label="Not collected" description="Browsing history, page content, forms, cookies, passwords, screenshots, and clipboard history."><Shield size={20} /></SettingRow>
          </SettingsSection> : null}

          {section === "keyboard" ? <SettingsSection title="Keyboard" description="Every drag action also has a keyboard-accessible alternative.">
            <ShortcutRow keys="Ctrl / ⌘ + K" label="Search and command palette" /><ShortcutRow keys={shortcut} label="Quick Save current page" /><ShortcutRow keys="Enter" label="Confirm dialogs and Quick Save" /><ShortcutRow keys="Esc" label="Close, cancel, or abort drag" /><ShortcutRow keys="Tab / Shift+Tab" label="Move focus" />
            <Button onClick={() => void browser.tabs.create({ url: "chrome://extensions/shortcuts" })}>Open Chrome shortcut settings</Button>
          </SettingsSection> : null}

          {section === "about" ? <SettingsSection title="About Asterfold" description="An original local-first visual bookmark workspace.">
            <div className="about-block"><div className="about-mark">✦</div><div><h3>Asterfold 1.0.0</h3><p>Manifest V3 · Schema 2 · Chrome 120+</p></div></div>
            <SettingRow label="Business model" description="No subscription, ads, affiliate links, analytics, or artificial limits."><span className="status-good">Personal and private</span></SettingRow>
            <SettingRow label="Implementation" description="Original name, mark, visual system, assets, and source code."><Shield size={20} /></SettingRow>
          </SettingsSection> : null}

          {section === "diagnostics" ? <SettingsSection title="Diagnostics" description="All diagnostic information stays local until you explicitly export it.">
            <div className="diagnostic-grid"><Metric icon={BookOpen} label="Pages" value={String(counts.pages)} /><Metric icon={Archive} label="Boards" value={String(counts.boards)} /><Metric icon={FileText} label="Bookmarks" value={String(counts.bookmarks)} /><Metric icon={Database} label="Storage used" value={formatBytes(storage?.usage)} /><Metric icon={Gauge} label="Storage quota" value={formatBytes(storage?.quota)} /><Metric icon={CheckCircle2} label="Invariants" value={invariants.length ? `${invariants.length} issues` : "Healthy"} /></div>
            {invariants.length ? <div className="diagnostic-issues">{invariants.map((issue) => <p key={issue}>{issue}</p>)}</div> : <div className="feature-status feature-status--success"><CheckCircle2 /><div><strong>No integrity issues found</strong><p>All active entities have valid parents and safe URLs.</p></div></div>}
            <div className="button-row"><Button icon={<RefreshCcw size={16} />} onClick={() => void ensureStarterWorkspace().then(() => auditInvariants()).then((issues) => { setInvariants(issues); props.onUpdated(issues.length ? "Repair finished with remaining issues" : "Safe repair completed"); })}>Safe repair</Button><Button icon={<Download size={16} />} onClick={() => downloadText("asterfold-diagnostics.json", JSON.stringify({ version: "1.0.0", schemaVersion: settings.schemaVersion, counts, storage, invariants, exportedAt: new Date().toISOString() }, null, 2), "application/json")}>Export diagnostics</Button></div>
          </SettingsSection> : null}
        </div>
      </div>
    </Modal>
  );
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="settings-section"><header><h2>{title}</h2><p>{description}</p></header><div className="settings-section__body">{children}</div></section>;
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return <div className="setting-row"><div><strong>{label}</strong>{description ? <p>{description}</p> : null}</div><div className="setting-row__control">{children}</div></div>;
}

function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return <div className="shortcut-row"><kbd>{keys}</kbd><span>{label}</span></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Info; label: string; value: string }) {
  return <div className="metric"><Icon size={18} /><span>{label}</span><strong>{value}</strong></div>;
}
