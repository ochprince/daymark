import assert from 'node:assert/strict'
import test from 'node:test'
import { planJump, planJumpDown, simulateJump, type Platform } from './geometry.ts'

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
