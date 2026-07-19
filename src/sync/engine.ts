import { z } from "zod";
import { db, type AsterfoldDatabase } from "../db/database";
import type { SyncOperation, SyncState } from "../domain/models";
import { createId, nowIso } from "../utils/ids";
import { getSupabaseClient } from "./client";
import { getCloudConfig } from "./config";
import { nextRetryAt, operationArguments, remoteEntitySchema, resolveConflict, type RemoteEntity } from "./protocol";

export interface SyncResult {
  status: SyncState["status"];
  pushed: number;
  pulled: number;
  pending: number;
  message: string;
}

async function currentState(database: AsterfoldDatabase): Promise<SyncState> {
  const existing = await database.syncState.get("sync");
  if (existing) return existing;
  const state: SyncState = {
    id: "sync",
    userId: null,
    deviceId: createId(),
    status: "disabled",
    cursor: 0,
    lastSyncAt: null,
    lastError: null,
    updatedAt: nowIso(),
  };
  await database.syncState.put(state);
  return state;
}

export async function getSyncStatus(database: AsterfoldDatabase = db): Promise<SyncResult> {
  const state = await currentState(database);
  const pending = await database.syncOperations.count();
  return {
    status: getCloudConfig() ? state.status : "disabled",
    pushed: 0,
    pulled: 0,
    pending,
    message: getCloudConfig() ? "Cloud build configured" : "Local-only mode",
  };
}

async function applyRemoteEntity(row: RemoteEntity, database: AsterfoldDatabase): Promise<void> {
  if (row.entity_type === "page") {
    const local = await database.pages.get(row.entity_id);
    await database.pages.put(local ? resolveConflict(local, row.payload) : row.payload);
    return;
  }
  if (row.entity_type === "board") {
    const local = await database.boards.get(row.entity_id);
    await database.boards.put(local ? resolveConflict(local, row.payload) : row.payload);
    return;
  }
  if (row.entity_type === "bookmark") {
    const local = await database.bookmarks.get(row.entity_id);
    await database.bookmarks.put(local ? resolveConflict(local, row.payload) : row.payload);
    return;
  }
  if (row.entity_type === "settings") {
    const local = await database.settings.get("app");
    await database.settings.put(!local || row.payload.updatedAt >= local.updatedAt ? row.payload : local);
    return;
  }
  const settings = await database.settings.get("app");
  if (settings && row.updated_at >= settings.updatedAt) {
    await database.settings.put({ ...settings, theme: row.payload, updatedAt: row.updated_at });
  }
}

export async function runSync(database: AsterfoldDatabase = db): Promise<SyncResult> {
  const client = getSupabaseClient();
  if (!client) return { status: "disabled", pushed: 0, pulled: 0, pending: await database.syncOperations.count(), message: "Cloud sync is not configured; local data is safe" };
  const state = await currentState(database);
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData.session?.user) return { status: "disabled", pushed: 0, pulled: 0, pending: await database.syncOperations.count(), message: "Sign in before syncing" };
  const userId = sessionData.session.user.id;
  await database.syncState.put({ ...state, userId, status: "syncing", updatedAt: nowIso(), lastError: null });

  let pushed = 0;
  try {
    const operations = await database.syncOperations.where("nextAttemptAt").belowOrEqual(nowIso()).limit(100).toArray();
    for (const operation of operations) {
      const { error } = await client.rpc("apply_sync_operation", operationArguments(operation));
      if (error) {
        await database.syncOperations.update(operation.id, {
          attempts: operation.attempts + 1,
          nextAttemptAt: nextRetryAt(operation.attempts + 1),
          error: error.message,
        });
        continue;
      }
      await database.syncOperations.delete(operation.id);
      pushed += 1;
    }

    const response = await client
      .from("sync_entities")
      .select("user_id,entity_type,entity_id,entity_version,server_version,operation_id,deleted_at,updated_at,payload")
      .gt("server_version", state.cursor)
      .order("server_version", { ascending: true })
      .limit(500);
    if (response.error) throw new Error(response.error.message);
    const rows = z.array(remoteEntitySchema).parse(response.data as unknown);
    await database.transaction("rw", database.pages, database.boards, database.bookmarks, database.settings, async () => {
      for (const row of rows) await applyRemoteEntity(row, database);
    });
    const cursor = rows.at(-1)?.server_version ?? state.cursor;
    const pending = await database.syncOperations.count();
    await database.syncState.put({ ...state, userId, status: "idle", cursor, lastSyncAt: nowIso(), lastError: null, updatedAt: nowIso() });
    return { status: "idle", pushed, pulled: rows.length, pending, message: "Saved locally and synced" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await database.syncState.put({ ...state, userId, status: navigator.onLine ? "error" : "offline", lastError: message, updatedAt: nowIso() });
    return { status: navigator.onLine ? "error" : "offline", pushed, pulled: 0, pending: await database.syncOperations.count(), message };
  }
}

export async function enqueueSyncOperation(
  operation: Omit<SyncOperation, "id" | "attempts" | "createdAt" | "nextAttemptAt" | "error">,
  database: AsterfoldDatabase = db,
): Promise<SyncOperation | null> {
  const state = await currentState(database);
  if (!getCloudConfig() || !state.userId) return null;
  const timestamp = nowIso();
  const queued: SyncOperation = { ...operation, id: createId(), attempts: 0, createdAt: timestamp, nextAttemptAt: timestamp, error: null };
  await database.syncOperations.put(queued);
  return queued;
}
