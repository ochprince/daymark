import { MarkIcon, MoonIcon, SunIcon } from './icons'
import type { Theme } from '../lib/useTheme'

/** 分支预览构建（VITE_PREVIEW=1）时标记出来 */
const PREVIEW = import.meta.env.VITE_PREVIEW === '1'

type Props = {
  scrolled: boolean
  theme: Theme
  onToggleTheme: (origin: { x: number; y: number }) => void
}

export function TopBar({ scrolled, theme, onToggleTheme }: Props) {
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
          aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const isKeyboard = event.detail === 0
            onToggleTheme({
              x: isKeyboard ? rect.left + rect.width / 2 : event.clientX,
              y: isKeyboard ? rect.top + rect.height / 2 : event.clientY,
            })
          }}
        >
          {theme === 'dark' ? <MoonIcon className="icon-18" /> : <SunIcon className="icon-18" />}
        </button>
      </div>
    </header>
  )
}
