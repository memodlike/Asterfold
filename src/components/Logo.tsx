interface LogoProps {
  compact?: boolean;
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <div className="brand" aria-label="Asterfold">
      <svg className="brand__mark" viewBox="0 0 64 64" aria-hidden="true">
        <g fill="currentColor">
          <path d="M32 3 39 24.5 32 29l-7-4.5Z" />
          <path d="m61 32-21.5 7L35 32l4.5-7Z" />
          <path d="m32 61-7-21.5 7-4.5 7 4.5Z" />
          <path d="M3 32 24.5 25l4.5 7-4.5 7Z" />
          <path d="m52 12-7 21-10-2 2-10Z" opacity=".72" />
          <path d="m52 52-21-7 2-10 10 2Z" opacity=".72" />
          <path d="M12 52 19 31l10 2-2 10Z" opacity=".72" />
          <path d="m12 12 21 7-2 10-10-2Z" opacity=".72" />
        </g>
        <circle cx="32" cy="32" r="4" fill="currentColor" />
      </svg>
      {!compact ? <span>Asterfold</span> : null}
    </div>
  );
}
