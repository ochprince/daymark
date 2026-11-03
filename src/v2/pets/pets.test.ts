import assert from 'node:assert/strict'
import test from 'node:test'
import { PET_SPECIES, PET_STAGES, PET_STATES, petSvg } from './art'
import { landingPlatform, placeBubble, throwVelocity, type Platform } from './geometry'

test('四系 × 五阶段 = 20 种造型，每张都带 --c 与状态', () => {
  assert.equal(PET_SPECIES.length, 4)
  assert.equal(PET_STAGES.length, 5)
  const seen = new Set<string>()
  for (const species of PET_SPECIES) {
    for (const stage of PET_STAGES) {
      const svg = petSvg({ species, stage, state: 'stand', size: 64, uid: `${species}${stage}` })
      assert.match(svg, /^<svg class="pet-art/, `${species}-${stage} 应该是一段 svg`)
      assert.ok(svg.includes('fill="var(--c)"'), `${species}-${stage} 用 --c 上色`)
      assert.ok(svg.includes('data-state="stand"'), `${species}-${stage} 带状态`)
      // 造型指纹：物种 + 阶段都要参与，不能只是换标签
      seen.add(`${species}-${stage}:${svg.length}:${svg.slice(0, 220)}`)
    }
  }
  assert.equal(seen.size, 20, '20 种造型应当互不相同')
})

test('八个状态都产出对应 data-state 的 svg', () => {
  assert.deepEqual([...PET_STATES], ['stand', 'walk', 'sit', 'sleep', 'fall', 'climb', 'drag', 'cheer'])
  for (const state of PET_STATES) {
    const svg = petSvg({ species: 'drop', stage: 3, state, size: 80 })
    assert.ok(svg.includes(`data-state="${state}"`))
  }
  // 睡觉有 zzz、掉落有速度线，表情零件随状态变
  assert.ok(petSvg({ species: 'drop', stage: 3, state: 'sleep', size: 80 }).includes('pet-zzz'))
  assert.ok(petSvg({ species: 'drop', stage: 3, state: 'fall', size: 80 }).includes('pet-lines'))
  assert.notEqual(
    petSvg({ species: 'drop', stage: 3, state: 'drag', size: 80 }),
    petSvg({ species: 'drop', stage: 3, state: 'stand', size: 80 }),
  )
})

test('气泡默认在头顶，箭头朝下且不出安全区', () => {
  const r = placeBubble({ x: 200, y: 400, h: 100, hw: 46, bw: 120, bh: 34, W: 400, H: 800 })
  assert.equal(r.dir, 't')
  assert.equal(r.y, 400 - 100 - 11 - 34)
  assert.equal(r.x, 140)
  assert.ok(r.tail > 16 && r.tail < 104)
})

test('靠近顶部时气泡翻到侧边，永不压状态栏（44px）', () => {
  const r = placeBubble({ x: 200, y: 90, h: 92, hw: 46, bw: 130, bh: 36, W: 400, H: 800 })
  assert.notEqual(r.dir, 't')
  assert.ok(r.y >= 44, `y=${r.y} 不该小于 44`)
  assert.ok(r.x >= 12 && r.x + 130 <= 388)
})

test('贴左 / 贴右时夹进边缘留白', () => {
  const left = placeBubble({ x: 8, y: 600, h: 92, hw: 46, bw: 140, bh: 36, W: 400, H: 800 })
  assert.ok(left.x >= 12)
  assert.ok(left.x + 140 <= 388)
  const right = placeBubble({ x: 396, y: 600, h: 92, hw: 46, bw: 140, bh: 36, W: 400, H: 800 })
  assert.ok(right.x >= 12 && right.x + 140 <= 388)
  assert.ok(right.y >= 44 && right.y + 36 <= 800 - 24)
})

test('落地判定取这一帧穿过的最高平台', () => {
  const platforms: Platform[] = [
    { key: 'top', l: 0, r: 300, t: 200 },
    { key: 'low', l: 0, r: 300, t: 500 },
    { key: 'far', l: 320, r: 400, t: 260 },
    { key: 'floor', l: 0, r: 400, t: 786, floor: true },
  ]
  assert.equal(landingPlatform(platforms, 180, 210, 100)?.key, 'top')
  assert.equal(landingPlatform(platforms, 480, 520, 100)?.key, 'low')
  assert.equal(landingPlatform(platforms, 180, 210, 350), null, '水平不在平台上不算落地')
  assert.equal(landingPlatform(platforms, 700, 800, 100)?.key, 'floor')
})

test('抛出手势按采样算速度并夹在 ±1300', () => {
  const slow = throwVelocity([[2000, 100, 300]])
  assert.deepEqual(slow, { vx: 0, vy: 0 })
  const fling = throwVelocity([
    [0, 0, 0],
    [100, 100, 20],
  ])
  assert.equal(fling.vx, 1000)
  assert.equal(fling.vy, 200)
  const hard = throwVelocity([
    [0, 0, 0],
    [16, 4000, -4000],
  ])
  assert.deepEqual(hard, { vx: 1300, vy: -1300 })
})
