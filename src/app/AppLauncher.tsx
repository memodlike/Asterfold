import { useEffect, useRef, useState } from "react";
import { FolderPlus, Layers3, Search, Settings, Shield, ShieldCheck, Trash2 } from "lucide-react";
import type { Page } from "../domain/models";
import { useI18n } from "../i18n";

interface AppLauncherProps {
  pages: Page[];
  activePageId: string;
  privacy: boolean;
  onCreateBoard: () => void;
  onCreatePage: () => void;
  onSelectPage: (id: string) => void;
  onSearch: () => void;
  onPrivacy: () => void;
  onTrash: () => void;
  onSettings: () => void;
}

export function AppLauncher(props: AppLauncherProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);

  const cancelClose = (): void => {
    if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current);
  };
  const scheduleClose = (): void => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setPagesOpen(false);
    }, 350);
  };

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

  const act = (callback: () => void): void => {
    callback();
    setOpen(false);
    setPagesOpen(false);
  };

  return (
    <div ref={rootRef} className={`app-launcher ${open ? "is-open" : ""}`} onPointerEnter={cancelClose} onPointerLeave={scheduleClose}>
      {open ? (
        <div className="launcher-menu" role="menu">
          <button role="menuitem" onClick={() => act(props.onCreateBoard)}><FolderPlus size={17} /><span>{t("launcher.newBoard")}</span></button>
          <button role="menuitem" aria-expanded={pagesOpen} onClick={() => setPagesOpen((value) => !value)}><Layers3 size={17} /><span>{t("launcher.pages")}</span></button>
          {pagesOpen ? <div className="launcher-pages"><button className="launcher-pages__create" onClick={() => act(props.onCreatePage)}><FolderPlus size={14} />{t("name.newPage")}</button>{props.pages.map((page) => <button key={page.id} className={page.id === props.activePageId ? "is-active" : ""} onClick={() => act(() => props.onSelectPage(page.id))}>{page.title}</button>)}</div> : null}
          <button role="menuitem" onClick={() => act(props.onSearch)}><Search size={17} /><span>{t("generic.search")}</span></button>
          <button role="menuitem" className={props.privacy ? "is-active" : ""} onClick={() => act(props.onPrivacy)}>{props.privacy ? <ShieldCheck size={17} /> : <Shield size={17} />}<span>{t(props.privacy ? "launcher.privacyOn" : "launcher.privacyOff")}</span></button>
          <button role="menuitem" onClick={() => act(props.onTrash)}><Trash2 size={17} /><span>{t("generic.trash")}</span></button>
          <button role="menuitem" onClick={() => act(props.onSettings)}><Settings size={17} /><span>{t("generic.settings")}</span></button>
        </div>
      ) : null}
      <button className="launcher-trigger" aria-label={t("launcher.label")} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <img src="/icons/mark-monochrome.svg" alt="" />
        <span>Asterfold</span>
      </button>
    </div>
  );
}
