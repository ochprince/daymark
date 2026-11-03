import assert from 'node:assert/strict'
import test from 'node:test'
import { createJsonStore } from './jsonStore'
import {
  DEFAULT_ENTITLEMENT,
  ENTITLEMENT_STORAGE_KEY,
  FREE_CHAPTER_LIMIT,
  FREE_ITEM_LIMIT,
  canAddItem,
  canOpenChapter,
  canShareCard,
  canUse,
  canUseSkin,
  effectiveStatus,
  entitlementStore,
  getEntitlement,
  grantLife,
  grantPro,
  grantTrial,
  grantYear,
  isPro,
  normalizeEntitlement,
  proDaysLeft,
  remainingSlots,
  revokePro,
} from './entitlement'

/** 固定时间轴，全部用例不碰「现在」，避免跨时区/跨天抖动 */
const T0 = Date.parse('2026-01-01T00:00:00.000Z')
const DAY = 86_400_000

function reset() {
  entitlementStore.reset()
}

/** 用一个假 window 走真实的 createJsonStore 读取路径（迁移就发生在这一步） */
function makeStoreWith(raw: unknown) {
  const memory = new Map<string, string>()
  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
    },
    addEventListener: () => undefined,
  }
  const target = globalThis as unknown as { window?: unknown }
  const previous = target.window
  target.window = fakeWindow
  try {
    memory.set('test.entitlement', JSON.stringify(raw))
    const store = createJsonStore({ key: 'test.entitlement', normalize: normalizeEntitlement })
    return store
  } finally {
    target.window = previous
  }
}

test('默认是免费版', () => {
  reset()
  assert.equal(isPro(T0), false)
  assert.equal(effectiveStatus(T0), 'free')
  assert.deepEqual(getEntitlement(), DEFAULT_ENTITLEMENT)
  assert.equal(getEntitlement().proUntil, undefined)
})

test('免费版同时 8 件事（v3 口径），第 9 件才拦', () => {
  reset()
  assert.equal(FREE_ITEM_LIMIT, 8)
  assert.equal(canAddItem(0, T0), true)
  assert.equal(canAddItem(FREE_ITEM_LIMIT - 1, T0), true)
  assert.equal(canAddItem(FREE_ITEM_LIMIT, T0), false)
  assert.equal(canAddItem(8, T0), false)
  assert.equal(remainingSlots(7, T0), 1)
  assert.equal(remainingSlots(8, T0), 0)
  assert.equal(canAddItem(FREE_ITEM_LIMIT, T0), false)
  assert.equal(canOpenChapter(FREE_CHAPTER_LIMIT, T0), false)
})

test('永久（life）：全部闸门放开，且没有到期日', () => {
  reset()
  grantLife(T0)
  assert.equal(getEntitlement().status, 'life')
  assert.equal(getEntitlement().proUntil, undefined)
  assert.equal(isPro(T0), true)
  // 一百年后仍然是 Pro
  assert.equal(isPro(T0 + 36500 * DAY), true)
  assert.equal(canAddItem(999, T0), true)
  assert.equal(remainingSlots(999, T0), Number.POSITIVE_INFINITY)
  assert.equal(canUseSkin('pixel', T0), true)
  assert.equal(canOpenChapter(50, T0), true)
  assert.equal(canShareCard(T0), true)
  assert.equal(getEntitlement().purchasedAt, T0)
})

test('试用期内是 Pro', () => {
  reset()
  grantTrial(T0)
  assert.equal(getEntitlement().status, 'trial')
  assert.equal(isPro(T0), true)
  assert.equal(isPro(T0 + 6 * DAY), true)
  assert.equal(effectiveStatus(T0 + 6 * DAY), 'trial')
  assert.equal(canAddItem(8, T0 + 6 * DAY), true)
  assert.equal(proDaysLeft(T0), 7)
})

test('试用到期自动回落 free（不写库，判断即时生效）', () => {
  reset()
  grantTrial(T0)
  const expired = T0 + 8 * DAY
  assert.equal(isPro(expired), false)
  assert.equal(effectiveStatus(expired), 'free')
  assert.equal(canAddItem(8, expired), false)
  assert.equal(canUseSkin('pixel', expired), false)
  assert.equal(canShareCard(expired), false)
  // 状态本身还在（等下一次对账纠正），没有偷偷改写用户数据
  assert.equal(getEntitlement().status, 'trial')
  assert.equal(proDaysLeft(expired), null)
})

test('年费一年内是 Pro，过了到期日回落 free', () => {
  reset()
  grantYear(T0)
  assert.equal(getEntitlement().status, 'year')
  assert.ok(getEntitlement().proUntil)
  assert.equal(isPro(T0 + 364 * DAY), true)
  assert.equal(isPro(T0 + 366 * DAY), false)
  assert.equal(effectiveStatus(T0 + 366 * DAY), 'free')
})

test('到期边界：正好等于 proUntil 就不算 Pro', () => {
  reset()
  grantTrial(T0, '2026-01-08T00:00:00.000Z')
  const until = Date.parse('2026-01-08T00:00:00.000Z')
  assert.equal(isPro(until - 1), true)
  assert.equal(isPro(until), false)
})

test('旧数据 { pro: true } 迁移成 life，权益与购买时间都不丢', () => {
  const store = makeStoreWith({ pro: true, purchasedAt: 1700000000000, checkedAt: 1700000000000 })
  assert.equal(store.get().status, 'life')
  assert.equal(store.get().proUntil, undefined)
  assert.equal(store.get().purchasedAt, 1700000000000)
  assert.equal(store.get().checkedAt, 1700000000000)
})

test('旧数据 { pro: false } 迁移成 free', () => {
  const store = makeStoreWith({ pro: false, purchasedAt: null, checkedAt: 1700000000000 })
  assert.equal(store.get().status, 'free')
  assert.equal(store.get().proUntil, undefined)
})

test('新结构原样读回：year / trial 保留 proUntil', () => {
  const store = makeStoreWith({ status: 'year', proUntil: '2027-01-01T00:00:00.000Z', purchasedAt: T0, checkedAt: T0 })
  assert.equal(store.get().status, 'year')
  assert.equal(store.get().proUntil, '2027-01-01T00:00:00.000Z')
})

test('未知 status 回落 free', () => {
  reset()
  assert.equal(normalizeEntitlement({ status: 'pro', proUntil: '2027-01-01T00:00:00.000Z' }).status, 'free')
  assert.equal(normalizeEntitlement({ status: 'premium' }).status, 'free')
  assert.equal(normalizeEntitlement({ status: 42 }).status, 'free')
  assert.equal(normalizeEntitlement({ status: null, pro: true }).status, 'life')
})

test('非法日期不崩：有期限但日期坏了，按免费算', () => {
  const bad = normalizeEntitlement({ status: 'trial', proUntil: 'not-a-date' })
  assert.equal(bad.status, 'free')
  assert.equal(bad.proUntil, undefined)

  assert.equal(normalizeEntitlement({ status: 'year', proUntil: 12345 }).status, 'free')
  assert.equal(normalizeEntitlement({ status: 'year', proUntil: '' }).status, 'free')
  assert.equal(normalizeEntitlement({ status: 'trial' }).status, 'free')
  // 坏数据不影响持久化的数字字段
  const messy = normalizeEntitlement({ status: 'year', proUntil: 'x', purchasedAt: 'yesterday', checkedAt: Number.NaN })
  assert.equal(messy.purchasedAt, null)
  assert.equal(messy.checkedAt, null)
})

test('坏数据 / 空值一律归一成免费版，不会误开 Pro', () => {
  reset()
  assert.deepEqual(normalizeEntitlement(undefined), DEFAULT_ENTITLEMENT)
  assert.deepEqual(normalizeEntitlement(null), DEFAULT_ENTITLEMENT)
  assert.deepEqual(normalizeEntitlement('pro'), DEFAULT_ENTITLEMENT)
  assert.equal(normalizeEntitlement({ pro: 'yes' }).status, 'free')
  assert.equal(isPro(T0), false)
})

test('grantPro 幂等，且不会把年费偷偷升级成永久', () => {
  reset()
  grantPro(T0)
  grantPro(T0 + 1000)
  assert.equal(getEntitlement().status, 'life')
  assert.equal(getEntitlement().purchasedAt, T0)

  reset()
  grantYear(T0)
  grantPro(T0 + 1000) // App 壳里的旧回调
  assert.equal(getEntitlement().status, 'year')
  assert.equal(getEntitlement().purchasedAt, T0)

  reset()
  grantTrial(T0)
  grantPro(T0 + 1000)
  assert.equal(getEntitlement().status, 'trial')
})

test('续费不覆盖首次购买时间', () => {
  reset()
  grantYear(T0)
  grantYear(T0 + 365 * DAY)
  assert.equal(getEntitlement().purchasedAt, T0)
})

test('撤销后回到免费口径，但不改数据层', () => {
  reset()
  grantLife(T0)
  revokePro(T0 + DAY)
  assert.equal(getEntitlement().status, 'free')
  assert.equal(getEntitlement().proUntil, undefined)
  assert.equal(getEntitlement().purchasedAt, null)
  assert.equal(isPro(T0 + DAY), false)
  assert.equal(canAddItem(8, T0 + DAY), false)
})

test('统一门禁 canUse：各档位判断一致', () => {
  reset()
  // 免费：8 件、3 章、jelly 皮肤、分享卡关闭、情绪层全关
  assert.equal(canUse({ kind: 'item', count: 7 }, T0), true)
  assert.equal(canUse({ kind: 'item', count: 8 }, T0), false)
  assert.equal(canUse({ kind: 'chapter', index: 2 }, T0), true)
  assert.equal(canUse({ kind: 'chapter', index: 3 }, T0), false)
  assert.equal(canUse({ kind: 'skin', pack: 'jelly' }, T0), true)
  assert.equal(canUse({ kind: 'skin', pack: 'night' }, T0), false)
  assert.equal(canUse({ kind: 'shareCard' }, T0), false)
  assert.equal(canUse({ kind: 'pets' }, T0), false)
  assert.equal(canUse({ kind: 'liveActivity' }, T0), false)
  assert.equal(canUse({ kind: 'alarm' }, T0), false)
  assert.equal(canUse({ kind: 'icloud' }, T0), false)

  grantLife(T0)
  assert.equal(canUse({ kind: 'item', count: 999 }, T0), true)
  assert.equal(canUse({ kind: 'chapter', index: 99 }, T0), true)
  assert.equal(canUse({ kind: 'skin', pack: 'night' }, T0), true)
  assert.equal(canUse({ kind: 'shareCard' }, T0), true)
  assert.equal(canUse({ kind: 'pets' }, T0), true)
  assert.equal(canUse({ kind: 'liveActivity' }, T0), true)
  assert.equal(canUse({ kind: 'alarm' }, T0), true)
  assert.equal(canUse({ kind: 'icloud' }, T0), true)
})

test('存储 key 不变（旧数据能读到）', () => {
  assert.equal(ENTITLEMENT_STORAGE_KEY, 'daymark.entitlement.v1')
})
