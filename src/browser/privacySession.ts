import { browser } from "wxt/browser";

const PRIVACY_SESSION_KEY = "privacySessionEnabled";
const PRIVACY_CHANNEL = "asterfold_privacy_session_channel";

let inMemoryPrivacy = false;
const localListeners = new Set<(enabled: boolean) => void>();

function getBroadcastChannel(): BroadcastChannel | null {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      return new BroadcastChannel(PRIVACY_CHANNEL);
    }
  } catch {
    // fallback
  }
  return null;
}

export async function readSessionPrivacy(): Promise<boolean> {
  try {
    if (browser?.storage?.session?.get) {
      const stored = await browser.storage.session.get(PRIVACY_SESSION_KEY);
      return stored[PRIVACY_SESSION_KEY] === true;
    }
  } catch {
    // fallback to web storage
  }
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(PRIVACY_SESSION_KEY);
      if (stored !== null) return stored === "true";
    }
  } catch {
    // fallback
  }
  try {
    if (typeof sessionStorage !== "undefined") {
      const stored = sessionStorage.getItem(PRIVACY_SESSION_KEY);
      if (stored !== null) return stored === "true";
    }
  } catch {
    // fallback
  }
  return inMemoryPrivacy;
}

export async function writeSessionPrivacy(enabled: boolean): Promise<void> {
  inMemoryPrivacy = enabled;
  try {
    if (browser?.storage?.session?.set && browser?.storage?.session?.remove) {
      if (enabled) await browser.storage.session.set({ [PRIVACY_SESSION_KEY]: true });
      else await browser.storage.session.remove(PRIVACY_SESSION_KEY);
    }
  } catch {
    // fallback to web storage
  }
  try {
    if (typeof localStorage !== "undefined") {
      if (enabled) localStorage.setItem(PRIVACY_SESSION_KEY, "true");
      else localStorage.removeItem(PRIVACY_SESSION_KEY);
    }
  } catch {
    // ignore
  }
  try {
    if (typeof sessionStorage !== "undefined") {
      if (enabled) sessionStorage.setItem(PRIVACY_SESSION_KEY, "true");
      else sessionStorage.removeItem(PRIVACY_SESSION_KEY);
    }
  } catch {
    // ignore
  }

  // Notify local in-memory listeners
  for (const listener of localListeners) {
    try {
      listener(enabled);
    } catch {
      // ignore
    }
  }

  // Broadcast to other contexts (tabs, popups)
  try {
    const channel = getBroadcastChannel();
    channel?.postMessage({ type: "PRIVACY_CHANGED", enabled });
    channel?.close();
  } catch {
    // ignore
  }
}

export function subscribeSessionPrivacy(listener: (enabled: boolean) => void): () => void {
  localListeners.add(listener);

  const handleChange = (changes: Record<string, { newValue?: unknown }>, areaName: string): void => {
    if (areaName !== "session" || !(PRIVACY_SESSION_KEY in changes)) return;
    listener(changes[PRIVACY_SESSION_KEY]?.newValue === true);
  };
  try {
    browser?.storage?.onChanged?.addListener?.(handleChange);
  } catch {
    // ignore
  }

  const handleStorage = (event: StorageEvent): void => {
    if (event.key === PRIVACY_SESSION_KEY) {
      listener(event.newValue === "true");
    }
  };
  if (typeof window !== "undefined") {
    try {
      window.addEventListener("storage", handleStorage);
    } catch {
      // ignore
    }
  }

  const channel = getBroadcastChannel();
  if (channel) {
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (typeof data === "object" && data !== null && "type" in data && "enabled" in data) {
        const payload = data as { type: unknown; enabled: unknown };
        if (payload.type === "PRIVACY_CHANGED" && typeof payload.enabled === "boolean") {
          listener(payload.enabled);
        }
      }
    };
  }

  return () => {
    localListeners.delete(listener);
    try {
      browser?.storage?.onChanged?.removeListener?.(handleChange);
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      try {
        window.removeEventListener("storage", handleStorage);
      } catch {
        // ignore
      }
    }
    try {
      channel?.close();
    } catch {
      // ignore
    }
  };
}
