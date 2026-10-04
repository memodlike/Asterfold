import { browser } from "wxt/browser";

const PRIVACY_SESSION_KEY = "privacySessionEnabled";

let inMemoryPrivacy = false;

export async function readSessionPrivacy(): Promise<boolean> {
  try {
    if (browser?.storage?.session?.get) {
      const stored = await browser.storage.session.get(PRIVACY_SESSION_KEY);
      return stored[PRIVACY_SESSION_KEY] === true;
    }
  } catch {
    // fallback to web storage
  }
  if (typeof sessionStorage !== "undefined") {
    return sessionStorage.getItem(PRIVACY_SESSION_KEY) === "true";
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
  if (typeof sessionStorage !== "undefined") {
    if (enabled) sessionStorage.setItem(PRIVACY_SESSION_KEY, "true");
    else sessionStorage.removeItem(PRIVACY_SESSION_KEY);
  }
}

export function subscribeSessionPrivacy(listener: (enabled: boolean) => void): () => void {
  const handleChange = (changes: Record<string, { newValue?: unknown }>, areaName: string): void => {
    if (areaName !== "session" || !(PRIVACY_SESSION_KEY in changes)) return;
    listener(changes[PRIVACY_SESSION_KEY]?.newValue === true);
  };
  try {
    browser?.storage?.onChanged?.addListener?.(handleChange);
    return () => {
      try {
        browser?.storage?.onChanged?.removeListener?.(handleChange);
      } catch {
        // ignore
      }
    };
  } catch {
    return () => undefined;
  }
}
