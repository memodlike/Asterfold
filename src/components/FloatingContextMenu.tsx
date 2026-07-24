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
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === "Escape") onClose(); };
    const close = (): void => onClose();
    const onOutsidePointer = (event: PointerEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onOutsidePointer);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
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
