/**
 * 本地日期键（yyyy-mm-dd）与时刻解析。
 *
 * 从 checkins.ts 抽出来的纯函数：成长计算、迁移、收藏这些不碰存储的模块也要用，
 * 不应该为此拖进一个 store。checkins.ts 继续 re-export，老调用点不用改。
 */

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
