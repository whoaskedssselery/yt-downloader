import { motion, useReducedMotion } from 'framer-motion'
import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import './Splash.css'

const MotionDownload = motion.create(Download)

interface SplashProps {
  ready: boolean
  onFinished: () => void
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const
const LOOP_SECONDS = 1.4

export default function Splash({ ready, onFinished }: SplashProps) {
  const reduceMotion = useReducedMotion()
  const [playedOnce, setPlayedOnce] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setPlayedOnce(true), reduceMotion ? 0 : LOOP_SECONDS * 2 * 1000)
    return () => clearTimeout(timer)
  }, [reduceMotion])

  useEffect(() => {
    if (ready && playedOnce) onFinished()
  }, [ready, playedOnce, onFinished])

  const dropLoop = reduceMotion
    ? undefined
    : {
        duration: LOOP_SECONDS,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'easeInOut' as const,
        times: [0, 0.18, 0.55, 0.75, 1]
      }

  return (
    <motion.div
      className="splash"
      role="status"
      aria-live="polite"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      <span className="sr-only">Загрузка приложения</span>
      <motion.div
        className="splash-badge"
        initial={reduceMotion ? false : { scale: 0.6, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      >
        <svg width="88" height="88" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="3" y="7" width="26" height="18" rx="5" fill="var(--brand-red)" />
          <polygon points="14,12 14,20 21,16" fill="#fff" />
        </svg>
        <div className="splash-download-badge">
          <MotionDownload
            size={22}
            color="var(--on-solid)"
            strokeWidth={2.5}
            animate={
              reduceMotion ? undefined : { y: [-40, 0, 0, 40, 40], opacity: [0, 1, 1, 0, 0] }
            }
            transition={dropLoop}
          />
        </div>
      </motion.div>
      <motion.p
        className="splash-word"
        initial={reduceMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15, ease: EASE_OUT }}
      >
        YT Downloader
      </motion.p>
    </motion.div>
  )
}
