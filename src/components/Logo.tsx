interface LogoProps {
  compact?: boolean;
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <div className="brand" aria-label="Asterfold">
      <svg className="brand__mark" viewBox="0 0 64 64" aria-hidden="true">
        <g fill="currentColor">
          <path d="M32 3 41 24 35 29 28 24Z" />
          <path d="m61 32-21 9-5-6 5-7Z" />
          <path d="m32 61-9-21 6-5 7 5Z" />
          <path d="M3 32 24 23l5 6-5 7Z" />
        </g>
        <path d="m32 28 4 4-4 4-4-4Z" fill="var(--color-canvas, Canvas)" />
      </svg>
      {!compact ? <span>Asterfold</span> : null}
    </div>
  );
}
