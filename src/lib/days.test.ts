import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildCountdownList,
  calendarBreakdown,
  daysSince,
  daysUntil,
  formatSpan,
  milestoneAt,
  nextOccurrence,
  sortEvents,
  startOfDay,
  summarize,
  summarizeCountdowns,
} from './days.ts'
import type { CountdownEvent, DayEvent, Repeat } from './types.ts'

/** 用本地时间构造时间戳，避免测试受时区影响 */
function at(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime()
}

function makeEvent(id: string, startedAt: number, createdAt = startedAt): DayEvent {
  return { id, title: id, startedAt, createdAt, color: 0 }
}

test('daysSince 按自然日计算，不管当天几点记录', () => {
  assert.equal(daysSince(at(2026, 9, 29), at(2026, 9, 29)), 0)
  assert.equal(daysSince(at(2026, 9, 28), at(2026, 9, 29)), 1)
  assert.equal(daysSince(at(2026, 9, 29, 0), at(2026, 9, 29, 23)), 0)
  assert.equal(daysSince(at(2025, 9, 29), at(2026, 9, 29)), 365)
  // 闰年：2024-02-29 到 2025-03-01 是 366 天
  assert.equal(daysSince(at(2024, 2, 29), at(2025, 3, 1)), 366)
})

test('未来时间一律收敛到 0 天', () => {
  assert.equal(daysSince(at(2026, 10, 1), at(2026, 9, 29)), 0)
})

test('startOfDay 抹掉时分秒', () => {
  const start = startOfDay(at(2026, 9, 29, 23))
  assert.equal(start, new Date(2026, 8, 29, 0, 0, 0, 0).getTime())
})

test('calendarBreakdown 按自然月拆分，月末自动收敛', () => {
  assert.deepEqual(calendarBreakdown(at(2026, 1, 31), at(2026, 3, 1)), {
    years: 0,
    months: 1,
    days: 1,
  })
  assert.deepEqual(calendarBreakdown(at(2024, 2, 29), at(2025, 2, 28)), {
    years: 1,
    months: 0,
    days: 0,
  })
  assert.deepEqual(calendarBreakdown(at(2020, 5, 20), at(2026, 9, 29)), {
    years: 6,
    months: 4,
    days: 9,
  })
  assert.deepEqual(calendarBreakdown(at(2026, 9, 29), at(2026, 9, 29)), {
    years: 0,
    months: 0,
    days: 0,
  })
})

test('formatSpan 不足 31 天不显示', () => {
  assert.equal(formatSpan(at(2026, 9, 1), at(2026, 9, 29)), '')
  assert.equal(formatSpan(at(2026, 6, 21), at(2026, 9, 29)), '3 个月 8 天')
  assert.equal(formatSpan(at(2025, 9, 29), at(2026, 9, 29)), '1 年')
})

test('里程碑只在恰好踩中的那天出现', () => {
  assert.equal(milestoneAt(100), 100)
  assert.equal(milestoneAt(365), 365)
  assert.equal(milestoneAt(101), null)
  assert.equal(milestoneAt(0), null)
})

test('列表按经历时间倒序，同一天按创建时间排', () => {
  const events = [
    makeEvent('newest', at(2026, 9, 20)),
    makeEvent('oldest', at(2020, 1, 1)),
    makeEvent('middle-b', at(2024, 6, 1), 200),
    makeEvent('middle-a', at(2024, 6, 1), 100),
  ]

  assert.deepEqual(
    sortEvents(events).map((event) => event.id),
    ['oldest', 'middle-a', 'middle-b', 'newest'],
  )
})

test('summarize 给出总数与最长天数', () => {
  const events = [makeEvent('a', at(2026, 9, 20)), makeEvent('b', at(2020, 1, 1))]
  assert.deepEqual(summarize(events, at(2026, 9, 29)), { count: 2, longest: 2463 })
  assert.deepEqual(summarize([], at(2026, 9, 29)), { count: 0, longest: 0 })
})

/* ---------------------------- 倒数日 ---------------------------- */

/** 与 nextOccurrence 的返回口径一致：当天 00:00 */
function day(year: number, month: number, dayOfMonth: number): number {
  return startOfDay(at(year, month, dayOfMonth))
}

function makeCountdown(id: string, startedAt: number, repeat: Repeat, createdAt = startedAt): CountdownEvent {
  return { id, title: id, startedAt, repeat, createdAt, color: 0 }
}

test('nextOccurrence：不重复或还在未来时就是那一天', () => {
  const now = at(2026, 9, 30)
  assert.equal(nextOccurrence(at(2026, 12, 25), 'none', now), day(2026, 12, 25))
  assert.equal(nextOccurrence(at(2026, 12, 25), 'yearly', now), day(2026, 12, 25))
  assert.equal(daysUntil(at(2026, 10, 1), now), 1)
  assert.equal(daysUntil(now, now), 0)
  assert.equal(daysUntil(at(2026, 9, 1), now), -29)
})

test('nextOccurrence：按年重复的生日会走到下一个生日', () => {
  const now = at(2026, 9, 30)
  assert.equal(nextOccurrence(at(1990, 5, 20), 'yearly', now), day(2027, 5, 20))
  assert.equal(nextOccurrence(at(2019, 10, 1), 'yearly', now), day(2026, 10, 1))
  // 今天就是纪念日 → 就是今天
  assert.equal(nextOccurrence(at(2019, 9, 30), 'yearly', now), day(2026, 9, 30))
})

test('nextOccurrence：按周重复取锚点的星期几', () => {
  const now = at(2026, 9, 30) // 星期三
  // 锚点也是星期三 → 就是今天
  assert.equal(nextOccurrence(at(2026, 9, 23), 'weekly', now), day(2026, 9, 30))
  assert.equal(daysUntil(nextOccurrence(at(2026, 9, 23), 'weekly', now), now), 0)
  // 锚点是星期四 → 明天
  assert.equal(nextOccurrence(at(2026, 9, 24), 'weekly', now), day(2026, 10, 1))
  // 锚点是星期二 → 下周二（永远落在 0-6 天内，不会出现「已过去」）
  const next = nextOccurrence(at(2026, 9, 29), 'weekly', now)
  assert.equal(next, day(2026, 10, 6))
  assert.equal(daysUntil(next, now), 6)
  // 填的未来日期不影响：锚点只看星期几
  assert.equal(nextOccurrence(at(2026, 10, 21), 'weekly', now), day(2026, 9, 30))
})

test('nextOccurrence：按月重复在月末自动收敛', () => {
  const now = at(2026, 9, 30)
  // 1/31 → 2/28 → 3/31 → 4/30 → 5/31 → 6/30 → 7/31 → 8/31 → 9/30
  assert.equal(nextOccurrence(at(2026, 1, 31), 'monthly', now), day(2026, 9, 30))
  assert.equal(nextOccurrence(at(2026, 1, 31), 'monthly', at(2026, 8, 15)), day(2026, 8, 31))
})

test('nextOccurrence：2 月 29 日按年重复会收敛到 2 月 28 日', () => {
  assert.equal(nextOccurrence(at(2024, 2, 29), 'yearly', at(2025, 6, 1)), day(2026, 2, 28))
  // 闰年那一年回到 29 日
  assert.equal(nextOccurrence(at(2024, 2, 29), 'yearly', at(2027, 3, 1)), day(2028, 2, 29))
})

test('nextOccurrence：填写的日期在未来时，切换周期同样给出真正的下一次', () => {
  const now = at(2026, 9, 30)
  // 填 12/20 选每月 → 从今天往后最近的一个 20 号
  assert.equal(nextOccurrence(at(2026, 12, 20), 'monthly', now), day(2026, 10, 20))
  // 填 12/20 选每年 → 从今天往后最近的 12/20
  assert.equal(nextOccurrence(at(2026, 12, 20), 'yearly', now), day(2026, 12, 20))
  // 填 2027/3/8 选每月 → 下一个 8 号
  assert.equal(nextOccurrence(at(2027, 3, 8), 'monthly', now), day(2026, 10, 8))
  // 填 2027/12/20 选每年 → 最近的一次是今年 12/20
  assert.equal(nextOccurrence(at(2027, 12, 20), 'yearly', now), day(2026, 12, 20))
  // 不重复 → 原样，不做任何外推
  assert.equal(nextOccurrence(at(2027, 3, 8), 'none', now), day(2027, 3, 8))
})

test('nextOccurrence：每月重复的锚点是「几号」，跨月取最近一次', () => {
  // 锚点 31 号：9 月只有 30 天，收敛到 9/30
  assert.equal(nextOccurrence(at(2026, 1, 31), 'monthly', at(2026, 9, 29)), day(2026, 9, 30))
  // 到了 10 月，下一个 31 号就是 10/31
  assert.equal(nextOccurrence(at(2026, 1, 31), 'monthly', at(2026, 10, 1)), day(2026, 10, 31))
})

test('buildCountdownList 按距离正序，越近越靠上', () => {
  const now = at(2026, 9, 30)
  const list = buildCountdownList(
    [
      makeCountdown('远', at(2027, 6, 1), 'none'),
      makeCountdown('近', at(2026, 10, 2), 'none'),
      makeCountdown('生日', at(1990, 5, 20), 'yearly'),
    ],
    now,
  )
  assert.deepEqual(
    list.map((view) => view.event.id),
    ['近', '生日', '远'],
  )
  assert.deepEqual(
    list.map((view) => view.days),
    [2, 232, 244],
  )
})

test('summarizeCountdowns 只统计还没到的', () => {
  const now = at(2026, 9, 30)
  const list = buildCountdownList(
    [makeCountdown('过了', at(2026, 9, 1), 'none'), makeCountdown('一周后', at(2026, 10, 7), 'none')],
    now,
  )
  assert.deepEqual(summarizeCountdowns(list), { count: 2, nearest: 7 })
})
