/**
 * v2 迁移：把老数据补成新结构（首启用 v2 打开时执行一次，幂等）。
 *
 * 规则见 docs/plan-v2.md 第 8.3 节。这里全部是纯函数，存储读写放在 runMigration 里，
 * 方便单测逐行覆盖。
 *
 * 关键点：
 * - 所有新字段都可选，读不到就给默认值，老数据不会因此丢字段。
 * - peakStage / seenStage 都写成当前形态——否则升级后一打开会连播 N 段进化过场。
 * - 徽章静默补发，不弹窗。
 */
import { countRecordedDays } from './growth'
import { dexKey, emptyCollection } from './collection'
import { buildItemViews, itemKey, type ItemView } from './itemview'
import { migrateSkin, type SkinState } from './skin'
import type {
  Chapter,
  CheckInCadence,
  CheckInEvent,
  CountdownEvent,
  DayEvent,
  Species,
  Stage,
} from './types'

export const MIGRATION_FLAG = 'daymark.migrated.v2'

export const STORAGE_KEYS = {
  events: 'daymark.events.v1',
  countdowns: 'daymark.countdowns.v1',
  checkins: 'daymark.checkins.v1',
  theme: 'daymark.theme.v2',
  collection: 'daymark.collection.v1',
  skin: 'daymark.skin.v1',
  focus: 'daymark.focus.v1',
} as const

/* ------------------------------------------------------------------ *
 * 物种推荐
 * ------------------------------------------------------------------ */

const MOON_WORDS = ['睡', '眠', '冥想', '休息']
const DROP_WORDS = ['水', '喝']
const STAR_WORDS = ['跑', '走', '步', '运动', '健身', '骑', '游泳', '瑜伽']

/** 按标题与周期推荐物种（迁移与新建时的预选共用） */
export function pickSpecies(title: string, cadence: CheckInCadence = 'daily'): Species {
  const name = title ?? ''
  if (MOON_WORDS.some((word) => name.includes(word))) return 'moon'
  if (DROP_WORDS.some((word) => name.includes(word))) return 'drop'
  if (STAR_WORDS.some((word) => name.includes(word))) return 'star'
  return cadence === 'daily' ? 'sprout' : 'star'
}

/* ------------------------------------------------------------------ *
 * 单条记录
 * ------------------------------------------------------------------ */

function normalizeChapter(input: unknown): Chapter | null {
  if (typeof input !== 'object' || input === null) return null
  const value = input as Partial<Chapter>
  if (typeof value.days !== 'number' || !Number.isFinite(value.days)) return null
  if (typeof value.endedAt !== 'number' || !Number.isFinite(value.endedAt)) return null
  const chapter: Chapter = { days: Math.max(0, Math.trunc(value.days)), endedAt: value.endedAt }
  if (typeof value.line === 'string' && value.line.length > 0) chapter.line = value.line
  if (typeof value.stage === 'number' && value.stage >= 0 && value.stage <= 4) {
    chapter.stage = Math.trunc(value.stage) as Stage
  }
  if (typeof value.startedAt === 'number' && Number.isFinite(value.startedAt)) {
    chapter.startedAt = value.startedAt
  }
  return chapter
}

export function migrateDayEvent(event: DayEvent): DayEvent {
  return {
    ...event,
    species: event.species ?? 'sprout',
    history: Array.isArray(event.history)
      ? event.history.map(normalizeChapter).filter((item): item is Chapter => item !== null)
      : event.history,
  }
}

export function migrateCheckIn(event: CheckInEvent): CheckInEvent {
  return {
    ...event,
    species: event.species ?? pickSpecies(event.title, event.cadence),
    // days 只保留最近 240 个周期，长期用户按天推算会丢数，所以这里落一个计数器
    growthDays:
      typeof event.growthDays === 'number' && Number.isFinite(event.growthDays)
        ? Math.max(0, Math.trunc(event.growthDays))
        : countRecordedDays(event.days),
    chapters: Array.isArray(event.chapters)
      ? event.chapters.map(normalizeChapter).filter((item): item is Chapter => item !== null)
      : event.chapters,
  }
}

export function migrateCountdown(event: CountdownEvent): CountdownEvent {
  return {
    ...event,
    ackedFor: Array.isArray(event.ackedFor)
      ? event.ackedFor.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      : event.ackedFor,
  }
}

/* ------------------------------------------------------------------ *
 * 整体迁移
 * ------------------------------------------------------------------ */

export type MigrationInput = {
  events: DayEvent[]
  countdowns: CountdownEvent[]
  checkins: CheckInEvent[]
  /** 旧主题开关（daymark.theme.v2） */
  theme: 'system' | 'light' | 'dark' | null
}

export type MigrationResult = {
  events: DayEvent[]
  countdowns: CountdownEvent[]
  checkins: CheckInEvent[]
  /**
   * 收藏的初始值。迁移只是「算出应该有什么」，真正写入由调用方决定：
   * 已存在 daymark.collection.v1 时不覆盖（幂等），只补缺。
   */
  collection: {
    dex: string[]
    badges: string[]
    peakStage: Record<string, Stage>
    seenStage: Record<string, Stage>
    lastNoteAt: number
  }
  skin: SkinState
  focus: string | null
  views: ItemView[]
}

/** 徽章门槛：成长天数达到哪一档就补哪个 */
const GROWTH_BADGES: readonly { growth: number; id: string }[] = [
  { growth: 7, id: 'd7' },
  { growth: 30, id: 'd30' },
  { growth: 100, id: 'd100' },
  { growth: 365, id: 'd365' },
]

export function migrateAll(input: MigrationInput, now: number): MigrationResult {
  const events = input.events.map(migrateDayEvent)
  const countdowns = input.countdowns.map(migrateCountdown)
  const checkins = input.checkins.map(migrateCheckIn)

  const views = buildItemViews({ events, countdowns, checkins }, now)

  // 形态：按成长算出来的当前形态，peak 与 seen 都从这里起步
  const peakStage: Record<string, Stage> = {}
  const seenStage: Record<string, Stage> = {}
  const dex = new Set<string>()

  for (const view of views) {
    const stage = view.stage
    peakStage[view.key] = stage
    seenStage[view.key] = stage
    if (view.kind === 'countdown') {
      dex.add(dexKey('post', 0))
      continue
    }
    for (let level = 0; level <= stage; level += 1) dex.add(dexKey(view.species, level as Stage))
  }

  const maxGrowth = views.reduce((max, view) => (view.growth > max ? view.growth : max), 0)
  const hasChapter =
    events.some((event) => (event.history?.length ?? 0) > 0) ||
    checkins.some((event) => (event.chapters?.length ?? 0) > 0) ||
    events.length > 0 // 老版本没有「章节」概念，有坚持记录就算翻过篇

  const badges: string[] = []
  if (views.length > 0) badges.push('first')
  for (const rule of GROWTH_BADGES) {
    if (maxGrowth >= rule.growth) badges.push(rule.id)
  }
  if (hasChapter) badges.push('chapter')

  return {
    events,
    countdowns,
    checkins,
    collection: { dex: [...dex], badges, peakStage, seenStage, lastNoteAt: now },
    skin: migrateSkin(input.theme),
    focus: views[0]?.key ?? null,
    views,
  }
}

/* ------------------------------------------------------------------ *
 * 启动时的执行器（读写 localStorage）
 * ------------------------------------------------------------------ */

export type MigrationStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function parseArray(raw: string | null): unknown[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function looksLikeRecord(value: unknown): boolean {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string'
}

/**
 * 首启执行一次：补字段、写收藏与皮肤、记住焦点。
 * 已经迁过的直接返回 null（幂等）；任何一步失败都不抛错，返回 null 让 App 照常启动。
 */
export function runMigration(storage: MigrationStorage, now: number = Date.now()): MigrationResult | null {
  try {
    if (storage.getItem(MIGRATION_FLAG)) return null

    const rawEvents = parseArray(storage.getItem(STORAGE_KEYS.events)).filter(looksLikeRecord)
    const rawCountdowns = parseArray(storage.getItem(STORAGE_KEYS.countdowns)).filter(looksLikeRecord)
    const rawCheckins = parseArray(storage.getItem(STORAGE_KEYS.checkins)).filter(looksLikeRecord)
    const themeRaw = storage.getItem(STORAGE_KEYS.theme)
    const theme = themeRaw === 'system' || themeRaw === 'light' || themeRaw === 'dark' ? themeRaw : null

    const result = migrateAll(
      {
        events: rawEvents as DayEvent[],
        countdowns: rawCountdowns as CountdownEvent[],
        checkins: rawCheckins as CheckInEvent[],
        theme,
      },
      now,
    )
    const skin = result.skin

    storage.setItem(STORAGE_KEYS.events, JSON.stringify(result.events))
    storage.setItem(STORAGE_KEYS.countdowns, JSON.stringify(result.countdowns))
    storage.setItem(STORAGE_KEYS.checkins, JSON.stringify(result.checkins))

    const existingCollection = (() => {
      try {
        const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEYS.collection) ?? 'null')
        return parsed
      } catch {
        return null
      }
    })()

    // 收藏只在「没有」时整份写入，已有的话不覆盖（重复启动、回滚重装都安全）
    if (!existingCollection) {
      storage.setItem(
        STORAGE_KEYS.collection,
        JSON.stringify({
          ...emptyCollection(),
          dex: result.collection.dex,
          badges: Object.fromEntries(result.collection.badges.map((id) => [id, now])),
          peakStage: result.collection.peakStage,
          seenStage: result.collection.seenStage,
          lastNoteAt: result.collection.lastNoteAt,
        }),
      )
    }

    if (!storage.getItem(STORAGE_KEYS.skin)) {
      storage.setItem(STORAGE_KEYS.skin, JSON.stringify(skin))
    }
    if (result.focus && !storage.getItem(STORAGE_KEYS.focus)) {
      storage.setItem(STORAGE_KEYS.focus, result.focus)
    }

    storage.setItem(MIGRATION_FLAG, String(now))
    return result
  } catch {
    return null
  }
}

/** 焦点 key 的读写（与迁移共用键名） */
export function readFocus(storage: MigrationStorage): string | null {
  const value = storage.getItem(STORAGE_KEYS.focus)
  return value && value.includes(':') ? value : null
}

export function writeFocus(storage: MigrationStorage, key: string | null): void {
  try {
    if (key) storage.setItem(STORAGE_KEYS.focus, key)
  } catch {
    /* 隐私模式下写不进去，下次打开回到第一件 */
  }
}

/** 记一次之后 growthDays 该不该动，见 growth.nextGrowthDays */
export { itemKey }
