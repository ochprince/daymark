import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_ENTITLEMENT,
  FREE_CHAPTER_LIMIT,
  FREE_ITEM_LIMIT,
  canAddItem,
  canOpenChapter,
  canShareCard,
  canUseSkin,
  entitlementStore,
  getEntitlement,
  grantPro,
  isPro,
  normalizeEntitlement,
  remainingSlots,
  revokePro,
} from './entitlement'

function reset() {
  entitlementStore.reset()
}

test('默认是免费版', () => {
  reset()
  assert.equal(isPro(), false)
  assert.deepEqual(getEntitlement(), DEFAULT_ENTITLEMENT)
})

test('免费版：只能加 2 件事，第 3 件要买', () => {
  reset()
  assert.equal(canAddItem(0), true)
  assert.equal(canAddItem(FREE_ITEM_LIMIT - 1), true)
  assert.equal(canAddItem(FREE_ITEM_LIMIT), false)
  assert.equal(canAddItem(9), false)
  assert.equal(remainingSlots(1), 1)
  assert.equal(remainingSlots(5), 0)
})

test('买断之后不再限制', () => {
  reset()
  grantPro(1000)
  assert.equal(isPro(), true)
  assert.equal(canAddItem(99), true)
  assert.equal(remainingSlots(99), Number.POSITIVE_INFINITY)
  assert.equal(canUseSkin('pixel'), true)
  assert.equal(canOpenChapter(50), true)
  assert.equal(canShareCard(), true)
  assert.equal(getEntitlement().purchasedAt, 1000)
})

test('grantPro 幂等，不覆盖首次购买时间', () => {
  reset()
  grantPro(1000)
  grantPro(2000)
  assert.equal(getEntitlement().purchasedAt, 1000)
})

test('撤销后回到免费口径，但不改数据层', () => {
  reset()
  grantPro(1000)
  revokePro()
  assert.equal(isPro(), false)
  assert.equal(getEntitlement().purchasedAt, null)
  assert.equal(canAddItem(3), false)
})

test('皮肤与分享卡的分界', () => {
  reset()
  assert.equal(canUseSkin('jelly'), true)
  assert.equal(canUseSkin('night'), false)
  assert.equal(canShareCard(), false)
  assert.equal(canOpenChapter(0), true)
  assert.equal(canOpenChapter(FREE_CHAPTER_LIMIT - 1), true)
  assert.equal(canOpenChapter(FREE_CHAPTER_LIMIT), false)
})

test('坏数据归一化成免费版，不会误开 pro', () => {
  assert.deepEqual(normalizeEntitlement(undefined), DEFAULT_ENTITLEMENT)
  assert.equal(normalizeEntitlement({ pro: 'yes' }).pro, false)
  assert.equal(normalizeEntitlement({ pro: true }).pro, true)
  const bad = normalizeEntitlement({ pro: true, purchasedAt: 'yesterday', checkedAt: Number.NaN })
  assert.equal(bad.pro, true)
  assert.equal(bad.purchasedAt, null)
  assert.equal(bad.checkedAt, null)
})
