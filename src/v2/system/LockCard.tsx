/**
 * 锁屏卡片 · 浅色磨砂。
 *
 * 真机对应 iOS 16.1 起的 Live Activity（锁屏那张长条），
 * 内容来自同一个 ActivityAttributes，只是系统把背景换成磨砂材质。
 * Web 版用 backdrop-filter 近似，底色仍然读皮肤令牌，所以四种皮肤下都不违和。
 */
import type { CSSProperties } from 'react'
import { Creature } from '../../components/Creature'
import { formatShortDate } from '../../lib/days'
import { t } from '../../lib/i18n'
import { formatClockShort, formatPercent, frozenClock, type SystemClock } from './clock'
import type { SystemItem } from './model'

export type LockCardProps = {
  item: SystemItem | null
  clock?: SystemClock
  onOpen?: (item: SystemItem | null) => void
  className?: string
}

const FALLBACK_CLOCK = frozenClock()

function hue(item: SystemItem | null): CSSProperties {
  const color = item?.color ?? 4
  return { '--c': `var(--h-${color})`, '--c2': `var(--h-${color}-2)` } as CSSProperties
}

function dayLine(item: SystemItem): string {
  if (item.kind === 'countdown') {
    if (item.days <= 0) return t('sys.countdown.today')
    return `${t('sys.countdown.in')} ${item.days} ${t('sys.unitDay')}`
  }
  return t('sys.lock.day', { n: Math.max(0, item.days) })
}

export function LockCard({ item, clock, onOpen, className }: LockCardProps) {
  const time = clock ?? FALLBACK_CLOCK
  const clickable = typeof onOpen === 'function'

  if (!item) {
    return (
      <div className={className ? `sys-lock is-empty ${className}` : 'sys-lock is-empty'}>
        <span className="sys-lock-time">{formatClockShort(time.now)}</span>
        <p className="sys-lock-title">{t('sys.lock.focus')}</p>
      </div>
    )
  }

  return (
    <div
      className={className ? `sys-lock ${className}` : 'sys-lock'}
      style={hue(item)}
      data-kind={item.kind}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={() => onOpen?.(item)}
      onKeyDown={(event) => {
        if (!clickable) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen?.(item)
        }
      }}
    >
      <div className="sys-lock-head">
        <span className="sys-lock-kicker">{t('sys.lock.focus')}</span>
        <span className="sys-lock-time">{formatClockShort(time.now)}</span>
      </div>
      <div className="sys-lock-body">
        <div className="sys-lock-main">
          <b className="sys-lock-title">{item.title}</b>
          <span className="sys-lock-day">{dayLine(item)}</span>
          <span className="sys-lock-sub">
            {item.kind === 'countdown' && item.date
              ? `${formatShortDate(item.date)}${item.repeat ? ` · ${item.repeat}` : ''}`
              : item.kind === 'habit'
                ? t('sys.habit.today', { done: item.count ?? 0, target: item.target ?? item.count ?? 0 })
                : `${formatPercent(time.dayPercent)} ${t('sys.todayWalk')}`}
          </span>
        </div>
        <div className="sys-lock-cr">
          <span className="sys-lock-halo" />
          <Creature species={item.species} stage={item.stage} size={64} />
        </div>
      </div>
      <div className="sys-lock-bar">
        <i style={{ width: `${item.kind === 'habit' ? Math.min(100, ((item.count ?? 0) / (item.target ?? 1)) * 100) : time.dayPercent}%` }} />
      </div>
    </div>
  )
}
