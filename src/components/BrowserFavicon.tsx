import { Globe } from "lucide-react";
import { useState, type ReactNode } from "react";

interface BrowserFaviconProps {
  source: string;
  className?: string | undefined;
  privacy?: boolean | undefined;
  fallback?: ReactNode | undefined;
}

export function BrowserFavicon({ source, className, privacy, fallback }: BrowserFaviconProps) {
  const [failed, setFailed] = useState(false);
  const [prevSource, setPrevSource] = useState(source);

  if (prevSource !== source) {
    setPrevSource(source);
    setFailed(false);
  }

  const isSafeSource = Boolean(
    source &&
    !privacy &&
    (source.startsWith("chrome-extension://") || source.startsWith("chrome://"))
  );
  const showImage = isSafeSource && !failed;

  return (
    <span className={`favicon ${className ?? ""}`.trim()} aria-hidden="true">
      {showImage ? (
        <img
          src={source}
          alt=""
          role="presentation"
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        fallback ?? <Globe strokeWidth={1.8} />
      )}
    </span>
  );
}
