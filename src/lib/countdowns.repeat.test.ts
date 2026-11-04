import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCountdownList } from './days.ts'
import type { CountdownEvent } from './types.ts'

const NOW = new Date(2026, 10, 4).getTime() // 2026-11-04
const mk = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime()

const event = (startedAt: number, repeat: CountdownEvent['repeat']): CountdownEvent =>
  ({ id: 'c', title: '生日', startedAt, createdAt: NOW, color: 1, repeat, species: 'post' }) as CountdownEvent

test('生日按年：今年的还没到 → 就是今年那天', () => {
  const view = buildCountdownList([event(mk(1995, 12, 20), 'yearly')], NOW)[0]
  assert.equal(new Date(view.next).getFullYear(), 2026)
  assert.equal(view.days, 46)
})

test('生日按年：今年的已经过了 → 自动落到明年', () => {
  const view = buildCountdownList([event(mk(1995, 5, 20), 'yearly')], NOW)[0]
  assert.equal(new Date(view.next).getFullYear(), 2027)
  assert.equal(new Date(view.next).getMonth(), 4)
  assert.equal(new Date(view.next).getDate(), 20)
})

test('只此一次：过去的日期不会被推到明年', () => {
  const view = buildCountdownList([event(mk(1995, 5, 20), 'none')], NOW)[0]
  assert.equal(new Date(view.next).getFullYear(), 1995)
  assert.ok(view.days < 0, '过去的一次性倒数日天数为负，界面负责说「已经过去 N 天」')
})

test('闰日生日：平年按 2 月 28 日算，不会跳到 3 月', () => {
  const view = buildCountdownList([event(mk(2000, 2, 29), 'yearly')], NOW)[0]
  const next = new Date(view.next)
  assert.equal(next.getFullYear(), 2027)
  assert.equal(next.getMonth(), 1, '仍然是二月')
  assert.equal(next.getDate(), 28)
})
