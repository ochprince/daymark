import { useCallback, useEffect, useRef, useState } from 'react'
import { animate, useMotionValue } from 'motion/react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/** 翻页吸附的弹簧：比卡片略慢一点，行程更长 */
const SPRING_PAGE = { type: 'spring', visualDuration: 0.42, bounce: 0.12 } as const
/** 拖到边界外的阻尼系数 */
const RUBBER = 0.35
/** 判定甩动的速度阈值（px/s） */
const FLICK = 450
/** 小于这个位移视为点击，不算拖动 */
const DRAG_SLOP = 6

type Sample = { x: number; t: number }

/**
 * 横向翻页：两页并排放在一条轨道上，用手指拖就是直接拖轨道，
 * 松手按「先看速度、再看是否过半」的 iOS 模型吸附到某一页。
 * 手势只挂在传入 handleProps 的元素上（也就是箭头），列表上的滑动不受影响。
 */
export function usePager(count: number) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const gesture = useRef<{ pointerId: number; startX: number; startValue: number; samples: Sample[] } | null>(null)
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

  const goTo = useCallback(
    (next: number) => setIndex(Math.max(0, Math.min(count - 1, next))),
    [count],
  )

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!width) return
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue: x.get(),
      samples: [{ x: event.clientX, t: performance.now() }],
    }
    draggedRef.current = false
    x.stop()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return

    active.samples.push({ x: event.clientX, t: performance.now() })
    if (active.samples.length > 6) active.samples.shift()
    if (Math.abs(event.clientX - active.startX) > DRAG_SLOP) draggedRef.current = true

    let next = active.startValue + (event.clientX - active.startX)
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
    else if (position < base - width / 2) target = index + 1
    else if (position > base + width / 2) target = index - 1
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
