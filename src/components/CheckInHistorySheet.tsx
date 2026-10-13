import { Sheet } from './Sheet'
import {
  buildHistory,
  periodLabel,
  periodNoun,
  periodUnit,
  summarizePeriods,
} from '../lib/checkins'
import type { CheckInEvent } from '../lib/types'

type Props = {
  event: CheckInEvent
  now: number
  onClose: () => void
}

/**
 * 打卡历史：每个走完的周期一行，最近的在上。
 * 当前周期不在里面（卡片上正在显示），所以第一天打开通常是空的。
 */
export function CheckInHistorySheet({ event, now, onClose }: Props) {
  const periods = buildHistory(event, now)
  const summary = summarizePeriods(periods)
  const unit = periodUnit(event.cadence)

  return (
    <Sheet label={`${event.title} 的历史`} onClose={onClose}>
      <h2 className="sheet__title">{event.title} 的历史</h2>
      <p className="sheet__sub">
        {periods.length > 0
          ? `共 ${summary.periods} ${unit} · 最多 ${summary.most} 次 · 合计 ${summary.total} 次`
          : `${periodNoun(event.cadence)}还在进行中，走完一个周期就会记在这里`}
      </p>

      {periods.length > 0 ? (
        <ul className="checkin-history">
          {periods.map((period) => (
            <li key={period.start} className="checkin-history__row">
              <span className="checkin-history__when">{periodLabel(event.cadence, period.start)}</span>
              <span className="checkin-history__count">
                <b>{period.count}</b>
                <span>次</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="checkin-history__empty">换个周期或者明天再来看看</p>
      )}
    </Sheet>
  )
}
