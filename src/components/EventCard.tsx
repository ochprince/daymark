import { useRef } from 'react'
import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import { accentFor } from '../lib/palette'
import { daysSince, formatDate, formatSpan, isToday, milestoneAt } from '../lib/days'
import type { DayEvent } from '../lib/types'
import { SparkIcon, TrashIcon } from './icons'

type DragInfo = {
  offset: { x: number; y: number }
  velocity: { x: number; y: number }
}

type Props = {
  event: DayEvent
  now: number
  revealed: boolean
  onReveal: (id: string | null) => void
  onOpen: (event: DayEvent) => void
  onDelete: (event: DayEvent) => void
}

const REVEAL_X = -92

export function EventCard({ event, now, revealed, onReveal, onOpen, onDelete }: Props) {
  const accent = accentFor(event.color)
  const days = daysSince(event.startedAt, now)
  const span = formatSpan(event.startedAt, now)
  const milestone = milestoneAt(days)
  const started = isToday(event.startedAt, now)
  // 拖动结束后浏览器仍会补发一次 click，用它挡掉「滑完顺手打开了编辑」
  const draggedRef = useRef(false)

  const accentStyle = {
    '--accent-from': accent.from,
    '--accent-to': accent.to,
    '--accent-ink': accent.ink,
  } as CSSProperties

  return (
    <div className="swipe">
      {/* 删除层单独裁剪成与卡片同半径的圆角矩形：
          卡片滑开后，红色会填满卡片圆角让出来的缺口，沿卡片的弧度贴合，
          而在静止状态下它被卡片完全盖住（两者轮廓一致），不会从圆角缝隙里透出来。 */}
      <div className="swipe__bleed" data-hidden={!revealed}>
        <div className="swipe__fill" />
        <button
          type="button"
          className="swipe__action"
          tabIndex={revealed ? 0 : -1}
          aria-hidden={!revealed}
          onClick={() => onDelete(event)}
        >
          <TrashIcon />
          删除
        </button>
      </div>

      <motion.div
        className="card"
        style={accentStyle}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`${event.title}，已经 ${days} 天`}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: REVEAL_X, right: 0 }}
        dragElastic={0.06}
        dragMomentum={false}
        animate={{ x: revealed ? REVEAL_X : 0 }}
        transition={{ type: 'spring', stiffness: 430, damping: 38 }}
        whileTap={{ scale: 0.988 }}
        onDragStart={() => {
          draggedRef.current = false
        }}
        onDrag={(_event, info: DragInfo) => {
          if (Math.abs(info.offset.x) > 6) draggedRef.current = true
        }}
        onDragEnd={(_event, info: DragInfo) => {
          const shouldReveal = info.offset.x < -44 || info.velocity.x < -320
          onReveal(shouldReveal ? event.id : null)
          window.setTimeout(() => {
            draggedRef.current = false
          }, 420)
        }}
        onClick={() => {
          if (draggedRef.current) return
          if (revealed) {
            onReveal(null)
            return
          }
          onOpen(event)
        }}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return
          keyEvent.preventDefault()
          if (revealed) {
            onReveal(null)
            return
          }
          onOpen(event)
        }}
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
      </motion.div>
    </div>
  )
}
