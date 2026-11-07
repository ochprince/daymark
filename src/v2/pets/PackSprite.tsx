import { useEffect, useRef, useState } from 'react'
import type { PackState } from '../../lib/petpack'
import type { LiveFrame, LivePack } from '../../lib/petpackStore'

const POSE_ORDER: Record<string, readonly PackState[]> = {
  stand: ['stand', 'look'],
  walk: ['walk', 'run'],
  sit: ['sit'],
  sleep: ['sleep'],
  fall: ['fall', 'jump'],
  climb: ['climb', 'cling'],
  drag: ['drag'],
  cheer: ['bounce', 'stand'],
  dance: ['dance', 'bounce'],
  hug: ['hug', 'sit'],
  dangle: ['dangle', 'sit'],
  spin: ['spin', 'look'],
}

function framesFor(pose: string, frames: LivePack['frames']): LiveFrame[] {
  const order = POSE_ORDER[pose] || POSE_ORDER.stand
  for (const state of order) {
    const list = frames[state]
    if (list?.length) return list
  }
  return frames.stand || []
}

function motionReduced(): boolean {
  return (
    document.documentElement.classList.contains('reduce-motion') ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  )
}

/** 按动作表播序列帧。物理还是外面那一层，这里只负责当前姿势该亮哪张图。 */
export function PackSprite({ pose, size, frames }: { pose: string; size: number; frames: LivePack['frames'] }) {
  const list = framesFor(pose, frames)
  const listRef = useRef(list)
  listRef.current = list
  const key = `${pose}:${list.length}:${list[0]?.src ?? ''}:${list[0]?.durMs ?? 0}`
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    const framesNow = listRef.current
    if (framesNow.length <= 1 || motionReduced()) return
    let cursor = 0
    let timer = 0
    const step = () => {
      const current = listRef.current
      if (!current.length) return
      cursor = (cursor + 1) % current.length
      setIndex(cursor)
      timer = window.setTimeout(step, Math.max(60, current[cursor]?.durMs || 120))
    }
    timer = window.setTimeout(step, Math.max(60, framesNow[0]?.durMs || 120))
    return () => window.clearTimeout(timer)
  }, [key])

  const frame = list[index] || list[0]
  if (!frame) return null
  return (
    <img
      className="pet-pack"
      src={frame.src}
      alt=""
      draggable={false}
      style={{ width: size, height: size }}
    />
  )
}
