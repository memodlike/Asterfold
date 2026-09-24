import { useEffect, useRef, useState } from "react";
import { Bookmark as BookmarkIcon, ChevronLeft, ChevronRight, Copy, FolderPlus, LayoutGrid, Layers3, Pencil, Plus, Search, Settings, Shield, ShieldCheck, Star, Trash2 } from "lucide-react";
import type { Page } from "../domain/models";
import { FloatingContextMenu, type ContextMenuPoint } from "../components/FloatingContextMenu";
import { primaryShortcut } from "../browser/platform";
import { useI18n } from "../i18n";
import "./launcher.css";

interface AppLauncherProps {
  pages: Page[];
  activePageId: string;
  privacy: boolean;
  pageStats?: { boards: number; bookmarks: number };
  onCreateBoard: () => void;
  onCreatePage: () => void;
  onSelectPage: (id: string) => void;
  onRenamePage: (page: Page) => void;
  onDuplicatePage: (page: Page) => void;
  onDefaultPage: (page: Page) => void;
  onMovePage: (page: Page, targetIndex: number) => void;
  onDeletePage: (page: Page) => void;
  onSearch: () => void;
  onPrivacy: () => void;
  onTrash: () => void;
  onSettings: () => void;
  showFirstRunHint?: boolean;
  onDismissFirstRunHint?: () => void;
}

export function AppLauncher(props: AppLauncherProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [pageMenu, setPageMenu] = useState<{ page: Page; point: ContextMenuPoint } | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchShortcut = primaryShortcut("K");
  const activePage = props.pages.find((page) => page.id === props.activePageId);

  const cancelClose = (): void => {
    if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current);
  };
  const scheduleClose = (): void => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      if (rootRef.current?.contains(document.activeElement)) return;
      setOpen(false);
      setPagesOpen(false);
    }, 350);
  };

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }, [open]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setPagesOpen(false);
      }
    };
    const closeEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
        setPagesOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      cancelClose();
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  const discover = (): void => {
    if (props.showFirstRunHint) props.onDismissFirstRunHint?.();
  };

  const act = (callback: () => void): void => {
    discover();
    callback();
    setOpen(false);
    setPagesOpen(false);
  };

  return (
    <div ref={rootRef} className={`app-launcher ${open ? "is-open" : ""}`} onPointerEnter={cancelClose} onPointerLeave={scheduleClose}>
      {props.showFirstRunHint ? (
        <aside className="launcher-discovery" aria-label={t("launcher.discoveryTitle")}>
          <button className="launcher-discovery__dismiss" aria-label={t("launcher.discoveryDismiss")} onClick={props.onDismissFirstRunHint}>×</button>
          <strong>{t("launcher.discoveryTitle")}</strong>
          <p>{t("launcher.discoveryBody")}</p>
          <button className="launcher-discovery__action" onClick={() => { discover(); setOpen(true); }}>
            {t("launcher.discoveryAction")}
          </button>
        </aside>
      ) : null}
      {open ? (
        <div ref={menuRef} className="launcher-menu" role="menu" aria-label={t("launcher.label")} onKeyDown={(event) => {
          const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")].filter((item) => item.offsetParent !== null);
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items[next]?.focus();
          }
        }}>
          <div className="launcher-menu__header" role="presentation">
            <span className="launcher-menu__page"><span className="launcher-menu__dot" aria-hidden="true" />{props.privacy || !activePage ? t("generic.page") : activePage.title}</span>
            {props.pageStats ? (
              <span className="launcher-menu__stats" title={t("launcher.pageSummary", props.pageStats)}>
                <span aria-hidden="true"><LayoutGrid size={12} />{props.pageStats.boards}</span>
                <span aria-hidden="true"><BookmarkIcon size={12} />{props.pageStats.bookmarks}</span>
                <span className="sr-only">{t("launcher.pageSummary", props.pageStats)}</span>
              </span>
            ) : null}
          </div>
          <button role="menuitem" onClick={() => act(props.onCreateBoard)}><FolderPlus size={17} /><span>{t("launcher.newBoard")}</span></button>
          <div className="launcher-menu__separator" role="separator" />
          <button role="menuitem" aria-expanded={pagesOpen} onClick={() => setPagesOpen((value) => !value)}>
            <Layers3 size={17} /><span>{t("launcher.pages")}</span>
            <span className="launcher-menu__trail" aria-hidden="true"><span className="launcher-menu__count">{props.pages.length}</span><ChevronRight size={14} className="launcher-menu__chevron" /></span>
          </button>
          {pagesOpen ? (
            <div className="launcher-pages" role="group" aria-label={t("launcher.pages")}>
              {props.pages.map((page) => <button role="menuitem" key={page.id} aria-current={page.id === props.activePageId ? "page" : undefined} className={page.id === props.activePageId ? "is-active" : ""} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setPageMenu({ page, point: { x: event.clientX, y: event.clientY } }); }} onKeyDown={(event) => { if (event.shiftKey && event.key === "F10") { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setPageMenu({ page, point: { x: rect.right, y: rect.bottom } }); } }} onClick={() => act(() => props.onSelectPage(page.id))}>{page.title}</button>)}
              <button role="menuitem" className="launcher-pages__create" aria-label={t("name.newPage")} title={t("name.newPage")} onClick={() => act(props.onCreatePage)}><Plus size={14} /></button>
            </div>
          ) : null}
          <button role="menuitem" aria-keyshortcuts={searchShortcut.aria} onClick={() => act(props.onSearch)}>
            <Search size={17} /><span>{t("generic.search")}</span>
            <span className="launcher-menu__trail" aria-hidden="true"><kbd>{searchShortcut.visual}</kbd></span>
          </button>
          <button role="menuitemcheckbox" aria-checked={props.privacy} className={props.privacy ? "is-active" : ""} onClick={() => act(props.onPrivacy)}>
            {props.privacy ? <ShieldCheck size={17} /> : <Shield size={17} />}<span>{t("launcher.privacy")}</span>
            <span className="launcher-menu__trail" aria-hidden="true"><span className={`launcher-switch ${props.privacy ? "is-on" : ""}`} aria-hidden="true" /></span>
          </button>
          <div className="launcher-menu__separator" role="separator" />
          <button role="menuitem" onClick={() => act(props.onTrash)}><Trash2 size={17} /><span>{t("generic.trash")}</span></button>
          <button role="menuitem" onClick={() => act(props.onSettings)}><Settings size={17} /><span>{t("generic.settings")}</span></button>
        </div>
      ) : null}
      <button ref={triggerRef} className="launcher-trigger" aria-label={t("launcher.label")} aria-haspopup="menu" aria-expanded={open} onClick={() => { discover(); setOpen((value) => !value); }}>
        <img src="/icons/mark-monochrome.svg" alt="" />
        <span>Asterfold</span>
      </button>
      {pageMenu ? <FloatingContextMenu label={t("generic.page")} point={pageMenu.point} onClose={() => setPageMenu(null)}>
        <button onClick={() => { props.onRenamePage(pageMenu.page); setPageMenu(null); }}><Pencil size={15} />{t("generic.rename")}</button>
        <button onClick={() => { props.onDuplicatePage(pageMenu.page); setPageMenu(null); }}><Copy size={15} />{t("generic.duplicate")}</button>
        <button disabled={pageMenu.page.isDefault} onClick={() => { props.onDefaultPage(pageMenu.page); setPageMenu(null); }}><Star size={15} />{t("settings.defaultPage")}</button>
        <button disabled={props.pages.findIndex((page) => page.id === pageMenu.page.id) <= 0} onClick={() => { props.onMovePage(pageMenu.page, props.pages.findIndex((page) => page.id === pageMenu.page.id) - 1); setPageMenu(null); }}><ChevronLeft size={15} />{t("generic.moveLeft")}</button>
        <button disabled={props.pages.findIndex((page) => page.id === pageMenu.page.id) >= props.pages.length - 1} onClick={() => { props.onMovePage(pageMenu.page, props.pages.findIndex((page) => page.id === pageMenu.page.id) + 1); setPageMenu(null); }}><ChevronRight size={15} />{t("generic.moveRight")}</button>
        <button className="danger" onClick={() => { props.onDeletePage(pageMenu.page); setPageMenu(null); }}><Trash2 size={15} />{t("bookmark.moveTrash")}</button>
      </FloatingContextMenu> : null}
    </div>
  );
}
