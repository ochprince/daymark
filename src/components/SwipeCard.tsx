import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { accentFor } from '../lib/palette'
import { TrashIcon } from './icons'

type DragInfo = {
  offset: { x: number; y: number }
  velocity: { x: number; y: number }
}

type Props = {
  id: string
  /** 无障碍名称 */
  ariaLabel: string
  colorIndex: number
  revealed: boolean
  onReveal: (id: string | null) => void
  onOpen: () => void
  onDelete: () => void
  children: ReactNode
}

/** 完全滑开的位移，与 index.css 的 --swipe-reveal 保持同一数值 */
const REVEAL_X = -92
/**
 * 拖动下限 = 删除按钮的宽度：滑到刚好露出按钮就停住，
 * 再往左不会继续拉出更多红色（只有一点回弹），和 iOS 一样。
 */
const DRAG_FLOOR = REVEAL_X
/** 松手收敛的弹簧：对齐 Apple 的「响应 0.35s、轻微回弹」 */
const SPRING_SNAP = { type: 'spring', visualDuration: 0.35, bounce: 0.18 } as const

const clampAction = (value: number) => Math.min(-REVEAL_X, Math.max(0, value - REVEAL_X))

/**
 * 卡片外壳：负责左滑露出删除、点击打开、拖动跟手与松手吸附。
 * 走过的日子 / 倒数日两种卡片共用同一套手势实现。
 */
export function SwipeCard({
  id,
  ariaLabel,
  colorIndex,
  revealed,
  onReveal,
  onOpen,
  onDelete,
  children,
}: Props) {
  const accent = accentFor(colorIndex)
  const draggedRef = useRef(false)
  /** 记录按下位置与按下期间的最大移动量：用来区分「点击」和「拖动」 */
  const pressRef = useRef<{ x: number; y: number; moved: number } | null>(null)
  const reduceMotion = useReducedMotion()

  // 位移是唯一状态源：红色填充与删除图标都由它派生
  const x = useMotionValue(0)
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

  useEffect(() => snap(revealed ? REVEAL_X : 0), [revealed, snap])

  const accentStyle = {
    '--accent-from': accent.from,
    '--accent-to': accent.to,
    '--accent-ink': accent.ink,
  } as CSSProperties

  return (
    <div className="swipe">
      {/* 删除层裁剪成与卡片同半径的圆角矩形：红色沿卡片弧度贴合，
          静止时两者轮廓一致，红色被卡片完全盖住 */}
      <div className="swipe__bleed">
        <div className="swipe__fill" />
        <motion.button
          type="button"
          className="swipe__action"
          style={{ x: actionX }}
          tabIndex={revealed ? 0 : -1}
          aria-hidden={!revealed}
          onClick={onDelete}
        >
          <TrashIcon />
          删除
        </motion.button>
      </div>

      <motion.div
        className="card"
        data-swipe-card="true"
        style={{ ...accentStyle, x }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: DRAG_FLOOR, right: 0 }}
        // 右侧阻尼 0：卡片不能往右拖（往右会露出底下的红色）。
        // 左侧只留极小回弹：到按钮宽度就是「到头了」，不会拉出更多红色。
        dragElastic={{ left: 0.03, right: 0 }}
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

          onReveal(shouldReveal ? id : null)
          snap(shouldReveal ? REVEAL_X : 0)
          window.setTimeout(() => {
            draggedRef.current = false
          }, 420)
        }}
        onPointerDown={(pointerEvent) => {
          // 在 window 上记移动量：拖动时手指下的元素会换，挂在卡片上会漏记
          const press = { x: pointerEvent.clientX, y: pointerEvent.clientY, moved: 0 }
          pressRef.current = press
          const onMove = (moveEvent: PointerEvent) => {
            const moved = Math.hypot(moveEvent.clientX - press.x, moveEvent.clientY - press.y)
            if (moved > press.moved) press.moved = moved
          }
          // 只在 pointerup 或超时后清理：pointercancel（motion 判定为纵向滚动时会发）
          // 不能作为结束信号，否则移动量会被清成 0
          const stop = () => {
            window.removeEventListener('pointermove', onMove, { capture: true } as EventListenerOptions)
            window.removeEventListener('pointerup', stop)
            window.clearTimeout(timer)
          }
          window.addEventListener('pointermove', onMove, { passive: true, capture: true })
          window.addEventListener('pointerup', stop)
          const timer = window.setTimeout(stop, 1500)
        }}
        onClick={(clickEvent) => {
          const press = pressRef.current
          pressRef.current = null
          if (draggedRef.current) return
          // 纵向拖动（滚列表）也算「不是点击」，否则松手会误开编辑
          if (press && clickEvent.detail > 0 && press.moved > 6) return
          if (revealed) {
            onReveal(null)
            return
          }
          onOpen()
        }}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return
          keyEvent.preventDefault()
          if (revealed) {
            onReveal(null)
            return
          }
          onOpen()
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
