import assert from 'node:assert/strict'
import test from 'node:test'
import {
  landingPlatform,
  planDropDown,
  planJump,
  planJumpDown,
  simulateJump,
  type Platform,
} from './geometry.ts'

const G = 2200

const plat = (key: string, l: number, r: number, t: number): Platform => ({ key, l, r, t })

test('目标在上：算出来的这一跳真的落在它上面', () => {
  const target = plat('high', 100, 260, 300)
  const platforms = [plat('floor', 0, 400, 700), target]
  const plan = planJump({ x: 180, y: 700 }, target, { gravity: G })
  assert.ok(plan)
  const hit = simulateJump({ x: 180, y: 700 }, plan!.vx, plan!.vy, platforms, { gravity: G })
  assert.equal(hit?.key, 'high')
})

test('隔了两级台阶也能跳上去，不会被中间那级截住', () => {
  const mid = plat('mid', 90, 300, 560)
  const top = plat('top', 120, 280, 300)
  const platforms = [plat('floor', 0, 400, 700), mid, top]
  const plan = planJump({ x: 150, y: 700 }, top, { gravity: G })
  assert.ok(plan)
  const hit = simulateJump({ x: 150, y: 700 }, plan!.vx, plan!.vy, platforms, { gravity: G })
  assert.equal(hit?.key, 'top')
})

test('目标在下：从高处跳下去，落在下层的目标上而不是地面', () => {
  const low = plat('low', 60, 200, 640)
  const platforms = [plat('floor', 0, 400, 720), low]
  const plan = planJump({ x: 300, y: 380 }, low, { gravity: G })
  assert.ok(plan)
  const hit = simulateJump({ x: 300, y: 380 }, plan!.vx, plan!.vy, platforms, { gravity: G })
  assert.equal(hit?.key, 'low')
})

test('远到跳不过去的目标：算不出方案就返回 null，而不是硬塞一个速度', () => {
  const far = plat('far', 2600, 2800, 300)
  const plan = planJump({ x: 40, y: 700 }, far, { gravity: G, maxVx: 120 })
  assert.equal(plan, null)
})

test('往下跳：先越过自己的台阶再落到下层，不会被自己那级接住', () => {
  const high = plat('high', 80, 300, 300)
  const low = plat('low', 320, 520, 620)
  const platforms = [high, low, plat('floor', 0, 900, 700)]
  let ok = 0
  for (let i = 0; i < 20; i += 1) {
    const plan = planJumpDown({ x: 190, y: 303 }, high, low, { gravity: G })
    assert.ok(plan)
    const hit = simulateJump({ x: 190, y: 303 }, plan!.vx, plan!.vy, platforms, { gravity: G })
    if (hit?.key === 'low') ok += 1
  }
  assert.equal(ok, 20)
})

test('宽平台的往下跳：越边永无解，直接落下要成立', () => {
  // 舞台卡横跨 16–374、顶边在 79；成长条在卡片里 38–352、顶边 492
  const card = plat('card', 16, 374, 79)
  const growth = plat('growth', 38, 352, 492)
  const platforms = [card, growth, plat('tabbar', 54, 336, 756), plat('floor', 0, 390, 830)]

  // 先证明：老老实实按「越过自己的边」算，三个起跳点全无解（这就是它不下来的原因）
  for (const x of [40, 195, 350]) {
    assert.equal(planJumpDown({ x, y: 79 }, card, growth, { gravity: G }), null, `x=${x} 本该无解`)
  }

  // 再证明：走「直接从脚下落下去」这条路，落点就是成长条
  for (const x of [40, 195, 350]) {
    const plan = planDropDown({ x, y: 79 }, card, growth, { gravity: G })
    assert.ok(plan, `x=${x} 应该有解`)
    const hit = simulateJump(
      { x, y: 79 },
      plan!.vx,
      plan!.vy,
      platforms.filter((p) => p.key !== card.key),
      { gravity: G, bounds: { left: 32, right: 358 } },
    )
    assert.equal(hit?.key, 'growth', `x=${x} 的落点`)
  }
})

test('不在脚下的平台不能走「直接落下」那条', () => {
  const card = plat('card', 16, 374, 79)
  const side = plat('side', 420, 520, 492) // 横向完全在卡片右边
  assert.equal(planDropDown({ x: 195, y: 79 }, card, side, { gravity: G }), null)
})

test('站在平台上「原地往下掉」会被自己脚下这块按容差接回去', () => {
  // 舞台卡顶边 t=79，人落在 t + 3 = 82 上
  const card = plat('card', 16, 374, 79)
  const hero = plat('hero', 115, 275, 317)
  // 从 82 开始掉：82 就是它的顶面，落在 (prevY-1, y] 里，会被自己接住
  assert.equal(landingPlatform([card, hero], 82, 82.4, 195)?.key, 'card')
  // 先把脚挪开 6px 再掉，就掉得下去了
  assert.equal(landingPlatform([card, hero], 88, 88.5, 195), null)
  // 继续往下，接住它的是卡片里那块空地
  assert.equal(landingPlatform([card, hero], 300, 320, 195)?.key, 'hero')
})
