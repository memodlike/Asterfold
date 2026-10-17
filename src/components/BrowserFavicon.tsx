import { Globe } from "lucide-react";
import { useState, type ReactNode } from "react";
import { getMonogramColor, getMonogramLetter } from "../domain/bookmarkNaming";

export interface BrowserFaviconProps {
  url?: string | undefined;
  title?: string | undefined;
  source?: string | undefined;
  className?: string | undefined;
  privacy?: boolean | undefined;
  fallback?: ReactNode | undefined;
}

export function BrowserFavicon({ url, title, source, className, privacy, fallback }: BrowserFaviconProps) {
  const [failed, setFailed] = useState(false);
  const [prevSource, setPrevSource] = useState(source);

  if (prevSource !== source) {
    setPrevSource(source);
    setFailed(false);
  }

  const isSafeLocalSource = Boolean(
    source &&
    !privacy &&
    (source.startsWith("chrome-extension://") || source.startsWith("chrome://"))
  );
  const showImage = isSafeLocalSource && !failed;

  const effectiveUrl = (url || "").trim();

  return (
    <span className={`favicon ${className ?? ""}`.trim()} aria-hidden="true">
      {privacy ? (
        fallback ?? <Globe strokeWidth={1.8} />
      ) : showImage ? (
        <img
          src={source}
          alt=""
          role="presentation"
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
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

