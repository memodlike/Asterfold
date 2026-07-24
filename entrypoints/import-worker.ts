import { parseBackup, parseNetscapeHtml } from "../src/services/exportImport";

export default defineUnlistedScript(() => {
  self.addEventListener("message", (event: MessageEvent<{ id: string; kind: "backup" | "html"; text: string }>) => {
    const request = event.data;
    try {
      self.postMessage(request.kind === "backup"
        ? { id: request.id, ok: true, result: parseBackup(request.text) }
        : { id: request.id, ok: true, result: parseNetscapeHtml(request.text) });
    } catch (error) {
      self.postMessage({
        id: request.id,
        ok: false,
        message: error instanceof Error ? error.message.slice(0, 500) : "Import parsing failed",
      });
    }
  });
});
