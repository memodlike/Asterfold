import { describe, expect, it } from "vitest";
import { getCloudConfig } from "../src/sync/config";
import { nextRetryAt, operationArguments, remoteEntitySchema, resolveConflict } from "../src/sync/protocol";
import type { SyncOperation } from "../src/domain/models";

describe("optional sync protocol", () => {
  it("stays disabled for incomplete or unsafe configuration", () => {
    expect(getCloudConfig({ WXT_ENABLE_CLOUD_SYNC: "false" })).toBeNull();
    expect(getCloudConfig({ WXT_ENABLE_CLOUD_SYNC: "true", WXT_SUPABASE_URL: "http://example.com", WXT_SUPABASE_ANON_KEY: "public" })).toBeNull();
    expect(getCloudConfig({ WXT_ENABLE_CLOUD_SYNC: "true", WXT_SUPABASE_URL: "https://project.supabase.co/path", WXT_SUPABASE_ANON_KEY: "public" })).toEqual({
      enabled: true,
      url: "https://project.supabase.co",
      publishableKey: "public",
    });
  });

  it("resolves conflicts deterministically by entity version then timestamp", () => {
    const local = { version: 4, updatedAt: "2025-01-01T00:00:00.000Z", value: "local" };
    const newerVersion = { version: 5, updatedAt: "2024-01-01T00:00:00.000Z", value: "remote-version" };
    const newerTimestamp = { version: 4, updatedAt: "2026-01-01T00:00:00.000Z", value: "remote-time" };
    expect(resolveConflict(local, newerVersion).value).toBe("remote-version");
    expect(resolveConflict(local, newerTimestamp).value).toBe("remote-time");
  });

  it("uses bounded exponential retry and closed RPC arguments", () => {
    const now = Date.parse("2026-01-01T00:00:00.000Z");
    expect(Date.parse(nextRetryAt(0, now)) - now).toBe(2_000);
    expect(Date.parse(nextRetryAt(30, now)) - now).toBe(60 * 60 * 1_000);
    const operation: SyncOperation = {
      id: "1db2aa5f-2d06-41bf-a383-ff63e15cc82f",
      entityType: "bookmark",
      entityId: "bookmark-1",
      operation: "upsert",
      payload: { id: "bookmark-1" },
      expectedVersion: 3,
      attempts: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      nextAttemptAt: "2026-01-01T00:00:00.000Z",
      error: null,
    };
    expect(operationArguments(operation)).toEqual({
      p_operation_id: operation.id,
      p_entity_type: "bookmark",
      p_entity_id: "bookmark-1",
      p_operation: "upsert",
      p_payload: { id: "bookmark-1" },
      p_expected_version: 3,
    });
  });

  it("rejects an unvalidated remote payload before it reaches IndexedDB", () => {
    expect(() => remoteEntitySchema.parse({ entity_type: "bookmark", payload: { url: "javascript:alert(1)" } })).toThrow();
  });
});
