import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyCollection } from './collection'
import { buildItemViews } from './itemview'
import { DEX_TOTAL, badgeCount, collectChapters, dexCount, dexCountOf, hasDex } from './museum'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime()

function viewsOf(events: unknown[], checkins: unknown[], countdowns: unknown[], now: number) {
  return buildItemViews(
    { events: events as never, checkins: checkins as never, countdowns: countdowns as never },
    now,
  )
}

test('书架：坚持与习惯的章节都收成书，按结束时间倒序', () => {
  const now = at(2026, 10, 25)
  const views = viewsOf(
    [
      {
        id: 'e1',
        title: '戒烟',
        createdAt: at(2025, 1, 1),
        startedAt: at(2026, 6, 1),
        color: 0,
        species: 'sprout',
        history: [
          { days: 128, endedAt: at(2026, 3, 1), stage: 4 },
          { days: 40, endedAt: at(2026, 5, 1), stage: 3 },
        ],
      },
    ],
    [
      {
        id: 'c1',
        title: '喝水',
        createdAt: at(2026, 1, 1),
        color: 3,
        cadence: 'daily',
        species: 'drop',
        target: 8,
        days: {},
        times: {},
        growthDays: 21,
        chapters: [{ days: 21, endedAt: at(2026, 9, 25), stage: 2 }],
      },
    ],
    [],
    now,
  )

  const books = collectChapters(views)
  assert.equal(books.length, 3)
  assert.deepEqual(
    books.map((book) => book.days),
    [21, 40, 128],
  )
  assert.equal(books[0].title, '喝水')
  assert.equal(books[0].itemKey, 'habit:c1')
  // 唯一键：同一件事的多个章节不能撞
  assert.equal(new Set(books.map((book) => book.key)).size, 3)
})

test('书架：倒数日到过的那天也是一本（没有天数）', () => {
  const views = viewsOf(
    [],
    [],
    [
      {
        id: 'd1',
        title: '妈妈的生日',
        startedAt: at(2026, 10, 20),
        createdAt: at(2026, 1, 1),
        color: 6,
        repeat: 'yearly',
        history: [{ at: at(2026, 10, 20), line: '那天打了电话。' }],
      },
    ],
    at(2026, 10, 25),
  )
  const books = collectChapters(views)
  assert.equal(books.length, 1)
  assert.equal(books[0].days, 0)
  assert.equal(books[0].line, '那天打了电话。')
})

test('空数据不炸，返回空书架', () => {
  const views = viewsOf([], [], [], at(2026, 10, 25))
  assert.deepEqual(collectChapters(views), [])
})

test('图鉴计数：总数 23，信信默认在，南瓜帽另算', () => {
  assert.equal(DEX_TOTAL, 23)
  const empty = emptyCollection()
  assert.equal(dexCount(empty), 1)

  const some = { ...empty, dex: ['sprout:0', 'sprout:1', 'drop:0', 'post:9'] }
  assert.equal(dexCount(some), 4)
  assert.equal(dexCountOf(some, 'sprout'), 2)
  assert.equal(dexCountOf(some, 'moon'), 0)
  assert.equal(hasDex(some, 'sprout', 1), true)
  assert.equal(hasDex(some, 'sprout', 2), false)

  const withPumpkin = { ...some, badges: { pumpkin: 1 } }
  assert.equal(dexCount(withPumpkin), 5)
  // 不会超过总数
  const all = { ...empty, dex: Array.from({ length: 40 }, (_, i) => `sprout:${i}`) }
  assert.equal(dexCount(all), DEX_TOTAL)
})

test('徽章计数', () => {
  assert.equal(badgeCount(emptyCollection()), 0)
  assert.equal(badgeCount({ ...emptyCollection(), badges: { first: 1, d7: 2 } }), 2)
})
