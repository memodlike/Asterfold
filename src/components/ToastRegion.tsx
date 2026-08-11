import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { useI18n } from "../i18n";

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
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busyActions, setBusyActions] = useState<Set<number>>(new Set());
  const idRef = useRef(0);
  const timers = useRef(new Map<number, number>());
  const deadlines = useRef(new Map<number, number>());
  const remaining = useRef(new Map<number, number>());

  const remove = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    deadlines.current.delete(id);
    remaining.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const schedule = useCallback((id: number, duration: number): void => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    const safeDuration = Math.max(0, duration);
    remaining.current.set(id, safeDuration);
    deadlines.current.set(id, Date.now() + safeDuration);
    timers.current.set(id, window.setTimeout(() => remove(id), safeDuration));
  }, [remove]);

  const push = useCallback((input: ToastInput) => {
    const id = ++idRef.current;
    setToasts((current) => [...current.slice(-2), { ...input, id }]);
    schedule(id, input.actionLabel ? 7_000 : 4_000);
  }, [schedule]);
  const pause = useCallback((id: number): void => {
    const timer = timers.current.get(id);
    if (timer === undefined) return;
    const deadline = deadlines.current.get(id);
    if (deadline !== undefined) remaining.current.set(id, Math.max(0, deadline - Date.now()));
    window.clearTimeout(timer);
    timers.current.delete(id);
    deadlines.current.delete(id);
  }, []);
  const resume = useCallback((toast: Toast): void => {
    if (timers.current.has(toast.id)) return;
    const duration = remaining.current.get(toast.id) ?? (toast.actionLabel ? 7_000 : 4_000);
    if (duration <= 0) remove(toast.id);
    else schedule(toast.id, duration);
  }, [remove, schedule]);
  const runAction = async (toast: Toast): Promise<void> => {
    if (!toast.onAction || busyActions.has(toast.id)) return;
    pause(toast.id);
    setBusyActions((current) => new Set(current).add(toast.id));
    try {
      await toast.onAction();
      remove(toast.id);
    } catch {
      setToasts((current) => current.map((item) => {
        if (item.id !== toast.id) return item;
        const failed = { ...item, tone: "error" as const, message: t("error.actionFailed") };
        delete failed.actionLabel;
        delete failed.onAction;
        return failed;
      }));
      schedule(toast.id, 4_000);
    } finally {
      setBusyActions((current) => {
        const next = new Set(current);
        next.delete(toast.id);
        return next;
      });
    }
  };

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
    deadlines.current.clear();
    remaining.current.clear();
  }, []);

  return {
    push,
    region: (
      <div className="toast-region" role="region" aria-label={t("generic.notifications")}>
        {toasts.map((toast) => (
          <div
            className={`toast toast--${toast.tone ?? "neutral"}`}
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            onPointerEnter={() => pause(toast.id)}
            onPointerLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) resume(toast); }}
            onFocusCapture={() => pause(toast.id)}
            onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) resume(toast); }}
          >
            {toast.tone === "error" ? <AlertCircle size={18} aria-hidden="true" /> : toast.tone === "success" ? <CheckCircle2 size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}
            <span>{toast.message}</span>
            {toast.actionLabel && toast.onAction ? (
              <Button variant="ghost" size="small" disabled={busyActions.has(toast.id)} onClick={() => { void runAction(toast); }}>{toast.actionLabel}</Button>
            ) : null}
            <IconButton label={t("generic.dismiss")} onClick={() => remove(toast.id)}><X size={16} /></IconButton>
          </div>
        ))}
      </div>
    ),
  };
}
