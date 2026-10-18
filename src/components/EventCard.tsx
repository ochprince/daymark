import { SwipeCard } from './SwipeCard'
import { anchorOf, daysSince, formatDate, formatSpan, isToday, milestoneAt } from '../lib/days'
import type { DayEvent } from '../lib/types'
import { SparkIcon } from './icons'

type Props = {
  event: DayEvent
  now: number
  revealed: boolean
  onReveal: (id: string | null) => void
  onOpen: (event: DayEvent) => void
  /** 点「历史」胶囊：直接看这一轮轮的历史 */
  onHistory?: (event: DayEvent) => void
  /** 按住卡片半秒：重置这一轮（之前的天数归档进历史） */
  onReset?: (event: DayEvent) => void
  onDelete: (event: DayEvent) => void
}

export function EventCard({ event, now, revealed, onReveal, onOpen, onHistory, onReset, onDelete }: Props) {
  const anchor = anchorOf(event)
  const days = daysSince(anchor, now)
  const span = formatSpan(anchor, now)
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
      // 按住半秒重置：和打卡页按住记一次是同一套确认逻辑
      onLongPress={onReset ? () => onReset(event) : undefined}
      pressScale={false}
      onDelete={() => onDelete(event)}
    >
      <div className="card__head">
        <h2 className="card__title">
          <span className="card__dot" />
          <span>{event.title}</span>
        </h2>
      <div className="card__tools">
        <button
          type="button"
          className="field__chip"
          aria-label={`查看「${event.title}」的历史`}
          onClick={(clickEvent) => {
            clickEvent.stopPropagation()
            onHistory?.(event)
          }}
        >
          <span className="field__chip-dot" />
          {event.history && event.history.length > 0 ? `历史 · ${event.history.length} 轮` : '历史'}
        </button>
      </div>
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
