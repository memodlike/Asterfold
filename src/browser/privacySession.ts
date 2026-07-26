import { browser } from "wxt/browser";

const PRIVACY_SESSION_KEY = "privacySessionEnabled";

export async function readSessionPrivacy(): Promise<boolean> {
  const stored = await browser.storage.session.get(PRIVACY_SESSION_KEY);
  return stored[PRIVACY_SESSION_KEY] === true;
}

export async function writeSessionPrivacy(enabled: boolean): Promise<void> {
  if (enabled) await browser.storage.session.set({ [PRIVACY_SESSION_KEY]: true });
  else await browser.storage.session.remove(PRIVACY_SESSION_KEY);
}

export function subscribeSessionPrivacy(listener: (enabled: boolean) => void): () => void {
  const handleChange = (changes: Record<string, { newValue?: unknown }>, areaName: string): void => {
    if (areaName !== "session" || !(PRIVACY_SESSION_KEY in changes)) return;
    listener(changes[PRIVACY_SESSION_KEY]?.newValue === true);
  };
  browser.storage.onChanged.addListener(handleChange);
  return () => browser.storage.onChanged.removeListener(handleChange);
}
