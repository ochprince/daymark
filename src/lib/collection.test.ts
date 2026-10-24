import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BADGES,
  BADGE_BY_ID,
  collectionStore,
  dexKey,
  emptyCollection,
  evaluateBadges,
  hasBadge,
  needsStageTransition,
  normalizeCollection,
  noteStage,
  unlockBadges,
  unlockDex,
} from './collection'

test('收藏默认值：空表，没有野字段', () => {
  const empty = normalizeCollection(undefined)
  assert.deepEqual(empty.dex, [])
  assert.deepEqual(empty.badges, {})
  assert.deepEqual(empty.peakStage, {})
  assert.deepEqual(empty.seenStage, {})
})

test('normalize 丢掉坏数据但不丢整份', () => {
  const state = normalizeCollection({
    badges: { first: 123, notARealBadge: 456, d7: 'x' },
    dex: ['sprout:0', 'sprout:0', 42],
    peakStage: { 'habit:1': 3, 'habit:2': 9, 'habit:3': 'x' },
    notes: [{ id: 'n1', text: 'hi', at: 1 }],
    notesThisWeek: { week: 3, count: 2 },
    peak: { bogus: 1 },
  })
  assert.deepEqual(state.badges, { first: 123 })
  assert.deepEqual(state.dex, ['sprout:0'])
  assert.deepEqual(state.peakStage, { 'habit:1': 3 })
  assert.equal(state.notes.length, 1)
  assert.deepEqual(state.notesThisWeek, { week: 3, count: 2 })
  // 野字段不会被带出来
  assert.equal((state as unknown as Record<string, unknown>).peak, undefined)
})

test('noteStage 写的是 peakStage / seenStage，不是 peak / seen', () => {
  collectionStore.reset()
  noteStage('habit:1', 2, 'peak')
  noteStage('habit:1', 1, 'seen')
  const state = collectionStore.get()
  assert.equal(state.peakStage['habit:1'], 2)
  assert.equal(state.seenStage['habit:1'], 1)
  assert.equal((state as unknown as Record<string, unknown>).peak, undefined)
  assert.equal((state as unknown as Record<string, unknown>).seen, undefined)

  // 只升不降
  noteStage('habit:1', 1, 'peak')
  assert.equal(collectionStore.get().peakStage['habit:1'], 2)
})

test('图鉴与徽章解锁幂等', () => {
  collectionStore.reset()
  assert.deepEqual(unlockDex([dexKey('moon', 2), dexKey('moon', 2)]), ['moon:2'])
  assert.deepEqual(unlockDex([dexKey('moon', 2)]), [])
  assert.deepEqual(collectionStore.get().dex, ['moon:2'])

  const first = unlockBadges(['first', 'd7'], 1000)
  assert.deepEqual(first, ['first', 'd7'])
  assert.deepEqual(unlockBadges(['first'], 2000), [])
  assert.equal(collectionStore.get().badges.first, 1000)
})

test('过场补播：看过的形态低于当前形态才播', () => {
  const state = { ...emptyCollection(), seenStage: { 'habit:1': 1 as const } }
  assert.equal(needsStageTransition(state, 'habit:1', 2), true)
  assert.equal(needsStageTransition(state, 'habit:1', 1), false)
  assert.equal(needsStageTransition(state, 'habit:9', 1), true)
})

test('徽章条件：门槛、章节、夜猫子 / 早起鸟、节日隐藏款', () => {
  const empty = emptyCollection()
  const base = { itemCount: 1, maxGrowth: 0, hasChapter: false }

  assert.deepEqual(evaluateBadges(base, empty), ['first'])
  assert.deepEqual(evaluateBadges({ ...base, maxGrowth: 7 }, empty), ['first', 'd7'])
  assert.deepEqual(evaluateBadges({ ...base, maxGrowth: 365 }, empty), ['first', 'd7', 'd30', 'd100', 'd365'])
  assert.deepEqual(evaluateBadges({ ...base, hasChapter: true }, empty), ['first', 'chapter'])
  assert.deepEqual(evaluateBadges({ ...base, wokeUp: true }, empty), ['first', 'back'])

  const night = new Date(2026, 9, 25, 2, 30).getTime()
  const early = new Date(2026, 9, 25, 5, 30).getTime()
  const noon = new Date(2026, 9, 25, 12, 0).getTime()
  assert.deepEqual(evaluateBadges({ ...base, recordedAt: night }, empty), ['first', 'night'])
  assert.deepEqual(evaluateBadges({ ...base, recordedAt: early }, empty), ['first', 'early'])
  assert.deepEqual(evaluateBadges({ ...base, recordedAt: noon }, empty), ['first'])

  assert.deepEqual(evaluateBadges({ ...base, festivalId: 'halloween' }, empty), ['first', 'pumpkin'])
})

test('已解锁的不再重复给', () => {
  const state = { ...emptyCollection(), badges: { first: 1 } }
  assert.deepEqual(evaluateBadges({ itemCount: 1, maxGrowth: 0, hasChapter: false }, state), [])
})

test('徽章目录本身没重复 id，且都有文案键', () => {
  const ids = BADGES.map((badge) => badge.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(hasBadge(emptyCollection(), 'first'), false)
  assert.ok(BADGE_BY_ID.first)
})
