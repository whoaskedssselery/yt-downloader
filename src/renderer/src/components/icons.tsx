// Every icon here is purely decorative — always rendered next to a visible
// text label or an aria-label on its own button — hence aria-hidden below
// instead of a <title>.
interface IconProps {
  size?: number
  className?: string
}

const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 20 20',
  fill: 'none',
  'aria-hidden': true
})

export function IconSearch({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M17 17L13.4 13.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconFolder({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M2.5 5.8C2.5 5.03 3.12 4.4 3.9 4.4H7.6L9.1 6H16.1C16.87 6 17.5 6.63 17.5 7.4V14.2C17.5 14.97 16.87 15.6 16.1 15.6H3.9C3.12 15.6 2.5 14.97 2.5 14.2V5.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconDownload({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M10 3V12.5M10 12.5L14 8.5M10 12.5L6 8.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 15.5H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconClose({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M5 5L15 15M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconLock({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect
        x="4.5"
        y="8.5"
        width="11"
        height="8"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M6.8 8.5V6.3A3.2 3.2 0 0113.2 6.3V8.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="12.4" r="1.1" fill="currentColor" />
    </svg>
  )
}

export function IconCheck({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.6 10.2L8.8 12.4L13.4 7.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconAlert({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M10 2.5L18 16.5H2L10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 8V11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" />
    </svg>
  )
}

export function IconFilm({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="2.5" y="4" width="15" height="12" rx="1.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 4V16M13 4V16" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 8H7M13 8H17.5M2.5 12H7M13 12H17.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function IconWave({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M2.5 10H5L6.8 4.5L9.5 15.5L11.5 8L13 12L14.5 10H17.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconLink({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8.3 11.7L11.7 8.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M9 6.2L10.4 4.8A3.2 3.2 0 1115 9.4L13.5 10.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M11 13.8L9.6 15.2A3.2 3.2 0 115 10.6L6.5 9.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconUser({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.5 17C4.3 13.4 7 11.5 10 11.5C13 11.5 15.7 13.4 16.5 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconSun({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="10" cy="10" r="3.6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 2.5V4.3M10 15.7V17.5M17.5 10H15.7M4.3 10H2.5M15.1 4.9L13.8 6.2M6.2 13.8L4.9 15.1M15.1 15.1L13.8 13.8M6.2 6.2L4.9 4.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconMoon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M16.5 12.3A7 7 0 018 3.6a7 7 0 108.5 8.7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Spinner({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={`spinner ${className ?? ''}`}>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.2" />
      <path
        d="M17.5 10a7.5 7.5 0 00-7.5-7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
