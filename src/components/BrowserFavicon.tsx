import { Globe } from "lucide-react";
import type { ReactNode } from "react";
import { getMonogramColor, getMonogramLetter } from "../domain/bookmarkNaming";

export interface BrowserFaviconProps {
  url?: string | undefined;
  title?: string | undefined;
  className?: string | undefined;
  privacy?: boolean | undefined;
  fallback?: ReactNode | undefined;
}

export function BrowserFavicon({ url, title, className, privacy, fallback }: BrowserFaviconProps) {
  const effectiveUrl = (url || "").trim();

  return (
    <span className={`favicon ${className ?? ""}`.trim()} aria-hidden="true">
      {privacy ? (
        fallback ?? <Globe strokeWidth={1.8} />
      ) : effectiveUrl ? (
        <span
          className="favicon__monogram"
          style={{ backgroundColor: getMonogramColor(effectiveUrl) }}
        >
          {getMonogramLetter(effectiveUrl, title)}
        </span>
      ) : (
        fallback ?? <Globe strokeWidth={1.8} />
      )}
    </span>
  );
}

