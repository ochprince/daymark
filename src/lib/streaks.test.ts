import assert from 'node:assert/strict'
import test from 'node:test'
import { closeStreak, normalizeStreaks, sortStreaks, summarizeStreaks } from './streaks'

const at = (year: number, month: number, day: number, hour = 0) =>
  new Date(year, month - 1, day, hour).getTime()

test('closeStreak：封存天数与完成日期', () => {
  const start = at(2026, 9, 28)
  const streak = closeStreak(start, at(2026, 10, 6, 20))
  assert.equal(streak.days, 8)
  assert.equal(streak.endedAt, at(2026, 10, 6))
})

test('closeStreak：当天重置就是 0 天', () => {
  const streak = closeStreak(at(2026, 10, 6), at(2026, 10, 6, 23))
  assert.equal(streak.days, 0)
  assert.equal(streak.endedAt, at(2026, 10, 6))
})

test('sortStreaks：按完成时间倒序，最近的在最前', () => {
  const list = [
    { days: 3, endedAt: at(2026, 5, 1) },
    { days: 30, endedAt: at(2026, 9, 1) },
    { days: 12, endedAt: at(2026, 7, 1) },
  ]
  assert.deepEqual(
    sortStreaks(list).map((s) => s.days),
    [30, 12, 3],
  )
  // 不改原数组
  assert.deepEqual(
    list.map((s) => s.days),
    [3, 30, 12],
  )
})

test('summarizeStreaks：段数、最长、合计', () => {
  const summary = summarizeStreaks([
    { days: 3, endedAt: at(2026, 5, 1) },
    { days: 30, endedAt: at(2026, 9, 1) },
    { days: 12, endedAt: at(2026, 7, 1) },
  ])
  assert.deepEqual(summary, { count: 3, longest: 30, total: 45 })
  assert.deepEqual(summarizeStreaks([]), { count: 0, longest: 0, total: 0 })
})

test('normalizeStreaks：滤掉坏数据、倒序、限量', () => {
  const messy = [
    { days: 5, endedAt: at(2026, 3, 1) },
    { days: 'x', endedAt: at(2026, 3, 2) },
    { days: -1, endedAt: at(2026, 3, 3) },
    null,
    { days: Number.NaN, endedAt: at(2026, 3, 4) },
    { days: 9, endedAt: at(2026, 8, 1) },
  ] as never
  assert.deepEqual(
    normalizeStreaks(messy).map((s) => s.days),
    [9, 5],
  )
  assert.deepEqual(normalizeStreaks(undefined), [])
  const many = Array.from({ length: 260 }, (_, index) => ({ days: index, endedAt: at(2026, 1, 1) + index * 86_400_000 }))
  assert.equal(normalizeStreaks(many).length, 200)
})
