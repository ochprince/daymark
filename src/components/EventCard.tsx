import { useCallback, useEffect, useRef } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
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

/** 完全滑开的位移，与 index.css 的 --swipe-reveal 保持同一数值 */
const REVEAL_X = -92
/** 拖动缓冲区：留出余量后，手指甩过头也不会撞上硬边界（iOS 里是阻尼回弹） */
const DRAG_FLOOR = -240
/** 松手后收敛的弹簧：对齐 Apple 的「响应 0.35s、轻微回弹」手感 */
const SPRING_SNAP = { type: 'spring', visualDuration: 0.35, bounce: 0.18 } as const

const clampAction = (value: number) => Math.min(-REVEAL_X, Math.max(0, value - REVEAL_X))

export function EventCard({ event, now, revealed, onReveal, onOpen, onDelete }: Props) {
  const accent = accentFor(event.color)
  const days = daysSince(event.startedAt, now)
  const span = formatSpan(event.startedAt, now)
  const milestone = milestoneAt(days)
  const started = isToday(event.startedAt, now)
  // 拖动结束后浏览器仍会补发一次 click，用它挡掉「滑完顺手打开了编辑」
  const draggedRef = useRef(false)
  const reduceMotion = useReducedMotion()

  // 卡片位移是唯一的状态源：红色填充与删除图标都由它派生
  const x = useMotionValue(0)
  // 图标随手指滑入，滑过终点后停在终点（iOS 的视差手感）
  const actionX = useTransform(x, clampAction)

  const snap = useCallback(
    (target: number) => {
      if (reduceMotion) {
        x.set(target)
        return () => undefined
      }
      const controls = animate(x, target, SPRING_SNAP)
      return () => controls.stop()
    },
    [reduceMotion, x],
  )

  // 外部状态变化（例如另一张卡片被滑开）时同样收敛到正确位置
  useEffect(() => snap(revealed ? REVEAL_X : 0), [revealed, snap])

  const accentStyle = {
    '--accent-from': accent.from,
    '--accent-to': accent.to,
    '--accent-ink': accent.ink,
  } as CSSProperties

  return (
    <div className="swipe">
      {/* 删除层裁剪成与卡片同半径的圆角矩形：卡片滑开后红色沿卡片弧度贴合，
          静止时两者轮廓一致，红色被卡片完全盖住，不会从圆角缝隙里透出来 */}
      <div className="swipe__bleed">
        <div className="swipe__fill" />
        <motion.button
          type="button"
          className="swipe__action"
          style={{ x: actionX }}
          tabIndex={revealed ? 0 : -1}
          aria-hidden={!revealed}
          onClick={() => onDelete(event)}
        >
          <TrashIcon />
          删除
        </motion.button>
      </div>

      <motion.div
        className="card"
        style={{ ...accentStyle, x }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`${event.title}，已经 ${days} 天`}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: DRAG_FLOOR, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        whileTap={{ scale: 0.988 }}
        onDragStart={() => {
          draggedRef.current = false
          x.stop()
        }}
        onDrag={(_event, info: DragInfo) => {
          if (Math.abs(info.offset.x) > 6) draggedRef.current = true
        }}
        onDragEnd={(_event, info: DragInfo) => {
          // iOS 的判定顺序：先看甩动速度，速度不够再看松手瞬间的绝对位置（过半即开）
          const position = x.get()
          const velocity = info.velocity.x
          let shouldReveal: boolean
          if (velocity < -400) shouldReveal = true
          else if (velocity > 400) shouldReveal = false
          else shouldReveal = position < REVEAL_X / 2

          onReveal(shouldReveal ? event.id : null)
          // 不依赖 state 变化，直接按判定结果收敛，避免「本来就开着」时停在半路
          snap(shouldReveal ? REVEAL_X : 0)
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
