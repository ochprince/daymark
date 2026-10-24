import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MIGRATION_FLAG,
  STORAGE_KEYS,
  migrateAll,
  migrateCheckIn,
  migrateDayEvent,
  pickSpecies,
  runMigration,
} from './migrate'
import type { MigrationStorage } from './migrate'
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

function memoryStorage(seed: Record<string, string> = {}): MigrationStorage & { dump: () => Record<string, string> } {
  const data = { ...seed }
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value
    },
    dump: () => ({ ...data }),
  }
}

test('物种推荐：标题关键词优先，其次按周期', () => {
  assert.equal(pickSpecies('早睡'), 'moon')
  assert.equal(pickSpecies('冥想 10 分钟'), 'moon')
  assert.equal(pickSpecies('喝水'), 'drop')
  assert.equal(pickSpecies('跑步'), 'star')
  assert.equal(pickSpecies('读书', 'daily'), 'sprout')
  assert.equal(pickSpecies('读书', 'weekly'), 'star')
  assert.equal(pickSpecies('随便写写'), 'sprout')
})

test('老 CheckIn 补 species 与 growthDays；已有的值不动', () => {
  const older: CheckInEvent = {
    id: 'c1',
    title: '喝水',
    createdAt: at(2026, 9, 1),
    color: 0,
    cadence: 'daily',
    days: { '2026-10-01': 3, '2026-10-02': 1, '2026-10-03': 0 },
  }
  const migrated = migrateCheckIn(older)
  assert.equal(migrated.species, 'drop')
  assert.equal(migrated.growthDays, 2)
  // target 不写：空 = 不设上限，保持原有行为
  assert.equal(migrated.target, undefined)

  const already: CheckInEvent = { ...older, species: 'star', growthDays: 99 }
  assert.equal(migrateCheckIn(already).species, 'star')
  assert.equal(migrateCheckIn(already).growthDays, 99)
})

test('老 DayEvent 补 species；历史里的坏数据被丢掉', () => {
  const event = {
    id: 'e1',
    title: '戒烟',
    startedAt: at(2026, 1, 1),
    createdAt: at(2026, 1, 1),
    color: 0,
    history: [
      { days: 5, endedAt: at(2026, 2, 1) },
      { days: 'x', endedAt: at(2026, 2, 1) },
      null,
    ],
  } as unknown as DayEvent
  const migrated = migrateDayEvent(event)
  assert.equal(migrated.species, 'sprout')
  assert.equal(migrated.history?.length, 1)
  assert.equal(migrated.history?.[0].days, 5)
})

test('整体迁移：图鉴按形态铺满、徽章静默补发、peak 与 seen 写成当前形态', () => {
  const events: DayEvent[] = [
    { id: 'e1', title: '在一起', startedAt: at(2026, 10, 17), createdAt: at(2026, 10, 17), color: 0 },
  ]
  const checkins: CheckInEvent[] = [
    {
      id: 'c1',
      title: '读书',
      createdAt: at(2026, 1, 1),
      color: 1,
      cadence: 'daily',
      days: {},
      growthDays: 8,
    },
  ]
  const countdowns: CountdownEvent[] = [
    { id: 'd1', title: '生日', startedAt: at(2026, 12, 1), createdAt: at(2026, 1, 1), color: 2, repeat: 'yearly' },
  ]

  const result = migrateAll({ events, checkins, countdowns, theme: 'dark' }, at(2026, 10, 24))

  // 8 天 → 形态 2：芽芽的 0/1/2 都进图鉴
  assert.ok(result.collection.dex.includes('sprout:0'))
  assert.ok(result.collection.dex.includes('sprout:1'))
  assert.ok(result.collection.dex.includes('sprout:2'))
  assert.ok(!result.collection.dex.includes('sprout:3'))
  // 有倒数日 → 信使图鉴
  assert.ok(result.collection.dex.includes('post:0'))

  assert.equal(result.collection.peakStage['habit:c1'], 2)
  assert.equal(result.collection.seenStage['habit:c1'], 2)

  assert.ok(result.collection.badges.includes('first'))
  assert.ok(result.collection.badges.includes('d7'))
  assert.ok(!result.collection.badges.includes('d30'))
  assert.ok(result.collection.badges.includes('chapter'))

  assert.equal(result.skin.pack, 'night')
  assert.equal(result.focus, 'since:e1')
})

test('迁移是幂等的：跑第二次直接返回 null，不覆盖已有收藏', () => {
  const storage = memoryStorage({
    [STORAGE_KEYS.checkins]: JSON.stringify([
      {
        id: 'c1',
        title: '喝水',
        createdAt: at(2026, 9, 1),
        color: 0,
        cadence: 'daily',
        days: { '2026-10-01': 1 },
      },
    ]),
  })

  const first = runMigration(storage, at(2026, 10, 24))
  assert.ok(first)
  assert.ok(storage.getItem(MIGRATION_FLAG))

  const second = runMigration(storage, at(2026, 10, 25))
  assert.equal(second, null)

  // 收藏被用户改过之后，即便强制重跑迁移也不该被覆盖
  const before = storage.getItem(STORAGE_KEYS.collection)
  storage.setItem(
    STORAGE_KEYS.collection,
    JSON.stringify({ ...JSON.parse(before ?? '{}'), dex: [] }),
  )
  storage.setItem(MIGRATION_FLAG, '') // 清掉标记，相当于「重装后再次升级」
  runMigration(storage, at(2026, 10, 26))
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEYS.collection) ?? '{}').dex, [])
})

test('迁移写回的三类事带上了新字段，坏数据不让整段崩', () => {
  const storage = memoryStorage({
    [STORAGE_KEYS.events]: JSON.stringify([{ id: 'e1', title: '戒烟', startedAt: at(2026, 1, 1), createdAt: at(2026, 1, 1), color: 0 }]),
    [STORAGE_KEYS.checkins]: 'not json',
    [STORAGE_KEYS.countdowns]: JSON.stringify([{ oops: true }]),
  })
  const result = runMigration(storage, at(2026, 10, 24))
  assert.ok(result)
  const events = JSON.parse(storage.getItem(STORAGE_KEYS.events) ?? '[]') as DayEvent[]
  assert.equal(events[0].species, 'sprout')
  // 非法 JSON 视为空，不会抛错
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEYS.checkins) ?? '[]'), [])
})

test('迁移：主题 system / light / dark 各自落到皮肤状态', () => {
  const cases: [string | null, string, boolean][] = [
    [null, 'jelly', true],
    ['system', 'jelly', true],
    ['light', 'jelly', false],
    ['dark', 'night', false],
  ]
  for (const [theme, pack, followSystem] of cases) {
    const storage = memoryStorage(theme ? { [STORAGE_KEYS.theme]: theme } : {})
    const result = runMigration(storage, at(2026, 10, 24))
    assert.ok(result)
    assert.equal(result.skin.pack, pack, `theme=${String(theme)}`)
    assert.equal(result.skin.followSystem, followSystem, `theme=${String(theme)}`)
  }
})

test('迁移：空数据也能跑，不写垃圾', () => {
  const storage = memoryStorage()
  const result = runMigration(storage, at(2026, 10, 24))
  assert.ok(result)
  assert.equal(result.focus, null)
  assert.deepEqual(result.views, [])
  assert.equal(storage.getItem(STORAGE_KEYS.focus), null)
})

test('迁移用到的日期工具与天数口径一致（锚点补齐后仍按 24 小时）', () => {
  const checkin: CheckInEvent = {
    id: 'c9',
    title: '跑步',
    createdAt: at(2026, 9, 1),
    color: 0,
    cadence: 'weekly',
    days: { [dayKeyOf(at(2026, 10, 1))]: 2, [dayKeyOf(at(2026, 10, 2))]: 1 },
  }
  assert.equal(migrateCheckIn(checkin).growthDays, 2)
  assert.equal(migrateCheckIn(checkin).species, 'star')
  assert.ok(at(2026, 10, 2) - at(2026, 10, 1) === DAY)
})
