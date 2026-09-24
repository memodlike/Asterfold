import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Copy, Edit3, ExternalLink, MoveRight, Search, ShieldCheck, Trash2 } from "lucide-react";
import type { Board, Bookmark, Page } from "../../domain/models";
import { BookmarkSearchEngine, createSearchDocuments, type SearchField, type SearchMode } from "../../search/searchEngine";
import { Modal } from "../../components/Modal";
import { SelectField } from "../../components/SelectField";
import { BrowserFavicon } from "../../components/BrowserFavicon";
import { faviconUrl } from "../../browser/api";
import { useI18n } from "../../i18n";
import { primaryShortcut } from "../../browser/platform";
import { highlightMatch } from "./highlightMatch";
import { useBoardHighlights } from "./useBoardHighlights";
import "./spotlight.css";

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
}

export function SearchPalette(props: SearchPaletteProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("fuzzy");
  const [field, setField] = useState<SearchField>("all");
  const [scope, setScope] = useState<"all" | "page">("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const engine = useMemo(() => props.privacy ? null : new BookmarkSearchEngine(createSearchDocuments(props.pages, props.boards, props.bookmarks)), [props.boards, props.bookmarks, props.pages, props.privacy]);
  const results = useMemo(() => engine?.search(query, { mode, field, ...(scope === "page" ? { pageId: props.activePageId } : {}), limit: 40 }) ?? [], [engine, field, mode, props.activePageId, query, scope]);
  const bookmarkById = useMemo(() => new Map(props.bookmarks.map((bookmark) => [bookmark.id, bookmark])), [props.bookmarks]);
  const searchShortcut = primaryShortcut("K");
  const fieldOptions = useMemo(() => [
    { value: "all", label: t("search.allFields") },
    { value: "title", label: t("search.titleOnly") },
    { value: "url", label: t("search.urlOnly") },
  ], [t]);
  const onPageHits = useMemo(() => results.filter((result) => result.pageId === props.activePageId).map((result) => result.id), [props.activePageId, results]);
  const activeResult = results[activeIndex];
  useBoardHighlights(!props.privacy && query.trim().length > 0, onPageHits, activeResult?.pageId === props.activePageId ? activeResult.id : null);

  useEffect(() => {
    if (props.open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [props.open]);

  useEffect(() => {
    setActiveIndex((current) => results.length === 0 ? 0 : Math.min(current, results.length - 1));
  }, [results.length]);

  useEffect(() => {
    const row = listRef.current?.children[activeIndex];
    if (row instanceof HTMLElement && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const close = (): void => {
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

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown" && results.length > 0) { event.preventDefault(); setActiveIndex((current) => Math.min(results.length - 1, current + 1)); }
    if (event.key === "ArrowUp" && results.length > 0) { event.preventDefault(); setActiveIndex((current) => Math.max(0, current - 1)); }
    if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); activate(); }
  };

  return (
    <Modal open={props.open} size="large" header="hidden" className="spotlight" backdropClassName="modal-backdrop--spotlight" title={t("search.title")} description={t("search.placeholder")} onClose={close}>
      <div className="spotlight__field">
        <Search size={20} aria-hidden="true" />
        <input ref={inputRef} maxLength={240} disabled={props.privacy} value={props.privacy ? t("search.protected") : query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={handleSearchKeyDown} placeholder={t("search.placeholder")} aria-label={t("search.title")} aria-keyshortcuts={searchShortcut.aria} aria-controls="spotlight-results" aria-activedescendant={activeResult ? `spotlight-result-${activeResult.id}` : undefined} />
        {!props.privacy && query.trim() ? <span className="spotlight__count" role="status">{t("search.found", { count: results.length })}</span> : null}
        <kbd>Esc</kbd>
      </div>
      <div className="spotlight__panel">
        <div className="spotlight__filters" role="group" aria-label={t("search.mode")}>
          <div className="segmented">{(["fuzzy", "prefix", "exact"] as const).map((item) => <button type="button" className={mode === item ? "is-active" : ""} aria-pressed={mode === item} key={item} onClick={() => { setMode(item); setActiveIndex(0); }}>{t(item === "fuzzy" ? "search.fuzzy" : item === "prefix" ? "search.prefix" : "search.exact")}</button>)}</div>
          <SelectField compact className="spotlight__select" value={field} options={fieldOptions} label={t("search.title")} onChange={(value) => { setField(value as SearchField); setActiveIndex(0); }} />
          <div className="segmented"><button type="button" aria-pressed={scope === "all"} className={scope === "all" ? "is-active" : ""} onClick={() => { setScope("all"); setActiveIndex(0); }}>{t("search.all")}</button><button type="button" aria-pressed={scope === "page"} className={scope === "page" ? "is-active" : ""} onClick={() => { setScope("page"); setActiveIndex(0); }}>{t("search.thisPage")}</button></div>
        </div>
        {props.privacy ? <div className="spotlight__state"><span className="spotlight__state-icon"><ShieldCheck size={20} /></span><div><strong>{t("search.privateTitle")}</strong><span>{t("search.privateBody")}</span></div></div> : null}
        {!props.privacy && query && results.length === 0 ? <div className="spotlight__state"><span className="spotlight__state-icon"><Search size={20} /></span><div><strong>{t("search.noMatches")}</strong></div></div> : null}
        {!props.privacy && !query ? <div className="spotlight__state"><span className="spotlight__state-icon"><Search size={20} /></span><div><strong>{t("search.start")}</strong><span>{t("search.placeholder")}</span></div></div> : null}
        <div ref={listRef} id="spotlight-results" className="spotlight__results" role="list" aria-label={t("search.results")}>
          {results.map((result, index) => {
            const bookmark = bookmarkById.get(result.id);
            if (!bookmark) return null;
            const faviconSource = props.privacy ? "" : faviconUrl(bookmark.url, 32);
            const active = index === activeIndex;
            return (
              <div key={result.id} id={`spotlight-result-${result.id}`} role="listitem" className={`spotlight__result ${active ? "is-active" : ""}`} onMouseEnter={() => setActiveIndex(index)}>
                <button type="button" aria-current={active ? "true" : undefined} className="spotlight__open" onClick={() => { props.onOpen(bookmark); close(); }}>
                  <span className="spotlight__favicon"><BrowserFavicon source={faviconSource} privacy={props.privacy} fallback={<span>{result.hostname[0]?.toUpperCase()}</span>} /></span>
                  <span className="spotlight__text">
                    <strong>{highlightMatch(result.title, query)}</strong>
                    <small>{highlightMatch(result.hostname, query)}</small>
                    {result.description ? <em>{result.description}</em> : null}
                  </span>
                  <span className="spotlight__path">{result.pageId === props.activePageId ? result.boardTitle : `${result.pageTitle} › ${result.boardTitle}`}</span>
                </button>
                <div className="spotlight__actions">
                  <button type="button" aria-label={t("search.reveal")} title={t("search.reveal")} onClick={() => { props.onReveal(bookmark, result.pageId); close(); }}><ExternalLink size={14} /></button>
                  <button type="button" aria-label={t("bookmark.edit")} title={t("bookmark.edit")} onClick={() => { props.onEdit(bookmark); close(); }}><Edit3 size={14} /></button>
                  <button type="button" aria-label={t("generic.move")} title={t("generic.move")} onClick={() => { props.onMove(bookmark); close(); }}><MoveRight size={14} /></button>
                  <button type="button" aria-label={t("bookmark.copyUrl")} title={t("bookmark.copyUrl")} onClick={() => props.onCopy(bookmark)}><Copy size={14} /></button>
                  <button type="button" className="danger" aria-label={t("generic.delete")} title={t("generic.delete")} onClick={() => { props.onDelete(bookmark); close(); }}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
        <footer className="spotlight__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> {t("search.navigate")}</span>
          <span><kbd>Enter</kbd> {t("generic.open")}</span>
          <span><kbd>Esc</kbd> {t("generic.close")}</span>
          {onPageHits.length > 0 ? <span className="spotlight__hint"><i aria-hidden="true" />{t("search.boardHint")}</span> : null}
        </footer>
      </div>
    </Modal>
  );
}
