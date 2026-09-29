import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'daymark.theme.v1'
const THEME_COLORS: Record<Theme, string> = { dark: '#08090C', light: '#F7F5F2' }

type ViewTransitionLike = { ready: Promise<void> }

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionLike
}

function readTheme(): Theme {
  const current = document.documentElement.dataset.theme
  if (current === 'light' || current === 'dark') return current
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[theme])
}

/**
 * 主题状态。切换时优先使用 View Transitions API 做一次圆形擦除，
 * 不支持（或用户开了「减少动态效果」）时直接切换。
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      try {
        if (window.localStorage.getItem(STORAGE_KEY)) return
      } catch {
        // 读不到就当作跟随系统
      }
      setTheme(media.matches ? 'light' : 'dark')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const persist = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 忽略
    }
  }, [])

  const toggleTheme = useCallback(
    (origin?: { x: number; y: number }) => {
      const next: Theme = theme === 'dark' ? 'light' : 'dark'
      const swap = () => {
        applyTheme(next)
        setTheme(next)
        persist(next)
      }

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const doc = document as DocumentWithViewTransition
      const supportsTransition = typeof doc.startViewTransition === 'function'

      if (!origin || reduced || !supportsTransition || !doc.startViewTransition) {
        swap()
        return
      }

      const { x, y } = origin
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
      const transition = doc.startViewTransition(swap)

      transition.ready
        .then(() => {
          document.documentElement.animate(
            {
              clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
            },
            {
              duration: 560,
              easing: 'cubic-bezier(.22,1,.36,1)',
              pseudoElement: '::view-transition-new(root)',
            },
          )
        })
        .catch(() => undefined)
    },
    [persist, theme],
  )

  return { theme, toggleTheme }
}
