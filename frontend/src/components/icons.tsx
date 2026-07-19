// Minimal SF-Symbols-style line icons (thin stroke, currentColor) — used
// instead of emoji so the sidebar reads as a native app chrome, not a chat UI.

type IconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconPhoto({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 15.5l-5.3-5.3a1.5 1.5 0 0 0-2.1 0L4 19" />
    </svg>
  )
}

export function IconAlbums({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  )
}

export function IconMusic({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  )
}

export function IconFolder({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  )
}

export function IconUpload({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 15.5V4M7 9l5-5 5 5" />
      <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
    </svg>
  )
}

export function IconFile({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" />
      <path d="M14 3.5V8h4" />
    </svg>
  )
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 5.5l6.5 6.5-6.5 6.5" />
    </svg>
  )
}

export function IconCabinet({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M4 12h16M8 7h.01M8 16h.01" />
    </svg>
  )
}

export function IconChevronLeft({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15 5.5L8.5 12l6.5 6.5" />
    </svg>
  )
}

export function IconDownload({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v12.5M7 11l5 5 5-5" />
      <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
    </svg>
  )
}

export function IconTrash({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
      <path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function IconInfo({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.75h.01" />
    </svg>
  )
}

export function IconMapPin({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  )
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  )
}

export function IconCheckCircle({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.3l2.6 2.6L16.3 9" />
    </svg>
  )
}

export function IconAlertCircle({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.25h.01" />
    </svg>
  )
}

export function IconClock({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

export function IconCamera({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  )
}

export function IconLogout({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 8V6a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5h6A1.5 1.5 0 0 0 14 18v-2" />
      <path d="M9 12h11M17 8.5l3.5 3.5-3.5 3.5" />
    </svg>
  )
}

export function IconPlay({ className }: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" className={className}>
      <path d="M7 4.8c0-1.1 1.2-1.8 2.2-1.2l10.4 6.7c.9.6.9 1.9 0 2.5L9.2 19.9c-1 .6-2.2-.1-2.2-1.2z" />
    </svg>
  )
}

export function IconPause({ className }: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" className={className}>
      <rect x="5.5" y="4" width="5" height="16" rx="1.5" />
      <rect x="13.5" y="4" width="5" height="16" rx="1.5" />
    </svg>
  )
}

export function IconSkipBack({ className }: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" className={className}>
      <path d="M6 4.5a1 1 0 0 1 1 1v15a1 1 0 0 1-2 0v-15a1 1 0 0 1 1-1z" />
      <path d="M19.5 5.2c0-1.1-1.2-1.8-2.2-1.2L8.4 9.5c-1 .6-1 2.1 0 2.7l8.9 5.5c1 .6 2.2-.1 2.2-1.2z" />
    </svg>
  )
}

export function IconSkipForward({ className }: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" className={className}>
      <path d="M18 4.5a1 1 0 0 0-1 1v15a1 1 0 0 0 2 0v-15a1 1 0 0 0-1-1z" />
      <path d="M4.5 5.2c0-1.1 1.2-1.8 2.2-1.2l8.9 5.5c1 .6 1 2.1 0 2.7l-8.9 5.5c-1 .6-2.2-.1-2.2-1.2z" />
    </svg>
  )
}

export function IconShuffle({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 6h3.5c1.3 0 2.5.7 3.2 1.8l4.6 8.4c.7 1.1 1.9 1.8 3.2 1.8H21" />
      <path d="M17.5 15l3.5 3-3.5 3" />
      <path d="M3 18h3.5c1.3 0 2.5-.7 3.2-1.8l1-1.8" />
      <path d="M14.3 8.8l1-1.8C16 5.7 17.2 5 18.5 5H21" />
      <path d="M17.5 3l3.5 3-3.5 3" />
    </svg>
  )
}

export function IconX({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
