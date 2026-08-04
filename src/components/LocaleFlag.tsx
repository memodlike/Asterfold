import type { ReactNode } from "react";
import { Globe2 } from "lucide-react";
import type { LocalePreference } from "../domain/models";

interface LocaleFlagProps {
  locale: LocalePreference;
}

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return <svg className="locale-flag" viewBox="0 0 24 18" role="img" aria-label={label}>{children}<rect x=".5" y=".5" width="23" height="17" rx="3" fill="none" stroke="currentColor" strokeOpacity=".16" /></svg>;
}

export function LocaleFlag({ locale }: LocaleFlagProps) {
  if (locale === "auto") return <span className="locale-flag locale-flag--auto" role="img" aria-label="Auto"><Globe2 size={18} /></span>;
  if (locale === "ru") return <Frame label="Russia"><rect width="24" height="6" fill="#fff" /><rect y="6" width="24" height="6" fill="#1c57a7" /><rect y="12" width="24" height="6" fill="#d52b1e" /></Frame>;
  if (locale === "kk") return <Frame label="Kazakhstan"><rect width="24" height="18" fill="#00afca" /><circle cx="12.5" cy="8" r="3.1" fill="#f5d44a" /><path d="M8.6 12.3h7.8c-1.2 1.5-2.5 2.2-3.9 2.2s-2.7-.7-3.9-2.2Z" fill="#f5d44a" /><path d="M3.2 3v12M4.7 4.2 3.2 5.6l1.5 1.4-1.5 1.4 1.5 1.4-1.5 1.4 1.5 1.4" fill="none" stroke="#f5d44a" strokeWidth=".8" /></Frame>;
  if (locale === "en") return <Frame label="United Kingdom"><rect width="24" height="18" fill="#21468b" /><path d="m0 0 24 18M24 0 0 18" stroke="#fff" strokeWidth="4" /><path d="m0 0 24 18M24 0 0 18" stroke="#cf142b" strokeWidth="1.8" /><path d="M12 0v18M0 9h24" stroke="#fff" strokeWidth="5" /><path d="M12 0v18M0 9h24" stroke="#cf142b" strokeWidth="2.6" /></Frame>;
  if (locale === "es") return <Frame label="Spain"><rect width="24" height="18" fill="#aa151b" /><rect y="4.5" width="24" height="9" fill="#f1bf00" /><circle cx="7.3" cy="9" r="1.4" fill="#aa151b" /></Frame>;
  if (locale === "de") return <Frame label="Germany"><rect width="24" height="6" fill="#171717" /><rect y="6" width="24" height="6" fill="#dd0000" /><rect y="12" width="24" height="6" fill="#ffce00" /></Frame>;
  if (locale === "fr") return <Frame label="France"><rect width="8" height="18" fill="#0055a4" /><rect x="8" width="8" height="18" fill="#fff" /><rect x="16" width="8" height="18" fill="#ef4135" /></Frame>;
  if (locale === "it") return <Frame label="Italy"><rect width="8" height="18" fill="#009246" /><rect x="8" width="8" height="18" fill="#fff" /><rect x="16" width="8" height="18" fill="#ce2b37" /></Frame>;
  if (locale === "pt") return <Frame label="Portugal"><rect width="9" height="18" fill="#046a38" /><rect x="9" width="15" height="18" fill="#da291c" /><circle cx="9" cy="9" r="2.3" fill="#ffcd00" /><circle cx="9" cy="9" r="1.15" fill="#fff" /></Frame>;
  if (locale === "pl") return <Frame label="Poland"><rect width="24" height="9" fill="#fff" /><rect y="9" width="24" height="9" fill="#dc143c" /></Frame>;
  if (locale === "uk") return <Frame label="Ukraine"><rect width="24" height="9" fill="#0057b7" /><rect y="9" width="24" height="9" fill="#ffd700" /></Frame>;
  if (locale === "tr") return <Frame label="Türkiye"><rect width="24" height="18" fill="#e30a17" /><circle cx="10" cy="9" r="4" fill="#fff" /><circle cx="11.2" cy="9" r="3.2" fill="#e30a17" /><path d="m15.5 6.7.7 1.5 1.7.2-1.25 1.1.35 1.65-1.5-.85-1.5.85.35-1.65-1.25-1.1 1.7-.2Z" fill="#fff" /></Frame>;
  return <Frame label="Netherlands"><rect width="24" height="6" fill="#ae1c28" /><rect y="6" width="24" height="6" fill="#fff" /><rect y="12" width="24" height="6" fill="#21468b" /></Frame>;
}
