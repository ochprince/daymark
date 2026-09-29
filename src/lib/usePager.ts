import { useCallback, useEffect, useRef, useState } from 'react'
import { animate, useMotionValue } from 'motion/react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/** 翻页吸附的弹簧 */
const SPRING_PAGE = { type: 'spring', visualDuration: 0.42, bounce: 0.12 } as const
/** 判定甩动的速度阈值（px/s） */
const FLICK = 400
/** 拖过一页宽的这个比例就翻页 */
const PAGE_RATIO = 0.3
/** 小于这个位移视为点击，不算拖动 */
const DRAG_SLOP = 6

/**
 * 这些区域里的横向拖动不属于翻页：
 * 卡片自己要用左滑删除，弹层/提示条是浮在上面的独立层。
 */
const OCCUPIED = '[data-swipe-card], .swipe__action, .sheet-overlay, .toast, .fab'

/**
 * 轨道上的槽位数。位置 x 保持在 [-2 个页宽, 0]，共 3 个页宽范围，
 * 3 格正好铺满并且左右都有一格接得上。
 */
export const SLOT_COUNT = 3

/** 第 slot 格放哪一页：内容沿轨道周期排列 */
export function pageOfSlot(slot: number, count: number): number {
  return ((slot % count) + count) % count
}

type Sample = { x: number; t: number }

/**
 * 横向翻页轨道，位置记作 x（px）：
 *   x = 0      第 0 页正对屏幕
 *   x = -w     第 1 页
 *   x = -2w    又回到第 0 页 —— 内容本身是周期的
 * 所以越过一整轮时把位置整体平移一个周期，渲染结果一个像素都不变，
 * 于是左右都能一直滑下去（不会滑到边上就停住）。
 *
 * 手势挂在整个页面上（handleProps），但只要按下的位置落在卡片内部，
 * 就让位给卡片的左滑删除，两边不会一起动。
 */
export function usePager(count: number) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const gesture = useRef<{
    pointerId: number
    startX: number
    startY: number
    /** 手势开始时的轨道位置（px） */
    startValue: number
    samples: Sample[]
    captured: boolean
  } | null>(null)
  const draggedRef = useRef(false)
  const [index, setIndex] = useState(0)
  /** 正对屏幕的槽位序号（给其它槽位加 inert） */
  const [activeSlot, setActiveSlot] = useState(0)
  const [width, setWidth] = useState(0)
  const x = useMotionValue(0)

  const period = count * width

  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const measure = () => setWidth(element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  /** 折回 [-一个周期, 0]；平移的都是整周期，视觉不变 */
  const frameX = useCallback(
    (value: number) => {
      if (!width || !period) return value
      let next = value
      while (next > 0) next -= period
      while (next < -period) next += period
      return next
    },
    [period, width],
  )

  /** 第 k 格对应的页索引（k 可以是负数） */
  const pageOfK = useCallback((k: number) => ((k % count) + count) % count, [count])

  /** 吸附到第 k 格；目标取离当前位置最近的等价位置 */
  const snapToK = useCallback(
    (k: number) => {
      if (!width || !period) return () => undefined
      const current = frameX(x.get())
      x.set(current)
      const raw = -k * width
      const shift = Math.ceil((current - raw) / period - 0.5)
      const destination = frameX(raw + shift * period)
      setIndex(pageOfK(k))
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduceMotion) {
        x.set(destination)
        return () => undefined
      }
      const controls = animate(x, destination, SPRING_PAGE)
      return () => controls.stop()
    },
    [frameX, pageOfK, period, width, x],
  )

  /** 当前位置落在第几格（含小数，用于判定方向） */
  const gridOf = useCallback((value: number) => -value / width, [width])

  // 正对屏幕的槽位序号
  useEffect(() => {
    if (!width) return
    const update = (value: number) => {
      const slot = Math.max(0, Math.min(SLOT_COUNT - 1, Math.round(-value / width)))
      setActiveSlot((previous) => (previous === slot ? previous : slot))
    }
    update(x.get())
    return x.on('change', update)
  }, [width, x])

  // 屏幕尺寸变化后重新对齐当前页
  useEffect(() => {
    if (!width) return
    x.set(frameX(-index * width))
    // 只在宽度变化时对齐
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width])

  /** 跳到指定页（点手柄）：走最近的方向，可以绕圈 */
  const goTo = useCallback(
    (target: number) => {
      if (!width) return
      const wanted = ((target % count) + count) % count
      const current = pageOfK(Math.round(gridOf(x.get())))
      if (wanted === current) return
      // 下一页 = 沿轨道继续往前走一格（x 更小）
      const step = wanted === (current + 1) % count ? 1 : -1
      snapToK(Math.round(gridOf(x.get())) + step)
    },
    [count, gridOf, pageOfK, snapToK, width, x],
  )

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!width) return
    // 落点在卡片/删除区/弹层里时，交给它们自己处理
    const target = event.target as HTMLElement | null
    if (target?.closest(OCCUPIED)) return

    // 先不抢占指针：轻点要能正常落到按钮上，等确实开始横向拖动再捕获
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startValue: x.get(),
      samples: [{ x: event.clientX, t: performance.now() }],
      captured: false,
    }
    draggedRef.current = false
    x.stop()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return

    const dx = event.clientX - active.startX
    const dy = event.clientY - active.startY
    if (!active.captured) {
      // 纵向为主的滑动是滚动列表，不抢
      if (Math.abs(dx) <= DRAG_SLOP || Math.abs(dx) <= Math.abs(dy)) return
      active.captured = true
      draggedRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    active.samples.push({ x: event.clientX, t: performance.now() })
    if (active.samples.length > 6) active.samples.shift()

    // 无限循环：越过一轮就把起点与当前位置一起平移一个周期（同一帧内完成）
    let next = active.startValue + dx
    if (period) {
      while (next > 0) {
        next -= period
        active.startValue -= period
      }
      while (next < -period) {
        next += period
        active.startValue += period
      }
    }
    x.set(next)
  }

  const finishGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    gesture.current = null

    const first = active.samples[0]
    const last = active.samples[active.samples.length - 1]
    const elapsed = last.t - first.t
    const velocity = elapsed > 0 ? ((last.x - first.x) / elapsed) * 1000 : 0

    const base = Math.round(gridOf(active.startValue))
    // 用手指的总位移判断方向：轨道中途平移过周期，用轨道位移会算反
    const travelled = (last.x - active.startX) / width
    let target = base
    // 向左滑 = 沿轨道往前走（数字更大的格），向右滑 = 往回
    if (velocity < -FLICK || travelled < -PAGE_RATIO) target = base + 1
    else if (velocity > FLICK || travelled > PAGE_RATIO) target = base - 1

    snapToK(target)
    window.setTimeout(() => {
      draggedRef.current = false
    }, 420)
  }

  return {
    stageRef,
    x,
    width,
    index,
    activeSlot,
    goTo,
    draggedRef,
    snapToK,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishGesture,
      onPointerCancel: finishGesture,
    },
  }
}
