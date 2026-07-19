import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

export interface ToastInput {
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  tone?: "success" | "error" | "neutral";
}

interface Toast extends ToastInput {
  id: number;
}

export interface ToastController {
  push: (toast: ToastInput) => void;
  region: React.ReactNode;
}

export function useToasts(): ToastController {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, number>());

  const remove = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((input: ToastInput) => {
    const id = ++idRef.current;
    setToasts((current) => [...current.slice(-2), { ...input, id }]);
    timers.current.set(id, window.setTimeout(() => remove(id), input.actionLabel ? 7_000 : 4_000));
  }, [remove]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
  }, []);

  return {
    push,
    region: (
      <div className="toast-region" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.tone ?? "neutral"}`} key={toast.id} role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{toast.message}</span>
            {toast.actionLabel && toast.onAction ? (
              <Button variant="ghost" size="small" onClick={() => { void Promise.resolve(toast.onAction?.()).finally(() => remove(toast.id)); }}>{toast.actionLabel}</Button>
            ) : null}
            <IconButton label="Dismiss" onClick={() => remove(toast.id)}><X size={16} /></IconButton>
          </div>
        ))}
      </div>
    ),
  };
}
