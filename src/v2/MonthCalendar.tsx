import { useMemo, useState } from 'react'
import { dayKey } from '../lib/daykey'
import { monthOffsetFloor, monthSummary } from '../lib/calmonth'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import { INTL_LOCALE, getLocale } from '../lib/i18n'

/**
 * 打卡日历：能往回翻月，每个记过的日子按次数深浅点亮，点一天看当天记了几次。
 *
 * 以前只画「这个月」、也不显示次数——习惯类（喝水这种一天记好几次的）过去的
 * 每日记录在档案里根本翻不到，看起来像只留了当月。
 */
export function MonthCalendar({
  days,
  times,
  target,
  now,
}: {
  days: Record<string, number>
  times?: Record<string, number[]>
  target?: number | null
  now: number
}) {
  const [offset, setOffset] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)

  // 能往回翻到最早一条记录那个月；再往前就是空日历，没必要
  const earliest = useMemo(() => {
    const keys = Object.keys(days).sort()
    return keys.length > 0 ? keys[0] : dayKey(now)
  }, [days, now])

  const today = new Date(now)
  const shown = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const year = shown.getFullYear()
  const month = shown.getMonth()
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const total = new Date(year, month + 1, 0).getDate()
  const todayKey = dayKey(now)
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  // 最早那个月是能翻到的下限
  const minOffset = monthOffsetFloor(earliest, today)

  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, index) => index + 1),
  ]

  const summary = monthSummary(days, year, month)
  const dayCount = summary.days
  const hitCount = summary.hits
  // 深浅按「跟目标比」走；没设目标的就按这个月最多的一天算满格
  const full = Math.max(2, target && target > 0 ? target : summary.peak)

  const monthLabel = (() => {
    try {
      return new Intl.DateTimeFormat(INTL_LOCALE[getLocale()], { year: 'numeric', month: 'long' }).format(shown)
    } catch {
      return `${year}-${String(month + 1).padStart(2, '0')}`
    }
  })()

  const pickedCount = picked ? (days[picked] ?? 0) : 0
  const pickedTimes = picked && times ? (times[picked] ?? []) : []

  const move = (delta: number) => {
    setPicked(null)
    setOffset((value) => Math.min(0, Math.max(minOffset, value + delta)))
  }

  return (
    <div className="card cal">
      <div className="cal-h">
        <button
          className="cal-nav"
          type="button"
          aria-label={t('profile.calendar.prev')}
          disabled={offset <= minOffset}
          onClick={() => move(-1)}
        >
          ‹
        </button>
        <div className="cal-title">
          <b>{monthLabel}</b>
          <small>
            {dayCount === 0
              ? t('profile.calendar.empty')
              : t('profile.calendar.summary', { days: dayCount, times: hitCount })}
          </small>
        </div>
        <button
          className="cal-nav"
          type="button"
          aria-label={t('profile.calendar.next')}
          disabled={offset >= 0}
          onClick={() => move(1)}
        >
          ›
        </button>
      </div>

      <div className="cal-g">
        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((key) => (
          <div key={key} className="wd">
            {t(`weekday.${key}` as MessageKey)}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} />
          const key = `${monthPrefix}-${String(day).padStart(2, '0')}`
          const count = days[key] ?? 0
          // 记了 1 次也看得见（0.42），到目标就是满格
          const strength = count > 0 ? 0.42 + 0.58 * Math.min(1, count / full) : 0
          const className = [
            'd',
            count > 0 ? 'on' : '',
            key === todayKey ? 'today' : '',
            picked === key ? 'picked' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button key={key} className={className} type="button" onClick={() => setPicked(picked === key ? null : key)}>
              {count > 0 ? (
                <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
                  <circle cx="18" cy="18" r="14" fill="var(--c)" opacity={strength.toFixed(2)} />
                </svg>
              ) : null}
              <span>{day}</span>
              {count > 1 ? <i className="cnt">{count}</i> : null}
            </button>
          )
        })}
      </div>

      <div className={picked ? 'cal-foot on' : 'cal-foot'}>
        {picked ? (
          <>
            <b>{shortDay(picked)}</b>
            <span>
              {pickedCount === 0
                ? t('profile.calendar.dayNone')
                : [t('profile.calendar.times', { n: pickedCount }), ...pickedTimes.map(clock)]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
          </>
        ) : (
          <span className="cal-note">{t('profile.calendar.tapHint')}</span>
        )}
      </div>
    </div>
  )
}

/** 2026-10-24 → 10月24日 / Oct 24 */
function shortDay(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[getLocale()], { month: 'short', day: 'numeric' }).format(
      new Date(year, month - 1, day),
    )
  } catch {
    return `${month}/${day}`
  }
}

/** 打卡时刻 → 08:12 */
function clock(at: number): string {
  const date = new Date(at)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
