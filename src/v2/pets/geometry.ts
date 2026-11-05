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

/**
 * 有目标的跳：给定起点和要落的平台，倒算初速度。
 *
 * 做法是先定一个比起点和目标都高的「顶点」，再由顶点算下落到目标顶面要多久，
 * 总时长 T = 上升 + 下降，水平速度就是位移 / T。
 * 这样无论目标在上还是在下、隔了几级台阶，只要顶点够高、水平速度不离谱，
 * 抛物线的顶点就能盖过中间那些平台，不会被半路截住。
 */
export type JumpPlan = { vx: number; vy: number; tx: number }

export function planJump(
  from: { x: number; y: number },
  target: Platform,
  opts: { gravity: number; maxVx?: number; clearance?: number; minClearance?: number },
): JumpPlan | null {
  const g = opts.gravity
  const maxVx = opts.maxVx ?? 420
  const clearance = opts.clearance ?? 56
  const minClearance = opts.minClearance ?? 22
  const top = target.t + 3
  const lo = target.l + 10
  const hi = target.r - 10
  if (hi <= lo) return null

  // 落点在目标平台中间偏一点，别每次都跳正中心
  const tx = clamp(lo + (hi - lo) * (0.35 + Math.random() * 0.3), lo, hi)
  const apex = Math.min(from.y, top) - (clearance + Math.random() * minClearance)
  const rise = from.y - apex
  if (rise <= 0) return null
  const vy = -Math.sqrt(2 * g * rise)
  const tUp = -vy / g
  const drop = top - apex
  if (drop <= 0) return null
  const tDown = Math.sqrt((2 * drop) / g)
  const T = tUp + tDown
  if (!Number.isFinite(T) || T <= 0) return null
  const vx = (tx - from.x) / T
  if (Math.abs(vx) > maxVx) return null
  return { vx, vy, tx }
}

/**
 * 按抛物线路子往前推，看第一个落在哪个平台。
 * 用来验证「这一跳真的能到目标」，而不是被中间那级台阶半路接住。
 */
export function simulateJump(
  from: { x: number; y: number },
  vx: number,
  vy: number,
  platforms: readonly Platform[],
  opts: { gravity: number; bounds?: { left: number; right: number }; dt?: number; limit?: number },
): Platform | null {
  const g = opts.gravity
  const dt = opts.dt ?? 1 / 120
  const limit = opts.limit ?? 4
  const left = opts.bounds?.left ?? -Infinity
  const right = opts.bounds?.right ?? Infinity
  let x = from.x
  let y = from.y
  let cvx = vx
  let cvy = vy
  for (let t = 0; t < limit; t += dt) {
    const prevY = y
    cvy += g * dt
    x += cvx * dt
    y += cvy * dt
    // 撞墙就反弹，跟物理层的处理一致，免得算出来的落点跟实际不符
    if (x < left) {
      x = left
      cvx = -cvx * 0.5
    } else if (x > right) {
      x = right
      cvx = -cvx * 0.5
    }
    if (cvy <= 0) continue
    const hit = landingPlatform(platforms, prevY, y, x)
    if (hit) return hit
  }
  return null
}

/**
 * 目标整个落在自己脚下（卡片顶 → 卡片里的成长条 / 备忘块）。
 *
 * `planJumpDown` 要求「先越过自己这一级的边」才不会被脚下的台阶接住，
 * 可源平台一旦很宽（.stage-card 横跨 16–374），越边要的横速比落点允许的还大，
 * 于是永远无解——表现就是它趴在卡片顶上，十几分钟一次也不往下走。
 * 这种情况不需要越边：它是从台阶前沿直接落下去的，按小跳 + 自由落体算就行。
 */
export function planDropDown(
  from: { x: number; y: number },
  source: Platform,
  target: Platform,
  opts: { gravity: number; maxVx?: number },
): JumpPlan | null {
  const g = opts.gravity
  const maxVx = opts.maxVx ?? 420
  const top = target.t + 3
  if (top <= from.y + 8) return null
  // 只有「目标横坐标基本在自己脚下」才走这条：不然应该用 planJumpDown 越边
  if (target.l > source.r - 8 || target.r < source.l + 8) return null

  const lo = target.l + 10
  const hi = target.r - 10
  if (hi <= lo) return null

  // 先轻轻抬一下再落下去，看着像跳下去而不是直接掉
  const c = 24
  const tUp = Math.sqrt((2 * c) / g)
  const drop = top - (from.y - c)
  if (drop <= 0) return null
  const tDown = Math.sqrt((2 * drop) / g)
  const T = tUp + tDown
  if (!Number.isFinite(T) || T <= 0) return null

  const aim = Math.min(hi, Math.max(lo, from.x))
  const vx = Math.min(maxVx, Math.max(-maxVx, (aim - from.x) / T))
  return { vx, vy: -Math.sqrt(2 * g * c), tx: from.x + vx * T }
}

/**
 * 往下跳：麻烦在于起点就站在源平台上，落下来的瞬间如果人还在源平台上方，
 * 会被「自己的台阶」先接住——所以水平速度必须先够越出源平台的边，
 * 再保证按这个速度飞到目标高度时，横坐标刚好落在目标平台里。
 *
 * 越出边所需的速度和「落在哪」是一对互相牵制的条件，这里用顶点高度 c 做一维搜索：
 * c 越大，滞空越久，同样的横移会带得更远。
 */
export function planJumpDown(
  from: { x: number; y: number },
  source: Platform,
  target: Platform,
  opts: { gravity: number; maxVx?: number },
): JumpPlan | null {
  const g = opts.gravity
  const maxVx = opts.maxVx ?? 420
  const top = target.t + 3
  if (top <= from.y + 8) return null
  const lo = target.l + 10
  const hi = target.r - 10
  if (hi <= lo) return null

  // 两个方向都试：往哪边越出自己的台阶更顺手就走哪边
  for (const dir of [1, -1] as const) {
    const edge = dir > 0 ? source.r : source.l
    const need = (edge - from.x) * dir
    for (let c = 20; c <= 220; c += 5) {
      const apexY = from.y - c
      const drop = top - apexY
      if (drop <= 0) continue
      const tUp = Math.sqrt((2 * c) / g)
      const tDown = Math.sqrt((2 * drop) / g)
      const T = tUp + tDown
      if (!Number.isFinite(T) || T <= 0) continue
      // 落回源平台顶面之前必须已经越过它的边
      const vxMin = ((need + 14) / (2 * tUp)) * 1.12
      // 按这个速度飞 T 秒后，横坐标要落在目标平台里
      const a = (lo - from.x) / T
      const b = (hi - from.x) / T
      const loVx = Math.max(vxMin, dir > 0 ? a : -b)
      const hiVx = Math.min(maxVx, dir > 0 ? b : -a)
      if (hiVx <= loVx) continue
      const vx = (loVx + hiVx) / 2
      return { vx, vy: -Math.sqrt(2 * g * c), tx: from.x + vx * T }
    }
  }
  return null
}
