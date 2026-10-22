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
  /**
   * 左滑露出删除：现在只剩编辑弹层里的历史条目在用。
   * 首页卡片已经撤掉这套手势——它和滚动/翻页同向，误触率高、后果又不可逆。
   */
  revealed?: boolean
  onReveal?: (id: string | null) => void
  /** 点击打开。历史条目这种没有可打开内容的就不传，点一下改为露出删除 */
  onOpen?: () => void
  /**
   * 长按。打卡卡片点击 = 记一次，编辑只能走长按，
   * 所以这里需要一个「按住不动 0.45 秒」的入口。
   */
  onLongPress?: () => void
  onDelete?: () => void
  /** 内层容器的类名，默认 card；历史条目换成紧凑的行样式 */
  className?: string
  /**
   * 按下时是否做 0.988 的缩放反馈。打卡卡片按住要两秒，
   * 缩放会让卡片边缘缩进去、把底下的红色露出来，所以那边关掉。
   */
  pressScale?: boolean
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
 * 多长的按下算「点一下」。
 * 卡片上的长按动作（打卡蓄力 0.5s）由子组件自己处理，
 * 所以这里只用时长把「松手之后浏览器补发的那次 click」挡掉，
 * 而不指望标志位——按到 300ms 以上一律不算点击。
 */
const TAP_MAX_MS = 300

/**
 * 卡片外壳：负责左滑露出删除、点击打开、拖动跟手与松手吸附。
 * 走过的日子 / 倒数日两种卡片、以及编辑弹层里的历史条目共用同一套手势实现。
 */
export function SwipeCard({
  id,
  ariaLabel,
  colorIndex,
  revealed,
  onReveal,
  onOpen,
  onLongPress,
  onDelete,
  className,
  pressScale = true,
  children,
}: Props) {
  const accent = accentFor(colorIndex)
  /** 没传 onDelete 就是「不使用滑动手势」的纯卡片外壳 */
  const swipeEnabled = Boolean(onDelete)
  const draggedRef = useRef(false)
  /** 长按已经触发过：抑制随之而来的那次 click，否则会又记一次 */
  const longPressedRef = useRef(false)
  /** 记录按下位置、按下期间的最大移动量与按下时刻：用来区分「点击」「拖动」「按住」 */
  const pressRef = useRef<{ x: number; y: number; moved: number; downAt: number } | null>(null)
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

  useEffect(() => snap(swipeEnabled && revealed ? REVEAL_X : 0), [revealed, snap, swipeEnabled])

  const accentStyle = {
    '--accent-from': accent.from,
    '--accent-to': accent.to,
    '--accent-ink': accent.ink,
  } as CSSProperties

  /** 点击 / 回车：已经露出来就收回，有可打开的内容就打开，否则露出删除 */
  const activate = useCallback(() => {
    if (swipeEnabled && revealed) {
      onReveal?.(null)
      return
    }
    if (onOpen) {
      onOpen()
      return
    }
    onReveal?.(id)
  }, [id, onOpen, onReveal, revealed, swipeEnabled])

  return (
    <div className="swipe">
      {/* 删除层裁剪成与卡片同半径的圆角矩形：红色沿卡片弧度贴合，
          静止时两者轮廓一致，红色被卡片完全盖住 */}
      {swipeEnabled ? (
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
      ) : null}

      <motion.div
        className={className ?? 'card'}
        data-swipe-card="true"
        style={{ ...accentStyle, x }}
        role={onOpen ? 'button' : 'listitem'}
        tabIndex={0}
        aria-haspopup={onOpen ? 'dialog' : undefined}
        aria-label={ariaLabel}
        data-card-id={id}
        drag={swipeEnabled ? 'x' : false}
        dragDirectionLock={swipeEnabled}
        dragConstraints={swipeEnabled ? { left: DRAG_FLOOR, right: 0 } : undefined}
        // 右侧阻尼 0：卡片不能往右拖（往右会露出底下的红色）。
        // 左侧只留极小回弹：到按钮宽度就是「到头了」，不会拉出更多红色。
        dragElastic={{ left: 0.03, right: 0 }}
        dragMomentum={false}
        whileTap={pressScale ? { scale: 0.988 } : undefined}
        onDragStart={() => {
          draggedRef.current = false
          x.stop()
        }}
        onDrag={(_event, info: DragInfo) => {
          if (!swipeEnabled) return
          if (Math.abs(info.offset.x) > 6) draggedRef.current = true
        }}
        onDragEnd={(_event, info: DragInfo) => {
          if (!swipeEnabled) return
          // iOS 的判定顺序：先看甩动速度，速度不够再看松手瞬间的绝对位置（过半即开）
          const position = x.get()
          const velocity = info.velocity.x
          let shouldReveal: boolean
          if (velocity < -400) shouldReveal = true
          else if (velocity > 400) shouldReveal = false
          else shouldReveal = position < REVEAL_X / 2

          onReveal?.(shouldReveal ? id : null)
          snap(shouldReveal ? REVEAL_X : 0)
          window.setTimeout(() => {
            draggedRef.current = false
          }, 500)
        }}
        onPointerDown={(pointerEvent) => {
          // 在 window 上记移动量：拖动时手指下的元素会换，挂在卡片上会漏记
          const press = { x: pointerEvent.clientX, y: pointerEvent.clientY, moved: 0, downAt: Date.now() }
          pressRef.current = press
          const onMove = (moveEvent: PointerEvent) => {
            const moved = Math.hypot(moveEvent.clientX - press.x, moveEvent.clientY - press.y)
            if (moved > press.moved) press.moved = moved
          }
          // 只在 pointerup 或超时后清理：pointercancel（motion 判定为纵向滚动时会发）
          // 不能作为结束信号，否则移动量会被清成 0
          let longTimer = 0
          const stop = () => {
            window.removeEventListener('pointermove', onMove, { capture: true } as EventListenerOptions)
            window.removeEventListener('pointerup', stop)
            window.clearTimeout(timer)
            window.clearTimeout(longTimer)
          }
          window.addEventListener('pointermove', onMove, { passive: true, capture: true })
          window.addEventListener('pointerup', stop)
          const timer = window.setTimeout(stop, 1500)
          // 长按：按住 0.5 秒且中途没怎么移动才算，移动超过 6px（想滑）就取消
          longTimer = window.setTimeout(() => {
            if (!onLongPress || press.moved > 6 || draggedRef.current) return
            longPressedRef.current = true
            onLongPress()
          }, 500)
        }}
        onClick={(clickEvent) => {
          const press = pressRef.current
          pressRef.current = null
          if (longPressedRef.current) {
            // 长按后的这次 click 丢掉，也不能让它去打开/记录
            longPressedRef.current = false
            draggedRef.current = false
            return
          }
          if (draggedRef.current) return
          // 纵向拖动（滚列表）也算「不是点击」，否则松手会误开编辑
          if (press && clickEvent.detail > 0 && press.moved > 6) return
          /*
           * 按得久 = 不是点击。子组件（打卡卡的蓄力）自己吃掉长按，
           * SwipeCard 这边收不到 onLongPress，只靠标志位拦不住松手后补发的 click，
           * 于是「按住记一次」会顺带把编辑页打开。改用时长判定，与谁处理长按无关。
           */
          if (press && clickEvent.detail > 0 && Date.now() - press.downAt > TAP_MAX_MS) return
          activate()
        }}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return
          keyEvent.preventDefault()
          activate()
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
