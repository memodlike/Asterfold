import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { primaryShortcut } from "../../browser/platform";
import { useI18n, type MessageKey } from "../../i18n";
import "./guideTour.css";

interface GuideTourProps {
  onFinish: () => void;
  /** Opens the Chrome import steps in Settings. */
  onOpenImport: () => void;
}

interface TourStep {
  id: "boards" | "add" | "menu" | "import";
  anchor: string;
  title: MessageKey;
  body: MessageKey;
  shortcut?: string;
  side: "below" | "above";
}

interface Placement { ring: CSSProperties; card: CSSProperties }

const CARD_WIDTH = 320;
const GAP = 12;
const EDGE = 12;

/**
 * Short first-run tips, each pointing at the real control it explains. The page under the tips
 * is not changed: one ring marks the control, one card explains it. Only opacity and transform
 * animate; Escape or "Skip tips" ends it for good.
 */
export function GuideTour({ onFinish, onOpenImport }: GuideTourProps) {
  const { t } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);
  const steps = useMemo<TourStep[]>(() => {
    const all: TourStep[] = [
      { id: "boards", anchor: ".board-track > .board", title: "tour.boardsTitle", body: "tour.boardsBody", side: "below" },
      { id: "add", anchor: ".board-track > .board .board__header", title: "tour.addTitle", body: "tour.addBody", shortcut: primaryShortcut("V").visual, side: "below" },
      { id: "menu", anchor: ".launcher-trigger", title: "tour.menuTitle", body: "tour.menuBody", shortcut: primaryShortcut("K").visual, side: "above" },
      { id: "import", anchor: ".launcher-trigger", title: "tour.importTitle", body: "tour.importBody", side: "above" },
    ];
    // A page without boards has nothing to point the first two tips at.
    return all.filter((step) => document.querySelector(step.anchor));
  }, []);
  const [index, setIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const step = steps[index];

  const place = useCallback(() => {
    const target = step ? document.querySelector<HTMLElement>(step.anchor) : null;
    if (!step || !target) return;
    const rect = target.getBoundingClientRect();
    const pad = step.id === "boards" ? 4 : 6;
    const cardHeight = cardRef.current?.offsetHeight ?? 170;
    const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - CARD_WIDTH - EDGE));
    const below = rect.bottom + pad + GAP;
    const above = rect.top - pad - GAP - cardHeight;
    const fitsBelow = below + cardHeight <= window.innerHeight - EDGE;
    const top = step.side === "below" && fitsBelow ? below : above >= EDGE ? above : Math.max(EDGE, window.innerHeight - cardHeight - EDGE);
    setPlacement({
      ring: { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, borderRadius: `calc(${getComputedStyle(target).borderRadius || "12px"} + ${String(pad)}px)` },
      card: { left, top, width: CARD_WIDTH },
    });
  }, [step]);

  useLayoutEffect(() => {
    place();
    if (step) document.documentElement.dataset.tourStep = step.id;
    return () => { delete document.documentElement.dataset.tourStep; };
  }, [place, step]);

  useEffect(() => {
    window.addEventListener("resize", place, { passive: true });
    return () => window.removeEventListener("resize", place);
  }, [place]);

  const placed = placement !== null;
  useEffect(() => {
    if (placed) cardRef.current?.querySelector<HTMLButtonElement>("[data-tour-primary]")?.focus();
  }, [index, placed]);

  useEffect(() => {
    if (steps.length === 0) onFinish();
  }, [onFinish, steps.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onFinish();
      } else if (event.key === "Tab") {
        const buttons = [...(cardRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
        const first = buttons[0];
        const last = buttons.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        else if (!cardRef.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onFinish]);

  if (!step || !placement) return null;
  const last = index === steps.length - 1;
  const titleId = `tour-title-${step.id}`;
  const bodyId = `tour-body-${step.id}`;

  return (
    <div className="tour" data-testid="guide-tour">
      <div className="tour__ring" style={placement.ring} aria-hidden="true" key={`ring-${step.id}`} />
      <div ref={cardRef} className="tour__card" style={placement.card} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} key={step.id}>
        <strong id={titleId}>{t(step.title)}</strong>
        <p id={bodyId}>{t(step.body, step.shortcut ? { shortcut: step.shortcut } : undefined)}</p>
        <div className="tour__footer">
          <span className="tour__dots" role="img" aria-label={t("tour.progress", { current: index + 1, total: steps.length })}>
            {steps.map((item, position) => <i key={item.id} className={position === index ? "is-current" : ""} />)}
          </span>
          {last ? null : <button type="button" className="tour__link" onClick={onFinish}>{t("tour.skip")}</button>}
          {index > 0 ? <button type="button" className="tour__button" onClick={() => setIndex(index - 1)}>{t("tour.back")}</button> : null}
          {step.id === "import" ? (
            <>
              <button type="button" className="tour__button" onClick={onFinish}>{t("tour.done")}</button>
              <button type="button" className="tour__button tour__button--primary" data-tour-primary onClick={() => { onFinish(); onOpenImport(); }}>{t("tour.importAction")}</button>
            </>
          ) : <button type="button" className="tour__button tour__button--primary" data-tour-primary onClick={() => (last ? onFinish() : setIndex(index + 1))}>{t(last ? "tour.done" : "tour.next")}</button>}
        </div>
      </div>
    </div>
  );
}
