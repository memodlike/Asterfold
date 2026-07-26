import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuPoint {
  x: number;
  y: number;
}

interface FloatingContextMenuProps {
  label: string;
  point: ContextMenuPoint;
  children: ReactNode;
  onClose: () => void;
}

const EDGE_GAP = 8;

export function FloatingContextMenu({ label, point, children, onClose }: FloatingContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [placement, setPlacement] = useState(point);

  useEffect(() => { setPlacement(point); }, [point]);
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    const next = {
      x: Math.max(EDGE_GAP, Math.min(point.x, window.innerWidth - bounds.width - EDGE_GAP)),
      y: Math.max(EDGE_GAP, Math.min(point.y, window.innerHeight - bounds.height - EDGE_GAP)),
    };
    if (next.x !== placement.x || next.y !== placement.y) setPlacement(next);
  }, [placement, point]);
  useLayoutEffect(() => {
    const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [];
    for (const button of buttons) if (!button.hasAttribute("role")) button.setAttribute("role", "menuitem");
    menuRef.current?.querySelector<HTMLElement>("button:not([disabled]), [role='menuitem']:not(button):not([aria-disabled='true'])")?.focus();
  }, []);
  useEffect(() => {
    let typeahead = "";
    let typeaheadTimer: number | undefined;
    const enabledItems = (): HTMLElement[] => [...(menuRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), [role='menuitem']:not(button):not([aria-disabled='true'])") ?? [])]
      .filter((item) => !item.hidden && getComputedStyle(item).display !== "none");
    const closeAndRestore = (): void => {
      onClose();
      queueMicrotask(() => returnFocusRef.current?.focus());
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      const items = enabledItems();
      const current = items.indexOf(document.activeElement as HTMLElement);
      if (event.key === "Escape" || event.key === "Tab") {
        if (event.key === "Escape") event.preventDefault();
        closeAndRestore();
        return;
      }
      if (items.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End")) {
        event.preventDefault();
        const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
        items[index]?.focus();
        return;
      }
      if (event.key.length === 1 && /\S/u.test(event.key)) {
        typeahead += event.key.toLocaleLowerCase();
        if (typeaheadTimer !== undefined) window.clearTimeout(typeaheadTimer);
        typeaheadTimer = window.setTimeout(() => { typeahead = ""; }, 500);
        items.find((item) => item.textContent?.trim().toLocaleLowerCase().startsWith(typeahead))?.focus();
      }
    };
    const close = (): void => onClose();
    const onOutsidePointer = (event: PointerEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onOutsidePointer);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      if (typeaheadTimer !== undefined) window.clearTimeout(typeaheadTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onOutsidePointer);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      aria-label={label}
      style={{ left: placement.x, top: placement.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
