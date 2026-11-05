import assert from 'node:assert/strict'
import test from 'node:test'
import { CARD_WALK, createBody, hop, step, walkTo } from './cardSim'

test('卡片里的它：跳起来会自己落回地面', () => {
  const body = createBody()
  hop(body, 40)
  assert.equal(body.mode, 'jump')
  assert.ok(body.vy < 0, '初速必须朝上')

  let landed = false
  let maxRise = 0
  for (let i = 0; i < 200 && !landed; i += 1) {
    const r = step(body, 60, 1 / 60)
    landed = r.landed
    maxRise = Math.min(maxRise, body.y)
  }
  assert.ok(landed, '两秒内必须落地')
  assert.equal(body.y, 0)
  assert.equal(body.mode, 'stand')
  // 抛物线顶点应当接近要求的 40px（步长离散，允许 3px 误差）
  assert.ok(Math.abs(-maxRise - 40) < 3.5, `跳的高度不对：${-maxRise}`)
})

test('卡片里的它：走到目标点就停下，不会越走越远', () => {
  const body = createBody()
  walkTo(body, 30)
  for (let i = 0; i < 200 && body.mode === 'walk'; i += 1) step(body, 60, 1 / 60)
  assert.equal(body.mode, 'stand')
  assert.ok(Math.abs(body.x - 30) < 0.01)
})

test('卡片里的它：撞墙就停住，出不了卡', () => {
  const body = createBody()
  walkTo(body, 999)
  for (let i = 0; i < 400; i += 1) step(body, 40, 1 / 60)
  assert.equal(body.x, 40)
  assert.equal(body.mode, 'stand')
})

test('卡片里的它：朝向跟着走的方向', () => {
  const body = createBody()
  walkTo(body, -25)
  assert.equal(body.dir, -1)
  walkTo(body, 25)
  assert.equal(body.dir, 1)
})

test('卡片里的它：一帧的步长有上限，卡顿不会让它瞬移', () => {
  const body = createBody()
  walkTo(body, 500)
  step(body, 200, 5)
  assert.ok(body.x <= CARD_WALK * 0.05 + 1e-6, `一帧最多走 ${CARD_WALK * 0.05}px，实际 ${body.x}`)
})
