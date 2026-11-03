/**
 * 灵动岛 · 三种形态。
 *
 * - idle：闲时的一条胶囊，左边小伙伴，右边当前焦点的天数和「今天已走」百分比；
 * - charging：日常计时展开，倒计时 + 进度环 + 小伙伴在动；
 * - done：完成，打勾（勾是描边画出来的，`.reduce-motion` 下直接显示）。
 *
 * 真机上这是 ActivityKit 的 Live Activity：Compact / Expanded / Minimal 三种呈现
 * 都是系统给的，Web 版把 width / height 的过渡当作「展开」的近似，
 * 0.35s 与 iOS 展开动效的时间尺度一致（见 docs/native/SYSTEM-SURFACES.md）。
 */
import type { CSSProperties } from 'react'
import { Creature } from '../../components/Creature'
import { t } from '../../lib/i18n'
import { formatMMSS, formatPercent, frozenClock, remainingSeconds, type SystemClock } from './clock'
import type { SystemItem } from './model'
import { Ring } from './Ring'

export type IslandState = 'idle' | 'charging' | 'done'

export type IslandTimer = {
  /** 计时开始的那一刻（毫秒） */
  startedAt: number
  /** 总时长（秒） */
  totalSeconds: number
}

export type DynamicIslandProps = {
  state: IslandState
  /** 当前焦点；没有就是一条空胶囊 */
  item?: SystemItem | null
  clock?: SystemClock
  /** charging 用的计时窗口；不给就当作刚开始的 25 分钟 */
  timer?: IslandTimer
  onOpen?: (item: SystemItem | null) => void
}

const FALLBACK_CLOCK = frozenClock()

function hue(item: SystemItem | null | undefined): CSSProperties {
  const color = item?.color ?? 2
  return { '--c': `var(--h-${color})`, '--c2': `var(--h-${color}-2)` } as CSSProperties
}

function IslandSubject({ item, clock }: { item: SystemItem | null | undefined; clock: SystemClock }) {
  if (!item) {
    return (
      <>
        <span className="sys-island-cr">
          <Creature species="moon" stage={0} size={26} />
        </span>
        <span className="sys-island-title">{t('sys.island.idle')}</span>
        <span className="sys-island-pct">{formatPercent(clock.dayPercent)}</span>
      </>
    )
  }
  return (
    <>
      <span className="sys-island-cr">
        <Creature species={item.species} stage={item.stage} size={28} />
      </span>
      <span className="sys-island-title">{item.title}</span>
      <span className="sys-island-days">
        <b>{Math.max(0, item.days)}</b>
        {t('sys.unitDay')}
        <em>{formatPercent(clock.dayPercent)}</em>
      </span>
    </>
  )
}

function CheckMark() {
  return (
    <span className="sys-island-check" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path d="M5 12.6l4.6 4.6L19 7.4" />
      </svg>
    </span>
  )
}

export function DynamicIsland({ state, item, clock, timer, onOpen }: DynamicIslandProps) {
  const now = (clock ?? FALLBACK_CLOCK).now
  const totalSeconds = timer?.totalSeconds && timer.totalSeconds > 0 ? timer.totalSeconds : 25 * 60
  const left = timer ? remainingSeconds(timer.startedAt + totalSeconds * 1000, now) : totalSeconds
  const elapsedRatio = Math.min(1, Math.max(0, 1 - left / totalSeconds))
  const percent = elapsedRatio * 100
  const clickable = typeof onOpen === 'function'

  return (
    <div
      className={`sys-island is-${state}`}
      data-state={state}
      style={hue(item)}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={() => onOpen?.(item ?? null)}
      onKeyDown={(event) => {
        if (!clickable) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen?.(item ?? null)
        }
      }}
    >
      <div className="sys-island-inner">
        {state === 'idle' ? (
          <div className="sys-island-row is-idle-row">
            <IslandSubject item={item} clock={clock ?? FALLBACK_CLOCK} />
          </div>
        ) : null}

        {state === 'charging' ? (
          <div className="sys-island-row is-charging-row">
            <span className="sys-island-cr is-live">
              <Creature species={item?.species ?? 'sprout'} stage={item?.stage ?? 0} size={52} />
            </span>
            <span className="sys-island-main">
              <small>{t('sys.island.charging')}</small>
              <b className="sys-island-time">{formatMMSS(left)}</b>
              <span className="sys-island-bar">
                <i style={{ width: `${percent}%` }} />
              </span>
            </span>
            <Ring percent={percent} size={58} stroke={6} className="is-island">
              <small className="sys-island-ring-label">{Math.round(percent)}%</small>
            </Ring>
          </div>
        ) : null}

        {state === 'done' ? (
          <div className="sys-island-row is-done-row">
            <CheckMark />
            <span className="sys-island-title">{t('sys.island.done')}</span>
            <span className="sys-island-sub">{item?.title ?? ''}</span>
          </div>
        ) : null}
      </div>
      {state === 'idle' ? (
        <span className="sys-island-edge" aria-hidden="true">
          <i style={{ width: `${(clock ?? FALLBACK_CLOCK).dayPercent}%` }} />
        </span>
      ) : null}
    </div>
  )
}
