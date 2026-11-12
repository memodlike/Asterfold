import { useSyncExternalStore } from "react";

/*
 * Website icons without any extension permission.
 *
 * 1. Icons that came with a browser bookmark export are stored with the bookmark and never
 *    touch the network.
 * 2. For every other bookmark the page may show `<site>/favicon.ico`, loaded by a plain <img>
 *    straight from the bookmarked site itself: no favicon service, no host permission, no
 *    fetch() and no script. The request carries no referrer. A site that has no icon there
 *    is remembered, so it is not asked again on every new tab, and the coloured letter stays.
 *
 * Loading from sites is a per-profile choice (on by default, switch in Settings → Data).
 * Privacy mode never loads or shows icons.
 */

const ENABLED_KEY = "asterfold:site-icons:v1";
const HOSTS_KEY = "asterfold:site-icon-hosts:v1";
const CHANGE_EVENT = "asterfold:site-icons";
const MISS_TTL = 3 * 24 * 60 * 60 * 1000;
const HIT_TTL = 30 * 24 * 60 * 60 * 1000;
const MAX_HOSTS = 2_000;

type HostState = "hit" | "miss";
interface HostMemory { hit: Map<string, number>; miss: Map<string, number> }

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readSiteIconsEnabled(): boolean {
  try {
    return storage()?.getItem(ENABLED_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeSiteIconsEnabled(enabled: boolean): void {
  try {
    storage()?.setItem(ENABLED_KEY, enabled ? "on" : "off");
  } catch {
    // Without storage the choice lasts for this tab only.
  }
  sessionEnabled = enabled;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

let sessionEnabled: boolean | null = null;

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent): void => {
    if (event.key === ENABLED_KEY) {
      sessionEnabled = null;
      onChange();
    }
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot(): boolean {
  sessionEnabled ??= readSiteIconsEnabled();
  return sessionEnabled;
}

/** Whether icons may be loaded from bookmarked sites; follows the Settings switch live. */
export function useSiteIconsEnabled(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/** `https://host/favicon.ico` for a web bookmark, or null for anything that is not a public web page. */
export function siteIconUrl(bookmarkUrl: string): { host: string; src: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(bookmarkUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = parsed.hostname.toLowerCase();
  // A real site name only: no bare words, no IPv4/IPv6 literals, no credentials in the address.
  if (!host.includes(".") || host.length > 253 || /^[\d.]+$/u.test(host) || host.includes(":") || parsed.username || parsed.password) return null;
  return { host: parsed.host.toLowerCase(), src: `${parsed.protocol}//${parsed.host}/favicon.ico` };
}

let memory: HostMemory | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function loadMemory(now: number): HostMemory {
  if (memory) return memory;
  const next: HostMemory = { hit: new Map(), miss: new Map() };
  try {
    const raw = JSON.parse(storage()?.getItem(HOSTS_KEY) ?? "null") as { hit?: unknown; miss?: unknown } | null;
    for (const [kind, ttl] of [["hit", HIT_TTL], ["miss", MISS_TTL]] as const) {
      const entries = raw?.[kind];
      if (typeof entries !== "object" || entries === null) continue;
      for (const [host, checkedAt] of Object.entries(entries as Record<string, unknown>)) {
        if (typeof checkedAt === "number" && now - checkedAt < ttl && host.length <= 260 && next[kind].size < MAX_HOSTS) next[kind].set(host, checkedAt);
      }
    }
  } catch {
    // A corrupt entry only costs asking the sites again.
  }
  memory = next;
  return next;
}

export function siteIconState(host: string, now = Date.now()): HostState | "unknown" {
  const current = loadMemory(now);
  if (current.hit.has(host)) return "hit";
  if (current.miss.has(host)) return "miss";
  return "unknown";
}

export function rememberSiteIcon(host: string, state: HostState, now = Date.now()): void {
  const current = loadMemory(now);
  const other = state === "hit" ? "miss" : "hit";
  if (current[state].has(host) && !current[other].has(host)) return;
  current[other].delete(host);
  if (current[state].size >= MAX_HOSTS) current[state].delete(current[state].keys().next().value!);
  current[state].set(host, now);
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    try {
      storage()?.setItem(HOSTS_KEY, JSON.stringify({ hit: Object.fromEntries(current.hit), miss: Object.fromEntries(current.miss) }));
    } catch {
      // Not persisting only repeats the lookups later.
    }
  }, 600);
}

export function resetSiteIconsForTests(): void {
  memory = null;
  sessionEnabled = null;
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = undefined;
}
