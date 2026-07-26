import { browser } from "wxt/browser";
import type { AsterfoldBackup } from "../domain/schemas";
import { ImportError } from "../domain/errors";
import { parseBackup, parseNetscapeHtml, type ImportRecord } from "./exportImport";

async function parseOffThread<T>(kind: "backup" | "html", text: string, fallback: () => T, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new DOMException("Import cancelled", "AbortError");
  if (typeof Worker === "undefined" || !browser.runtime?.getURL) return fallback();
  const worker = new Worker(browser.runtime.getURL("/import-worker.js"));
  const id = crypto.randomUUID();
  return new Promise<T>((resolve, reject) => {
    const cleanup = (): void => {
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = (): void => {
      cleanup();
      reject(new DOMException("Import cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.addEventListener("error", () => {
      cleanup();
      reject(new ImportError("Import worker failed"));
    }, { once: true });
    worker.addEventListener("message", (event: MessageEvent<{ id: string; ok: boolean; result?: T; message?: string }>) => {
      if (event.data.id !== id) return;
      cleanup();
      if (event.data.ok && event.data.result) resolve(event.data.result);
      else reject(new ImportError(event.data.message ?? "Import validation failed"));
    });
    worker.postMessage({ id, kind, text });
  });
}

export const parseBackupOffThread = (text: string, signal?: AbortSignal): Promise<AsterfoldBackup> =>
  parseOffThread("backup", text, () => parseBackup(text), signal);

export const parseHtmlOffThread = (text: string, signal?: AbortSignal): Promise<ImportRecord[]> =>
  parseOffThread("html", text, () => parseNetscapeHtml(text), signal);
