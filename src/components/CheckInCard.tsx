import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { SwipeCard } from './SwipeCard'
import { PencilIcon } from './icons'
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

/** 蓄力时长：按住这么久才记一次 */
const CHARGE_MS = 500

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
  /** 蓄满力：记一次 */
  onTap: (event: CheckInEvent) => void
  onOpenHistory: (event: CheckInEvent) => void
  onEdit: (event: CheckInEvent) => void
  onDelete: (event: CheckInEvent) => void
}

/**
 * 打卡卡片：**按住半秒**才算记一次。
 *
 * 按下开始蓄力（底部光晕亮起 + 标题旁圆点亮出进度环），
 * 中途松手就退回去、不记数——滑列表、手滑点一下都不会误记；
 * 蓄满才 +1，同时炸开一圈火花并轻微震动（次数踩到里程碑时飞得更远）。
 *
 * 蓄力动画全部交给 CSS 的 transition，JS 只在「按下」和「蓄满」两个时刻各跑一次，
 * 不做逐帧 setState。
 */
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

  const [charging, setCharging] = useState(false)
  const [bursts, setBursts] = useState<Burst[]>([])
  const pointRef = useRef({ x: 0, y: 0 })
  const timerRef = useRef(0)
  const lastCount = useRef(count)

  /**
   * 数字变大 = 刚刚记了一次，在手指按下的位置放特效。
   * 认「数字变化」而不是认「点击」：拖动、中途松手都不会误触发。
   */
  useEffect(() => {
    const delta = count - lastCount.current
    lastCount.current = count
    if (delta <= 0) return
    const burst = {
      id: ++burstSeed,
      x: pointRef.current.x,
      y: pointRef.current.y,
      milestone: COUNT_MILESTONES.includes(count),
    }
    setBursts((list) => [...list.slice(-4), burst])
    // 轻微震动（iOS Safari 没有这个 API，会自动跳过）
    navigator.vibrate?.(burst.milestone ? [12, 40, 22] : 16)
    // 定时收走这一次的特效：不依赖动画回调，连续打卡时也不会越积越多
    const timer = window.setTimeout(() => {
      setBursts((list) => list.filter((item) => item.id !== burst.id))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [count])

  // 卡片被滑走 / 页面切走时别把定时器留下，否则会在后台补记一次
  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const beginCharge = (pointerEvent: React.PointerEvent<HTMLDivElement>) => {
    if (pointerEvent.pointerType === 'mouse' && pointerEvent.button !== 0) return
    // 特效锚点收在卡片内：贴着边缘按的时候，烟花不会有一半被卡片裁掉
    const rect = pointerEvent.currentTarget.getBoundingClientRect()
    const clamp = (value: number, max: number) => Math.min(Math.max(value, 20), Math.max(20, max - 20))
    pointRef.current = {
      x: clamp(pointerEvent.clientX - rect.left, rect.width),
      y: clamp(pointerEvent.clientY - rect.top, rect.height),
    }
    window.clearTimeout(timerRef.current)
    setCharging(true)
    timerRef.current = window.setTimeout(() => {
      setCharging(false)
      onTap(event)
    }, CHARGE_MS)
  }

  const endCharge = () => {
    window.clearTimeout(timerRef.current)
    setCharging(false)
  }

  return (
    <SwipeCard
      id={event.id}
      colorIndex={event.color}
      ariaLabel={`${event.title}，${periodNoun(event.cadence)}已记 ${count} 次，按住半秒再记一次`}
      revealed={revealed}
      onReveal={onReveal}
      // 点一下不再记数：记一次只能靠按住蓄力，这里什么都不做
      onOpen={() => undefined}
      // 按住两秒的缩放会把卡片边缘缩进去、露出底下的红色，这里不要按下反馈
      pressScale={false}
      onDelete={() => onDelete(event)}
    >
      <div
        className="checkin"
        data-charging={charging}
        onPointerDown={beginCharge}
        onPointerUp={endCharge}
        onPointerCancel={endCharge}
        onPointerLeave={endCharge}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="card__head">
          <h2 className="card__title">
            <span className="card__dot-wrap" data-charging={charging}>
              <span className="card__dot" />
              {/* 蓄力进度环：从圆点长出来，两秒闭合 */}
              <svg className="charge-ring" viewBox="0 0 20 20" aria-hidden="true">
                <circle className="charge-ring__track" cx="10" cy="10" r="8.4" />
                <circle className="charge-ring__bar" cx="10" cy="10" r="8.4" />
              </svg>
            </span>
            <span>{event.title}</span>
          </h2>
          <div className="card__tools">
            {/* 入口常驻：刚建的事一件还没记完时也要能看到它，否则入口等于藏起来了 */}
            <button
              type="button"
              className="field__chip"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                onOpenHistory(event)
              }}
            >
              <span className="field__chip-dot" />
              {history.length > 0 ? `历史 · ${history.length} ${periodUnit(event.cadence)}` : '历史'}
            </button>
            <button
              type="button"
              className="card__icon"
              aria-label={`编辑「${event.title}」`}
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                onEdit(event)
              }}
            >
              <PencilIcon />
            </button>
          </div>
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
              <span>
                连续 {streak} {periodUnit(event.cadence)}
              </span>
            </>
          ) : null}
        </p>

        {/* 蓄力：底部柔和亮起的一团光（进度看标题旁的圆环，两秒闭合） */}
        <span className="checkin__energy" aria-hidden="true" />

        {/* 蓄满那一刻的特效层：全部限制在卡片内部（卡片本身 overflow: hidden），不参与命中 */}
        <div className="checkin__fx" aria-hidden="true">
          {bursts.map((burst) => (
            <span key={burst.id} className="checkin__at" style={{ left: burst.x, top: burst.y }}>
              {/* 从指尖扩散开的一圈光 */}
              <motion.span
                className="checkin__ripple"
                initial={{ scale: 0.12, opacity: 0.55 }}
                animate={{ scale: 1, opacity: 0 }}
                transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
              />
              {/* 数字上炸开的一圈细环 */}
              {reduceMotion ? null : (
                <motion.span
                  className="checkin__ring"
                  initial={{ scale: 0.5, opacity: 0.9 }}
                  animate={{ scale: burst.milestone ? 2.1 : 1.5, opacity: 0 }}
                  transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              {/* +1 往上飘 */}
              <motion.span
                className="checkin__ghost"
                initial={reduceMotion ? { opacity: 0 } : { y: 6, opacity: 0, scale: 0.7 }}
                animate={{ y: -46, opacity: [0, 1, 1, 0], scale: 1.15 }}
                transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
              >
                +1
              </motion.span>

              {/* 每次蓄满都炸一圈火花；踩到里程碑时飞得更远、卡片闪得更亮 */}
              {SPARK_ANGLES.map((angle, index) => {
                const radians = (angle * Math.PI) / 180
                const distance = burst.milestone
                  ? index % 2 === 0
                    ? 62
                    : 46
                  : index % 2 === 0
                    ? 44
                    : 32
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
                initial={{ opacity: burst.milestone ? 0.42 : 0.22 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.62, ease: 'easeOut' }}
              />
            </span>
          ))}
        </div>
      </div>
    </SwipeCard>
  )
}
