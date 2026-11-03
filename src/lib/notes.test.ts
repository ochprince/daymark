import assert from 'node:assert/strict'
import test from 'node:test'
import { bumpWeek, NOTE_POOL, nextNoteText, noteTextAt, shouldOfferNote, weekIndex } from './notes.ts'

const DAY = 86_400_000
/** 2026-11-03 10:00（周二）*/
const NOW = new Date(2026, 10, 3, 10, 0, 0).getTime()

test('间隔不足三天不给纸条', () => {
  assert.equal(shouldOfferNote({ notes: [{ at: NOW - 2 * DAY }] }, NOW, () => 0), false)
  assert.equal(shouldOfferNote({ notes: [{ at: NOW - 3 * DAY }] }, NOW, () => 0), true)
})

test('随机没命中也不给', () => {
  assert.equal(shouldOfferNote({ notes: [] }, NOW, () => 0.31), false)
  assert.equal(shouldOfferNote({ notes: [] }, NOW, () => 0.29), true)
})

test('这周已经出了两张就停', () => {
  const week = weekIndex(NOW)
  assert.equal(shouldOfferNote({ notes: [], notesThisWeek: { week, count: 2 } }, NOW, () => 0), false)
  assert.equal(shouldOfferNote({ notes: [], notesThisWeek: { week, count: 1 } }, NOW, () => 0), true)
})

test('上周的计数不算进本周', () => {
  const week = weekIndex(NOW)
  assert.equal(shouldOfferNote({ notes: [], notesThisWeek: { week: week - 1, count: 2 } }, NOW, () => 0), true)
})

test('文案按张数往后取，取完循环', () => {
  assert.equal(noteTextAt(0), NOTE_POOL[0])
  assert.equal(noteTextAt(1), NOTE_POOL[1])
  assert.equal(noteTextAt(NOTE_POOL.length), NOTE_POOL[0])
  assert.equal(noteTextAt(-1), NOTE_POOL[NOTE_POOL.length - 1])
})

test('下一张 = 已收张数那一位', () => {
  assert.equal(nextNoteText({ notes: [] }), NOTE_POOL[0])
  assert.equal(nextNoteText({ notes: [{ at: 0 }] }), NOTE_POOL[1])
})

test('本周计数：同周累加，跨周归零重算', () => {
  const week = weekIndex(NOW)
  assert.deepEqual(bumpWeek({ week, count: 1 }, NOW), { week, count: 2 })
  assert.deepEqual(bumpWeek({ week: week - 1, count: 2 }, NOW), { week, count: 1 })
  assert.deepEqual(bumpWeek(undefined, NOW), { week, count: 1 })
})

test('周一为一周之始', () => {
  const monday = new Date(2026, 10, 2).getTime()
  const sunday = new Date(2026, 10, 8).getTime()
  const nextMonday = new Date(2026, 10, 9).getTime()
  assert.equal(weekIndex(monday), weekIndex(NOW))
  // 周日还属于同一周，周一才翻篇
  assert.equal(weekIndex(sunday), weekIndex(NOW))
  assert.notEqual(weekIndex(nextMonday), weekIndex(NOW))
})
