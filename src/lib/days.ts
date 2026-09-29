import type { CountdownEvent, DayEvent, Repeat } from './types'

export const DAY_MS = 86_400_000

/** 本地时区当天 00:00 的时刻 */
export function startOfDay(ts: number): number {
  const date = new Date(ts)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 今天 00:00 的时刻 */
export function todayStart(now: number): number {
  return startOfDay(now)
}

/**
 * 已经过去的天数：按自然日计算。
 * 当天记录 = 0 天，昨天记录 = 1 天。未来时间一律按 0 处理。
 */
export function daysSince(startedAt: number, now: number): number {
  const diff = Math.round((startOfDay(now) - startOfDay(startedAt)) / DAY_MS)
  return diff > 0 ? diff : 0
}

export function isToday(startedAt: number, now: number): boolean {
  return startOfDay(startedAt) === startOfDay(now)
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' })

const shortFormatter = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' })

/** 2026年5月24日 */
export function formatDate(ts: number): string {
  return dateFormatter.format(new Date(ts))
}

/** 5月24日 */
export function formatShortDate(ts: number): string {
  return shortFormatter.format(new Date(ts))
}

/** 星期一 */
export function formatWeekday(ts: number): string {
  return weekdayFormatter.format(new Date(ts))
}

function toDateInputValue(ts: number): string {
  const date = new Date(ts)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** yyyy-mm-dd，用于 <input type="date"> */
export function dateInputValue(ts: number): string {
  return toDateInputValue(ts)
}

/** 解析 <input type="date"> 的值，失败时回退到今天 */
export function parseDateInput(value: string, fallback: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return startOfDay(fallback)
  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  if (Number.isNaN(parsed.getTime())) return startOfDay(fallback)
  parsed.setHours(0, 0, 0, 0)
  return parsed.getTime()
}

/** 从 d 起加 n 个月，日期溢出时收敛到月末（1/31 + 1 月 = 2/28） */
function addMonths(date: Date, count: number): Date {
  const year = date.getFullYear()
  const month = date.getMonth() + count
  const day = date.getDate()
  const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate()
  const result = new Date(year, month, Math.min(day, lastDayOfTargetMonth))
  result.setHours(0, 0, 0, 0)
  return result
}

export type Breakdown = { years: number; months: number; days: number }

/** 按日历拆分起止日之间的年 / 月 / 日（月按自然月，非 30 天近似） */
export function calendarBreakdown(startedAt: number, now: number): Breakdown {
  const start = new Date(startOfDay(startedAt))
  const end = new Date(startOfDay(now))
  if (end.getTime() <= start.getTime()) return { years: 0, months: 0, days: 0 }

  let totalMonths = 0
  // 上限 2400 个月（200 年）足够覆盖任何真实使用场景，同时避免异常数据导致死循环
  while (totalMonths < 2400 && addMonths(start, totalMonths + 1).getTime() <= end.getTime()) {
    totalMonths += 1
  }

  const anchor = addMonths(start, totalMonths)
  const days = Math.round((end.getTime() - anchor.getTime()) / DAY_MS)

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days,
  }
}

/** 「1 年 24 天」/「4 个月 6 天」；不足 31 天时返回空串（大数字已经说明一切） */
export function formatSpan(startedAt: number, now: number): string {
  if (daysSince(startedAt, now) < 31) return ''
  const { years, months, days } = calendarBreakdown(startedAt, now)
  const parts: string[] = []
  if (years > 0) parts.push(`${years} 年`)
  if (months > 0) parts.push(`${months} 个月`)
  if (days > 0) parts.push(`${days} 天`)
  return parts.join(' ')
}

export const MILESTONES = [
  7, 14, 21, 30, 50, 66, 88, 100, 150, 200, 250, 300, 365, 500, 666, 730, 999, 1000, 1314, 1500,
  2000, 2555, 3000, 3650, 5000, 7300, 10000,
]

/** 恰好踩在里程碑上时返回那个数字，否则 null */
export function milestoneAt(days: number): number | null {
  return MILESTONES.includes(days) ? days : null
}

/** 经历时间越长排越前；同一天记录的按创建时间排 */
export function sortEvents(events: readonly DayEvent[]): DayEvent[] {
  return [...events].sort((a, b) => {
    const byStart = startOfDay(a.startedAt) - startOfDay(b.startedAt)
    if (byStart !== 0) return byStart
    return a.createdAt - b.createdAt
  })
}

export type Summary = { count: number; longest: number }

export function summarize(events: readonly DayEvent[], now: number): Summary {
  let longest = 0
  for (const event of events) {
    const days = daysSince(event.startedAt, now)
    if (days > longest) longest = days
  }
  return { count: events.length, longest }
}

/* ------------------------------------------------------------------ *
 * 倒数日
 * ------------------------------------------------------------------ */

export type RepeatOption = { value: Repeat; label: string }

export const REPEAT_OPTIONS: readonly RepeatOption[] = [
  { value: 'none', label: '不重复' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
]

export function repeatOption(repeat: Repeat): RepeatOption {
  return REPEAT_OPTIONS.find((option) => option.value === repeat) ?? REPEAT_OPTIONS[0]
}

/**
 * 周期性事件的下一个时间点（含今天）。
 *
 * 锚点是「月+日」而不是「首次那一年那一天」：
 * - 每年重复：取锚点的月日，从今天往后找最近的一次（如锚点 5/20、今天 9/30 → 次年 5/20）
 * - 每月重复：取锚点的日，从今天往后找最近的一次（如锚点 20 号、今天 9/30 → 10/20）
 * 这样即使填写的日期在未来，切换周期也会立刻改变结果，
 * 而不是永远回显填写的那个日期。
 *
 * 月末收敛：锚点 31 号在 30 天的月份落到月末；2/29 在平年落到 2/28。
 */
export function nextOccurrence(at: number, repeat: Repeat, now: number): number {
  const base = new Date(startOfDay(at))
  const today = startOfDay(now)
  if (repeat === 'none') return base.getTime()

  const anchorDay = base.getDate()
  const anchorMonth = base.getMonth()
  const todayDate = new Date(today)

  if (repeat === 'yearly') {
    let year = todayDate.getFullYear()
    let candidate = dayInMonth(year, anchorMonth, anchorDay)
    if (candidate < today) candidate = dayInMonth(year + 1, anchorMonth, anchorDay)
    return candidate
  }

  let year = todayDate.getFullYear()
  let month = todayDate.getMonth()
  let candidate = dayInMonth(year, month, anchorDay)
  if (candidate < today) {
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
    candidate = dayInMonth(year, month, anchorDay)
  }
  return candidate
}

/** 构造某年某月第 day 天的零点，超出该月天数时收敛到月末 */
function dayInMonth(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const result = new Date(year, month, Math.min(day, lastDay))
  result.setHours(0, 0, 0, 0)
  return result.getTime()
}

/** 距离目标日期还有多少天：今天 = 0，已经过去为负数 */
export function daysUntil(at: number, now: number): number {
  return Math.round((startOfDay(at) - startOfDay(now)) / DAY_MS)
}

export type CountdownView = {
  event: CountdownEvent
  /** 下一个时间点 */
  next: number
  /** 距离下一个时间点还有多少天（负数表示已经过去） */
  days: number
  /** 计算时的当下，用于「今天」这类需要往后看一次的文案 */
  now: number
}

/** 按距离正序：越近越靠上，天数越多越靠下 */
export function buildCountdownList(events: readonly CountdownEvent[], now: number): CountdownView[] {
  return events
    .map((event) => {
      const next = nextOccurrence(event.startedAt, event.repeat, now)
      return { event, next, days: daysUntil(next, now), now }
    })
    .sort((a, b) => a.days - b.days || a.event.createdAt - b.event.createdAt)
}

export type CountdownSummary = { count: number; nearest: number | null }

export function summarizeCountdowns(views: readonly CountdownView[]): CountdownSummary {
  let nearest: number | null = null
  for (const view of views) {
    if (view.days < 0) continue
    if (nearest === null || view.days < nearest) nearest = view.days
  }
  return { count: views.length, nearest }
}
