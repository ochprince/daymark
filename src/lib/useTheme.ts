import { useCallback, useEffect, useRef, useState } from 'react'

export type Theme = 'dark' | 'light'
/** 主题偏好：跟随系统 / 固定浅色 / 固定深色 */
export type ThemeMode = 'system' | 'light' | 'dark'

/** 点一下图标就按这个顺序轮换 */
export const THEME_CYCLE: readonly ThemeMode[] = ['system', 'light', 'dark']

export const THEME_MODE_LABEL: Record<ThemeMode, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
}

export const THEME_MODE_TOAST: Record<ThemeMode, string> = {
  system: '已跟随系统，随手机自动切换',
  light: '已固定为浅色',
  dark: '已固定为深色',
}

/** v2 起「跟随系统」是默认值；不读 v1，免得旧的固定选择把新默认顶掉 */
const STORAGE_KEY = 'daymark.theme.v2'
const THEME_COLORS: Record<Theme, string> = { dark: '#08090C', light: '#F7F5F2' }
const LIGHT_QUERY = '(prefers-color-scheme: light)'

type ViewTransitionLike = { ready: Promise<void> }

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionLike
}

type Origin = { x: number; y: number }

/** 系统现在是浅色还是深色（iOS 的「自动」就是在日出日落切换它） */
function systemTheme(): Theme {
  return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark'
}

function readMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'system' || stored === 'light' || stored === 'dark') return stored
  } catch {
    // 读不到就当跟随系统
  }
  return 'system'
}

function effectiveTheme(mode: ThemeMode): Theme {
  return mode === 'system' ? systemTheme() : mode
}

function applyTheme(theme: Theme, mode: ThemeMode): void {
  const root = document.documentElement
  root.dataset.theme = theme
  root.dataset.themeMode = mode
  // 原生控件（滚动条、日期选择器）也跟着走
  root.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[theme])
}

/**
 * 主题状态。
 *  - mode：用户偏好（跟随系统 / 浅色 / 深色），会存下来
 *  - theme：当前实际生效的明暗
 * 跟随系统时监听系统明暗变化（iOS 的「自动」在日出日落切换），
 * 切换优先用 View Transitions 做圆形擦除，不支持或开了「减少动态效果」就直接换。
 */
export function useTheme() {
  const [state, setState] = useState(() => {
    const mode = readMode()
    return { mode, theme: effectiveTheme(mode) }
  })
  const stateRef = useRef(state)

  useEffect(() => {
    applyTheme(state.theme, state.mode)
    stateRef.current = state
  }, [state])

  const swap = useCallback((theme: Theme, mode: ThemeMode) => {
    applyTheme(theme, mode)
    setState({ mode, theme })
  }, [])

  /** 带圆形擦除的切换；origin 为空（系统自己变的）就从屏幕中心扩散 */
  const transitionTo = useCallback(
    (theme: Theme, mode: ThemeMode, origin: Origin | null) => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const doc = document as DocumentWithViewTransition
      const supports = typeof doc.startViewTransition === 'function'

      if (reduced || !supports || !doc.startViewTransition) {
        swap(theme, mode)
        return
      }

      const { x, y } = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
      const transition = doc.startViewTransition(() => swap(theme, mode))

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
    [swap],
  )

  // 跟随系统：系统换外观时跟着换（固定浅/深时不动）
  useEffect(() => {
    const media = window.matchMedia(LIGHT_QUERY)
    const onChange = () => {
      if (stateRef.current.mode !== 'system') return
      const next: Theme = media.matches ? 'light' : 'dark'
      if (next === stateRef.current.theme) return
      transitionTo(next, 'system', null)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [transitionTo])

  const persist = useCallback((mode: ThemeMode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // 忽略
    }
  }, [])

  /** 轮换：跟随系统 → 浅色 → 深色 → 跟随系统，返回切换后的偏好 */
  const cycleTheme = useCallback(
    (origin?: Origin): ThemeMode => {
      const nextMode = THEME_CYCLE[(THEME_CYCLE.indexOf(state.mode) + 1) % THEME_CYCLE.length]
      persist(nextMode)
      transitionTo(effectiveTheme(nextMode), nextMode, origin ?? null)
      return nextMode
    },
    [persist, state.mode, transitionTo],
  )

  return { theme: state.theme, mode: state.mode, cycleTheme }
}
