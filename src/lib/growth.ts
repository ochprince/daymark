/**
 * 成长（小伙伴长到第几形态）与休息态。
 *
 * 口径见 docs/plan-v2.md 第 6.3、6.4 节：
 * - 成长按「累计」算，不按连续；形态取历史最高，永不退化。
 * - 坚持类 growth = 已结束各章天数 + 当前这一章的天数。
 * - 习惯类 growth = 有记录的天数（同一天记多次只算 1），必须单独持久化
 *   （days 只保留最近 240 个周期，按天推算会丢数）。
 * - 习惯类太久没记 = 睡着了、暂停生长，不是断签，也不惩罚。
 */
import { dayKey, parseDayKey } from './daykey'
import { anchorOf, daysSince, DAY_MS, startOfDay } from './days'
import type { CheckInCadence, CheckInEvent, DayEvent, Stage } from './types'

/** 形态门槛：0 / 3 / 7 / 30 / 100 天 */
export const STAGE_THRESHOLDS = [0, 3, 7, 30, 100] as const

/** 各周期「多久没记算睡着」（天） */
export const SLEEP_AFTER_DAYS: Record<CheckInCadence, number> = {
  daily: 3,
  weekly: 5,
  monthly: 20,
}

/** 成长天数 → 形态 */
export function stageOf(growth: number): Stage {
  const value = Number.isFinite(growth) ? Math.max(0, Math.trunc(growth)) : 0
  let stage: Stage = 0
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (value >= STAGE_THRESHOLDS[i]) {
      stage = i as Stage
      break
    }
  }
  return stage
}

/**
 * 展示形态：取「按成长算出来的形态」和「历史最高形态」里更大的那个。
 * 历史章节可以被删、打卡可以撤销，growth 会变小，但形态不能倒退。
 */
export function displayStage(growth: number, peak?: Stage): Stage {
  const current = stageOf(growth)
  if (typeof peak !== 'number' || !Number.isFinite(peak)) return current
  return Math.max(current, peak) as Stage
}

/** 下一形态的门槛；已经到顶返回 null */
export function nextStageAt(growth: number): number | null {
  for (const threshold of STAGE_THRESHOLDS) {
    if (growth < threshold) return threshold
  }
  return null
}

/** 还差多少天到下一形态；已经到顶返回 null */
export function daysToNextStage(growth: number): number | null {
  const next = nextStageAt(growth)
  return next === null ? null : next - growth
}

/** 坚持类：历史各章天数之和 + 当前这一章（从锚点算满 24 小时的天数） */
export function growthOfSince(event: DayEvent, now: number): number {
  let total = 0
  for (const chapter of event.history ?? []) {
    const days = Number.isFinite(chapter.days) ? Math.trunc(chapter.days) : 0
    if (days > 0) total += days
  }
  return total + daysSince(anchorOf(event), now)
}

/**
 * 习惯类累计有记录的天数。
 * 优先读持久化的 growthDays；老数据没有这一项时按 days 里次数 > 0 的键数兜底。
 */
export function habitGrowthDays(event: Pick<CheckInEvent, 'days' | 'growthDays'>): number {
  if (typeof event.growthDays === 'number' && Number.isFinite(event.growthDays)) {
    return Math.max(0, Math.trunc(event.growthDays))
  }
  return countRecordedDays(event.days)
}

/** days 里「次数 > 0」的天数 */
export function countRecordedDays(days: Record<string, number> | undefined): number {
  if (!days) return 0
  let total = 0
  for (const count of Object.values(days)) {
    if (Number.isFinite(count) && count > 0) total += 1
  }
  return total
}

/** 这一天记过没有（次数 > 0） */
export function recordedOn(event: Pick<CheckInEvent, 'days'>, now: number): boolean {
  const count = event.days?.[dayKey(now)]
  return typeof count === 'number' && count > 0
}

/** 最近一次记录的日期（本地 00:00）；从没记过返回 null */
export function lastRecordedAt(event: Pick<CheckInEvent, 'days'>): number | null {
  let latest: number | null = null
  for (const [key, count] of Object.entries(event.days ?? {})) {
    if (!Number.isFinite(count) || count <= 0) continue
    const ts = parseDayKey(key)
    if (Number.isNaN(ts)) continue
    if (latest === null || ts > latest) latest = ts
  }
  return latest
}

/**
 * 习惯类是不是睡着了（暂停生长，不是断签）：
 * 今天还没记，且最近一次记录（从没记过就从创建时刻）距今已达阈值。
 */
export function isSleeping(event: CheckInEvent, now: number): boolean {
  if (recordedOn(event, now)) return false
  const last = lastRecordedAt(event)
  const since = last ?? startOfDay(event.createdAt)
  const threshold = SLEEP_AFTER_DAYS[event.cadence] ?? SLEEP_AFTER_DAYS.daily
  const gap = Math.round((startOfDay(now) - startOfDay(since)) / DAY_MS)
  return gap >= threshold
}

/**
 * 记一次 / 撤销一次之后 growthDays 的变化。
 * 规则：某天从 0 变 1 → +1；从 1 变 0 → −1；同一天再记不变。
 */
export function nextGrowthDays(
  before: number,
  after: number,
  growthDays: number,
): number {
  const wasRecorded = before > 0
  const nowRecorded = after > 0
  if (!wasRecorded && nowRecorded) return growthDays + 1
  if (wasRecorded && !nowRecorded) return Math.max(0, growthDays - 1)
  return growthDays
}
