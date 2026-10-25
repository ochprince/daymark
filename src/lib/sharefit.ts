/**
 * 分享卡片的几何辅助（纯函数，不碰 DOM / canvas，可以直接单测）。
 *
 * 目前两处用到：
 * - 相片模板：把一张任意比例的相片「cover」铺满 1080×1920 —— object-fit: cover
 *   在 Canvas 里的等价写法是算出源图上那块矩形，再整块 drawImage 到整张画布。
 *   Canvas 没有 object-fit，裁剪矩形必须自己算，算错了就是拉伸变形或留白边。
 * - 票根模板：上下两道虚线分隔 + 两侧半圆缺口。虚线不要用 ctx.setLineDash
 *   （不同浏览器/导出时 dash 相位不一致，缺口处还会画到票外），所以这里直接
 *   把虚线拆成一段段线段，把缺口拆成采样点，画的时候只负责 moveTo / lineTo。
 *
 * 所有函数都容忍脏输入（0、负数、NaN、Infinity）：返回 null 或空数组，
 * 让调用方安静地退回「没有相片 / 没有虚线」，绝不抛异常。
 */

export type Size = { width: number; height: number }
export type Point = { x: number; y: number }
export type Segment = { x1: number; y1: number; x2: number; y2: number }

/** 源图上要裁的那块（单位：源图像素） */
export type CropRect = { sx: number; sy: number; sw: number; sh: number }

/** 缺口的半圆采样点（首尾两点落在票框边上） */
export type Notch = {
  center: Point
  radius: number
  side: 'left' | 'right'
  points: Point[]
}

export type TicketHole = {
  /** 这条分隔线的 y */
  y: number
  /** 缺口之间那一段虚线，已经拆成线段 */
  segments: Segment[]
  /** 左、右两个半圆缺口 */
  notches: [Notch, Notch]
}

export type TicketHoleOptions = {
  /** 票框离画布边多远（缺口圆心就落在这条框线上） */
  inset?: number
  /** 缺口半径 */
  notchRadius?: number
  dash?: number
  gap?: number
  /** 半圆采样段数，越多越圆 */
  steps?: number
}

const EPSILON = 1e-6

function usableSize(size: Size | null | undefined): size is Size {
  if (!size) return false
  const { width, height } = size
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
}

/**
 * object-fit: cover 的源矩形：等比放大到刚好盖住画框，两边居中裁掉多余部分。
 * 画框或图片尺寸不合法时返回 null（调用方按「没有图」处理）。
 */
export function coverCrop(image: Size, frame: Size): CropRect | null {
  if (!usableSize(image) || !usableSize(frame)) return null
  const scale = Math.max(frame.width / image.width, frame.height / image.height)
  if (!Number.isFinite(scale) || scale <= 0) return null
  // 用除法而不是乘 (1/scale)：比例极端时误差更小
  const sw = frame.width / scale
  const sh = frame.height / scale
  if (!Number.isFinite(sw) || !Number.isFinite(sh) || sw <= 0 || sh <= 0) return null
  // 居中裁剪，并把浮点误差夹回图内，避免 drawImage 读到边界外
  const sx = Math.min(Math.max(0, (image.width - sw) / 2), Math.max(0, image.width - sw))
  const sy = Math.min(Math.max(0, (image.height - sh) / 2), Math.max(0, image.height - sh))
  return { sx, sy, sw, sh }
}

/**
 * 把一条直线拆成虚线线段。dash / gap 用同一单位（px）。
 * dash <= 0 或线长为 0 返回空数组；最后一段超出线长时截断，不会画出线外。
 */
export function dashLine(from: Point, to: Point, dash: number, gap: number): Segment[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (!Number.isFinite(length) || length <= 0) return []
  const dashLength = Number.isFinite(dash) ? Math.max(0, dash) : 0
  if (dashLength <= 0) return []
  const gapLength = Number.isFinite(gap) ? Math.max(0, gap) : 0
  const ux = dx / length
  const uy = dy / length
  const segments: Segment[] = []
  for (let cursor = 0; cursor < length - EPSILON; cursor += dashLength + gapLength) {
    const end = Math.min(cursor + dashLength, length)
    segments.push({
      x1: from.x + ux * cursor,
      y1: from.y + uy * cursor,
      x2: from.x + ux * end,
      y2: from.y + uy * end,
    })
  }
  return segments
}

/**
 * 缺口半圆：圆心落在票框线上。
 * side='left' 时向票内（右）鼓，'right' 时向票内（左）鼓，首尾两点是弦的两端。
 */
export function notchArc(center: Point, radius: number, side: 'left' | 'right', steps = 24): Notch {
  const r = Number.isFinite(radius) ? Math.max(0, radius) : 0
  const count = Math.max(2, Math.trunc(Number.isFinite(steps) ? steps : 24))
  const start = side === 'left' ? -Math.PI / 2 : Math.PI / 2
  const sweep = Math.PI
  const points: Point[] = []
  for (let index = 0; index <= count; index += 1) {
    const angle = start + (sweep * index) / count
    points.push({ x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) })
  }
  return { center, radius: r, side, points }
}

/**
 * 票根的一条「打孔线」：缺口之间铺一段虚线，两端各挖一个半圆。
 * inset 是票框到画布边的距离，缺口圆心就在票框上（左边 x=inset，右边 x=width-inset）。
 */
export function ticketHoles(
  size: Size,
  ys: readonly number[],
  options: TicketHoleOptions = {},
): TicketHole[] {
  if (!usableSize(size)) return []
  const inset = Number.isFinite(options.inset) ? Math.max(0, options.inset as number) : 0
  const radius = Number.isFinite(options.notchRadius) ? Math.max(0, options.notchRadius as number) : 0
  const dash = options.dash ?? 22
  const gap = options.gap ?? 18
  const steps = options.steps ?? 24

  const leftX = inset
  const rightX = size.width - inset
  const from = leftX + radius
  const to = rightX - radius

  const holes: TicketHole[] = []
  for (const raw of ys) {
    if (!Number.isFinite(raw)) continue
    const y = Math.min(Math.max(0, raw), size.height)
    holes.push({
      y,
      segments: to > from ? dashLine({ x: from, y }, { x: to, y }, dash, gap) : [],
      notches: [
        notchArc({ x: leftX, y }, radius, 'left', steps),
        notchArc({ x: rightX, y }, radius, 'right', steps),
      ],
    })
  }
  return holes
}

/* ---------------------------------------------------------------- 序列号 */

/** FNV-1a 32 位，纯整数运算，任何环境结果一致 */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/**
 * 票根编号：由「事项 + 日期」推出来，稳定不随机。
 * 同一天同一件事永远同一号，换一天才会变，重画/重开分享面板都不会跳号。
 */
export function ticketSerial(seed: string, stamp: string): string {
  const hash = fnv1a(`${seed}\u0000${stamp}`)
  const code = (hash >>> 0).toString(36).toUpperCase()
  return code.padStart(6, '0').slice(-6)
}
