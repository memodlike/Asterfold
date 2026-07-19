import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Edit3, ExternalLink, Link2, MoveRight, Search, ShieldCheck, Trash2 } from "lucide-react";
import type { Board, Bookmark, Page } from "../../domain/models";
import { BookmarkSearchEngine, createSearchDocuments, type SearchField, type SearchMode } from "../../search/searchEngine";
import { Modal } from "../../components/Modal";
import { useI18n } from "../../i18n";

interface SearchPaletteProps {
  open: boolean;
  privacy: boolean;
  pages: Page[];
  boards: Board[];
  bookmarks: Bookmark[];
  activePageId: string;
  onClose: () => void;
  onOpen: (bookmark: Bookmark) => void;
  onReveal: (bookmark: Bookmark, pageId: string) => void;
  onEdit: (bookmark: Bookmark) => void;
  onMove: (bookmark: Bookmark) => void;
  onCopy: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
  onQueryCommitted: (query: string) => void;
}

export function SearchPalette(props: SearchPaletteProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("fuzzy");
  const [field, setField] = useState<SearchField>("all");
  const [scope, setScope] = useState<"all" | "page">("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const engine = useMemo(() => new BookmarkSearchEngine(createSearchDocuments(props.pages, props.boards, props.bookmarks)), [props.boards, props.bookmarks, props.pages]);
  const results = useMemo(() => props.privacy ? [] : engine.search(query, { mode, field, ...(scope === "page" ? { pageId: props.activePageId } : {}), limit: 40 }), [engine, field, mode, props.activePageId, props.privacy, query, scope]);
  const bookmarkById = useMemo(() => new Map(props.bookmarks.map((bookmark) => [bookmark.id, bookmark])), [props.bookmarks]);

  useEffect(() => {
    if (props.open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [props.open]);

  const close = (): void => {
    if (query.trim()) props.onQueryCommitted(query.trim());
    props.onClose();
  };

  const activate = (): void => {
    const result = results[activeIndex];
    const bookmark = result ? bookmarkById.get(result.id) : undefined;
    if (bookmark) {
      props.onOpen(bookmark);
      close();
    }
  };

  return (
    <Modal open={props.open} size="large" title={t("search.title")} onClose={close}>
      <div className="search-palette" onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((current) => Math.min(results.length - 1, current + 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => Math.max(0, current - 1)); }
        if (event.key === "Enter") { event.preventDefault(); activate(); }
      }}>
        <div className="search-palette__input"><Search size={21} /><input ref={inputRef} disabled={props.privacy} value={props.privacy ? t("search.protected") : query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} placeholder={t("search.placeholder")} /></div>
        <div className="search-palette__filters">
          <div className="segmented" aria-label={t("search.mode")}>{(["fuzzy", "prefix", "exact"] as const).map((item) => <button className={mode === item ? "is-active" : ""} key={item} onClick={() => { setMode(item); setActiveIndex(0); }}>{t(item === "fuzzy" ? "search.fuzzy" : item === "prefix" ? "search.prefix" : "search.exact")}</button>)}</div>
          <select value={field} onChange={(event) => { setField(event.target.value as SearchField); setActiveIndex(0); }} aria-label={t("search.title")}><option value="all">{t("search.allFields")}</option><option value="title">{t("search.titleOnly")}</option><option value="url">{t("search.urlOnly")}</option></select>
          <div className="segmented"><button className={scope === "all" ? "is-active" : ""} onClick={() => { setScope("all"); setActiveIndex(0); }}>{t("search.all")}</button><button className={scope === "page" ? "is-active" : ""} onClick={() => { setScope("page"); setActiveIndex(0); }}>{t("search.thisPage")}</button></div>
        </div>
        {props.privacy ? <div className="search-private"><ShieldCheck size={30} /><strong>{t("search.privateTitle")}</strong><span>{t("search.privateBody")}</span></div> : null}
        {!props.privacy && query && results.length === 0 ? <div className="search-empty">{t("search.noMatches")}</div> : null}
        {!props.privacy && !query ? <div className="search-empty">{t("search.start")}</div> : null}
        <div className="search-results" role="listbox" aria-label={t("search.results")}>
          {results.map((result, index) => {
            const bookmark = bookmarkById.get(result.id);
            if (!bookmark) return null;
            return (
              <div key={result.id} role="option" aria-selected={index === activeIndex} className={`search-result ${index === activeIndex ? "is-active" : ""}`} onMouseEnter={() => setActiveIndex(index)}>
                <button className="search-result__main" onClick={() => { props.onOpen(bookmark); close(); }}><span className="result-monogram">{result.hostname[0]?.toUpperCase()}</span><span><strong>{result.title}</strong><small>{result.hostname} · {result.pageTitle} / {result.boardTitle}</small><em>{result.description}</em></span></button>
                <div className="search-result__actions">
                  <button onClick={() => { props.onReveal(bookmark, result.pageId); close(); }}><ExternalLink size={14} />{t("search.reveal")}</button>
                  <button onClick={() => { props.onEdit(bookmark); close(); }}><Edit3 size={14} />{t("bookmark.edit")}</button>
                  <button onClick={() => { props.onMove(bookmark); close(); }}><MoveRight size={14} />{t("generic.move")}</button>
                  <button onClick={() => props.onCopy(bookmark)}><Copy size={14} />{t("bookmark.copyUrl")}</button>
                  <button aria-label="Copy URL" onClick={() => props.onCopy(bookmark)}><Link2 size={14} /></button>
                  <button className="danger" onClick={() => { props.onDelete(bookmark); close(); }}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
        <footer className="search-palette__footer"><span><kbd>↑</kbd><kbd>↓</kbd> {t("search.navigate")}</span><span><kbd>Enter</kbd> {t("generic.open")}</span><span><kbd>Esc</kbd> {t("generic.close")}</span></footer>
      </div>
    </Modal>
  );
}
