import { createStore } from './store'
import { formatShortDate, formatWeekday, startOfDay } from './days'
import type { CheckInCadence, CheckInDraft, CheckInEvent } from './types'

const STORAGE_KEY = 'daymark.checkins.v1'

const CADENCES: CheckInCadence[] = ['daily', 'weekly', 'monthly']

/** 历史最多保留多少个周期，防止记录无限膨胀（每天一次 ≈ 8 个月，每月一次 ≈ 20 年） */
const MAX_PERIODS = 240

/** 同一天最多留这么多个时刻，防止异常数据把存储撑爆 */
const MAX_TIMES_PER_DAY = 500

/* ------------------------------------------------------------------ *
 * 日期与周期
 * ------------------------------------------------------------------ */

/** 本地日期键 yyyy-mm-dd */
export function dayKey(ts: number): string {
  const date = new Date(ts)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** 日期键 → 当天 00:00。用本地时间构造，不走 Date.parse 以免被当成 UTC */
export function parseDayKey(key: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return Number.NaN
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 所在自然周的周一 00:00（周一是每周第一天） */
export function weekStart(ts: number): number {
  const date = new Date(startOfDay(ts))
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 所在自然月的 1 号 00:00 */
export function monthStart(ts: number): number {
  const date = new Date(ts)
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

/** 当前周期的起点 */
export function periodStart(cadence: CheckInCadence, ts: number): number {
  if (cadence === 'daily') return startOfDay(ts)
  if (cadence === 'weekly') return weekStart(ts)
  return monthStart(ts)
}

/** 上一个周期的起点（用来翻出「昨天 / 上周 / 上个月」） */
export function previousPeriodStart(cadence: CheckInCadence, start: number): number {
  const date = new Date(start)
  if (cadence === 'daily') date.setDate(date.getDate() - 1)
  else if (cadence === 'weekly') date.setDate(date.getDate() - 7)
  else date.setMonth(date.getMonth() - 1)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 下一个周期的起点 */
export function nextPeriodStart(cadence: CheckInCadence, start: number): number {
  const date = new Date(start)
  if (cadence === 'daily') date.setDate(date.getDate() + 1)
  else if (cadence === 'weekly') date.setDate(date.getDate() + 7)
  else date.setMonth(date.getMonth() + 1)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export type CadenceOption = { value: CheckInCadence; label: string }

export const CADENCE_OPTIONS: readonly CadenceOption[] = [
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
]

export function cadenceOption(cadence: CheckInCadence): CadenceOption {
  return CADENCE_OPTIONS.find((option) => option.value === cadence) ?? CADENCE_OPTIONS[0]
}

/** 当前周期的说法：今天 / 本周 / 本月 */
export function periodNoun(cadence: CheckInCadence): string {
  if (cadence === 'daily') return '今天'
  if (cadence === 'weekly') return '本周'
  return '本月'
}

/** 上一个周期的说法：昨天 / 上周 / 上个月 */
export function previousNoun(cadence: CheckInCadence): string {
  if (cadence === 'daily') return '昨天'
  if (cadence === 'weekly') return '上周'
  return '上个月'
}

/** 历史每个周期的单位：天 / 周 / 个月 */
export function periodUnit(cadence: CheckInCadence): string {
  if (cadence === 'daily') return '天'
  if (cadence === 'weekly') return '周'
  return '个月'
}

/** 历史条目的时间标签：8月30日 星期日 / 8月25日那周 / 2026年8月 */
export function periodLabel(cadence: CheckInCadence, start: number): string {
  if (cadence === 'daily') return `${formatShortDate(start)} ${formatWeekday(start)}`
  if (cadence === 'weekly') return `${formatShortDate(start)}那周`
  const date = new Date(start)
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

/* ------------------------------------------------------------------ *
 * 统计
 * ------------------------------------------------------------------ */

/** [start, end) 区间内的总次数 */
export function countInRange(event: CheckInEvent, start: number, end: number): number {
  let total = 0
  for (const [key, count] of Object.entries(event.days)) {
    if (!Number.isFinite(count) || count <= 0) continue
    const ts = parseDayKey(key)
    if (Number.isNaN(ts) || ts < start || ts >= end) continue
    total += Math.trunc(count)
  }
  return total
}

/** 当前周期内的次数（卡片上的大数字）。只算这一个周期，不能越界到下一个周期 */
export function countInPeriod(event: CheckInEvent, now: number): number {
  const start = periodStart(event.cadence, now)
  return countInRange(event, start, nextPeriodStart(event.cadence, start))
}

/** 上一个周期内的次数（卡片脚注的对比） */
export function previousPeriodCount(event: CheckInEvent, now: number): number {
  const start = periodStart(event.cadence, now)
  return countInRange(event, previousPeriodStart(event.cadence, start), start)
}

/** 今天点了几下（同一天内点了几次） */
export function countToday(event: CheckInEvent, now: number): number {
  return Math.max(0, Math.trunc(event.days[dayKey(now)] ?? 0))
}

/** 某一天记下的所有时刻（毫秒，升序）。老数据没有时刻表，返回空数组 */
export function timesOf(event: CheckInEvent, key: string): number[] {
  const list = event.times?.[key]
  return Array.isArray(list) ? list : []
}

/** 时刻 → 「09:12」 */
export function formatClock(ts: number): string {
  const date = new Date(ts)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export type CheckInDay = {
  /** yyyy-mm-dd */
  key: string
  /** 本地当天 00:00 */
  start: number
  count: number
  /** 这一天的每次打卡时刻，升序 */
  times: number[]
}

/** 某个周期里每一天的明细（带时刻），日期升序 */
export function daysInPeriod(
  event: CheckInEvent,
  cadence: CheckInCadence,
  from: number,
): CheckInDay[] {
  const end = nextPeriodStart(cadence, from)
  const result: CheckInDay[] = []
  for (const [key, count] of Object.entries(event.days)) {
    if (!Number.isFinite(count) || count <= 0) continue
    const ts = parseDayKey(key)
    if (Number.isNaN(ts) || ts < from || ts >= end) continue
    result.push({ key, start: ts, count: Math.trunc(count), times: timesOf(event, key) })
  }
  return result.sort((a, b) => a.start - b.start)
}

export type CheckInPeriod = {
  /** 周期起点（本地 00:00） */
  start: number
  /** 这一周期内的总次数 */
  count: number
}

/**
 * 历史：把每天的记录按周期汇总，最近的在前。
 * 默认不包含「当前正在进行」的周期（卡片上已经在显示总数了），
 * includeCurrent 打开后会带进来——看「今天几点喝的」要靠它。
 */
export function buildHistory(
  event: CheckInEvent,
  now: number,
  includeCurrent = false,
): CheckInPeriod[] {
  const current = periodStart(event.cadence, now)
  const buckets = new Map<number, number>()
  for (const [key, count] of Object.entries(event.days)) {
    if (!Number.isFinite(count) || count <= 0) continue
    const ts = parseDayKey(key)
    if (Number.isNaN(ts)) continue
    const start = periodStart(event.cadence, ts)
    if (start > current) continue
    if (start === current && !includeCurrent) continue
    buckets.set(start, (buckets.get(start) ?? 0) + Math.trunc(count))
  }
  return [...buckets.entries()]
    .map(([start, count]) => ({ start, count }))
    .sort((a, b) => b.start - a.start)
}

export type CheckInSummary = { periods: number; most: number; total: number }

export function summarizePeriods(periods: readonly CheckInPeriod[]): CheckInSummary {
  let most = 0
  let total = 0
  for (const period of periods) {
    if (period.count > most) most = period.count
    total += period.count
  }
  return { periods: periods.length, most, total }
}

/** 列表排序：今天动过的排前面，其次按最近一次打卡时间 */
export function sortCheckIns(events: readonly CheckInEvent[]): CheckInEvent[] {
  const latest = (event: CheckInEvent): number => {
    let newest = 0
    for (const [key, count] of Object.entries(event.days)) {
      if (count <= 0) continue
      const ts = parseDayKey(key)
      if (!Number.isNaN(ts) && ts > newest) newest = ts
    }
    return newest
  }
  return [...events].sort((a, b) => latest(b) - latest(a) || a.createdAt - b.createdAt)
}

/** 连续打卡的周期数（含当前周期，当前没打就往前数） */
export function streakPeriods(event: CheckInEvent, now: number): number {
  const active = new Set(
    Object.entries(event.days)
      .filter(([, count]) => count > 0)
      .map(([key]) => periodStart(event.cadence, parseDayKey(key))),
  )
  let cursor = periodStart(event.cadence, now)
  if (!active.has(cursor)) {
    cursor = previousPeriodStart(event.cadence, cursor)
    if (!active.has(cursor)) return 0
  }
  let count = 0
  while (active.has(cursor)) {
    count += 1
    cursor = previousPeriodStart(event.cadence, cursor)
  }
  return count
}

/* ------------------------------------------------------------------ *
 * 存储
 * ------------------------------------------------------------------ */

function cleanDays(input: unknown, cadence: CheckInCadence): Record<string, number> {
  const result: Record<string, number> = {}
  if (typeof input !== 'object' || input === null) return result
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue
    result[key] = Math.trunc(value)
  }
  return pruneDays(result, cadence)
}

/** 只保留最近 MAX_PERIODS 个周期的记录 */
function pruneDays(days: Record<string, number>, cadence: CheckInCadence): Record<string, number> {
  const keys = Object.keys(days)
  if (keys.length === 0) return days
  const periods = new Set<number>()
  for (const key of keys) periods.add(periodStart(cadence, parseDayKey(key)))
  if (periods.size <= MAX_PERIODS) return days
  const kept = new Set([...periods].sort((a, b) => b - a).slice(0, MAX_PERIODS))
  const result: Record<string, number> = {}
  for (const key of keys) {
    if (kept.has(periodStart(cadence, parseDayKey(key)))) result[key] = days[key]
  }
  return result
}

/** 时刻表和次数表同进同退：日期键只保留次数表里还活着的那些 */
function cleanTimes(
  input: unknown,
  days: Record<string, number>,
  cadence: CheckInCadence,
): Record<string, number[]> {
  const result: Record<string, number[]> = {}
  if (typeof input !== 'object' || input === null) return result
  const kept = pruneDays(days, cadence)
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!(key in kept) || !Array.isArray(value)) continue
    const list = value
      .filter((item): item is number => typeof item === 'number' && Number.isFinite(item) && item > 0)
      .sort((a, b) => a - b)
      .slice(-MAX_TIMES_PER_DAY)
    if (list.length > 0) result[key] = list
  }
  return result
}

function isValid(value: unknown): value is CheckInEvent {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<CheckInEvent>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.createdAt === 'number' &&
    Number.isFinite(candidate.createdAt) &&
    typeof candidate.color === 'number' &&
    CADENCES.includes(candidate.cadence as CheckInCadence) &&
    typeof candidate.days === 'object' &&
    candidate.days !== null
  )
}

const checkins = createStore<CheckInEvent>({
  key: STORAGE_KEY,
  isValid,
  normalize: (event) => {
    const days = cleanDays(event.days, event.cadence)
    return {
      ...event,
      title: event.title.slice(0, 40),
      color: Math.trunc(event.color),
      days,
      times: cleanTimes(event.times, days, event.cadence),
    }
  },
  defaults: () => ({ title: '', color: 0, cadence: 'daily' as CheckInCadence, days: {}, times: {} }),
})

export const subscribe = checkins.subscribe
export const getCheckIns = checkins.getAll
export const removeCheckIn = checkins.remove
export const restoreCheckIn = checkins.restore
export const suggestColor = checkins.suggestColor

export function addCheckIn(draft: CheckInDraft): CheckInEvent {
  return checkins.add({
    title: draft.title.trim().slice(0, 40),
    color: draft.color,
    cadence: draft.cadence,
    days: {},
    times: {},
  })
}

export function updateCheckIn(id: string, patch: Partial<CheckInDraft>): void {
  const current = checkins.getAll().find((item) => item.id === id)
  checkins.update(id, {
    ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 40) } : {}),
    ...(patch.color !== undefined ? { color: patch.color } : {}),
    // 换周期时把记录按新粒度重新裁剪，避免留下一堆用不上的旧键
    ...(patch.cadence !== undefined
      ? {
          cadence: patch.cadence,
          days: pruneDays(current?.days ?? {}, patch.cadence),
          times: cleanTimes(current?.times, pruneDays(current?.days ?? {}, patch.cadence), patch.cadence),
        }
      : {}),
  })
}

export type TapResult = { key: string; count: number }

/** 打卡：今天 +1。返回这一天的累计次数，供动效与撤销用 */
export function tapCheckIn(id: string, now: number): TapResult | null {
  const event = checkins.getAll().find((item) => item.id === id)
  if (!event) return null
  const key = dayKey(now)
  const count = Math.max(0, Math.trunc(event.days[key] ?? 0)) + 1
  const times = { ...(event.times ?? {}) }
  times[key] = [...timesOf(event, key), now].slice(-MAX_TIMES_PER_DAY)
  checkins.update(id, { days: { ...event.days, [key]: count }, times })
  return { key, count }
}

/** 撤销一次打卡：把那一天减 1，减到 0 就删掉这个键 */
export function untapCheckIn(id: string, key: string): void {
  const event = checkins.getAll().find((item) => item.id === id)
  if (!event) return
  const count = Math.max(0, Math.trunc(event.days[key] ?? 0)) - 1
  const days = { ...event.days }
  const times = { ...(event.times ?? {}) }
  // 撤销的是最近记的那一次，所以从尾部收走一个时刻
  const list = timesOf(event, key)
  if (list.length > 0) {
    const next = list.slice(0, -1)
    if (next.length > 0) times[key] = next
    else delete times[key]
  }
  if (count > 0) days[key] = count
  else delete days[key]
  checkins.update(id, { days, times })
}
