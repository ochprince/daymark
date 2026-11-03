/**
 * 系统表面的展示模型。
 *
 * 小组件 / 灵动岛 / 锁屏 / 闹钟都只认 `SystemItem`——一个扁平、可序列化的快照。
 * 它和 `ItemView` 的区别是：没有事件对象、没有函数，正好是 iOS 侧需要从
 * App Group 里读出来的那些字段（见 docs/native/SYSTEM-SURFACES.md）。
 */
import { streakPeriods } from '../../lib/checkins'
import { t } from '../../lib/i18n'
import type { MessageKey } from '../../lib/i18n'
import type { ItemView } from '../../lib/itemview'
import type { CheckInCadence, Species, Stage } from '../../lib/types'
import { weekFlags } from './clock'

export type SystemKind = 'since' | 'habit' | 'countdown'

export type SystemTodo = { text: string; done: boolean }

export type SystemItem = {
  id: string
  kind: SystemKind
  title: string
  /**
   * 卡片上的主数字：
   *  - since：已走过的天数
   *  - habit：累计记过的天数
   *  - countdown：距离下一次还有几天（0 = 今天，负数 = 已过去）
   */
  days: number
  /** 调色板索引 0–7，对应皮肤令牌 --h-{n} */
  color: number
  species: Species
  stage: Stage
  /** habit：本周期已记次数 */
  count?: number
  /** habit：每周期的目标次数；null = 不设上限 */
  target?: number | null
  cadence?: CheckInCadence
  /** habit：最近 7 天（旧 → 今天）是否记过 */
  week?: boolean[]
  /** habit：连续天数 */
  streak?: number
  /** since：起始时刻（算「已走过 X 年 X 月」用） */
  startedAt?: number
  /** countdown：下一次发生的时刻 */
  date?: number
  /** countdown：一句备忘 */
  memo?: string
  /** countdown：待办（展示前 3 条） */
  todo?: SystemTodo[]
  /** countdown：重复方式的展示文案 */
  repeat?: string
}

const SPECIES_KEY: Record<Species, MessageKey> = {
  sprout: 'creature.sprout',
  moon: 'creature.moon',
  drop: 'creature.drop',
  star: 'creature.star',
  post: 'creature.post',
}

const STAGE_KEYS: Record<Exclude<Species, 'post'>, readonly MessageKey[]> = {
  sprout: ['stageName.sprout.0', 'stageName.sprout.1', 'stageName.sprout.2', 'stageName.sprout.3', 'stageName.sprout.4'],
  moon: ['stageName.moon.0', 'stageName.moon.1', 'stageName.moon.2', 'stageName.moon.3', 'stageName.moon.4'],
  drop: ['stageName.drop.0', 'stageName.drop.1', 'stageName.drop.2', 'stageName.drop.3', 'stageName.drop.4'],
  star: ['stageName.star.0', 'stageName.star.1', 'stageName.star.2', 'stageName.star.3', 'stageName.star.4'],
}

const REPEAT_KEYS: Record<string, MessageKey> = {
  none: 'sys.repeat.none',
  weekly: 'sys.repeat.weekly',
  monthly: 'sys.repeat.monthly',
  yearly: 'sys.repeat.yearly',
}

/** 小伙伴的名字：芽芽 / 眠眠 / …；信使不长大，所以形态名只对前四种物种有意义 */
export function speciesName(species: Species): string {
  return t(SPECIES_KEY[species])
}

export function stageName(species: Species, stage: Stage): string {
  if (species === 'post') return t('creature.post')
  const keys = STAGE_KEYS[species]
  return t(keys[Math.min(keys.length - 1, Math.max(0, stage))])
}

/** 形态进度：（当前形态起点 → 下一形态）之间的百分比；满级 100 */
const STAGE_STEPS: readonly number[] = [0, 3, 7, 30, 100]

export function stagePercent(stage: Stage, growthDays: number): number {
  if (stage >= STAGE_STEPS.length - 1) return 100
  const from = STAGE_STEPS[stage]
  const to = STAGE_STEPS[stage + 1]
  if (!(to > from)) return 100
  const ratio = (growthDays - from) / (to - from)
  return Math.min(100, Math.max(0, Math.round(ratio * 100)))
}

/**
 * ItemView → SystemItem。
 * 打卡的「最近 7 天」在这里就摊平成一串布尔，原生侧照着写 WidgetKit 的
 * timeline entry 就行，不用再理解 days / times 两张表。
 */
export function toSystemItem(view: ItemView, now: number): SystemItem {
  const base: SystemItem = {
    id: view.id,
    kind: view.kind,
    title: view.title,
    days: view.kind === 'since' ? view.days : view.kind === 'habit' ? view.growth : view.days,
    color: view.color,
    species: view.species,
    stage: view.stage,
  }

  if (view.kind === 'habit') {
    const logged = Object.keys(view.event.days).filter((key) => (view.event.days[key] ?? 0) > 0)
    const streak = streakPeriods(view.event, now)
    return {
      ...base,
      count: view.count,
      target: view.target,
      cadence: view.cadence,
      week: weekFlags(logged, now),
      streak,
    }
  }

  if (view.kind === 'since') {
    return { ...base, startedAt: view.event.anchorAt ?? view.event.startedAt }
  }

  if (view.kind === 'countdown') {
    const event = view.event
    return {
      ...base,
      date: view.next,
      memo: event.memo,
      todo: event.todo,
      repeat: REPEAT_KEYS[event.repeat] ? t(REPEAT_KEYS[event.repeat]) : undefined,
    }
  }

  return base
}
