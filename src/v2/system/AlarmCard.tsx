/**
 * AlarmKit 全屏闹钟卡。
 *
 * 对应 iOS 26 的 AlarmKit：穿透静音 / 专注，用户必须处理。
 * 这里只做视觉，不发声 —— Web 端的「响」交给 lab 的按钮，
 * 真机侧需要 AlarmManager 的 schedule + 系统授权（见 docs/native/SYSTEM-SURFACES.md）。
 */
import type { CSSProperties } from 'react'
import { Creature } from '../../components/Creature'
import { formatShortDate } from '../../lib/days'
import { t } from '../../lib/i18n'
import { formatClock, frozenClock, type SystemClock } from './clock'
import type { SystemItem } from './model'

export type AlarmScene = 'countdown' | 'reminder'

export type AlarmCardProps = {
  item: SystemItem | null
  /** 倒数日到点 / 习惯提醒到点 */
  scene?: AlarmScene
  clock?: SystemClock
  /** 再等 10 分钟 */
  onSnooze?: () => void
  /** 知道了（停止） */
  onDismiss?: () => void
}

const FALLBACK_CLOCK = frozenClock()

function hue(item: SystemItem | null): CSSProperties {
  const color = item?.color ?? 1
  return { '--c': `var(--h-${color})`, '--c2': `var(--h-${color}-2)` } as CSSProperties
}

export function AlarmCard({ item, scene = 'countdown', clock, onSnooze, onDismiss }: AlarmCardProps) {
  const time = clock ?? FALLBACK_CLOCK
  const reminder = scene === 'reminder'

  const headline = reminder ? t('sys.alarm.remind', { time: formatClock(time.now) }) : t('sys.alarm.today')
  const sub = item
    ? reminder
      ? t('sys.habit.today', { done: item.count ?? 0, target: item.target ?? item.count ?? 0 })
      : `${item.date ? formatShortDate(item.date) : ''}${item.repeat ? ` · ${item.repeat}` : ''}`
    : ''

  return (
    <div className="sys-alarm" style={hue(item)} data-scene={scene}>
      <div className="sys-alarm-glow" aria-hidden="true" />
      <div className="sys-alarm-body">
        <span className="sys-alarm-clock">{formatClock(time.now)}</span>
        <span className="sys-alarm-cr">
          <Creature species={item?.species ?? 'drop'} stage={item?.stage ?? 0} size={132} />
        </span>
        <small className="sys-alarm-kicker">{headline}</small>
        <b className="sys-alarm-title">{item?.title ?? t('sys.island.done')}</b>
        <span className="sys-alarm-sub">
          {sub}
          {!reminder && item?.memo ? ` · “${item.memo}”` : ''}
        </span>
      </div>
      <div className="sys-alarm-actions">
        <button type="button" className="sys-alarm-btn is-ghost" onClick={onSnooze}>
          {t('sys.alarm.snooze')}
        </button>
        <button type="button" className="sys-alarm-btn is-primary" onClick={onDismiss}>
          {t('sys.alarm.ok')}
        </button>
      </div>
    </div>
  )
}
