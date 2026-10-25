/**
 * 统一视图模型：把三类事（坚持 / 习惯 / 等待的日子）转成同一种展示对象。
 * 舞台、切换面板、档案页、分享卡片都只读它，不再各自判断三类数据。
 *
 * 顺序口径（docs/plan-v2.md 6.10）：先坚持（按 sortEvents），再习惯（按 sortCheckIns），
 * 再等待的日子（按距离正序）。舞台横滑与底部圆点共用这个顺序。
 */
import {
  DAY_MS,
  anchorOf,
  buildCountdownList,
  daysSince,
  daysUntil,
  nextOccurrence,
  sortEvents,
} from './days'
import { sortCheckIns, countInPeriod } from './checkins'
import { displayStage, growthOfSince, habitGrowthDays, isSleeping, recordedOn } from './growth'
import type {
  CheckInCadence,
  CheckInEvent,
  CountdownEvent,
  DayEvent,
  ItemKind,
  Reminder,
  Species,
  Stage,
} from './types'

export type Mood = 'idle' | 'happy' | 'sleep' | 'wow'

type ViewBase = {
  /** `since:id` / `habit:id` / `countdown:id`，焦点与收藏记录都用它 */
  key: string
  id: string
  title: string
  color: number
  species: Species
  /** 展示形态（已经并入历史最高形态，永不倒退） */
  stage: Stage
  /** 成长天数 */
  growth: number
  mood: Mood
  /** 提醒规则；空 = 不提醒 */
  remind?: Reminder
}

export type SinceView = ViewBase & {
  kind: 'since'
  /** 走过的天数 */
  days: number
  event: DayEvent
}

export type HabitView = ViewBase & {
  kind: 'habit'
  /** 当前周期内的次数 */
  count: number
  /** 每周期目标次数，空 = 不设上限 */
  target: number | null
  cadence: CheckInCadence
  event: CheckInEvent
}

export type CountdownView = ViewBase & {
  kind: 'countdown'
  /** 还有多少天：今天 0，已经过去为负数 */
  days: number
  /** 下一次发生的时刻 */
  next: number
  event: CountdownEvent
}

export type ItemView = SinceView | HabitView | CountdownView

export type ItemSources = {
  events: readonly DayEvent[]
  countdowns: readonly CountdownEvent[]
  checkins: readonly CheckInEvent[]
}

/** 三类事在切换面板 / 圆点里的固定分组顺序 */
export const KIND_ORDER: readonly ItemKind[] = ['since', 'habit', 'countdown']

export function itemKey(kind: ItemKind, id: string): string {
  return `${kind}:${id}`
}

export type BuildOptions = {
  /** 每件事的历史最高形态（collection.peakStage），用于「永不退化」 */
  peakStage?: Record<string, Stage>
}

export function buildItemViews(
  sources: ItemSources,
  now: number,
  options: BuildOptions = {},
): ItemView[] {
  const peaks = options.peakStage ?? {}
  const views: ItemView[] = []

  for (const event of sortEvents(sources.events)) {
    const key = itemKey('since', event.id)
    const growth = growthOfSince(event, now)
    views.push({
      key,
      kind: 'since',
      id: event.id,
      title: event.title,
      color: event.color,
      species: event.species ?? 'sprout',
      stage: displayStage(growth, peaks[key]),
      growth,
      days: daysSince(anchorOf(event), now),
      mood: 'idle',
      ...(event.remind ? { remind: event.remind } : {}),
      event,
    })
  }

  for (const event of sortCheckIns(sources.checkins)) {
    const key = itemKey('habit', event.id)
    const growth = habitGrowthDays(event)
    const sleeping = isSleeping(event, now)
    const recorded = recordedOn(event, now)
    const count = countInPeriod(event, now)
    const target =
      typeof event.target === 'number' && event.target > 0 ? Math.trunc(event.target) : null
    views.push({
      key,
      kind: 'habit',
      id: event.id,
      title: event.title,
      color: event.color,
      species: event.species ?? 'sprout',
      stage: displayStage(growth, peaks[key]),
      growth,
      count,
      target,
      cadence: event.cadence,
      mood: sleeping ? 'sleep' : recorded || (target !== null && count >= target) ? 'happy' : 'idle',
      ...(event.remind ? { remind: event.remind } : {}),
      event,
    })
  }

  for (const view of buildCountdownList(sources.countdowns, now)) {
    const event = view.event
    const key = itemKey('countdown', event.id)
    // 今天已经「说过了」：跳到下一次发生，当天态结束
    let next = view.next
    let days = view.days
    if (days === 0 && (event.ackedFor ?? []).includes(next)) {
      next = nextOccurrence(event.startedAt, event.repeat, next + DAY_MS, event.festivalId)
      days = daysUntil(next, now)
    }
    views.push({
      key,
      kind: 'countdown',
      id: event.id,
      title: event.title,
      color: event.color,
      // 信使不长大
      species: 'post',
      stage: 0,
      growth: 0,
      days,
      next,
      mood: days === 0 ? 'happy' : 'idle',
      ...(event.remind ? { remind: event.remind } : {}),
      event,
    })
  }

  return views
}

/** 按 key 找一件事 */
export function viewByKey(views: readonly ItemView[], key: string | null | undefined): ItemView | null {
  if (!key) return null
  return views.find((view) => view.key === key) ?? null
}

/**
 * 焦点被删掉之后落到哪一件：同组下一件，没有则上一件，整组都没了就取原位置往后最近的一件。
 * 返回新的焦点 key；一件事都没有时返回 null。
 */
export function focusAfterRemoval(views: readonly ItemView[], removedKey: string): string | null {
  const index = views.findIndex((view) => view.key === removedKey)
  if (index < 0) return views[0]?.key ?? null
  const remaining = views.filter((view) => view.key !== removedKey)
  if (remaining.length === 0) return null

  const removedKind = views[index].kind
  const sameKind = views.filter((view) => view.kind === removedKind && view.key !== removedKey)
  if (sameKind.length > 0) {
    const position = views.filter((view) => view.kind === removedKind).findIndex((view) => view.key === removedKey)
    return (sameKind[position] ?? sameKind[position - 1] ?? sameKind[0]).key
  }
  return (remaining[Math.min(index, remaining.length - 1)] ?? remaining[remaining.length - 1]).key
}

/** 计数：三类事各几件（切换面板的分组标题用） */
export function countByKind(views: readonly ItemView[]): Record<ItemKind, number> {
  const result: Record<ItemKind, number> = { since: 0, habit: 0, countdown: 0 }
  for (const view of views) result[view.kind] += 1
  return result
}
