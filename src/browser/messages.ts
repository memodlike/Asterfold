import { z } from "zod";

const entityIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u).brand<"EntityId">();
const urlSchema = z.string().min(1).max(8_192);
const titleSchema = z.string().max(240);

export const extensionMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("QUICK_SAVE"), tabId: z.number().int().positive().safe().optional() }).strict(),
  z.object({ type: z.literal("INSTANT_SAVE"), url: urlSchema, title: titleSchema }).strict(),
  z.object({ type: z.literal("OPEN_WORKSPACE"), pageId: entityIdSchema.optional() }).strict(),
  z.object({ type: z.literal("OPEN_URL"), url: urlSchema, mode: z.enum(["current", "new-tab", "new-window", "incognito"]) }).strict(),
  z.object({ type: z.literal("DATA_CHANGED"), entity: z.enum(["page", "board", "bookmark", "settings", "trash"]) }).strict(),
]);

export type ExtensionMessage = z.infer<typeof extensionMessageSchema>;
export type ExtensionErrorCode =
  | "ACTIVE_TAB_UNAVAILABLE"
  | "BOARD_REQUIRED"
  | "DUPLICATE_BOOKMARK"
  | "EXTERNAL_SENDER_REJECTED"
  | "INCOGNITO_UNAVAILABLE"
  | "INVALID_MESSAGE"
  | "MESSAGE_FAILED"
  | "SAVE_FAILED"
  | "UNSAFE_URL"
  | "UNSUPPORTED_MESSAGE";

export type ExtensionResponse<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; code: ExtensionErrorCode; params?: Record<string, string | number> };

export function parseExtensionMessage(value: unknown): ExtensionMessage | null {
  const parsed = extensionMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
