import { PET_GRAVITY } from './physics'

/**
 * 卡片里这只的走速。外面那只 44 px/s（体积 92），
 * 卡片里这只 158，按体积换算差不多这个数，看着才不拖沓。
 */
export const CARD_WALK = 70
/** 落地后再弹起的最小间隔，防止抖成筛子 */
export const CARD_BOUNCE_GAP = 900

export type CardMode = 'stand' | 'walk' | 'jump'

export type CardBody = {
  /** 相对舞台中心横向偏移，px，负为左 */
  x: number
  /** 相对卡片地面（空地的地面线）的纵向偏移：0 = 站在地上，负 = 跳起，正 = 更低的一层 */
  y: number
  vy: number
  dir: -1 | 1
  target: number
  mode: CardMode
  /** 当前站在哪一层的「地面」上：0 = 空地，>0 = 备忘块那层 */
  ground: number
}

export function createBody(): CardBody {
  return { x: 0, y: 0, vy: 0, dir: 1, target: 0, mode: 'stand', ground: 0 }
}

/** 掉到下面那一层（备忘块）：不加初速，让它自己落下去 */
export function fallTo(body: CardBody, ground: number): void {
  body.mode = 'jump'
  body.ground = Math.max(0, ground)
  body.vy = 0
}

/** 从下面那层跳回上面：初速刚好够升到目标那层 */
export function riseTo(body: CardBody, ground: number): void {
  const drop = Math.max(4, body.y - Math.max(0, ground))
  body.mode = 'jump'
  body.ground = Math.max(0, ground)
  body.vy = -Math.sqrt(2 * PET_GRAVITY * drop)
}

/** 原地跳：给定要跳多高（px），反算初速 */
export function hop(body: CardBody, height: number): void {
  const h = Math.max(8, Math.min(120, height))
  body.mode = 'jump'
  body.vy = -Math.sqrt(2 * PET_GRAVITY * h)
}

/** 走到某个横坐标（会被 limit 夹住） */
export function walkTo(body: CardBody, target: number): void {
  body.mode = 'walk'
  body.target = target
  body.dir = target < body.x ? -1 : 1
}

export type CardStep = { landed: boolean }

/**
 * 推进一帧。卡片里的世界很薄：只有一条地面和左右两堵墙，
 * 没有平台、没有拖拽，所以用不着外面那套完整的平台扫描。
 */
export function step(body: CardBody, maxX: number, dt: number): CardStep {
  const d = Math.max(0, Math.min(0.05, dt))
  let landed = false

  if (body.mode === 'jump') {
    body.vy += PET_GRAVITY * d
    body.y += body.vy * d
    if (body.y >= body.ground && body.vy > 0) {
      body.y = body.ground
      body.vy = 0
      body.mode = 'stand'
      landed = true
    }
  } else if (body.mode === 'walk') {
    const delta = body.target - body.x
    const stepLen = CARD_WALK * d
    if (Math.abs(delta) <= stepLen) {
      body.x = body.target
      body.mode = 'stand'
    } else {
      body.x += Math.sign(delta) * stepLen
      body.dir = delta < 0 ? -1 : 1
    }
  }

  // 撞墙就停住，不反弹（卡片里没有物理弹跳的必要）
  const limit = Math.max(0, maxX)
  if (body.x > limit) body.x = limit
  if (body.x < -limit) body.x = -limit
  if (body.mode === 'walk' && Math.abs(body.target) > limit) body.target = Math.sign(body.target) * limit

  return { landed }
}
