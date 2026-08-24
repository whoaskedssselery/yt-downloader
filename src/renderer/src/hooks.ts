import { useEffect, useState } from 'react'

const THEME_KEY = 'yt-downloader-theme'
type Theme = 'dark' | 'light'

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem(THEME_KEY) as Theme) || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

export function useGlobalScrollFade(): void {
  useEffect(() => {
    const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>()
    const onScroll = (e: Event): void => {
      const el = e.target
      if (!(el instanceof HTMLElement) || !el.classList.contains('scroll-fade')) return
      el.classList.add('is-scrolling')
      clearTimeout(timers.get(el))
      timers.set(
        el,
        setTimeout(() => el.classList.remove('is-scrolling'), 700)
      )
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', onScroll, { capture: true })
  }, [])
}
