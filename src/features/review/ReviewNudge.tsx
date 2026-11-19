import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { openUrl } from "../../browser/api";
import { useI18n } from "../../i18n";
import {
  currentExtensionVersion,
  isReviewDue,
  markReviewAsked,
  markReviewRated,
  readReviewState,
  recordVisit,
  REVIEW_STORAGE_KEY,
  STORE_REVIEW_URL,
} from "./reviewPrompt";
import "./reviewNudge.css";

/** Calm delay so the card never jumps in while someone is heading straight for a bookmark. */
export const REVIEW_SHOW_DELAY_MS = 3000;

interface ReviewNudgeProps {
  /** False while onboarding, tips, Privacy Mode or any dialog is on screen. */
  allowed: boolean;
  bookmarkCount: number;
}

export function ReviewNudge({ allowed, bookmarkCount }: ReviewNudgeProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [visible, setVisible] = useState(false);
  const visitRecorded = useRef(false);

  useEffect(() => {
    if (visitRecorded.current) return;
    visitRecorded.current = true;
    recordVisit();
  }, []);

  useEffect(() => {
    if (!allowed || visible) return;
    const version = currentExtensionVersion();
    if (!isReviewDue(readReviewState(), version, bookmarkCount, Date.now())) return;
    const handle = window.setTimeout(() => {
      // Another tab may have asked in the meantime; re-read before showing.
      if (document.visibilityState !== "visible") return;
      if (!isReviewDue(readReviewState(), version, bookmarkCount, Date.now())) return;
      markReviewAsked(version);
      setVisible(true);
    }, REVIEW_SHOW_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [allowed, bookmarkCount, visible]);

  useEffect(() => {
    if (!visible) return;
    const onStorage = (event: StorageEvent): void => {
      if (event.key === REVIEW_STORAGE_KEY && readReviewState()?.status === "rated") setVisible(false);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [visible]);

  if (!visible || !allowed) return null;

  const close = (): void => setVisible(false);
  const rate = (): void => {
    markReviewRated();
    setVisible(false);
    void openUrl(STORE_REVIEW_URL, "new-tab").catch(() => undefined);
  };

  return (
    <aside
      className="review-nudge"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <svg className="review-nudge__mark" viewBox="0 0 64 64" aria-hidden="true">
        <g fill="currentColor">
          <path d="M32 3 41 24 35 29 28 24Z" />
          <path d="m61 32-21 9-5-6 5-7Z" />
          <path d="m32 61-9-21 6-5 7 5Z" />
          <path d="M3 32 24 23l5 6-5 7Z" />
        </g>
      </svg>
      <button type="button" className="review-nudge__dismiss" aria-label={t("review.dismiss")} onClick={close}>
        <X size={15} aria-hidden="true" />
      </button>
      <strong id={titleId} className="review-nudge__title">{t("review.title")}</strong>
      <p className="review-nudge__body">{t("review.body")}</p>
      <div className="review-nudge__actions">
        <button type="button" className="review-nudge__rate" onClick={rate}>{t("review.rate")}</button>
        <button type="button" className="review-nudge__later" onClick={close}>{t("review.later")}</button>
      </div>
    </aside>
  );
}
