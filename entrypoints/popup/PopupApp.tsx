import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ExternalLink, RefreshCw, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { openWorkspace } from "../../src/browser/api";
import { Logo } from "../../src/components/Logo";
import { useWorkspace } from "../../src/app/useWorkspace";
import { translate, type MessageKey } from "../../src/i18n";
import { usePrivacyMode } from "../../src/app/usePrivacyMode";
import { applyPopupTheme } from "../../src/features/appearance/popupTheme";
import { readChromeBookmarks } from "../../src/features/onboarding/chromeBookmarkImport";
import { importRecords } from "../../src/services/exportImport";

export function PopupApp() {
  const { workspace, failed, retry } = useWorkspace();
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const t = useCallback((key: MessageKey, values?: Record<string, string | number>): string => translate(workspace?.settings.locale ?? "auto", key, values), [workspace?.settings.locale]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { privacy } = usePrivacyMode(workspace?.settings ?? { privacyPersist: false, privacyEnabled: false });

  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const update = (): void => setSystemDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (workspace?.settings.theme) applyPopupTheme(document.documentElement, workspace.settings.theme, systemDark);
  }, [systemDark, workspace?.settings.theme]);

  useEffect(() => {
    if (workspace && performance.getEntriesByName("asterfold-popup-interactive").length === 0) {
      performance.mark("asterfold-popup-interactive");
    }
  }, [workspace]);

  const counts = useMemo(() => {
    if (!workspace) return { pages: 0, boards: 0, bookmarks: 0 };
    return {
      pages: workspace.pages.filter((p) => p.deletedAt === null).length,
      boards: workspace.boards.filter((b) => b.deletedAt === null).length,
      bookmarks: workspace.bookmarks.filter((bm) => bm.deletedAt === null).length,
    };
  }, [workspace]);

  const syncChromeBookmarks = async (): Promise<void> => {
    if (syncing) return;
    setSyncing(true);
    setStatus(null);
    setError(null);
    try {
      const result = await readChromeBookmarks(true);
      if (result.status !== "granted") {
        setError(t("error.chromeBookmarksUnavailable"));
        return;
      }
      const summary = await importRecords(result.records, { pageTitle: t("settings.chromeBookmarks") }, "skip");
      setStatus(t("settings.imported", { count: summary.imported }));
    } catch {
      setError(t("error.chromeBookmarksUnavailable"));
    } finally {
      setSyncing(false);
    }
  };

  if (failed) {
    return (
      <div className="popup-loading">
        <AlertTriangle size={20} />
        {t("error.actionFailed")}
        <button onClick={retry}>{t("generic.retry")}</button>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="popup-loading">
        <Sparkles size={20} />
        {t("popup.preparing")}
      </div>
    );
  }

  return (
    <main className="popup" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void openWorkspace(); } }}>
      <header className="popup__header">
        <Logo />
        <button title={t("generic.settings")} aria-label={t("generic.settings")} onClick={() => void openWorkspace()}>
          <Settings size={17} />
        </button>
      </header>

      <section className="popup__content">
        <div className="popup__title">
          <h1>Asterfold</h1>
        </div>

        <div className="tab-preview">
          <span className="tab-preview__icon">
            <ShieldCheck size={20} />
          </span>
          <div>
            <strong>{privacy ? t("privacy.on") : t("settings.healthy")}</strong>
            <small>{privacy ? "••••••" : t("popup.localOnly")}</small>
          </div>
        </div>

        <div className="popup-grid">
          <div className="tab-preview" style={{ minHeight: "52px" }}>
            <div>
              <small>{t("launcher.pages")}</small>
              <strong>{privacy ? "••" : counts.pages}</strong>
            </div>
          </div>
          <div className="tab-preview" style={{ minHeight: "52px" }}>
            <div>
              <small>{t("trash.bookmarks")}</small>
              <strong>{privacy ? "••" : counts.bookmarks}</strong>
            </div>
          </div>
        </div>

        <button
          className="workspace-button"
          disabled={syncing}
          onClick={() => void syncChromeBookmarks()}
          style={{ minHeight: "38px" }}
        >
          <RefreshCw size={15} className={syncing ? "spin" : ""} />
          {syncing ? t("popup.saving") : t("settings.importChrome")}
        </button>

        {error ? (
          <div className="popup-error" role="alert">
            <AlertTriangle size={17} />
            {error}
          </div>
        ) : null}

        {status ? (
          <div className="popup-success" role="status">
            <Check size={17} />
            {status}
          </div>
        ) : null}
      </section>

      <div className="popup__actions">
        <button className="save-button" onClick={() => void openWorkspace()}>
          <ExternalLink size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
          {t("popup.openWorkspace")}
        </button>
      </div>

      <footer>
        <span>{t("popup.localOnly")}</span>
        <span>Asterfold 3.4.1</span>
      </footer>
    </main>
  );
}
