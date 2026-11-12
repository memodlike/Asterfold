import { useRef, useState, type DragEvent } from "react";
import { ExternalLink, FileUp, ShieldCheck } from "lucide-react";
import { openChromeBookmarkManager } from "../../browser/api";
import { isApplePlatform } from "../../browser/platform";
import type { MessageKey } from "../../i18n";
import "./importGuide.css";

interface ChromeImportGuideProps {
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  onFile: (file: File) => void;
  busy?: boolean;
  /** "row" lays the three steps side by side where there is room (Settings). */
  layout?: "stack" | "row";
}

function hasFiles(event: DragEvent): boolean {
  return [...event.dataTransfer.types].includes("Files");
}

/**
 * Three steps for moving bookmarks out of Chrome with no extension permission: Chrome writes
 * its own export file and the user hands that file over. The file carries each bookmark's icon.
 */
export function ChromeImportGuide({ t, onFile, busy = false, layout = "stack" }: ChromeImportGuideProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const managerShortcut = isApplePlatform() ? "⌥ ⌘ B" : "Ctrl + Shift + O";

  const openManager = (): void => {
    setOpenFailed(false);
    void openChromeBookmarkManager().catch(() => setOpenFailed(true));
  };
  const onDrop = (event: DragEvent): void => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !busy) onFile(file);
  };

  return (
    <div
      role="group"
      className={`import-guide import-guide--${layout} ${dragging ? "is-dragging" : ""}`}
      aria-label={t("guide.title")}
      onDragOver={(event) => { if (hasFiles(event)) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={onDrop}
    >
      <h4 className="import-guide__title">{t("guide.title")}</h4>
      <ol className="import-guide__steps">
        <li>
          <span className="import-guide__number" aria-hidden="true">1</span>
          <span className="import-guide__text">{t("guide.step1")}</span>
          <button type="button" className="import-guide__action" onClick={openManager}><ExternalLink size={13} aria-hidden="true" />{t("guide.open")}</button>
        </li>
        <li>
          <span className="import-guide__number" aria-hidden="true">2</span>
          <span className="import-guide__text">{t("guide.step2")}</span>
        </li>
        <li>
          <span className="import-guide__number" aria-hidden="true">3</span>
          <span className="import-guide__text">{t("guide.step3")}</span>
          <button type="button" className="import-guide__action import-guide__action--primary" disabled={busy} onClick={() => inputRef.current?.click()}><FileUp size={13} aria-hidden="true" />{t("guide.choose")}</button>
        </li>
      </ol>
      {openFailed ? <p className="import-guide__note" role="status">{t("guide.openFailed", { shortcut: managerShortcut })}</p> : null}
      <p className="import-guide__note"><ShieldCheck size={14} aria-hidden="true" />{t("guide.note")}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".html,.htm,text/html"
        hidden
        data-testid="import-guide-file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
