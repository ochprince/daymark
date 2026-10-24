/**
 * 收藏：图鉴、徽章、小纸条，以及每件事「见过的形态」（过场补播用）。
 *
 * 数据整体存成一份对象（daymark.collection.v1），见 docs/plan-v2.md 第 8.2 节。
 * 徽章解锁即弹窗；迁移时静默补发，不弹。
 */
import { createJsonStore } from './jsonStore'
import type { Stage } from './types'

const STORAGE_KEY = 'daymark.collection.v1'

export type BadgeId =
  | 'first'
  | 'd7'
  | 'd30'
  | 'd100'
  | 'd365'
  | 'back'
  | 'night'
  | 'early'
  | 'chapter'
  | 'bday'
  | 'share'
  | 'pumpkin'

export type BadgeDef = {
  id: BadgeId
  /** 文案键，正式文案在 i18n 里 */
  name: string
  desc: string
  hidden?: boolean
}

/** 徽章目录，顺序就是藏馆里的展示顺序 */
export const BADGES: readonly BadgeDef[] = [
  { id: 'first', name: '第一步', desc: '创建第一件事' },
  { id: 'd7', name: '一整周', desc: '任一件事长到 7 天' },
  { id: 'd30', name: '三十天', desc: '任一件事长到 30 天' },
  { id: 'd100', name: '一百天', desc: '任一件事长到 100 天' },
  { id: 'd365', name: '一年', desc: '任一件事长到 365 天' },
  { id: 'back', name: '回来了', desc: '第一次叫醒睡着的小伙伴' },
  { id: 'night', name: '夜猫子', desc: '在 0:00–4:59 记过一次' },
  { id: 'early', name: '早起鸟', desc: '在 5:00–5:59 记过一次' },
  { id: 'chapter', name: '翻篇', desc: '第一次结束一章' },
  { id: 'bday', name: '生日快乐', desc: '第一次陪一个倒数日走到那天' },
  { id: 'share', name: '晒一晒', desc: '第一次保存或分享卡片' },
  { id: 'pumpkin', name: '南瓜帽', desc: '万圣节当天打开 App', hidden: true },
]

export const BADGE_BY_ID: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map((badge) => [badge.id, badge]),
)

export type Note = {
  id: string
  text: string
  /** 署名：当时焦点小伙伴的名字 */
  from: string
  at: number
}

export type CollectionState = {
  /** 徽章 id → 解锁时刻 */
  badges: Record<string, number>
  /** 已解锁图鉴：`${species}:${stage}` */
  dex: string[]
  notes: Note[]
  /** 上一张纸条的时间，判断「距上次 ≥ 3 天」 */
  lastNoteAt?: number
  /** 这一周已经出了几张纸条（每周最多 2 张） */
  notesThisWeek?: { week: number; count: number }
  /** 每件事见过的最高形态：形态不倒退的依据 */
  peakStage: Record<string, Stage>
  /** 每件事「已经看过过场」的形态，避免重复播 */
  seenStage: Record<string, Stage>
  /** 节日彩蛋：节日 id → 已经看过的那一天（当天只触发一次） */
  festivalSeen: Record<string, number>
}

export function emptyCollection(): CollectionState {
  return {
    badges: {},
    dex: [],
    notes: [],
    notesThisWeek: undefined,
    peakStage: {},
    seenStage: {},
    festivalSeen: {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asStage(value: unknown): Stage | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const stage = Math.trunc(value)
  if (stage < 0 || stage > 4) return null
  return stage as Stage
}

function normalizeStageMap(input: unknown): Record<string, Stage> {
  const result: Record<string, Stage> = {}
  if (!isRecord(input)) return result
  for (const [key, value] of Object.entries(input)) {
    if (!key) continue
    const stage = asStage(value)
    if (stage !== null) result[key] = stage
  }
  return result
}

function normalizeBadges(input: unknown): Record<string, number> {
  const result: Record<string, number> = {}
  if (!isRecord(input)) return result
  for (const [key, value] of Object.entries(input)) {
    if (!BADGE_BY_ID[key]) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    result[key] = value
  }
  return result
}

function normalizeTimestampMap(input: unknown): Record<string, number> {
  const result: Record<string, number> = {}
  if (!isRecord(input)) return result
  for (const [key, value] of Object.entries(input)) {
    if (!key) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    result[key] = value
  }
  return result
}

function normalizeNotes(input: unknown): Note[] {
  if (!Array.isArray(input)) return []
  const result: Note[] = []
  for (const item of input) {
    if (!isRecord(item)) continue
    if (typeof item.id !== 'string' || typeof item.text !== 'string') continue
    if (typeof item.at !== 'number' || !Number.isFinite(item.at)) continue
    result.push({
      id: item.id,
      text: item.text,
      from: typeof item.from === 'string' ? item.from : '',
      at: item.at,
    })
  }
  return result.sort((a, b) => b.at - a.at)
}

export function normalizeCollection(input: unknown): CollectionState {
  if (!isRecord(input)) return emptyCollection()
  const note = input.notesThisWeek
  return {
    badges: normalizeBadges(input.badges),
    dex: Array.isArray(input.dex)
      ? [...new Set(input.dex.filter((key): key is string => typeof key === 'string' && key.length > 0))]
      : [],
    notes: normalizeNotes(input.notes),
    lastNoteAt:
      typeof input.lastNoteAt === 'number' && Number.isFinite(input.lastNoteAt)
        ? input.lastNoteAt
        : undefined,
    notesThisWeek:
      isRecord(note) &&
      typeof note.week === 'number' &&
      Number.isFinite(note.week) &&
      typeof note.count === 'number' &&
      Number.isFinite(note.count)
        ? { week: Math.trunc(note.week), count: Math.max(0, Math.trunc(note.count)) }
        : undefined,
    peakStage: normalizeStageMap(input.peakStage),
    seenStage: normalizeStageMap(input.seenStage),
    festivalSeen: normalizeTimestampMap(input.festivalSeen),
  }
}

export const collectionStore = createJsonStore<CollectionState>({
  key: STORAGE_KEY,
  normalize: normalizeCollection,
})

export const subscribe = collectionStore.subscribe
export const getCollection = collectionStore.get

export function hasBadge(state: CollectionState, id: BadgeId): boolean {
  return typeof state.badges[id] === 'number'
}

/** dex 键：`${species}:${stage}` */
export function dexKey(species: string, stage: Stage): string {
  return `${species}:${stage}`
}

/** 解锁图鉴（幂等） */
export function unlockDex(keys: readonly string[]): string[] {
  const state = collectionStore.get()
  const fresh = keys.filter((key) => key.length > 0 && !state.dex.includes(key))
  if (fresh.length === 0) return []
  collectionStore.patch({ dex: [...state.dex, ...fresh] })
  return fresh
}

/** 解锁徽章，返回这次真正解锁的（用来弹窗） */
export function unlockBadges(ids: readonly BadgeId[], now = Date.now()): BadgeId[] {
  const state = collectionStore.get()
  const fresh = ids.filter((id) => BADGE_BY_ID[id] && !hasBadge(state, id))
  if (fresh.length === 0) return []
  const badges = { ...state.badges }
  for (const id of fresh) badges[id] = now
  collectionStore.patch({ badges })
  return fresh
}

/** 静默补发（迁移时用，不弹窗） */
export function grantBadgesSilently(ids: readonly BadgeId[], at: number): void {
  const state = collectionStore.get()
  const badges = { ...state.badges }
  let changed = false
  for (const id of ids) {
    if (!BADGE_BY_ID[id] || hasBadge(state, id)) continue
    badges[id] = at
    changed = true
  }
  if (changed) collectionStore.patch({ badges })
}

/** 记下某件事见过的最高形态（只升不降） */
export function noteStage(itemKey: string, stage: Stage, kind: 'peak' | 'seen'): void {
  const state = collectionStore.get()
  const map = kind === 'peak' ? state.peakStage : state.seenStage
  const current = map[itemKey]
  if (typeof current === 'number' && current >= stage) return
  collectionStore.patch({ [kind]: { ...map, [itemKey]: stage } } as Partial<CollectionState>)
}

/** 过场是否还需要播：见过的形态低于当前形态 */
export function needsStageTransition(state: CollectionState, itemKey: string, stage: Stage): boolean {
  const seen = state.seenStage[itemKey]
  return typeof seen !== 'number' || seen < stage
}

export function addNote(note: Note): void {
  const state = collectionStore.get()
  collectionStore.patch({ notes: [note, ...state.notes].slice(0, 500) })
}

/* ------------------------------------------------------------------ *
 * 徽章条件
 * ------------------------------------------------------------------ */

export type BadgeContext = {
  /** 一共有几件事 */
  itemCount: number
  /** 所有事里最高的成长天数 */
  maxGrowth: number
  /** 有没有结束过至少一章 */
  hasChapter: boolean
  /** 这次是不是第一次叫醒睡着的小伙伴 */
  wokeUp?: boolean
  /** 这次记录发生的时刻（判夜猫子 / 早起鸟） */
  recordedAt?: number
  /** 这次是不是第一次陪倒数日走到当天 */
  celebratedCountdown?: boolean
  /** 这次是不是第一次保存 / 分享卡片 */
  sharedCard?: boolean
  /** 当天打开的节日 id（万圣节隐藏徽章） */
  festivalId?: string
}

/** 按条件算出「现在应该解锁哪些徽章」（不含已解锁的） */
export function evaluateBadges(ctx: BadgeContext, state: CollectionState): BadgeId[] {
  const fresh: BadgeId[] = []
  const add = (id: BadgeId, ok: boolean) => {
    if (ok && !hasBadge(state, id)) fresh.push(id)
  }

  add('first', ctx.itemCount >= 1)
  add('d7', ctx.maxGrowth >= 7)
  add('d30', ctx.maxGrowth >= 30)
  add('d100', ctx.maxGrowth >= 100)
  add('d365', ctx.maxGrowth >= 365)
  add('chapter', ctx.hasChapter)
  if (ctx.wokeUp) add('back', true)
  if (ctx.celebratedCountdown) add('bday', true)
  if (ctx.sharedCard) add('share', true)

  if (typeof ctx.recordedAt === 'number') {
    const hour = new Date(ctx.recordedAt).getHours()
    if (hour >= 0 && hour < 5) add('night', true)
    if (hour === 5) add('early', true)
  }

  if (ctx.festivalId === 'halloween') add('pumpkin', true)

  return fresh
}
