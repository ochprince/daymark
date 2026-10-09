import { daysSince, todayStart } from './days'
import type { Streak } from './types'

/**
 * 把「从起始日累计到现在」封存成一轮历史。
 * 完成时间就是被重置的那一天（本地 00:00），列表也按它倒序。
 */
export function closeStreak(startedAt: number, now: number): Streak {
  return { days: daysSince(startedAt, now), endedAt: todayStart(now) }
}

/** 历史列表：最近一次重置排最前 */
export function sortStreaks(history: readonly Streak[]): Streak[] {
  return [...history].sort((a, b) => b.endedAt - a.endedAt)
}

/** 头部小结：共几轮、最长多少天、合计多少天 */
export function summarizeStreaks(history: readonly Streak[]): {
  count: number
  longest: number
  total: number
} {
  let longest = 0
  let total = 0
  for (const streak of history) {
    if (streak.days > longest) longest = streak.days
    total += streak.days
  }
  return { count: history.length, longest, total }
}

/** 存进列表前的整理：滤掉坏数据、按完成时间倒序、只留最近 200 轮 */
export function normalizeStreaks(history: readonly Streak[] | undefined): Streak[] {
  if (!Array.isArray(history)) return []
  return sortStreaks(
    history.filter(
      (streak) =>
        streak &&
        typeof streak === 'object' &&
        Number.isFinite(streak.days) &&
        Number.isFinite(streak.endedAt) &&
        streak.days >= 0,
    ),
  ).slice(0, 200)
}
