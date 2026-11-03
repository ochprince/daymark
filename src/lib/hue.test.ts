import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  DEFAULT_HUE,
  HUE_COLORS,
  HUE_NAMES,
  hueFromLegacyColor,
  huePair,
  hueStyleText,
  hueVars,
  isHue,
  normalizeHue,
  type Hue,
} from './hue'
import { migrateAll, migrateCheckIn, migrateCountdown, migrateDayEvent, runMigration, STORAGE_KEYS, MIGRATION_FLAG } from './migrate'
import type { MigrationStorage } from './migrate'
import type { CheckInEvent, CountdownEvent, DayEvent } from './types'

const SKINS = ['jelly', 'paper', 'night', 'pixel'] as const

const HEX = /^#[0-9a-f]{6}$/

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const raw = hex.replace('#', '')
  const r = channel(parseInt(raw.slice(0, 2), 16))
  const g = channel(parseInt(raw.slice(2, 4), 16))
  const b = channel(parseInt(raw.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

function at(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime()
}

test('五个色相在四套皮肤下都有两级非空颜色（共 20 组，格式合法）', () => {
  assert.equal(HUE_NAMES.length, 5)
  assert.deepEqual([...HUE_NAMES], ['mint', 'sky', 'grape', 'lemon', 'coral'])
  for (const skin of SKINS) {
    for (const hue of HUE_NAMES) {
      const pair = huePair(hue, skin)
      assert.match(pair.c, HEX, `${skin}/${hue} 的 --c 不是合法色值`)
      assert.match(pair.c2, HEX, `${skin}/${hue} 的 --c2 不是合法色值`)
      assert.notEqual(pair.c, pair.c2, `${skin}/${hue} 的两级颜色不该相同`)
    }
  }
})

test('同一套皮肤里五个色相互不重复（色相真的分得开）', () => {
  for (const skin of SKINS) {
    const values = HUE_NAMES.map((hue) => huePair(hue, skin).c.toLowerCase())
    assert.equal(new Set(values).size, HUE_NAMES.length, `${skin} 里有色相的 --c 撞色了`)
  }
})

test('四套皮肤各给各的值，不互相复制', () => {
  for (const hue of HUE_NAMES) {
    const seen = new Set(SKINS.map((skin) => huePair(hue, skin).c.toLowerCase() + huePair(hue, skin).c2.toLowerCase()))
    assert.equal(seen.size, SKINS.length, `${hue} 在两套皮肤下取了同一组颜色`)
  }
})

test('未知色相回落到默认色相（mint），不抛错也不返回空', () => {
  assert.equal(DEFAULT_HUE, 'mint')
  assert.equal(normalizeHue('mint'), 'mint')
  assert.equal(normalizeHue('MINT'), 'mint')
  assert.equal(normalizeHue('  Sky '), 'sky')
  assert.equal(normalizeHue('amber'), 'mint')
  assert.equal(normalizeHue(''), 'mint')
  assert.equal(normalizeHue(undefined), 'mint')
  assert.equal(normalizeHue(null), 'mint')
  assert.equal(normalizeHue(3), 'mint')
  assert.equal(normalizeHue('nope', 'coral'), 'coral')
  assert.equal(huePair('chartreuse', 'jelly').c, HUE_COLORS.jelly.mint.c)
  assert.equal(isHue('coral'), true)
  assert.equal(isHue('Coral'), false)
})

test('未知皮肤回落软糖，颜色照样有值', () => {
  const pair = huePair('grape', 'neon' as unknown as 'jelly')
  assert.deepEqual(pair, HUE_COLORS.jelly.grape)
  assert.deepEqual(hueVars('grape', undefined), { '--c': '#cdb9ff', '--c2': '#7a5ae0' })
})

test('旧 color 索引 0–7 全部能落到色相（按 PALETTE 顺序对应）', () => {
  const expected: Hue[] = ['lemon', 'coral', 'grape', 'sky', 'mint', 'lemon', 'coral', 'grape']
  const actual = [0, 1, 2, 3, 4, 5, 6, 7].map(hueFromLegacyColor)
  assert.deepEqual(actual, expected)
  // 每个色相都至少被一个旧索引命中，没有色相永远到不了
  assert.equal(new Set(actual).size, HUE_NAMES.length)
})

test('旧 color 越界与脏值也收得住（循环取模 / 回落）', () => {
  assert.equal(hueFromLegacyColor(8), hueFromLegacyColor(0))
  assert.equal(hueFromLegacyColor(9), hueFromLegacyColor(1))
  assert.equal(hueFromLegacyColor(-1), hueFromLegacyColor(7))
  assert.equal(hueFromLegacyColor(-9), 'grape') // -9 → 7 → slate → grape
  assert.equal(hueFromLegacyColor(3.9), hueFromLegacyColor(3))
  assert.equal(hueFromLegacyColor(Number.NaN), DEFAULT_HUE)
  assert.equal(hueFromLegacyColor(Number.POSITIVE_INFINITY), DEFAULT_HUE)
})

test('hueVars 只出 --c / --c2 两个键，值与取值表一致', () => {
  for (const skin of SKINS) {
    for (const hue of HUE_NAMES) {
      const vars = hueVars(hue, skin)
      assert.deepEqual(Object.keys(vars).sort(), ['--c', '--c2'])
      assert.equal(vars['--c'], HUE_COLORS[skin][hue].c)
      assert.equal(vars['--c2'], HUE_COLORS[skin][hue].c2)
    }
  }
  assert.equal(hueStyleText('lemon', 'night'), '--c:#ffd862;--c2:#d19316')
})

test('夜航：色相在深色底上对比度不退化', () => {
  const NIGHT_SURFACE = '#1c2050'
  for (const hue of HUE_NAMES) {
    const { c, c2 } = huePair(hue, 'night')
    // --c 当宠物填充/大色块用，按正文级对比度要求（AA 4.5）
    assert.ok(contrast(c, NIGHT_SURFACE) >= 4.5, `夜航 ${hue} 的 --c 对比度只有 ${contrast(c, NIGHT_SURFACE).toFixed(2)}`)
    // --c2 当描边/细线用，至少要有 2.5 才看得见
    assert.ok(contrast(c2, NIGHT_SURFACE) >= 2.5, `夜航 ${hue} 的 --c2 对比度只有 ${contrast(c2, NIGHT_SURFACE).toFixed(2)}`)
    // 对比度是四套皮肤里最高的一组（深色底上重新调亮过），不是把浅色皮肤的值搬过来
    const nightFloor = contrast(c, NIGHT_SURFACE)
    for (const [skin, surface] of [
      ['jelly', '#ffffff'],
      ['paper', '#fbf9f4'],
      ['pixel', '#f7f4e4'],
    ] as const) {
      assert.ok(
        nightFloor > contrast(huePair(hue, skin).c, surface),
        `夜航 ${hue} 的对比度没有高过 ${skin}`,
      )
    }
  }
})

test('hue.css 与 hue.ts 的取值表一一对应（20 组）', () => {
  const css = readFileSync(new URL('../skins/hue.css', import.meta.url), 'utf8')
  let checked = 0
  for (const skin of SKINS) {
    for (const hue of HUE_NAMES) {
      const pattern = new RegExp(
        `\\[data-skin='${skin}'\\]\\[data-hue='${hue}'\\][^{]*\\{ --c: (#[0-9a-f]{6}); --c2: (#[0-9a-f]{6}); \\}`,
      )
      const match = pattern.exec(css)
      assert.ok(match, `hue.css 里缺 ${skin}/${hue} 的规则`)
      assert.equal(match[1], HUE_COLORS[skin][hue].c, `${skin}/${hue} 的 --c 与 hue.ts 不一致`)
      assert.equal(match[2], HUE_COLORS[skin][hue].c2, `${skin}/${hue} 的 --c2 与 hue.ts 不一致`)
      checked += 1
    }
  }
  assert.equal(checked, 20)
})

test('迁移：老 DayEvent 没有 hue 时按 color 补，已有的 hue 不被覆盖', () => {
  const older = {
    id: 'e1',
    title: '戒烟',
    startedAt: at(2026, 1, 1),
    createdAt: at(2026, 1, 1),
    color: 0,
  } as DayEvent
  assert.equal(migrateDayEvent(older).hue, 'lemon')
  // color 保留兼容
  assert.equal(migrateDayEvent(older).color, 0)

  for (const color of [0, 1, 2, 3, 4, 5, 6, 7]) {
    assert.equal(migrateDayEvent({ ...older, color }).hue, hueFromLegacyColor(color))
  }

  const custom: DayEvent = { ...older, color: 1, hue: 'grape' }
  assert.equal(migrateDayEvent(custom).hue, 'grape')
})

test('迁移：CheckIn / Countdown 也补 hue', () => {
  const checkin: CheckInEvent = {
    id: 'c1',
    title: '喝水',
    createdAt: at(2026, 9, 1),
    color: 4,
    cadence: 'daily',
    days: {},
  }
  assert.equal(migrateCheckIn(checkin).hue, 'mint')

  const countdown: CountdownEvent = {
    id: 'd1',
    title: '生日',
    startedAt: at(2026, 12, 1),
    createdAt: at(2026, 1, 1),
    color: 3,
    repeat: 'yearly',
  }
  assert.equal(migrateCountdown(countdown).hue, 'sky')
})

test('迁移：charge 收成非负整数秒，prev 只留合法日期', () => {
  const base: DayEvent = {
    id: 'e1',
    title: '在一起',
    startedAt: at(2026, 10, 17),
    createdAt: at(2026, 10, 17),
    color: 0,
  }
  const dirty = { ...base, charge: -12.7, prev: '2026/10/17' } as unknown as DayEvent
  const cleaned = migrateDayEvent(dirty)
  assert.equal(cleaned.charge, 0)
  assert.equal(cleaned.prev, undefined)

  const fine = migrateDayEvent({ ...base, charge: 7200.9, prev: '2026-10-17' })
  assert.equal(fine.charge, 7200)
  assert.equal(fine.prev, '2026-10-17')

  const broken = { ...base, charge: 'soon' } as unknown as DayEvent
  assert.equal(migrateDayEvent(broken).charge, undefined)
})

test('迁移幂等：对同一批数据跑两次，结果完全相同', () => {
  const events: DayEvent[] = [
    { id: 'e1', title: '在一起', startedAt: at(2026, 10, 17), createdAt: at(2026, 10, 17), color: 0 },
    { id: 'e2', title: '读书', startedAt: at(2026, 1, 1), createdAt: at(2026, 1, 1), color: 6, charge: 3600 },
  ]
  const checkins: CheckInEvent[] = [
    { id: 'c1', title: '喝水', createdAt: at(2026, 9, 1), color: 1, cadence: 'daily', days: { '2026-10-01': 1 } },
  ]
  const countdowns: CountdownEvent[] = [
    { id: 'd1', title: '生日', startedAt: at(2026, 12, 1), createdAt: at(2026, 1, 1), color: 2, repeat: 'yearly' },
  ]

  const once = migrateAll({ events, checkins, countdowns, theme: 'dark' }, at(2026, 10, 24))
  const twice = migrateAll(
    {
      events: once.events.map(migrateDayEvent),
      checkins: once.checkins.map(migrateCheckIn),
      countdowns: once.countdowns.map(migrateCountdown),
      theme: 'dark',
    },
    at(2026, 10, 24),
  )

  assert.deepEqual(twice.events, once.events)
  assert.deepEqual(twice.checkins, once.checkins)
  assert.deepEqual(twice.countdowns, once.countdowns)
  assert.deepEqual(twice.collection, once.collection)
  // 每条都带上了 hue，且落盘往返（JSON）后再迁一次结果不变
  for (const item of [...once.events, ...once.checkins, ...once.countdowns]) {
    assert.ok(isHue(item.hue), `${item.id} 迁移后没有 hue`)
  }
  for (const item of once.events) {
    const onDisk = JSON.parse(JSON.stringify(item))
    assert.equal(JSON.stringify(migrateDayEvent(onDisk)), JSON.stringify(item))
  }
  for (const item of once.checkins) {
    const onDisk = JSON.parse(JSON.stringify(item))
    assert.equal(JSON.stringify(migrateCheckIn(onDisk)), JSON.stringify(item))
  }
  for (const item of once.countdowns) {
    const onDisk = JSON.parse(JSON.stringify(item))
    assert.equal(JSON.stringify(migrateCountdown(onDisk)), JSON.stringify(item))
  }
})

test('runMigration：写过一次后就带 hue，第二次直接返回 null 不动数据', () => {
  const data: Record<string, string> = {
    [STORAGE_KEYS.events]: JSON.stringify([
      { id: 'e1', title: '戒烟', startedAt: at(2026, 1, 1), createdAt: at(2026, 1, 1), color: 4 },
    ]),
  }
  const storage: MigrationStorage = {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value
    },
  }

  const first = runMigration(storage, at(2026, 10, 24))
  assert.ok(first)
  assert.equal(first.events[0].hue, 'mint')
  const stored = data[STORAGE_KEYS.events]
  assert.equal(JSON.parse(stored)[0].hue, 'mint')

  const second = runMigration(storage, at(2026, 10, 25))
  assert.equal(second, null)
  assert.equal(data[STORAGE_KEYS.events], stored)
  assert.ok(data[MIGRATION_FLAG])
})
