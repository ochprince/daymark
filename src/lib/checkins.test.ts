import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildHistory,
  countInPeriod,
  daysInPeriod,
  formatClock,
  timesOf,
  countInRange,
  countToday,
  dayKey,
  parseDayKey,
  periodLabel,
  periodStart,
  previousPeriodCount,
  previousPeriodStart,
  sortCheckIns,
  streakPeriods,
  summarizePeriods,
  weekStart,
} from './checkins.ts'
import type { CheckInCadence, CheckInEvent } from './types.ts'

/** 用本地时间构造时间戳，避免测试受时区影响 */
function at(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime()
}

function make(cadence: CheckInCadence, days: Record<string, number>): CheckInEvent {
  return { id: 'c1', title: '喝水', createdAt: 0, color: 0, cadence, days }
}

test('dayKey / parseDayKey：本地日期往返一致', () => {
  assert.equal(dayKey(at(2026, 9, 30)), '2026-09-30')
  assert.equal(dayKey(at(2026, 1, 5, 0)), '2026-01-05')
  assert.equal(parseDayKey('2026-09-30'), at(2026, 9, 30, 0))
  assert.ok(Number.isNaN(parseDayKey('2026/09/30')))
})

test('weekStart：自然周从周一起算', () => {
  // 2026-09-30 是周三 → 那周的周一是 9/28
  assert.equal(dayKey(weekStart(at(2026, 9, 30))), '2026-09-28')
  // 周日属于「这一周」的最后一天，不是下一周的开头
  assert.equal(dayKey(weekStart(at(2026, 10, 4))), '2026-09-28')
  // 周一自己就是开头
  assert.equal(dayKey(weekStart(at(2026, 10, 5))), '2026-10-05')
  // 跨月：2026-11-01 是周日 → 那周从 10/26 开始
  assert.equal(dayKey(weekStart(at(2026, 11, 1))), '2026-10-26')
})

test('periodStart：三种周期的起点', () => {
  const now = at(2026, 9, 30)
  assert.equal(dayKey(periodStart('daily', now)), '2026-09-30')
  assert.equal(dayKey(periodStart('weekly', now)), '2026-09-28')
  assert.equal(dayKey(periodStart('monthly', now)), '2026-09-01')
})

test('previousPeriodStart：昨天 / 上一周 / 上个月', () => {
  const now = at(2026, 9, 30)
  assert.equal(dayKey(previousPeriodStart('daily', periodStart('daily', now))), '2026-09-29')
  assert.equal(dayKey(previousPeriodStart('weekly', periodStart('weekly', now))), '2026-09-21')
  assert.equal(dayKey(previousPeriodStart('monthly', periodStart('monthly', now))), '2026-08-01')
})

test('每日：今天归今天的，昨天归昨天的', () => {
  const event = make('daily', { '2026-09-29': 8, '2026-09-30': 3 })
  const now = at(2026, 9, 30, 20)
  assert.equal(countInPeriod(event, now), 3)
  assert.equal(previousPeriodCount(event, now), 8)
  assert.equal(countToday(event, now), 3)
})

test('每日：跨到第二天后昨天的数进历史、今天的数清零', () => {
  const event = make('daily', { '2026-09-29': 8, '2026-09-30': 3 })
  const tomorrow = at(2026, 10, 1, 9)
  assert.equal(countInPeriod(event, tomorrow), 0)
  assert.equal(previousPeriodCount(event, tomorrow), 3)
  const history = buildHistory(event, tomorrow)
  assert.deepEqual(history.map((p) => [p.start, p.count]), [
    [at(2026, 9, 30, 0), 3],
    [at(2026, 9, 29, 0), 8],
  ])
})

test('每周：同周内累加，跨周归零', () => {
  const event = make('weekly', { '2026-09-28': 1, '2026-09-30': 2, '2026-10-04': 1, '2026-10-05': 4 })
  // 9/30（周三）所在周：9/28 ~ 10/4
  assert.equal(countInPeriod(event, at(2026, 9, 30)), 4)
  assert.equal(previousPeriodCount(event, at(2026, 9, 30)), 0)
  // 10/5（周一）已经进入下一周
  assert.equal(countInPeriod(event, at(2026, 10, 5)), 4)
  assert.equal(previousPeriodCount(event, at(2026, 10, 5)), 4)
})

test('每周：周日算是本周的最后一天', () => {
  // 那天是 10/4 周日，仍在 9/28 那一周里
  const event = make('weekly', { '2026-09-28': 2, '2026-10-04': 3 })
  assert.equal(countInPeriod(event, at(2026, 10, 4, 23)), 5)
})

test('每月：同月累加，跨月归零', () => {
  const event = make('monthly', { '2026-08-31': 5, '2026-09-01': 2, '2026-09-30': 3 })
  assert.equal(countInPeriod(event, at(2026, 9, 15)), 5)
  assert.equal(previousPeriodCount(event, at(2026, 9, 15)), 5)
  assert.equal(countInPeriod(event, at(2026, 10, 1)), 0)
  assert.equal(previousPeriodCount(event, at(2026, 10, 1)), 5)
})

test('buildHistory：不含当前周期，最近的在前', () => {
  const event = make('monthly', { '2026-07-10': 3, '2026-08-10': 9, '2026-09-10': 1, '2026-09-20': 2 })
  const history = buildHistory(event, at(2026, 9, 30))
  assert.deepEqual(history.map((p) => [dayKey(p.start), p.count]), [
    ['2026-08-01', 9],
    ['2026-07-01', 3],
  ])
})

test('buildHistory：坏数据不会带崩统计', () => {
  const event = make('daily', { '2026-09-30': 2 })
  // 直接塞脏键，模拟 localStorage 被改过
  const dirty: CheckInEvent = {
    ...event,
    days: { '2026-09-30': 2, bad: 5, '2026-09-29': -3, '2026-09-28': 0 },
  }
  const history = buildHistory(dirty, at(2026, 10, 1))
  // 非日期键、负数、0 全部被丢掉，只剩有效的那一条
  assert.deepEqual(history.map((p) => [dayKey(p.start), p.count]), [['2026-09-30', 2]])
  assert.equal(countInRange(dirty, at(2026, 9, 1, 0), at(2026, 10, 1, 0)), 2)
})

test('summarizePeriods：共 N 个周期 · 最多 X 次 · 合计 Y 次', () => {
  const event = make('daily', { '2026-09-27': 4, '2026-09-28': 9, '2026-09-29': 1 })
  const summary = summarizePeriods(buildHistory(event, at(2026, 9, 30)))
  assert.deepEqual(summary, { periods: 3, most: 9, total: 14 })
})

test('streakPeriods：连续周期数（当前没打就往回数）', () => {
  const daily = make('daily', { '2026-09-27': 1, '2026-09-28': 1, '2026-09-29': 1 })
  // 今天（9/30）还没打，但昨天连着 → 连续 3 天
  assert.equal(streakPeriods(daily, at(2026, 9, 30)), 3)
  // 断了一天就归零
  const broken = make('daily', { '2026-09-27': 1, '2026-09-28': 1 })
  assert.equal(streakPeriods(broken, at(2026, 9, 30)), 0)
  const weekly = make('weekly', { '2026-09-14': 2, '2026-09-21': 1 })
  assert.equal(streakPeriods(weekly, at(2026, 9, 30)), 2)
})

test('sortCheckIns：最近打过的排前面', () => {
  const a = { ...make('daily', { '2026-09-20': 1 }), id: 'a', createdAt: 1 }
  const b = { ...make('daily', { '2026-09-30': 1 }), id: 'b', createdAt: 2 }
  const c = { ...make('daily', {}), id: 'c', createdAt: 3 }
  assert.deepEqual(sortCheckIns([a, b, c]).map((e) => e.id), ['b', 'a', 'c'])
})

test('periodLabel：历史条目的时间说法', () => {
  assert.equal(periodLabel('daily', at(2026, 9, 30, 0)), '9月30日 星期三')
  assert.equal(periodLabel('weekly', at(2026, 9, 28, 0)), '9月28日那周')
  assert.equal(periodLabel('monthly', at(2026, 8, 1, 0)), '2026年8月')
})

/* ---------------- 打卡时刻 ---------------- */

function withTimes(cadence: CheckInCadence, days: Record<string, number>, times: Record<string, number[]>) {
  return {
    id: 'x', title: '喝水', createdAt: 0, color: 0,
    cadence, days, times,
  } as CheckInEvent
}

test('timesOf：读出某一天的时刻，没有就返回空数组', () => {
  const event = withTimes('daily', { '2026-09-30': 2 }, { '2026-09-30': [1000, 2000] })
  assert.deepEqual(timesOf(event, '2026-09-30'), [1000, 2000])
  assert.deepEqual(timesOf(event, '2026-09-29'), [])
  const legacy = withTimes('daily', { '2026-09-30': 2 }, {})
  delete (legacy as { times?: unknown }).times
  assert.deepEqual(timesOf(legacy, '2026-09-30'), [])
})

test('formatClock：补零成 09:05', () => {
  const ts = new Date(2026, 8, 30, 9, 5).getTime()
  assert.equal(formatClock(ts), '09:05')
  const late = new Date(2026, 8, 30, 22, 40).getTime()
  assert.equal(formatClock(late), '22:40')
})

test('daysInPeriod：按天列出明细，带时刻', () => {
  const mon = new Date(2026, 8, 28, 0, 0, 0).getTime()
  const event = withTimes(
    'weekly',
    { '2026-09-28': 1, '2026-09-30': 2, '2026-10-02': 1 },
    { '2026-09-28': [mon + 3600e3], '2026-09-30': [mon + 7200e3, mon + 9000e3] },
  )
  const days = daysInPeriod(event, 'weekly', mon)
  assert.equal(days.length, 3)
  assert.deepEqual(days.map((d) => d.key), ['2026-09-28', '2026-09-30', '2026-10-02'])
  assert.deepEqual(days[1].times, [mon + 7200e3, mon + 9000e3])
  assert.deepEqual(days[2].times, [])
  assert.equal(days[2].count, 1)
})

test('buildHistory：默认不含当前周期，includeCurrent 打开后带上', () => {
  const today = new Date(2026, 8, 30, 10, 0).getTime()
  const event = withTimes('daily', { '2026-09-28': 1, '2026-09-29': 2, '2026-09-30': 3 }, {})
  assert.deepEqual(buildHistory(event, today).map((p) => p.count), [2, 1])
  assert.deepEqual(buildHistory(event, today, true).map((p) => p.count), [3, 2, 1])
})
