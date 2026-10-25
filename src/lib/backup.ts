/**
 * 备份的导入 / 导出（换机唯一的数据搬移方式）。
 *
 * 导出格式就是当初的 `{ v: 2, exportedAt, data: { 'daymark.xxx': '<json string>' } }`，
 * 导入要能认三种情况：
 *   1. 自家导出（完整）；
 *   2. 只有部分 key 的残缺备份（比如用户手工删过）；
 *   3. 老版本文档 —— v 大于当前版本时拒绝，小于时照常读（迁移会把它补全）。
 *
 * 铁律：**导入永远不删用户现在有的东西以外的东西**——它是一次覆盖式恢复，
 * 所以上层必须让用户先看清「将恢复 N 件事」，确认后才调 applyBackup。
 *
 * 这里负责校验与归一化，不碰 localStorage、不碰 React（方便直接测）。
 */
import { dayKey } from './daykey'

export const BACKUP_VERSION = 2
export const BACKUP_PREFIX = 'daymark.'

/** 只搬这些 key；`daymark.migrated.v2` 这类运行时标记不搬，让新设备自己重新迁移 */
export const BACKUP_KEYS = [
  'daymark.events.v1',
  'daymark.countdowns.v1',
  'daymark.checkins.v1',
  'daymark.collection.v1',
  'daymark.skin.v1',
  'daymark.prefs.v1',
  'daymark.focus.v1',
  'daymark.locale.v1',
  'daymark.entitlement.v1',
] as const

export type BackupFile = {
  v: number
  exportedAt: number
  data: Record<string, string>
}

export type BackupSummary = {
  events: number
  countdowns: number
  checkins: number
  badges: number
  dex: number
  exportedAt: number
  locale: string
  /** 备份里带的 key，调试与展示用 */
  keys: string[]
}

export type ParseResult =
  | { ok: true; file: BackupFile; summary: BackupSummary }
  | { ok: false; reason: 'not-json' | 'not-backup' | 'too-new' | 'empty' }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function countArray(raw: string | undefined): number {
  if (!raw) return 0
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

function readObject(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** 把任意输入收成标准备份文件；认不出来返回 reason，不抛异常 */
export function parseBackup(input: unknown): ParseResult {
  let value: unknown = input
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input)
    } catch {
      return { ok: false, reason: 'not-json' }
    }
  }
  if (!isRecord(value)) return { ok: false, reason: 'not-backup' }

  const version = Number(value.v)
  if (!Number.isFinite(version)) return { ok: false, reason: 'not-backup' }
  if (version > BACKUP_VERSION) return { ok: false, reason: 'too-new' }

  if (!isRecord(value.data)) return { ok: false, reason: 'not-backup' }

  // 只认 daymark.* 且值是字符串；其它一律丢掉（防止陌生 key 污染本地存储）
  const data: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value.data)) {
    if (!key.startsWith(BACKUP_PREFIX)) continue
    if (typeof raw !== 'string') continue
    data[key] = raw
  }
  if (Object.keys(data).length === 0) return { ok: false, reason: 'empty' }

  const exportedAt = Number.isFinite(Number(value.exportedAt)) ? Number(value.exportedAt) : Date.now()
  const collection = readObject(data['daymark.collection.v1'])

  return {
    ok: true,
    file: { v: version, exportedAt, data },
    summary: {
      events: countArray(data['daymark.events.v1']),
      countdowns: countArray(data['daymark.countdowns.v1']),
      checkins: countArray(data['daymark.checkins.v1']),
      badges: Array.isArray(collection.badges) ? collection.badges.length : 0,
      dex: isRecord(collection.dex) ? Object.keys(collection.dex).length : 0,
      exportedAt,
      locale: typeof data['daymark.locale.v1'] === 'string' ? data['daymark.locale.v1'].replace(/"/g, '') : '',
      keys: Object.keys(data),
    },
  }
}

/** 生成要写进文件的完整载荷（导出用） */
export function buildBackup(storage: Pick<Storage, 'length' | 'key' | 'getItem'>, now = Date.now()): BackupFile {
  const data: Record<string, string> = {}
  for (const key of BACKUP_KEYS) {
    const raw = storage.getItem(key)
    if (raw !== null) data[key] = raw
  }
  return { v: BACKUP_VERSION, exportedAt: now, data }
}

export function backupFileName(now = Date.now()): string {
  return `daymark-${dayKey(now)}.json`
}

/**
 * 写回 localStorage。**只写备份里有的 key**，不清理其它 —— 用户的偏好、
 * 提醒弹过的记录这类东西留着不会有事，删了反而丢。
 * 返回实际写入的 key 数。
 */
export function applyBackup(
  storage: Pick<Storage, 'setItem'>,
  file: BackupFile,
): number {
  let written = 0
  for (const [key, raw] of Object.entries(file.data)) {
    if (!key.startsWith(BACKUP_PREFIX)) continue
    storage.setItem(key, raw)
    written += 1
  }
  return written
}

/** 摘要文案里的数字（中英文由调用方拼） */
export function summaryCounts(summary: BackupSummary): Array<{ kind: 'since' | 'habit' | 'countdown'; count: number }> {
  return [
    { kind: 'since', count: summary.events },
    { kind: 'habit', count: summary.checkins },
    { kind: 'countdown', count: summary.countdowns },
  ]
}
