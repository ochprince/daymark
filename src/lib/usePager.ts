import { useCallback, useEffect, useRef, useState } from 'react'
import { animate, useMotionValue } from 'motion/react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/** 翻页吸附的弹簧：比卡片略慢一点，行程更长 */
const SPRING_PAGE = { type: 'spring', visualDuration: 0.42, bounce: 0.12 } as const
/** 拖到边界外的阻尼系数 */
const RUBBER = 0.35
/** 判定甩动的速度阈值（px/s） */
const FLICK = 400
/** 位移超过这个比例就翻页（iOS 是过半，但手机上滑一半太长，用 30% 更跟手） */
const PAGE_RATIO = 0.3
/** 小于这个位移视为点击，不算拖动 */
const DRAG_SLOP = 6

type Sample = { x: number; t: number }

/**
 * 横向翻页轨道：两页并排，整条轨道跟手移动，松手按 iOS 模型吸附
 * （先看甩动速度，速度不够再看是否过半）。
 *
 * 手势挂在 handleProps 指向的元素上——也就是整个上部区域（含翻页手柄），
 * 列表区域不参与，所以卡片上的左滑仍然只用于删除。
 */
export function usePager(count: number) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const gesture = useRef<{
    pointerId: number
    startX: number
    startValue: number
    samples: Sample[]
    captured: boolean
  } | null>(null)
  const draggedRef = useRef(false)
  const [index, setIndex] = useState(0)
  const [width, setWidth] = useState(0)
  const x = useMotionValue(0)

  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const measure = () => setWidth(element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const snapTo = useCallback(
    (target: number) => {
      const destination = -target * width
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!width || reduceMotion) {
        x.set(destination)
        return () => undefined
      }
      const controls = animate(x, destination, SPRING_PAGE)
      return () => controls.stop()
    },
    [width, x],
  )

  // 页索引或宽度变化（含旋转屏幕）时收敛到正确位置
  useEffect(() => snapTo(index), [index, snapTo])

  const goTo = useCallback((next: number) => setIndex(Math.max(0, Math.min(count - 1, next))), [count])

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!width) return
    // 先不抢占指针：轻点要能正常落到按钮上（比如翻页手柄），
    // 等确实开始拖动（超过阈值）再捕获，避免点击被吞掉
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
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
    if (!active.captured) {
      if (Math.abs(dx) <= DRAG_SLOP) return
      active.captured = true
      draggedRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    active.samples.push({ x: event.clientX, t: performance.now() })
    if (active.samples.length > 6) active.samples.shift()

    let next = active.startValue + dx
    const min = -(count - 1) * width
    if (next > 0) next *= RUBBER
    else if (next < min) next = min + (next - min) * RUBBER
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

    const base = -index * width
    const position = x.get()
    let target = index
    if (velocity < -FLICK) target = index + 1
    else if (velocity > FLICK) target = index - 1
    else if (position < base - width * PAGE_RATIO) target = index + 1
    else if (position > base + width * PAGE_RATIO) target = index - 1
    target = Math.max(0, Math.min(count - 1, target))

    setIndex(target)
    // 索引没变时也要收敛回来（同页返回原位 / 越界回弹）
    snapTo(target)
    window.setTimeout(() => {
      draggedRef.current = false
    }, 420)
  }

  return {
    stageRef,
    x,
    width,
    index,
    goTo,
    draggedRef,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishGesture,
      onPointerCancel: finishGesture,
    },
  }
}
