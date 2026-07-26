import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let listener: ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void) | null = null;
  return {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    addListener: vi.fn((next: typeof listener) => { listener = next; }),
    removeListener: vi.fn((next: typeof listener) => { if (listener === next) listener = null; }),
    emit(enabled: boolean | undefined) {
      listener?.({
        privacySessionEnabled: {
          oldValue: enabled === undefined ? true : false,
          newValue: enabled,
        },
      }, "session");
    },
  };
});

vi.mock("wxt/browser", () => ({
  browser: {
    storage: {
      session: {
        get: mocks.get,
        set: mocks.set,
        remove: mocks.remove,
      },
      onChanged: {
        addListener: mocks.addListener,
        removeListener: mocks.removeListener,
      },
    },
  },
}));

import { usePrivacyMode } from "../src/app/usePrivacyMode";

describe("cross-context session Privacy Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({});
    mocks.set.mockResolvedValue(undefined);
    mocks.remove.mockResolvedValue(undefined);
  });

  it("masks by default until the session value has loaded", async () => {
    let resolveRead: ((value: Record<string, unknown>) => void) | undefined;
    mocks.get.mockReturnValue(new Promise((resolve) => { resolveRead = resolve; }));
    const { result } = renderHook(() => usePrivacyMode({ privacyPersist: false, privacyEnabled: false }));

    expect(result.current.privacy).toBe(true);
    act(() => { resolveRead?.({}); });
    await waitFor(() => expect(result.current.privacy).toBe(false));
  });

  it("writes and observes the shared Chrome session flag", async () => {
    mocks.get.mockResolvedValue({ privacySessionEnabled: true });
    const { result } = renderHook(() => usePrivacyMode({ privacyPersist: false, privacyEnabled: false }));
    await waitFor(() => expect(result.current.privacy).toBe(true));

    await act(async () => { await result.current.setPrivacy(false); });
    expect(mocks.remove).toHaveBeenCalledWith("privacySessionEnabled");
    expect(result.current.privacy).toBe(false);

    act(() => mocks.emit(true));
    expect(result.current.privacy).toBe(true);
  });

  it("uses persisted settings without waiting for session storage", () => {
    mocks.get.mockImplementation(() => new Promise(() => undefined));
    const { result } = renderHook(() => usePrivacyMode({ privacyPersist: true, privacyEnabled: false }));
    expect(result.current.privacy).toBe(false);
  });
});
