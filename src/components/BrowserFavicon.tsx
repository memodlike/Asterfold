import { Globe } from "lucide-react";
import { useState } from "react";

interface BrowserFaviconProps {
  source: string;
}

export function BrowserFavicon({ source }: BrowserFaviconProps) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="favicon" aria-hidden="true">
      {source && !failed
        ? <img src={source} alt="" onError={() => setFailed(true)} />
        : <Globe strokeWidth={1.8} />}
    </span>
  );
}
