import { MAX_TITLE_LENGTH, normalizeEntityTitle } from "./text";

/**
 * Recognizable brands and services with their authoritative, official capitalization.
 */
const BRAND_NAMES: Readonly<Record<string, string>> = {
  // Major tech & search
  google: "Google",
  youtube: "YouTube",
  github: "GitHub",
  gitlab: "GitLab",
  linkedin: "LinkedIn",
  chatgpt: "ChatGPT",
  openai: "OpenAI",
  anthropic: "Anthropic",
  claude: "Claude",
  notion: "Notion",
  figma: "Figma",
  reddit: "Reddit",
  twitter: "Twitter",
  x: "X",
  wikipedia: "Wikipedia",
  netflix: "Netflix",
  spotify: "Spotify",
  amazon: "Amazon",
  apple: "Apple",
  microsoft: "Microsoft",
  yahoo: "Yahoo",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",

  // Developer & productivity
  stackoverflow: "Stack Overflow",
  stackexchange: "Stack Exchange",
  medium: "Medium",
  twitch: "Twitch",
  discord: "Discord",
  slack: "Slack",
  dropbox: "Dropbox",
  pinterest: "Pinterest",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  quora: "Quora",
  producthunt: "Product Hunt",
  hackerone: "HackerOne",
  ycombinator: "Y Combinator",
  codepen: "CodePen",
  codesandbox: "CodeSandbox",
  replit: "Replit",
  vercel: "Vercel",
  netlify: "Netlify",
  cloudflare: "Cloudflare",
  atlassian: "Atlassian",
  jira: "Jira",
  confluence: "Confluence",
  trello: "Trello",
  bitbucket: "Bitbucket",
  linear: "Linear",
  superhuman: "Superhuman",
  loom: "Loom",
  miro: "Miro",
  canva: "Canva",
  dribbble: "Dribbble",
  behance: "Behance",
  unsplash: "Unsplash",
  webflow: "Webflow",
  wordpress: "WordPress",
  substack: "Substack",
  npm: "npm",
  npmjs: "npm",
  pypi: "PyPI",
  crates: "Crates.io",

  // Commerce, finance & travel
  airbnb: "Airbnb",
  uber: "Uber",
  ebay: "eBay",
  paypal: "PayPal",
  stripe: "Stripe",
  booking: "Booking.com",

  // Media, news & gaming
  imdb: "IMDb",
  steam: "Steam",
  steampowered: "Steam",
  playstation: "PlayStation",
  xbox: "Xbox",
  epicgames: "Epic Games",
  soundcloud: "SoundCloud",
  vimeo: "Vimeo",
  dailymotion: "Dailymotion",
  bbc: "BBC",
  cnn: "CNN",
  nytimes: "The New York Times",
  theverge: "The Verge",
  techcrunch: "TechCrunch",
  wired: "Wired",
  bloomberg: "Bloomberg",
  forbes: "Forbes",
  reuters: "Reuters",

  // Education
  khanacademy: "Khan Academy",
  coursera: "Coursera",
  udemy: "Udemy",
  edx: "edX",
  duolingo: "Duolingo",

  // Regional & CIS services
  habr: "Habr",
  vk: "VK",
  yandex: "Yandex",
  kaspi: "Kaspi",
  kolesa: "Kolesa",
  krisha: "Krisha",
  olx: "OLX",
  wildberries: "Wildberries",
  ozon: "Ozon",
};

/**
 * Specific hostname overrides where the subdomain determines the product identity.
 */
const SPECIFIC_HOST_NAMES: Readonly<Record<string, string>> = {
  "docs.google.com": "Google Docs",
  "sheets.google.com": "Google Sheets",
  "slides.google.com": "Google Slides",
  "drive.google.com": "Google Drive",
  "mail.google.com": "Gmail",
  "calendar.google.com": "Google Calendar",
  "maps.google.com": "Google Maps",
  "meet.google.com": "Google Meet",
  "keep.google.com": "Google Keep",
  "news.google.com": "Google News",
  "translate.google.com": "Google Translate",
  "gist.github.com": "GitHub Gist",
  "news.ycombinator.com": "Hacker News",
  "web.whatsapp.com": "WhatsApp",
  "web.telegram.org": "Telegram",
  "t.me": "Telegram",
  "dev.to": "DEV Community",
};

/**
 * Multi-part second-level public suffixes commonly encountered in domain names.
 */
const MULTI_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk", "net.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.nz", "net.nz", "org.nz", "govt.nz",
  "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp",
  "co.kr", "ne.kr", "re.kr",
  "com.br", "net.br", "org.br", "gov.br",
  "com.mx", "edu.mx", "gob.mx", "org.mx",
  "co.za", "org.za", "gov.za",
  "com.sg", "edu.sg", "gov.sg",
  "com.tr", "edu.tr", "gov.tr", "org.tr",
  "com.ar", "net.ar", "org.ar",
  "com.co", "net.co", "nom.co",
  "com.pl", "net.pl", "org.pl",
  "com.ru", "net.ru", "org.ru", "pp.ru",
  "com.tw", "org.tw", "gov.tw",
  "com.hk", "org.hk", "gov.hk",
  "com.my", "org.my", "gov.my",
  "com.ph", "org.ph", "gov.ph",
  "com.pk", "org.pk", "gov.pk",
  "com.ng", "org.ng", "gov.ng",
  "co.id", "net.id", "or.id", "go.id",
  "co.in", "net.in", "org.in", "gen.in", "firm.in", "ind.in",
  "com.cn", "net.cn", "org.cn", "gov.cn",
  "co.il", "org.il", "gov.il",
]);

/**
 * Formats an unknown domain token into clean, natural title case.
 * e.g., "my-cool-project" -> "My Cool Project"
 */
function toTitleCase(token: string): string {
  return token
    .split(/[-_.]+/u)
    .filter(Boolean)
    .map((word) => {
      if (word.length === 0) return "";
      // Keep acronyms like "API", "SDK", "CSS" or all-uppercase words intact
      if (word.length > 1 && word === word.toUpperCase() && !/^\d+$/u.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Extracts the primary domain token from a hostname, correctly accounting
 * for multi-part public suffixes and stripping generic subdomains.
 */
export function extractRootDomain(hostname: string): { rootLabel: string; fullHost: string } {
  const cleanHost = hostname.toLowerCase().replace(/^www\./u, "");
  const parts = cleanHost.split(".");

  if (parts.length <= 1) {
    return { rootLabel: cleanHost, fullHost: cleanHost };
  }

  // Check for 2-part TLD match (e.g., example.co.uk)
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join(".");
    if (MULTI_PART_SUFFIXES.has(lastTwo)) {
      const label = parts[parts.length - 3]!;
      return { rootLabel: label, fullHost: cleanHost };
    }
  }

  // Standard 1-part TLD match (e.g., example.com, sub.example.kz)
  const nonTldParts = parts.slice(0, -1);
  const candidateIndex = nonTldParts.length - 1;

  // The last token before TLD is the primary root label.
  const rootLabel = nonTldParts[candidateIndex] || cleanHost;
  return { rootLabel, fullHost: cleanHost };
}

/**
 * Derives a human-readable site identity from any URL.
 * Handles known brands, service subdomains, multi-part TLDs, and unknown domains.
 */
export function normalizeSiteIdentity(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "Bookmark";

  try {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      parsed = new URL(`https://${trimmed}`);
    }

    if (parsed.protocol === "about:") {
      return parsed.pathname === "blank" || !parsed.pathname ? "Bookmark" : `About ${toTitleCase(parsed.pathname)}`;
    }
    if (parsed.protocol === "mailto:") {
      const email = (parsed.pathname || "").trim();
      return email ? `Email (${email})` : "Email";
    }
    if (parsed.protocol === "chrome:") {
      const page = parsed.hostname.replace(/[-_]+/gu, " ");
      return page ? `Chrome ${toTitleCase(page)}` : "Chrome";
    }

    const host = parsed.hostname.toLowerCase();
    if (!host) {
      return "Bookmark";
    }

    // Check specific full-hostname matches (e.g. docs.google.com -> "Google Docs")
    if (SPECIFIC_HOST_NAMES[host]) {
      return SPECIFIC_HOST_NAMES[host];
    }
    const withoutWww = host.replace(/^www\./u, "");
    if (SPECIFIC_HOST_NAMES[withoutWww]) {
      return SPECIFIC_HOST_NAMES[withoutWww];
    }

    // Handle localhost and IP addresses
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") {
      return parsed.port ? `Localhost (${parsed.port})` : "Localhost";
    }
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host)) {
      return parsed.port ? `${host}:${parsed.port}` : host;
    }

    const { rootLabel } = extractRootDomain(host);

    // Look up in Brand dictionary
    if (BRAND_NAMES[rootLabel]) {
      return BRAND_NAMES[rootLabel];
    }

    // Format unknown domain label cleanly
    const formatted = toTitleCase(rootLabel);
    return formatted || "Bookmark";
  } catch {
    // Malformed URL fallback
    const stripped = trimmed.replace(/^https?:\/\//iu, "").replace(/^www\./iu, "").split(/[/?#]/u)[0] || "";
    return stripped ? toTitleCase(stripped.split(".")[0] || "Bookmark") : "Bookmark";
  }
}

const GENERIC_PLACEHOLDERS = new Set([
  "",
  "bookmark",
  "bookmarks",
  "untitled",
  "untitled bookmark",
  "untitled page",
  "new tab",
  "no title",
  "link",
  "http",
  "https",
  "null",
  "undefined",
]);

/**
 * Evaluates whether a raw bookmark title is missing, empty, generic, or an unusable raw URL.
 */
export function isUnusableTitle(rawTitle: string | null | undefined, url: string): boolean {
  if (!rawTitle) return true;
  const trimmed = rawTitle.trim();
  if (trimmed.length === 0) return true;

  const lower = trimmed.toLowerCase();
  if (GENERIC_PLACEHOLDERS.has(lower)) return true;

  // If title starts with a protocol scheme, it is an unusable raw URL
  if (/^[a-z0-9+.-]+:\/\//iu.test(trimmed)) return true;

  // If title starts with www. or matches common URL patterns
  if (/^www\d*\.[a-z0-9-]+/iu.test(trimmed)) return true;

  // If title strictly matches or contains a domain extension pattern without spaces
  if (!trimmed.includes(" ") && /\.(?:com|org|net|io|co|uk|kz|ru|dev|app|ai|me|info|biz|tv|cc|so|gg|sh)(?:\/.*)?$/iu.test(trimmed)) {
    return true;
  }

  // If title equals the URL or URL's hostname
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    if (lower === parsed.href.toLowerCase() || lower === parsed.hostname.toLowerCase() || lower === parsed.hostname.replace(/^www\./u, "").toLowerCase()) {
      return true;
    }
  } catch {
    // If URL is invalid and title equals URL string
    if (trimmed === url.trim()) return true;
  }

  return false;
}

/**
 * Recovers a clean human-readable bookmark title when missing or unusable,
 * while preserving valid user-defined titles 100%.
 */
export function recoverBookmarkTitle(rawTitle: string | null | undefined, url: string): string {
  if (!isUnusableTitle(rawTitle, url)) {
    const trimmed = rawTitle!.trim();
    const safeTitle = trimmed.length > MAX_TITLE_LENGTH ? trimmed.slice(0, MAX_TITLE_LENGTH) : trimmed;
    return normalizeEntityTitle(safeTitle, "Bookmark");
  }
  const derived = normalizeSiteIdentity(url);
  const safeDerived = derived.length > MAX_TITLE_LENGTH ? derived.slice(0, MAX_TITLE_LENGTH) : derived;
  return normalizeEntityTitle(safeDerived, "Bookmark");
}
