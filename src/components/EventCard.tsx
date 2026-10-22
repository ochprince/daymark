import { motion, useReducedMotion } from 'motion/react'
import { SwipeCard } from './SwipeCard'
import { anchorOf, daysSince, formatDate, formatSpan, isToday, milestoneAt } from '../lib/days'
import type { DayEvent } from '../lib/types'
import { SparkIcon } from './icons'

type Props = {
  event: DayEvent
  now: number
  onOpen: (event: DayEvent) => void
  /** 点「历史」胶囊：直接看这一轮轮的历史 */
  onHistory?: (event: DayEvent) => void
}

export function EventCard({ event, now, onOpen, onHistory }: Props) {
  const reduced = useReducedMotion()
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
      // 点一下 = 打开编辑。长按在这张卡片上不再绑定任何动作：
      // 「按住」在整个 app 里只有一个意思——记一次（打卡）。
      onOpen={() => onOpen(event)}
      pressScale={false}
    >
      <div className="card__body">
      <div className="card__head">
        <h2 className="card__title">
          <span className="card__dot" />
          <span>{event.title}</span>
        </h2>
      <div className="card__head-aside">
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
      </div>

      <div className="card__count">
        <motion.span
          key={days}
          className="card__num"
          initial={reduced ? false : { opacity: 0, y: 12, scale: 0.92, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        >
          {days}
        </motion.span>
        <span className="card__unit">天</span>
      </div>

      <p className="card__foot">
        {started ? <em>从今天开始计时</em> : <span>{formatDate(event.startedAt)} 起</span>}
      </p>
      </div>
    </SwipeCard>
  )
}
