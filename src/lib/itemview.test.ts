import assert from 'node:assert/strict'
import test from 'node:test'
import { buildItemViews, countByKind, focusAfterRemoval, viewByKey } from './itemview'
import type { CheckInEvent, CountdownEvent, DayEvent } from './types'

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

const now = at(2026, 10, 24)

const events: DayEvent[] = [
  {
    id: 'e-late',
    title: '戒烟',
    startedAt: at(2026, 10, 20),
    createdAt: at(2026, 10, 20),
    color: 1,
  },
  {
    id: 'e-early',
    title: '在一起',
    startedAt: at(2025, 1, 1),
    createdAt: at(2025, 1, 1),
    color: 2,
    species: 'sprout',
  },
]

const checkins: CheckInEvent[] = [
  {
    id: 'c-later',
    title: '读书',
    createdAt: at(2026, 9, 1),
    color: 3,
    cadence: 'daily',
    days: { [dayKeyOf(now)]: 1 },
    times: {},
  },
  {
    id: 'c-sleep',
    title: '早睡',
    createdAt: at(2026, 9, 15),
    color: 4,
    cadence: 'daily',
    days: { [dayKeyOf(now - 10 * DAY)]: 1 },
    times: {},
    species: 'moon',
  },
]

const countdowns: CountdownEvent[] = [
  {
    id: 'd-today',
    title: '生日',
    startedAt: at(2026, 10, 24),
    createdAt: at(2026, 1, 1),
    color: 5,
    repeat: 'yearly',
  },
  {
    id: 'd-later',
    title: '旅行',
    startedAt: at(2026, 12, 1),
    createdAt: at(2026, 1, 2),
    color: 6,
    repeat: 'none',
  },
]

test('顺序：先坚持（按起始日），再习惯（按创建时间），再等待的日子（按距离）', () => {
  const views = buildItemViews({ events, countdowns, checkins }, now)
  assert.deepEqual(
    views.map((view) => view.key),
    ['since:e-early', 'since:e-late', 'habit:c-later', 'habit:c-sleep', 'countdown:d-today', 'countdown:d-later'],
  )
})

test('三类事的大数字各按自己的口径算', () => {
  const views = buildItemViews({ events, countdowns, checkins }, now)
  const since = viewByKey(views, 'since:e-early')
  assert.equal(since?.kind, 'since')
  assert.equal(since?.kind === 'since' ? since.days : null, 661)
  assert.equal(since?.kind === 'since' ? since.growth : null, 661)

  const habit = viewByKey(views, 'habit:c-later')
  assert.equal(habit?.kind === 'habit' ? habit.count : null, 1)

  const today = viewByKey(views, 'countdown:d-today')
  assert.equal(today?.kind === 'countdown' ? today.days : null, 0)
  assert.equal(today?.mood, 'happy')

  const later = viewByKey(views, 'countdown:d-later')
  assert.equal(later?.kind === 'countdown' ? later.days : null, 38)
})

test('习惯很久没记 = 睡着（mood sleep），不是断签', () => {
  const views = buildItemViews({ events, countdowns, checkins }, now)
  assert.equal(viewByKey(views, 'habit:c-sleep')?.mood, 'sleep')
})

test('倒数日的信使不长大，物种固定 post、形态固定 0', () => {
  const views = buildItemViews({ events, countdowns, checkins }, now)
  const view = viewByKey(views, 'countdown:d-today')
  assert.equal(view?.species, 'post')
  assert.equal(view?.stage, 0)
  assert.equal(view?.growth, 0)
})

test('peakStage 让形态永不倒退', () => {
  const views = buildItemViews({ events, countdowns, checkins }, now, {
    peakStage: { 'since:e-late': 3 },
  })
  assert.equal(viewByKey(views, 'since:e-late')?.stage, 3)
})

test('按 kind 计数', () => {
  const views = buildItemViews({ events, countdowns, checkins }, now)
  assert.deepEqual(countByKind(views), { since: 2, habit: 2, countdown: 2 })
})

test('焦点被删：同组下一件 → 上一件 → 邻组', () => {
  const views = buildItemViews({ events, countdowns, checkins }, now)
  assert.equal(focusAfterRemoval(views, 'since:e-early'), 'since:e-late')
  assert.equal(focusAfterRemoval(views, 'since:e-late'), 'since:e-early')
  assert.equal(focusAfterRemoval(views, 'countdown:d-later'), 'countdown:d-today')
  assert.equal(focusAfterRemoval(views, 'habit:c-later'), 'habit:c-sleep')
})

test('焦点被删：整组没了就落到原位置往后最近的一件', () => {
  const views = buildItemViews({ events: [events[1]], countdowns: [], checkins: [] }, now)
  assert.equal(focusAfterRemoval(views, 'since:e-early'), null)
  assert.equal(focusAfterRemoval([], 'since:e-early'), null)
})

test('空数据不抛错', () => {
  const views = buildItemViews({ events: [], countdowns: [], checkins: [] }, now)
  assert.deepEqual(views, [])
  assert.equal(viewByKey(views, null), null)
})
