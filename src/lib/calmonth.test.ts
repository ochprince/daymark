import assert from 'node:assert/strict'
import { test } from 'node:test'
import { monthKey, monthOffsetFloor, monthSummary } from './calmonth.ts'

test('monthKey 补零', () => {
  assert.equal(monthKey(2026, 0), '2026-01')
  assert.equal(monthKey(2026, 9), '2026-10')
  assert.equal(monthKey(2026, 11), '2026-12')
})

test('monthSummary 只统计当月，跳过 0 次和坏值', () => {
  const days = {
    '2026-09-30': 4,
    '2026-10-01': 2,
    '2026-10-02': 0,
    '2026-10-03': -1,
    '2026-10-04': Number.NaN,
    '2026-10-05': 3,
    '2026-11-01': 7,
    '2026-1': 9,
  }
  assert.deepEqual(monthSummary(days, 2026, 9), { days: 2, hits: 5, peak: 3 })
})

test('monthSummary 空月份返回全 0', () => {
  assert.deepEqual(monthSummary({}, 2026, 9), { days: 0, hits: 0, peak: 0 })
  assert.deepEqual(monthSummary({ '2026-03-04': 2 }, 2026, 9), { days: 0, hits: 0, peak: 0 })
})

test('月份前缀不会串月：10 月不吃 100 月/1 月的键', () => {
  const days = { '2026-10-01': 1, '2026-11-01': 5, '2026-01-01': 9 }
  assert.deepEqual(monthSummary(days, 2026, 9), { days: 1, hits: 1, peak: 1 })
})

test('monthOffsetFloor 翻到最早记录那个月，且不超过当月', () => {
  const now = new Date(2026, 9, 27) // 2026-10
  assert.equal(monthOffsetFloor('2026-08-03', now), -2)
  assert.equal(monthOffsetFloor('2026-10-01', now), 0)
  assert.equal(monthOffsetFloor('2026-12-01', now), 0)
  assert.equal(monthOffsetFloor('2025-10-15', now), -12)
})

test('monthOffsetFloor 对空值 / 坏值退回 0', () => {
  const now = new Date(2026, 9, 27)
  assert.equal(monthOffsetFloor(undefined, now), 0)
  assert.equal(monthOffsetFloor('', now), 0)
  assert.equal(monthOffsetFloor('abc', now), 0)
  assert.equal(monthOffsetFloor('2026-99-01', now), 0)
})
