import { z } from "zod";
import type { SyncOperation } from "../domain/models";
import { appSettingsSchema, bookmarkSchema, boardSchema, pageSchema, themeSchema } from "../domain/schemas";

const remoteBase = z.object({
  user_id: z.string().uuid(),
  entity_id: z.string().min(1).max(128),
  entity_version: z.number().finite().int().positive(),
  server_version: z.number().finite().int().nonnegative(),
  operation_id: z.string().uuid(),
  deleted_at: z.string().datetime({ offset: true }).nullable(),
  updated_at: z.string().datetime({ offset: true }),
}).strict();

export const remoteEntitySchema = z.discriminatedUnion("entity_type", [
  remoteBase.extend({ entity_type: z.literal("page"), payload: pageSchema }),
  remoteBase.extend({ entity_type: z.literal("board"), payload: boardSchema }),
  remoteBase.extend({ entity_type: z.literal("bookmark"), payload: bookmarkSchema }),
  remoteBase.extend({ entity_type: z.literal("settings"), payload: appSettingsSchema }),
  remoteBase.extend({ entity_type: z.literal("theme"), payload: themeSchema }),
]);

export type RemoteEntity = z.infer<typeof remoteEntitySchema>;

export interface VersionedEntity {
  version: number;
  updatedAt: string;
}

export function resolveConflict<T extends VersionedEntity>(local: T, remote: T): T {
  if (remote.version !== local.version) return remote.version > local.version ? remote : local;
  return remote.updatedAt >= local.updatedAt ? remote : local;
}

export function nextRetryAt(attempts: number, now = Date.now()): string {
  const boundedAttempts = Math.max(0, Math.min(attempts, 12));
  const delay = Math.min(60 * 60 * 1_000, 2 ** boundedAttempts * 2_000);
  return new Date(now + delay).toISOString();
}

export function operationArguments(operation: SyncOperation): Record<string, unknown> {
  return {
    p_operation_id: operation.id,
    p_entity_type: operation.entityType,
    p_entity_id: operation.entityId,
    p_operation: operation.operation,
    p_payload: operation.payload,
    p_expected_version: operation.expectedVersion,
  };
}
