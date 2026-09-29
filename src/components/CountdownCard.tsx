import { SwipeCard } from './SwipeCard'
import { DAY_MS, formatDate, milestoneAt, nextOccurrence, repeatOption } from '../lib/days'
import type { CountdownView } from '../lib/days'
import type { CountdownEvent } from '../lib/types'
import { RepeatIcon, SparkIcon } from './icons'

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
  const milestone = days > 0 ? milestoneAt(days) : null
  const expired = days < 0
  const number = Math.abs(days)

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
        {milestone !== null ? (
          <span className="chip chip--milestone">
            <SparkIcon />
            还有 {milestone} 天
          </span>
        ) : event.repeat !== 'none' ? (
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
            <span>下次 {formatDate(nextOccurrence(event.startedAt, event.repeat, view.now + DAY_MS))}</span>
          ) : (
            <span>{formatDate(next)}</span>
          )
        ) : expired ? (
          <span>原定 {formatDate(next)}</span>
        ) : event.repeat !== 'none' ? (
          <span>下次 {formatDate(next)}</span>
        ) : (
          <span>{formatDate(next)}</span>
        )}
      </p>
    </SwipeCard>
  )
}
