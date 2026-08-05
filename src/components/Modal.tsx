import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { useI18n } from "../i18n";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  size?: "small" | "medium" | "large" | "fullscreen";
  side?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

export function Modal({
  open,
  title,
  description,
  size = "medium",
  side = false,
  onClose,
  children,
  footer,
  className = "",
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
}: ModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropPointerRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscapeRef.current = closeOnEscape;
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (first ?? panel)?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && closeOnEscapeRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null);
      const initial = items[0];
      const last = items.at(-1);
      if (!initial || !last) {
        event.preventDefault();
        panel.focus();
      } else if (event.shiftKey && document.activeElement === initial) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        initial.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className={`modal-backdrop ${side ? "modal-backdrop--side" : ""}`}
      role="presentation"
      onPointerDown={(event) => { backdropPointerRef.current = event.target === event.currentTarget; }}
      onPointerUp={(event) => {
        if (closeOnBackdrop && backdropPointerRef.current && event.target === event.currentTarget) onClose();
        backdropPointerRef.current = false;
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`modal modal--${size} ${side ? "modal--side" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          {showCloseButton ? <IconButton label={t("generic.close")} onClick={onClose}><X size={18} /></IconButton> : null}
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
