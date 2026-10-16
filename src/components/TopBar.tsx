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
  soundOn: boolean
  onToggleSound: () => void
}

/** 喇叭：开着画声波，关了画一道叉 */
function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg
      className="icon-18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6.5 9H3.5v6h3L11 19z" />
      {on ? (
        <>
          <path d="M15 9.5a3.5 3.5 0 0 1 0 5" />
          <path d="M17.5 7a7 7 0 0 1 0 10" />
        </>
      ) : (
        <path d="m15.5 9.5 5 5M20.5 9.5l-5 5" />
      )}
    </svg>
  )
}

export function TopBar({ scrolled, mode, onCycleTheme, soundOn, onToggleSound }: Props) {
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
        <div className="topbar__actions">
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
        <button
          type="button"
          className="icon-btn"
          data-sound={soundOn ? 'on' : 'off'}
          aria-label={soundOn ? '音效已开，点击关闭' : '音效已关，点击打开'}
          onClick={onToggleSound}
        >
          <SoundIcon on={soundOn} />
        </button>
        </div>
      </div>
    </header>
  )
}
