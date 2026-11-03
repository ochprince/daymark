/**
 * 环形进度。小组件里「轻点记一次」的按钮、灵动岛的倒计时环都用它。
 * 只看百分比，不关心背后的业务，方便原生侧照着画（SwiftUI Circle().trim）。
 */
import type { CSSProperties, ReactNode } from 'react'

export type RingProps = {
  /** 0–100 */
  percent: number
  size: number
  stroke?: number
  className?: string
  /** 环中心的内容（数字 / 小伙伴） */
  children?: ReactNode
  /** 环外再叠一层样式（配色跟着父级的 --c / --c2 走） */
  style?: CSSProperties
}

export function Ring({ percent, size, stroke = 8, className, children, style }: RingProps) {
  const safe = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0
  const radius = Math.max(1, (size - stroke) / 2)
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - safe / 100)

  return (
    <span className={className ? `sys-ring ${className}` : 'sys-ring'} style={{ width: size, height: size, ...style }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="sys-ring-trk" cx={center} cy={center} r={radius} strokeWidth={stroke} />
        <circle
          className="sys-ring-arc"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {children ? <span className="sys-ring-in">{children}</span> : null}
    </span>
  )
}
