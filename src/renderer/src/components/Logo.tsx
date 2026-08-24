import { Download } from 'lucide-react'
import './Logo.css'

interface LogoProps {
  size?: number
  className?: string
}

export default function Logo({ size = 34, className }: LogoProps) {
  return (
    <div className={`logo ${className ?? ''}`} style={{ width: size, height: size }}>
      <svg
        className="logo-badge"
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <rect x="3" y="7" width="26" height="18" rx="5" fill="var(--brand-red)" />
        <polygon points="14,12 14,20 21,16" fill="#fff" />
      </svg>
      <div className="logo-download-badge">
        <Download
          size={Math.round(size * 0.34)}
          color="var(--on-solid)"
          strokeWidth={2.75}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
