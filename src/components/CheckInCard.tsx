import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { SwipeCard } from './SwipeCard'
import {
  buildHistory,
  countInPeriod,
  periodNoun,
  periodUnit,
  previousNoun,
  previousPeriodCount,
  streakPeriods,
} from '../lib/checkins'
import type { CheckInEvent } from '../lib/types'

/** 次数踩到这些数字时来一次更大的庆祝（和天数里程碑一样，只是换成了次数） */
const COUNT_MILESTONES = [3, 5, 10, 15, 20, 30, 50, 66, 88, 100, 150, 200, 300, 365, 500, 1000]

/** 一圈飞出去的小亮点：固定角度，避免每次随机导致看起来不稳定 */
const SPARK_ANGLES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324]

type Burst = {
  id: number
  /** 手指按下的位置（相对卡片） */
  x: number
  y: number
  milestone: boolean
}

let burstSeed = 0

type Props = {
  event: CheckInEvent
  now: number
  revealed: boolean
  onReveal: (id: string | null) => void
  /** 点一下：记一次 */
  onTap: (event: CheckInEvent) => void
  onOpenHistory: (event: CheckInEvent) => void
  /** 长按：编辑 */
  onEdit: (event: CheckInEvent) => void
  onDelete: (event: CheckInEvent) => void
}

export function CheckInCard({
  event,
  now,
  revealed,
  onReveal,
  onTap,
  onOpenHistory,
  onEdit,
  onDelete,
}: Props) {
  const count = countInPeriod(event, now)
  const previous = previousPeriodCount(event, now)
  const history = buildHistory(event, now)
  const streak = streakPeriods(event, now)
  const reduceMotion = useReducedMotion()

  const [bursts, setBursts] = useState<Burst[]>([])
  const pointRef = useRef({ x: 0, y: 0 })
  const lastCount = useRef(count)

  /**
   * 数字变大 = 刚刚记了一次，在手指按下的位置放特效。
   * 认「数字变化」而不是认「点击」：拖动、长按都不会误触发。
   */
  useEffect(() => {
    const delta = count - lastCount.current
    lastCount.current = count
    if (delta <= 0 || reduceMotion) return
    const burst = {
      id: ++burstSeed,
      x: pointRef.current.x,
      y: pointRef.current.y,
      milestone: COUNT_MILESTONES.includes(count),
    }
    setBursts((list) => [...list.slice(-4), burst])
    // 轻微震动（iOS Safari 没有这个 API，会自动跳过）
    navigator.vibrate?.(burst.milestone ? [12, 40, 22] : 8)
    // 定时收走这一次的特效：不依赖动画回调，快速连点时也不会越积越多
    const timer = window.setTimeout(() => {
      setBursts((list) => list.filter((item) => item.id !== burst.id))
    }, 900)
    return () => window.clearTimeout(timer)
  }, [count, reduceMotion])

  return (
    <SwipeCard
      id={event.id}
      colorIndex={event.color}
      ariaLabel={`${event.title}，${periodNoun(event.cadence)}已记 ${count} 次`}
      revealed={revealed}
      onReveal={onReveal}
      onOpen={() => onTap(event)}
      onLongPress={() => onEdit(event)}
      onDelete={() => onDelete(event)}
    >
      <div
        className="checkin"
        onPointerDown={(pointerEvent) => {
          const rect = pointerEvent.currentTarget.getBoundingClientRect()
          pointRef.current = {
            x: pointerEvent.clientX - rect.left,
            y: pointerEvent.clientY - rect.top,
          }
        }}
      >
        <div className="card__head">
          <h2 className="card__title">
            <span className="card__dot" />
            <span>{event.title}</span>
          </h2>
          {history.length > 0 ? (
            <button
              type="button"
              className="field__chip"
              onClick={(clickEvent) => {
                // 别让它冒泡成「记一次」
                clickEvent.stopPropagation()
                onOpenHistory(event)
              }}
            >
              <span className="field__chip-dot" />
              历史 · {history.length} {periodUnit(event.cadence)}
            </button>
          ) : null}
        </div>

        <div className="card__count">
          <span className="card__lead">{periodNoun(event.cadence)}</span>
          <span className="checkin__num">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={count}
                className="card__num"
                initial={reduceMotion ? { opacity: 0 } : { y: 30, opacity: 0, scale: 0.78, filter: 'blur(4px)' }}
                animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={reduceMotion ? { opacity: 0 } : { y: -30, opacity: 0, scale: 0.78, filter: 'blur(4px)' }}
                transition={{ type: 'spring', stiffness: 460, damping: 27, mass: 0.62 }}
              >
                {count}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="card__unit">次</span>
        </div>

        <p className="card__foot">
          {previous > 0 ? (
            <span>
              {previousNoun(event.cadence)} {previous} 次
            </span>
          ) : (
            <em>从今天开始记</em>
          )}
          {streak >= 2 ? (
            <>
              <span className="checkin__sep" />
              <span>连续 {streak} {periodUnit(event.cadence)}</span>
            </>
          ) : null}
        </p>

        {/* 特效层：全部限制在卡片内部（卡片本身 overflow: hidden），不参与命中 */}
        <div className="checkin__fx" aria-hidden="true">
          {bursts.map((burst) => (
            <span key={burst.id} className="checkin__at" style={{ left: burst.x, top: burst.y }}>
              {/* 从指尖扩散开的一圈光 */}
              <motion.span
                className="checkin__ripple"
                initial={{ scale: 0.12, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 0 }}
                transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
              />
              {/* 数字上炸开的一圈细环 */}
              <motion.span
                className="checkin__ring"
                initial={{ scale: 0.5, opacity: 0.9 }}
                animate={{ scale: burst.milestone ? 2.1 : 1.5, opacity: 0 }}
                transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
              />
              {/* +1 往上飘 */}
              <motion.span
                className="checkin__ghost"
                initial={reduceMotion ? { opacity: 0 } : { y: 6, opacity: 0, scale: 0.7 }}
                animate={{ y: -46, opacity: [0, 1, 1, 0], scale: 1.15 }}
                transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
              >
                +1
              </motion.span>

              {burst.milestone ? (
                <>
                  {SPARK_ANGLES.map((angle, index) => {
                    const radians = (angle * Math.PI) / 180
                    const distance = index % 2 === 0 ? 52 : 38
                    return (
                      <motion.span
                        key={angle}
                        className="checkin__spark"
                        initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
                        animate={{
                          x: Math.cos(radians) * distance,
                          y: Math.sin(radians) * distance,
                          opacity: [0, 1, 0],
                          scale: [0.3, 1, 0.4],
                        }}
                        transition={{ duration: 0.68, delay: index * 0.014, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )
                  })}
                  {/* 整张卡闪一下 */}
                  <motion.span
                    className="checkin__flash"
                    initial={{ opacity: 0.42 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.62, ease: 'easeOut' }}
                  />
                </>
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </SwipeCard>
  )
}
