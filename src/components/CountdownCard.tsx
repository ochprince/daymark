import { SwipeCard } from './SwipeCard'
import { DAY_MS, formatDate, formatWeekday, nextOccurrence, repeatOption } from '../lib/days'
import type { CountdownView } from '../lib/days'
import type { CountdownEvent } from '../lib/types'
import { RepeatIcon } from './icons'

type Props = {
  view: CountdownView
  revealed: boolean
  onReveal: (id: string | null) => void
  onOpen: (view: CountdownView) => void
  onDelete: (event: CountdownEvent) => void
}

export function CountdownCard({ view, revealed, onReveal, onOpen, onDelete }: Props) {
  const { event, next, days } = view
  const repeat = repeatOption(event.repeat)
  const expired = days < 0
  const number = Math.abs(days)
  /** 周期性事件的下一次：每周带上星期几，一眼能对上 */
  const formatNext = (timestamp: number) =>
    event.repeat === 'weekly'
      ? `${formatWeekday(timestamp)} · ${formatDate(timestamp)}`
      : formatDate(timestamp)

  return (
    <SwipeCard
      id={event.id}
      colorIndex={event.color}
      ariaLabel={`${event.title}，${expired ? `已过去 ${number} 天` : days === 0 ? '就是今天' : `还有 ${days} 天`}`}
      revealed={revealed}
      onReveal={onReveal}
      onOpen={() => onOpen(view)}
      onDelete={() => onDelete(event)}
    >
      <div className="card__head">
        <h2 className="card__title">
          <span className="card__dot" />
          <span>{event.title}</span>
        </h2>
        {/* 倒数日页不放里程碑徽标：那和大字「还有 N 天」是同一句话 */}
        {event.repeat !== 'none' ? (
          <span className="chip">
            <RepeatIcon />
            {repeat.label}
          </span>
        ) : expired ? (
          <span className="chip chip--muted">已过期</span>
        ) : null}
      </div>

      <div className="card__count">
        {days > 0 ? (
          <>
            <span className="card__lead">还有</span>
            <span className="card__num">{days}</span>
            <span className="card__unit">天</span>
          </>
        ) : days === 0 ? (
          <span className="card__num card__num--word">今天</span>
        ) : (
          <>
            <span className="card__lead">已过去</span>
            <span className="card__num">{number}</span>
            <span className="card__unit">天</span>
          </>
        )}
      </div>

      <p className="card__foot">
        {days === 0 ? (
          // 今天这一天，往后看一次更有用（月重复给下个月，一次性给原定日期）
          event.repeat !== 'none' ? (
            <span>
              下次 {formatNext(nextOccurrence(event.startedAt, event.repeat, view.now + DAY_MS))}
            </span>
          ) : (
            <span>{formatDate(next)}</span>
          )
        ) : expired ? (
          <span>原定 {formatDate(next)}</span>
        ) : event.repeat !== 'none' ? (
          <span>下次 {formatNext(next)}</span>
        ) : (
          <span>{formatDate(next)}</span>
        )}
      </p>
    </SwipeCard>
  )
}
