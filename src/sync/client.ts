import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { browser } from "wxt/browser";
import { getCloudConfig } from "./config";

interface AuthStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const authStorage: AuthStorage = {
  async getItem(key) {
    const result = await browser.storage.local.get(key);
    const value = result[key];
    return typeof value === "string" ? value : null;
  },
  async setItem(key, value) {
    await browser.storage.local.set({ [key]: value });
  },
  async removeItem(key) {
    await browser.storage.local.remove(key);
  },
};

let singleton: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = getCloudConfig();
  if (!config) return null;
  singleton ??= createClient(config.url, config.publishableKey, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: authStorage,
      storageKey: "asterfold-cloud-session",
    },
    global: { headers: { "X-Client-Info": "asterfold-extension/2.1.3" } },
  });
  return singleton;
}

export async function signInWithGoogle(): Promise<{ userId: string }> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Cloud sync is not configured in this build");
  const granted = await browser.permissions.request({ permissions: ["identity"] });
  if (!granted) throw new Error("Chrome identity permission was not granted");
  const redirectTo = browser.identity.getRedirectURL("supabase-auth");
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error(error?.message ?? "Supabase did not return an authorization URL");
  const callbackUrl = await browser.identity.launchWebAuthFlow({ url: data.url, interactive: true });
  if (!callbackUrl) throw new Error("Google sign-in was cancelled");
  const code = new URL(callbackUrl).searchParams.get("code");
  if (!code) throw new Error("The OAuth callback did not contain an authorization code");
  const { data: sessionData, error: exchangeError } = await client.auth.exchangeCodeForSession(code);
  if (exchangeError || !sessionData.user) throw new Error(exchangeError?.message ?? "Unable to complete sign-in");
  return { userId: sessionData.user.id };
}

export async function signOutCloud(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error(error.message);
}
