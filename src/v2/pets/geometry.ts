/**
 * 宠物层的纯计算：平台落地判定、气泡避让、抛出手势速度。
 * 不碰 DOM，方便单测；PetLayer 只负责把结果画出来。
 */

export type BubbleDir = 't' | 'r' | 'l' | 'b'

export type Platform = {
  key: string
  /** 左 / 右 / 顶，单位是层内坐标（px） */
  l: number
  r: number
  t: number
  floor?: boolean
  /** 真实的 DOM：落地时给它抖一下（bump） */
  el?: HTMLElement
  /** 命中的选择器，用来判断哪类平台不该抖 */
  sel?: string
}

export type BubbleInput = {
  /** 宠物脚底位置 */
  x: number
  y: number
  /** 宠物整体高度与半宽 */
  h: number
  hw: number
  /** 气泡尺寸 */
  bw: number
  bh: number
  /** 层尺寸 */
  W: number
  H: number
  /** 顶部安全区（状态栏 44px）、底部留白、左右留白、气泡与宠物间隙 */
  safeTop?: number
  safeBottom?: number
  edge?: number
  gap?: number
  /** 上一次的方向：空间够就保持，避免来回跳 */
  prefer?: BubbleDir | null
}

export type BubblePlacement = { dir: BubbleDir; x: number; y: number; tail: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/**
 * 气泡摆位：默认在宠物上方、箭头朝下；
 * 靠近顶部/左/右边缘时翻到下方/右侧/左侧，并且永远夹在安全区里。
 */
export function placeBubble(o: BubbleInput): BubblePlacement {
  const { x, y, h, hw, bw, bh, W, H } = o
  const safeTop = o.safeTop ?? 44
  const safeBottom = o.safeBottom ?? 24
  const edge = o.edge ?? 12
  const gap = o.gap ?? 11

  const head = y - h
  const side = hw * 0.8 + gap
  const cy = y - h * 0.55
  const maxX = Math.max(edge, W - edge - bw)
  const maxY = Math.max(safeTop, H - safeBottom - bh)

  const fits: Record<BubbleDir, boolean> = {
    t: head - gap - bh >= safeTop,
    r: x + side + bw <= W - edge,
    l: x - side - bw >= edge,
    b: y + gap + bh <= H - safeBottom,
  }

  let dir = o.prefer ?? null
  if (!dir || !fits[dir]) {
    const near = W - x >= x ? (['r', 'l'] as const) : (['l', 'r'] as const)
    const order: BubbleDir[] = ['t', near[0], near[1], 'b']
    dir = order.find((d) => fits[d]) ?? 't'
  }

  let bx: number
  let by: number
  let tail: number

  if (dir === 't' || dir === 'b') {
    bx = clamp(x - bw / 2, edge, maxX)
    by = dir === 't' ? Math.max(safeTop, head - gap - bh) : Math.min(maxY, y + gap)
    tail = clamp(x - bx, 16, Math.max(16, bw - 16))
  } else {
    bx = dir === 'r' ? x + side : x - side - bw
    bx = clamp(bx, edge, maxX)
    by = clamp(cy - bh / 2, safeTop, maxY)
    tail = clamp(cy - by, 12, Math.max(12, bh - 12))
  }

  return { dir, x: bx, y: by, tail }
}

/**
 * 掉落时找落脚平台：这一帧脚底从 prevY 穿到 y（向下）时，
 * 顶面落在区间内、且水平在平台范围内，取最上面那个。
 */
export function landingPlatform(
  platforms: readonly Platform[],
  prevY: number,
  y: number,
  x: number,
): Platform | null {
  let best: Platform | null = null
  for (const p of platforms) {
    const top = p.t + 3
    if (top < prevY - 1 || top > y) continue
    if (x < p.l + 6 || x > p.r - 6) continue
    if (!best || top < best.t) best = p
  }
  return best
}

export type PointerSample = readonly [t: number, x: number, y: number]

/** 松手时的速度：取最近几帧的位移，夹在 ±max，别把宠物扔出宇宙 */
export function throwVelocity(samples: readonly PointerSample[], max = 1300): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 }
  const a = samples[0]
  const b = samples[samples.length - 1]
  const dt = Math.max(16, b[0] - a[0]) / 1000
  return {
    vx: clamp((b[1] - a[1]) / dt, -max, max),
    vy: clamp((b[2] - a[2]) / dt, -max, max),
  }
}
