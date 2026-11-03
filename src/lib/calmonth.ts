/**
 * 打卡日历用到的一点纯计算：某个月记了几天、一共几次、单日最多几次。
 *
 * 放在 lib 里是为了能单测——档案页上的月历、以后可能的年度热力图都要用同一份口径，
 * 不要各自写一遍 `key.startsWith(...)` 的字符串切片。
 */

/** 2026-10 */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export type MonthSummary = {
  /** 这个月有记录的天数 */
  days: number
  /** 这个月的总次数（按每天的次数累加） */
  hits: number
  /** 单日最多次数（用来决定深浅的满格） */
  peak: number
}

/** 按本地日期键（yyyy-mm-dd）汇总某个月；其它月份、0 次、坏键都跳过 */
export function monthSummary(days: Record<string, number>, year: number, month: number): MonthSummary {
  const prefix = `${monthKey(year, month)}-`
  let dayCount = 0
  let hits = 0
  let peak = 0
  for (const [key, value] of Object.entries(days)) {
    if (!key.startsWith(prefix)) continue
    const count = Math.floor(Number(value))
    if (!Number.isFinite(count) || count <= 0) continue
    dayCount += 1
    hits += count
    if (count > peak) peak = count
  }
  return { days: dayCount, hits, peak }
}

/**
 * 日历能往回翻多少个月：翻到最早一条记录所在的月为止。
 * 没有记录时就是 0（只能看当月）。
 */
export function monthOffsetFloor(earliestKey: string | undefined | null, now: Date): number {
  if (!earliestKey || earliestKey.length < 7) return 0
  const year = Number(earliestKey.slice(0, 4))
  const month = Number(earliestKey.slice(5, 7))
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return 0
  const diff = (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth())
  return Math.min(0, diff)
}
