import { useState } from 'react'
import { Sheet } from './Sheet'
import { ChevronDownIcon } from './icons'
import {
  buildHistory,
  daysInPeriod,
  formatClock,
  periodLabel,
  periodUnit,
  summarizePeriods,
} from '../lib/checkins'
import type { CheckInEvent } from '../lib/types'

type Props = {
  event: CheckInEvent
  now: number
  onClose: () => void
}

/** 周期里某一天的短标签：9月30日 */
function shortDay(ts: number): string {
  const date = new Date(ts)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

/**
 * 打卡历史：每个周期一行，最近的在上，点开能看到这个周期里
 * 每一天是几点几分记的。当前周期也在列表里（顶行），默认展开。
 */
export function CheckInHistorySheet({ event, now, onClose }: Props) {
  const periods = buildHistory(event, now, true)
  // 小结必须和下面列出来的行对得上：列表里有今天，小结就算今天
  const summary = summarizePeriods(periods)
  const unit = periodUnit(event.cadence)

  // 默认展开最近的一行——想看「今天几点喝的」，一进来就是它
  const [openKey, setOpenKey] = useState<number | null>(periods.length > 0 ? periods[0].start : null)

  return (
    <Sheet label={`${event.title} 的历史`} onClose={onClose}>
      <h2 className="sheet__title">{event.title} 的历史</h2>
      <p className="sheet__sub">
        {summary.periods > 0
          ? `共 ${summary.periods} ${unit} · 最多 ${summary.most} 次 · 合计 ${summary.total} 次`
          : '点开一行，能看到每次是几点记的'}
      </p>

      {periods.length > 0 ? (
        <ul className="checkin-history">
          {periods.map((period) => {
            const open = openKey === period.start
            const days = open ? daysInPeriod(event, event.cadence, period.start) : []
            return (
              <li key={period.start} className="checkin-history__row" data-open={open}>
                <button
                  type="button"
                  className="checkin-history__head"
                  aria-expanded={open}
                  onClick={() => setOpenKey(open ? null : period.start)}
                >
                  {/* 不加「今天 ·」前缀：列表本来就是崭新的在上，顶行即当前周期，
                      加了前缀会让两行的日期错开，看着不齐 */}
                  <span className="checkin-history__when">
                    {periodLabel(event.cadence, period.start, now)}
                  </span>
                  <span className="checkin-history__count">
                    <b>{period.count}</b>
                    <span>次</span>
                  </span>
                  <span className="checkin-history__chev" aria-hidden="true">
                    <ChevronDownIcon />
                  </span>
                </button>

                {open ? (
                  <ul className="checkin-history__days">
                    {days.map((day) => (
                      <li key={day.key} className="checkin-history__day">
                        {event.cadence === 'daily' ? null : (
                          <span className="checkin-history__date">{shortDay(day.start)}</span>
                        )}
                        <span className="checkin-history__times">
                          {day.times.length > 0 ? (
                            day.times.map((ts, index) => (
                              <span key={`${ts}-${index}`} className="checkin-history__time">
                                {formatClock(ts)}
                              </span>
                            ))
                          ) : (
                            <span className="checkin-history__notime">{day.count} 次 · 当时没记时刻</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="checkin-history__empty">还没有记录，按住卡片就开始记了</p>
      )}
    </Sheet>
  )
}
