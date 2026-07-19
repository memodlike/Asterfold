export interface CloudConfig {
  enabled: true;
  url: string;
  publishableKey: string;
}

type CloudEnvironment = Record<string, string | boolean | undefined>;

const runtimeEnvironment = import.meta.env as CloudEnvironment;

export function getCloudConfig(environment: CloudEnvironment = runtimeEnvironment): CloudConfig | null {
  const enabled = String(environment.WXT_ENABLE_CLOUD_SYNC ?? "false").toLowerCase() === "true";
  if (!enabled) return null;
  const url = String(environment.WXT_SUPABASE_URL ?? "").trim();
  const publishableKey = String(environment.WXT_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !publishableKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return { enabled: true, url: parsed.origin, publishableKey };
  } catch {
    return null;
  }
}

export function isCloudConfigured(): boolean {
  return getCloudConfig() !== null;
}
