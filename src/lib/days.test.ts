import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calendarBreakdown,
  daysSince,
  formatSpan,
  milestoneAt,
  sortEvents,
  startOfDay,
  summarize,
} from './days.ts'
import type { DayEvent } from './types.ts'

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
