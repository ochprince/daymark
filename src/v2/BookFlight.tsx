import { useEffect, useRef } from 'react'

export type BookFlightProps = {
  /** 起点：舞台卡的位置 */
  from: DOMRect
  /** 终点：藏馆 tab 的位置 */
  to: DOMRect
  color: number
  onDone: () => void
}

/**
 * 合上书 → 飞进藏馆。
 *
 * 只在「结束这一章」时播一次（低频节点，可以做得重一点）。
 * 用 Web Animations API 而不是 CSS：起点终点都是运行时量出来的，
 * 写死在 CSS 里换分辨率就歪。reduced-motion 直接结束，不做减速版。
 */
export function BookFlight({ from, to, color, onDone }: BookFlightProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduce || typeof node.animate !== 'function') {
      onDone()
      return undefined
    }

    const startX = from.left + from.width / 2 - 26
    const startY = from.top + from.height / 2 - 32
    const endX = to.left + to.width / 2 - 26
    const endY = to.top + to.height / 2 - 32
    // 弧线：中点抬高一点，避免直线穿过卡片
    const midX = (startX + endX) / 2
    const midY = Math.min(startY, endY) - 80

    const animation = node.animate(
      [
        { transform: `translate(${startX}px, ${startY}px) scale(1) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${midX}px, ${midY}px) scale(0.62) rotate(-12deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${endX}px, ${endY}px) scale(0.16) rotate(-24deg)`, opacity: 0 },
      ],
      { duration: 420, easing: 'cubic-bezier(.34,.01,.3,1)', fill: 'forwards' },
    )
    animation.onfinish = onDone
    return () => animation.cancel()
  }, [from, to, onDone])

  return (
    <div className="book-flight" aria-hidden="true">
      <div ref={ref} className="bf-book" style={{ '--c': `var(--h-${color})` } as React.CSSProperties}>
        <span className="bf-spine" />
      </div>
      <style>{`
        .book-flight { position: fixed; inset: 0; pointer-events: none; z-index: 70; }
        .bf-book {
          position: absolute; left: 0; top: 0; width: 52px; height: 64px;
          border-radius: 8px; border: 2px solid var(--ink);
          background: var(--c); box-shadow: 0 10px 24px -12px rgba(0,0,0,.45);
          will-change: transform, opacity;
        }
        .bf-book::after {
          content: ''; position: absolute; inset: 7px 7px 9px 15px;
          border: 1.5px solid rgba(0,0,0,.25); border-radius: 4px; background: rgba(255,255,255,.35);
        }
        .bf-spine { position: absolute; left: 7px; top: 6px; bottom: 6px; width: 3px; border-radius: 2px; background: var(--ink); opacity: .55; }
      `}</style>
    </div>
  )
}
