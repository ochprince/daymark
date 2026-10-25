import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyBackup,
  BACKUP_KEYS,
  buildBackup,
  backupFileName,
  parseBackup,
  summaryCounts,
  type BackupFile,
} from './backup'

function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed))
  return {
    get length() {
      return map.size
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    dump: () => Object.fromEntries(map),
  }
}

const sample = {
  'daymark.events.v1': JSON.stringify([{ id: 'e1', title: '戒烟' }, { id: 'e2', title: '健身' }]),
  'daymark.checkins.v1': JSON.stringify([{ id: 'c1', title: '喝水' }]),
  'daymark.countdowns.v1': JSON.stringify([{ id: 'd1', title: '生日' }]),
  'daymark.collection.v1': JSON.stringify({ badges: ['first', 'week'], dex: { 'sprout:1': true } }),
  'daymark.locale.v1': '"zh"',
  'daymark.migrated.v2': '"1"',
}

test('导出：只收白名单 key，运行时标记不带出去', () => {
  const file = buildBackup(fakeStorage(sample), 1_700_000_000_000)
  assert.equal(file.v, 2)
  assert.equal(file.exportedAt, 1_700_000_000_000)
  assert.ok(file.data['daymark.events.v1'])
  assert.equal(file.data['daymark.migrated.v2'], undefined)
  for (const key of Object.keys(file.data)) {
    assert.ok((BACKUP_KEYS as readonly string[]).includes(key), `不该带 ${key}`)
  }
})

test('导出：缺的 key 不补空值', () => {
  const file = buildBackup(fakeStorage({ 'daymark.events.v1': '[]' }))
  assert.deepEqual(Object.keys(file.data), ['daymark.events.v1'])
})

test('回环：导出再导入，内容一致', () => {
  const storage = fakeStorage(sample)
  const file = buildBackup(storage)
  const result = parseBackup(JSON.stringify(file))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.summary.events, 2)
  assert.equal(result.summary.checkins, 1)
  assert.equal(result.summary.countdowns, 1)
  assert.equal(result.summary.badges, 2)
  assert.equal(result.summary.dex, 1)
  assert.equal(result.summary.locale, 'zh')

  const target = fakeStorage()
  assert.equal(applyBackup(target, result.file), 5)
  assert.equal(target.getItem('daymark.events.v1'), storage.getItem('daymark.events.v1'))
  assert.equal(target.getItem('daymark.migrated.v2'), null, '运行时标记不该被写回')
})

test('导入：坏 JSON / 不像备份 / 空数据 分别给出原因', () => {
  assert.deepEqual(parseBackup('{ not json'), { ok: false, reason: 'not-json' })
  assert.deepEqual(parseBackup({ v: 2 }), { ok: false, reason: 'not-backup' })
  assert.deepEqual(parseBackup({ hello: 1 }), { ok: false, reason: 'not-backup' })
  assert.deepEqual(parseBackup({ v: 2, data: {} }), { ok: false, reason: 'empty' })
  assert.deepEqual(parseBackup({ v: 2, data: { 'other.key': 'x' } }), { ok: false, reason: 'empty' })
  assert.deepEqual(parseBackup(42), { ok: false, reason: 'not-backup' })
})

test('导入：版本比现在新就拒绝，旧版本照收', () => {
  assert.deepEqual(parseBackup({ v: 99, data: { 'daymark.events.v1': '[]' } }), { ok: false, reason: 'too-new' })
  const older = parseBackup({ v: 1, data: { 'daymark.events.v1': '[]' } })
  assert.equal(older.ok, true)
})

test('导入：陌生 key 与非字符串值被丢掉', () => {
  const result = parseBackup({
    v: 2,
    exportedAt: 5,
    data: {
      'daymark.events.v1': '[]',
      'evil.key': 'x',
      'daymark.hack': 123,
    },
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(Object.keys(result.file.data), ['daymark.events.v1'])
  assert.deepEqual(result.file.data['evil.key'], undefined)
})

test('导入：坏掉的内容不会让整份备份作废，只是计数为 0', () => {
  const result = parseBackup({ v: 2, data: { 'daymark.events.v1': 'not json', 'daymark.collection.v1': '{}' } })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.summary.events, 0)
  assert.equal(result.summary.badges, 0)
  assert.equal(result.summary.dex, 0)
})

test('导入：没有 exportedAt 用当前时间兜底', () => {
  const result = parseBackup({ v: 2, data: { 'daymark.events.v1': '[]' } })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.ok(result.file.exportedAt > 1_600_000_000_000)
})

test('文件名带日期，且只含安全字符', () => {
  const name = backupFileName(new Date(2026, 9, 25).getTime())
  assert.equal(name, 'daymark-2026-10-25.json')
  assert.match(name, /^[a-z0-9.-]+$/)
})

test('摘要计数按三类事的顺序给出', () => {
  const counts = summaryCounts({
    events: 3,
    countdowns: 1,
    checkins: 2,
    badges: 0,
    dex: 0,
    exportedAt: 0,
    locale: 'zh',
    keys: [],
  })
  assert.deepEqual(counts, [
    { kind: 'since', count: 3 },
    { kind: 'habit', count: 2 },
    { kind: 'countdown', count: 1 },
  ])
})

test('applyBackup 只写不改：本地已有的其它 key 保留', () => {
  const storage = fakeStorage({ 'daymark.prefs.v1': '{"sound":false}' })
  const file: BackupFile = { v: 2, exportedAt: 0, data: { 'daymark.events.v1': '[]' } }
  applyBackup(storage, file)
  assert.equal(storage.getItem('daymark.prefs.v1'), '{"sound":false}')
  assert.equal(storage.getItem('daymark.events.v1'), '[]')
})
