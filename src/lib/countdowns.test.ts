import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addCountdown,
  getCountdowns,
  markSaid,
  unsayDone,
  worthCelebrating,
} from './countdowns.ts'

/** 本地时间的某天 00:00（倒数日的发生日就是这个刻度） */
function day(year: number, month: number, date: number): number {
  return new Date(year, month - 1, date, 0, 0, 0, 0).getTime()
}

function make(title: string) {
  return addCountdown({ title, startedAt: day(2026, 10, 27), color: 1, repeat: 'yearly' })
}

function read(id: string) {
  const event = getCountdowns().find((item) => item.id === id)
  assert.ok(event, '记录应该还在')
  return event
}

test('说过了：acknowledge 这一次发生，并留一条 history', () => {
  const event = make('妈妈的生日')
  const when = day(2026, 10, 27)
  markSaid(event.id, when)
  const after = read(event.id)
  assert.deepEqual(after.ackedFor, [when])
  assert.deepEqual(after.history, [{ at: when }])
})

test('撤销「说过了」：ackedFor 与 history 都回到没说过之前', () => {
  const event = make('出发旅行')
  const when = day(2026, 10, 27)
  const before = read(event.id)
  markSaid(event.id, when)
  unsayDone(event.id, when)
  const after = read(event.id)
  // 收空了就把字段摘掉：和点「说过了」之前一模一样
  assert.equal(after.ackedFor, undefined)
  assert.equal(after.history, undefined)
  assert.deepEqual(after.ackedFor ?? [], before.ackedFor ?? [])
  assert.deepEqual(after.history ?? [], before.history ?? [])
})

test('撤销只收掉点过的那一次，别的「说过了」不动', () => {
  const event = make('每年体检')
  const first = day(2025, 10, 27)
  const second = day(2026, 10, 27)
  markSaid(event.id, first)
  markSaid(event.id, second)
  unsayDone(event.id, second)
  const after = read(event.id)
  assert.deepEqual(after.ackedFor, [first])
  assert.deepEqual(after.history, [{ at: first }])
})

test('撤销没说过的一次 / 不存在的 id：安静地什么都不做', () => {
  const event = make('纪念日')
  const when = day(2026, 10, 27)
  unsayDone(event.id, when)
  assert.deepEqual(read(event.id).ackedFor ?? [], [])
  assert.doesNotThrow(() => unsayDone('not-a-real-id', when))
  // 已经撤销过一次，再撤一次也不会把别的记录弄坏
  markSaid(event.id, when)
  unsayDone(event.id, when)
  assert.deepEqual(read(event.id).ackedFor ?? [], [])
  assert.deepEqual(read(event.id).history ?? [], [])
})

test('刚建的倒数日填了今天：不算「陪它走到那天」', () => {
  // 2026-11-06 中午建的，日期也是今天 —— 没有等过
  const now = new Date(2026, 10, 6, 12, 0, 0).getTime()
  assert.equal(worthCelebrating(now, now), false)
  // 昨天建的、今天到：等过一夜，该庆祝
  assert.equal(worthCelebrating(now - 86400000, now), true)
  // 今天 00:05 建的，也算今天
  const early = new Date(2026, 10, 6, 0, 5, 0).getTime()
  assert.equal(worthCelebrating(early, now), false)
})
