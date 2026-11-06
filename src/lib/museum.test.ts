import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyCollection } from './collection'
import type { ShelfBook } from './museum'
import { buildItemViews } from './itemview'
import {
  DEX_TOTAL,
  SPECIES_HUE,
  badgeCount,
  collectBooks,
  collectChapters,
  countdownArrivals,
  dexCount,
  dexCountOf,
  hasDex,
  speciesColor,
  shelfBooks,
  speciesHue,
  stageTint,
} from './museum'

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

test('书架：倒数日同一天的「到过」只算一章（点两下不该变两章）', () => {
  const views = viewsOf(
    [],
    [],
    [
      {
        id: 'd2',
        title: '说好要去的海边',
        startedAt: at(2026, 11, 3),
        createdAt: at(2026, 1, 1),
        color: 3,
        repeat: 'none',
        history: [
          { at: at(2026, 11, 3) + 3600_000 },
          { at: at(2026, 11, 3) },
        ],
      },
    ],
    at(2026, 11, 5),
  )
  const books = collectChapters(views)
  assert.equal(books.length, 1)
})

test('书架：删掉的那件事，书还留在架上', () => {
  const views = viewsOf(
    [],
    [],
    [
      {
        id: 'd3',
        title: '等待的日子',
        startedAt: at(2026, 11, 3),
        createdAt: at(2026, 1, 1),
        color: 1,
        repeat: 'none',
        history: [{ at: at(2026, 11, 3) }],
      },
    ],
    at(2026, 11, 5),
  )
  const before = collectBooks(views)
  assert.equal(before.length, 1)
  // 删掉之后 views 里没有它了，只有藏馆里抄下来的那一本
  const after = collectBooks([], before)
  assert.equal(after.length, 1)
  assert.equal(after[0].title, '等待的日子')
  assert.equal(after[0].chapters.length, 1)
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

test('书架：一件事只占一本书，翻过的章夹在书里', () => {
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
          { days: 12, endedAt: at(2026, 5, 20), stage: 2 },
        ],
      },
    ],
    [],
    [],
    now,
  )

  const books = collectBooks(views)
  assert.equal(books.length, 1)
  assert.equal(books[0].key, 'since:e1')
  assert.equal(books[0].chapters.length, 3)
  // 章是新的在前
  assert.deepEqual(
    books[0].chapters.map((chapter) => chapter.days),
    [12, 40, 128],
  )
  // 书脊上的厚度看「当前这一章走了多久」，不是历史总和
  assert.equal(books[0].days, views[0].kind === 'since' ? views[0].days : -1)
})

test('书架：习惯书按记过的天数算厚度，倒数日按剩余天数（到过就是 0）', () => {
  const now = at(2026, 10, 25)
  const views = viewsOf(
    [],
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
    [
      { id: 'd1', title: '生日', startedAt: at(2026, 10, 20), createdAt: at(2026, 1, 1), color: 5, repeat: 'none' },
    ],
    now,
  )
  const books = collectBooks(views)
  const habit = books.find((book) => book.key === 'habit:c1')
  const countdown = books.find((book) => book.key === 'countdown:d1')
  assert.equal(habit?.days, 21)
  assert.equal(habit?.chapters.length, 1)
  assert.ok(countdown)
  assert.equal(countdown?.days, 0)
})

test('书架：多件事按「这一章开始的时间」倒序，且一本书不会重复出现', () => {
  const now = at(2026, 10, 26)
  const views = viewsOf(
    [
      { id: 'old', title: '早睡', createdAt: at(2025, 1, 1), startedAt: at(2025, 2, 1), color: 1, species: 'moon', history: [] },
      {
        id: 'new',
        title: '戒烟',
        createdAt: at(2025, 1, 1),
        startedAt: at(2026, 9, 1),
        color: 0,
        species: 'sprout',
        history: [{ days: 30, endedAt: at(2026, 8, 1), stage: 2 }],
      },
    ],
    [],
    [],
    now,
  )
  const books = collectBooks(views)
  assert.equal(books.length, 2)
  assert.deepEqual(
    books.map((book) => book.title),
    ['戒烟', '早睡'],
  )
  assert.equal(books.filter((book) => book.title === '戒烟').length, 1)
})

test('书架：没有历史章节的书也照样上台', () => {
  const now = at(2026, 10, 26)
  const views = viewsOf(
    [{ id: 'e1', title: '学法语', createdAt: at(2026, 9, 1), startedAt: at(2026, 9, 1), color: 2, species: 'star' }],
    [],
    [],
    now,
  )
  const books = collectBooks(views)
  assert.equal(books.length, 1)
  assert.deepEqual(books[0].chapters, [])
  assert.ok(books[0].days > 0)
})

test('图鉴配色：颜色属于「谁」，不属于「长到第几形态」', () => {
  // 色相只认物种，五个形态取到的都是同一个
  assert.deepEqual([0, 1, 2, 3, 4].map(() => speciesHue('sprout')), Array(5).fill('mint'))
  // 五种小伙伴五种颜色，互不撞色
  assert.equal(new Set(Object.values(SPECIES_HUE)).size, Object.keys(SPECIES_HUE).length)
  assert.equal(speciesHue('moon'), 'grape')
  assert.equal(speciesHue('drop'), 'sky')
  assert.equal(speciesHue('star'), 'lemon')
  assert.equal(speciesHue('post'), 'coral')
  // 未知物种不能把界面变成没有颜色的黑块
  assert.equal(speciesHue('nope'), 'mint')
})

test('图鉴底色随形态递进：0→4 单调加深，越界被夹住', () => {
  const tints = [0, 1, 2, 3, 4].map(stageTint)
  assert.deepEqual(tints, [14, 20, 26, 32, 38])
  assert.equal(stageTint(-3), 14)
  assert.equal(stageTint(9), 38)
  assert.equal(stageTint(2.7), 26)
})

test('新建默认色：颜色由物种决定，水滴不会是柠檬黄', () => {
  assert.equal(speciesColor('sprout'), 4) // mint
  assert.equal(speciesColor('moon'), 2) // grape
  assert.equal(speciesColor('drop'), 3) // sky
  assert.equal(speciesColor('star'), 0) // lemon
  assert.equal(speciesColor('post'), 1) // coral
  assert.equal(speciesColor('nope'), 4)
})

test('倒数日到过了，就算没点过「说过了」，也得算一章', () => {
  const now = at(2026, 11, 6)
  // 昨天建的、今天到：晚了之后没有任何 history 记录
  const arrived = viewsOf(
    [],
    [],
    [{ id: 'd1', title: '聚餐', startedAt: at(2026, 11, 6), createdAt: at(2026, 11, 5), color: 1, repeat: 'none' }],
    now,
  )
  const chapters = collectChapters(arrived)
  assert.equal(chapters.length, 1)
  assert.equal(new Date(chapters[0].endedAt).toDateString(), new Date(at(2026, 11, 6)).toDateString())

  // 还没到的，不该凭空多一章
  const future = viewsOf(
    [],
    [],
    [{ id: 'd2', title: '过年', startedAt: at(2026, 12, 1), createdAt: at(2026, 11, 5), color: 1, repeat: 'none' }],
    now,
  )
  assert.equal(collectChapters(future).length, 0)

  // 同一件事同一天只算一章
  const acked = viewsOf(
    [],
    [],
    [{
      id: 'd3', title: '生日', startedAt: at(2026, 11, 6), createdAt: at(2026, 11, 5), color: 1, repeat: 'none',
      history: [{ at: at(2026, 11, 6) }],
    }],
    now,
  )
  assert.equal(collectChapters(acked).length, 1)
  assert.ok(countdownArrivals(acked.find((v) => v.kind === 'countdown') as never).length === 1)
})

test('早就在存档里的书：到过但没抄下章节，读的时候补上', () => {
  const now = at(2026, 11, 6)
  const legacy: ShelfBook = {
    key: 'countdown:c1',
    title: '聚餐',
    kind: 'countdown' as const,
    color: 1,
    species: 'sprout' as const,
    stage: 0 as const,
    days: 0,
    startedAt: at(2026, 11, 6),
    deletedAt: now,
    chapters: [],
  }
  const [book] = shelfBooks([legacy], now)
  assert.equal(book.chapters.length, 1)
  assert.equal(new Date(book.chapters[0].endedAt).toDateString(), new Date(at(2026, 11, 6)).toDateString())

  // 删的时候还没到那天：不补
  const notYet: ShelfBook = { ...legacy, key: 'countdown:c2', days: 9, startedAt: at(2026, 11, 15) }
  assert.equal(shelfBooks([notYet], now)[0].chapters.length, 0)

  // 已经有章节的，原样
  const withChapter: ShelfBook = {
    ...legacy,
    key: 'countdown:c3',
    chapters: [{ key: 'x', itemKey: 'countdown:c3', title: '聚餐', days: 0, endedAt: at(2026, 11, 1), color: 1, species: 'sprout' as const, stage: 0 as const }],
  }
  assert.equal(shelfBooks([withChapter], now)[0].chapters.length, 1)
  assert.equal(new Date(shelfBooks([withChapter], now)[0].chapters[0].endedAt).getDate(), 1)
})
