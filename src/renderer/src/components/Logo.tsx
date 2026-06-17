export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-label="Arbeiten">
      <defs>
        <linearGradient id="arbeitenLogo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8584c" />
          <stop offset="1" stopColor="#d1453b" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1024" height="1024" rx="230" ry="230" fill="url(#arbeitenLogo)" />
      <g fill="#ffffff">
        <path d="M300 720 L430 304 L520 304 L650 720 L566 720 L538 626 L412 626 L384 720 Z M433 552 L517 552 L475 412 Z" />
        <path d="M690 720 L690 430 L764 430 L764 470 C788 440 820 424 858 424 L858 502 C812 502 770 520 764 566 L764 720 Z" />
      </g>
    </svg>
  )
}
