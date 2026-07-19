import { z } from "zod";

export const extensionMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("QUICK_SAVE"), tabId: z.number().int().optional() }),
  z.object({ type: z.literal("INSTANT_SAVE"), url: z.string(), title: z.string(), faviconUrl: z.string().nullable().optional() }),
  z.object({ type: z.literal("OPEN_WORKSPACE"), pageId: z.string().optional() }),
  z.object({ type: z.literal("OPEN_URL"), url: z.string(), mode: z.enum(["current", "new-tab", "new-window", "incognito"]) }),
  z.object({ type: z.literal("SYNC_NOW") }),
  z.object({ type: z.literal("GET_SYNC_STATUS") }),
  z.object({ type: z.literal("DATA_CHANGED"), entity: z.enum(["page", "board", "bookmark", "settings", "trash"]) }),
]);

export type ExtensionMessage = z.infer<typeof extensionMessageSchema>;

export interface ExtensionResponse {
  ok: boolean;
  message?: string;
  data?: unknown;
}

export function parseExtensionMessage(value: unknown): ExtensionMessage | null {
  const parsed = extensionMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
