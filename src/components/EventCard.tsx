import { SwipeCard } from './SwipeCard'
import { daysSince, formatDate, formatSpan, isToday, milestoneAt } from '../lib/days'
import type { DayEvent } from '../lib/types'
import { SparkIcon } from './icons'

type Props = {
  event: DayEvent
  now: number
  revealed: boolean
  onReveal: (id: string | null) => void
  onOpen: (event: DayEvent) => void
  onDelete: (event: DayEvent) => void
}

export function EventCard({ event, now, revealed, onReveal, onOpen, onDelete }: Props) {
  const days = daysSince(event.startedAt, now)
  const span = formatSpan(event.startedAt, now)
  const milestone = milestoneAt(days)
  const started = isToday(event.startedAt, now)

  return (
    <SwipeCard
      id={event.id}
      colorIndex={event.color}
      ariaLabel={`${event.title}，已经 ${days} 天`}
      revealed={revealed}
      onReveal={onReveal}
      onOpen={() => onOpen(event)}
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
            满 {milestone} 天
          </span>
        ) : span ? (
          <span className="chip">{span}</span>
        ) : null}
      </div>

      <div className="card__count">
        <span className="card__num">{days}</span>
        <span className="card__unit">天</span>
      </div>

      <p className="card__foot">
        {started ? <em>从今天开始计时</em> : <span>{formatDate(event.startedAt)} 起</span>}
      </p>
    </SwipeCard>
  )
}
