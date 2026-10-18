import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { SwipeCard } from './SwipeCard'
import { PencilIcon } from './icons'
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

/** 按住多久才重置：和打卡蓄力一致 */
const RESET_HOLD_MS = 500

export function EventCard({ event, now, revealed, onReveal, onOpen, onHistory, onReset, onDelete }: Props) {
  const reduced = useReducedMotion()
  const [charging, setCharging] = useState(false)
  const holdTimer = useRef<number | null>(null)

  const endCharge = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    setCharging(false)
  }

  const beginCharge = () => {
    if (!onReset) return
    setCharging(true)
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      setCharging(false)
      onReset(event)
    }, RESET_HOLD_MS)
  }

  useEffect(() => endCharge, [])
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
      // 卡面点一下不做任何事：按住是重置，编辑走右上角的铅笔，避免两者打架
      onOpen={() => undefined}
      // 按住重置的蓄力自己做（要带进度环），不用 SwipeCard 的裸长按
      pressScale={false}
      onDelete={() => onDelete(event)}
    >
      <div
        className="card__body"
        data-charging={charging ? 'true' : undefined}
        onPointerDown={(pointerEvent) => {
          pointerEvent.preventDefault()
          beginCharge()
        }}
        onPointerUp={endCharge}
        onPointerLeave={endCharge}
        onPointerCancel={endCharge}
      >
        <span className="checkin__energy" aria-hidden="true" />
      <div className="card__head">
        <h2 className="card__title">
          <span className="card__dot-wrap" data-charging={charging ? 'true' : undefined}>
            <span className="card__dot" />
            <svg className="charge-ring" viewBox="0 0 20 20" aria-hidden="true">
              <circle className="charge-ring__track" cx="10" cy="10" r="8.4" />
              <circle className="charge-ring__bar" cx="10" cy="10" r="8.4" />
            </svg>
          </span>
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
        <button
          type="button"
          className="card__icon"
          aria-label={`编辑「${event.title}」`}
          onClick={(clickEvent) => {
            clickEvent.stopPropagation()
            onOpen(event)
          }}
        >
          <PencilIcon className="icon-16" />
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
