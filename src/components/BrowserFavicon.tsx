import { Globe } from "lucide-react";
import { useState, type ReactNode } from "react";
import { getMonogramColor, getMonogramLetter } from "../domain/bookmarkNaming";
import { safeCustomIconUrl } from "../domain/icons";
import { rememberSiteIcon, siteIconState, siteIconUrl, useSiteIconsEnabled } from "../features/icons/siteIcons";

export interface BrowserFaviconProps {
  url?: string | undefined;
  title?: string | undefined;
  className?: string | undefined;
  privacy?: boolean | undefined;
  fallback?: ReactNode | undefined;
  /** Icon stored with the bookmark (from a browser export); shown without any network request. */
  icon?: string | null | undefined;
  /** False keeps the icon fully local, e.g. while an address is still being typed. */
  remote?: boolean | undefined;
}

/**
 * A bookmark's icon: the stored one, else the site's own favicon when that is allowed, else a
 * coloured letter. The letter stays underneath until a site icon has actually loaded, and a
 * site without an icon keeps it, so a row never shows a broken image or jumps.
 */
export function BrowserFavicon({ url, title, className, privacy, fallback, icon, remote = true }: BrowserFaviconProps) {
  const effectiveUrl = (url || "").trim();
  const siteIcons = useSiteIconsEnabled();
  const stored = privacy ? "" : safeCustomIconUrl(icon);
  const site = !privacy && !stored && remote && siteIcons && effectiveUrl ? siteIconUrl(effectiveUrl) : null;
  const known = site ? siteIconState(site.host) : "unknown";
  // Keyed by address, so a result for one site is never applied to another after an edit.
  const [result, setResult] = useState<{ src: string; state: "hit" | "miss" } | null>(null);
  const state = site && result?.src === site.src ? result.state : known;

  let content: ReactNode;
  if (privacy || !effectiveUrl) {
    content = fallback ?? <Globe strokeWidth={1.8} />;
  } else if (stored) {
    content = <img className="favicon__image is-loaded" src={stored} alt="" decoding="async" draggable={false} />;
  } else {
    const monogram = (
      <span className="favicon__monogram" style={{ backgroundColor: getMonogramColor(effectiveUrl) }}>
        {getMonogramLetter(effectiveUrl, title)}
      </span>
    );
    content = (
      <>
        {state === "hit" ? null : monogram}
        {site && state !== "miss" ? (
          <img
            className={`favicon__image ${state === "hit" ? "is-loaded" : ""}`}
            src={site.src}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
            onLoad={(event) => {
              // Some servers answer a missing icon with a 1×1 image.
              const ok = event.currentTarget.naturalWidth >= 8 && event.currentTarget.naturalHeight >= 8;
              rememberSiteIcon(site.host, ok ? "hit" : "miss");
              setResult({ src: site.src, state: ok ? "hit" : "miss" });
            }}
            onError={() => {
              rememberSiteIcon(site.host, "miss");
              setResult({ src: site.src, state: "miss" });
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <span className={`favicon ${className ?? ""}`.trim()} aria-hidden="true">
      {content}
    </span>
  );
}
