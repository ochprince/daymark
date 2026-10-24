import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countRecordedDays,
  daysToNextStage,
  displayStage,
  growthOfSince,
  habitGrowthDays,
  isSleeping,
  lastRecordedAt,
  nextGrowthDays,
  nextStageAt,
  recordedOn,
  stageOf,
} from './growth'
import type { CheckInEvent, DayEvent } from './types'

const DAY = 86_400_000

function at(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime()
}

function dayKeyOf(ts: number): string {
  const date = new Date(ts)
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

function checkin(overrides: Partial<CheckInEvent> = {}): CheckInEvent {
  return {
    id: 'c1',
    title: '喝水',
    createdAt: at(2026, 10, 1),
    color: 0,
    cadence: 'daily',
    days: {},
    times: {},
    ...overrides,
  }
}

function sinceEvent(overrides: Partial<DayEvent> = {}): DayEvent {
  return {
    id: 'e1',
    title: '戒烟',
    startedAt: at(2026, 10, 1),
    createdAt: at(2026, 10, 1),
    color: 0,
    ...overrides,
  }
}

test('形态门槛：0 / 3 / 7 / 30 / 100 天，边界向内', () => {
  assert.equal(stageOf(0), 0)
  assert.equal(stageOf(2), 0)
  assert.equal(stageOf(3), 1)
  assert.equal(stageOf(6), 1)
  assert.equal(stageOf(7), 2)
  assert.equal(stageOf(29), 2)
  assert.equal(stageOf(30), 3)
  assert.equal(stageOf(99), 3)
  assert.equal(stageOf(100), 4)
  assert.equal(stageOf(9999), 4)
})

test('形态对脏数据不抛错：负数、NaN 都按 0 天', () => {
  assert.equal(stageOf(-5), 0)
  assert.equal(stageOf(Number.NaN), 0)
  assert.equal(stageOf(Number.POSITIVE_INFINITY), 0)
})

test('形态永不退化：成长变小仍取历史最高', () => {
  assert.equal(displayStage(2, 3), 3)
  assert.equal(displayStage(50, 3), 3)
  assert.equal(displayStage(365, 3), 4)
  assert.equal(displayStage(7, undefined), 2)
})

test('到下一形态还差几天；到顶返回 null', () => {
  assert.equal(nextStageAt(0), 3)
  assert.equal(daysToNextStage(0), 3)
  assert.equal(daysToNextStage(2), 1)
  assert.equal(daysToNextStage(30), 70)
  assert.equal(nextStageAt(100), null)
  assert.equal(daysToNextStage(120), null)
})

test('坚持类成长 = 历史各章天数 + 当前这一章', () => {
  const now = at(2026, 10, 11) // 满 10 天
  const event = sinceEvent({
    startedAt: at(2026, 10, 1),
    history: [
      { days: 30, endedAt: at(2026, 9, 1) },
      { days: 5, endedAt: at(2026, 8, 1) },
    ],
  })
  assert.equal(growthOfSince(event, now), 45)
})

test('坚持类成长：锚点优先于起始日（满 24 小时才 +1）', () => {
  const startedAt = at(2026, 10, 1, 9)
  const now = at(2026, 10, 2, 10) // 25 小时后
  assert.equal(growthOfSince(sinceEvent({ startedAt, anchorAt: at(2026, 10, 1, 9) }), now), 1)
  assert.equal(growthOfSince(sinceEvent({ startedAt, anchorAt: at(2026, 10, 2, 9) }), now), 0)
})

test('习惯类成长优先读 growthDays，老数据按有记录的天数兜底', () => {
  assert.equal(habitGrowthDays({ days: { '2026-10-01': 1, '2026-10-02': 3 }, growthDays: 400 }), 400)
  assert.equal(habitGrowthDays({ days: { '2026-10-01': 1, '2026-10-02': 3 } }), 2)
  assert.equal(countRecordedDays({ '2026-10-01': 0, '2026-10-02': 3 }), 1)
})

test('growthDays 只认「某天从 0 变 1 / 从 1 变 0」', () => {
  assert.equal(nextGrowthDays(0, 1, 5), 6) // 第一次记
  assert.equal(nextGrowthDays(1, 2, 5), 5) // 同一天再记
  assert.equal(nextGrowthDays(2, 1, 5), 5) // 还有记录
  assert.equal(nextGrowthDays(1, 0, 5), 4) // 撤到 0
  assert.equal(nextGrowthDays(0, 0, 5), 5)
})

test('最近一次记录 / 今天记过没有', () => {
  const event = checkin({ days: { '2026-10-01': 1, '2026-10-03': 2 } })
  assert.equal(lastRecordedAt(event), at(2026, 10, 3, 0))
  assert.equal(lastRecordedAt(checkin()), null)
  assert.equal(recordedOn(event, at(2026, 10, 3, 23)), true)
  assert.equal(recordedOn(event, at(2026, 10, 4, 0)), false)
})

test('睡着：每天 ≥3 天、每周 ≥5 天、每月 ≥20 天', () => {
  const now = at(2026, 10, 10)
  const days = { [dayKeyOf(at(2026, 10, 7))]: 1 } // 3 天前
  assert.equal(isSleeping(checkin({ days, cadence: 'daily' }), now), true)
  assert.equal(isSleeping(checkin({ days, cadence: 'weekly' }), now), false) // 才 3 天
  assert.equal(
    isSleeping(checkin({ days: { [dayKeyOf(at(2026, 10, 5))]: 1 }, cadence: 'weekly' }), now),
    true,
  )
  assert.equal(
    isSleeping(checkin({ days: { [dayKeyOf(at(2026, 9, 25))]: 1 }, cadence: 'monthly' }), now),
    false,
  )
  assert.equal(
    isSleeping(checkin({ days: { [dayKeyOf(at(2026, 9, 19))]: 1 }, cadence: 'monthly' }), now),
    true,
  )
})

test('睡着：今天记过就不算睡；从没记过从创建时刻起算', () => {
  const now = at(2026, 10, 10)
  assert.equal(isSleeping(checkin({ days: { [dayKeyOf(now)]: 1 } }), now), false)
  assert.equal(isSleeping(checkin({ createdAt: now - 2 * DAY }), now), false)
  assert.equal(isSleeping(checkin({ createdAt: now - 4 * DAY }), now), true)
})
