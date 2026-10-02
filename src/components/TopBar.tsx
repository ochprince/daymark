import { AutoIcon, MarkIcon, MoonIcon, SunIcon } from './icons'
import { THEME_MODE_LABEL } from '../lib/useTheme'
import type { ThemeMode } from '../lib/useTheme'

/** 分支预览构建（VITE_PREVIEW=1）时标记出来 */
const PREVIEW = import.meta.env.VITE_PREVIEW === '1'

/** 图标跟着偏好走：跟随系统用 A（Auto），固定浅色/深色用太阳和月亮 */
const ICONS: Record<ThemeMode, typeof SunIcon> = {
  system: AutoIcon,
  light: SunIcon,
  dark: MoonIcon,
}

type Props = {
  scrolled: boolean
  mode: ThemeMode
  onCycleTheme: (origin: { x: number; y: number }) => void
}

export function TopBar({ scrolled, mode, onCycleTheme }: Props) {
  const Icon = ICONS[mode]

  return (
    <header className="topbar" data-scrolled={scrolled}>
      <div className="topbar__inner">
        <div className="brand">
          <MarkIcon className="brand__mark" />
          <span className="brand__name">
            Daymark<span>刻度</span>
          </span>
          {/* 分支预览版才显示，方便和线上正式版区分 */}
          {PREVIEW ? <span className="brand__preview">预览</span> : null}
        </div>
        <button
          type="button"
          className="icon-btn"
          data-theme-mode={mode}
          aria-label={`主题：${THEME_MODE_LABEL[mode]}，点击切换`}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const isKeyboard = event.detail === 0
            onCycleTheme({
              x: isKeyboard ? rect.left + rect.width / 2 : event.clientX,
              y: isKeyboard ? rect.top + rect.height / 2 : event.clientY,
            })
          }}
        >
          <Icon className="icon-18" />
        </button>
      </div>
    </header>
  )
}
