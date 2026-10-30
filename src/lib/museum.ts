import { dexKey } from './collection'
import type { CollectionState } from './collection'
import type { ItemView } from './itemview'
import type { Stage } from './types'

/** 书架上的一本「书」：一件事结束过的某一章 */
export type ShelfChapter = {
  /** 唯一键：事项 key + 章节序号 */
  key: string
  itemKey: string
  title: string
  days: number
  endedAt: number
  color: number
  species: ItemView['species']
  stage: Stage
  line?: string
}

export const SPECIES_WITH_DEX = ['sprout', 'moon', 'drop', 'star'] as const
export const DEX_STAGE_COUNT = 5

/**
 * 把三类事的已结束章节收成书架上的书。
 * 坚持/习惯读 history / chapters；倒数日到过的那天也算一章（★）。
 */
export function collectChapters(views: readonly ItemView[]): ShelfChapter[] {
  const books: ShelfChapter[] = []
  for (const view of views) {
    if (view.kind === 'since') {
      ;(view.event.history ?? []).forEach((chapter, index) => {
        books.push({
          key: `${view.key}#${index}`,
          itemKey: view.key,
          title: view.title,
          days: chapter.days,
          endedAt: chapter.endedAt,
          color: view.color,
          species: view.species,
          stage: chapter.stage ?? view.stage,
          line: chapter.line,
        })
      })
    } else if (view.kind === 'habit') {
      ;(view.event.chapters ?? []).forEach((chapter, index) => {
        books.push({
          key: `${view.key}#${index}`,
          itemKey: view.key,
          title: view.title,
          days: chapter.days,
          endedAt: chapter.endedAt,
          color: view.color,
          species: view.species,
          stage: chapter.stage ?? view.stage,
          line: chapter.line,
        })
      })
    } else {
      ;(view.event.history ?? []).forEach((entry, index) => {
        books.push({
          key: `${view.key}#${index}`,
          itemKey: view.key,
          title: view.title,
          days: 0,
          endedAt: entry.at,
          color: view.color,
          species: view.species,
          stage: 0,
          line: entry.line,
        })
      })
    }
  }
  return books.sort((a, b) => b.endedAt - a.endedAt)
}

/**
 * 书架上的一本书 = 一件事。翻过的章节夹在书里，点开才看得到。
 *
 * 之前书架是「一章一本书」，同一件事每重置一次就多一本，7 段坚持铺成 7 本书；
 * 现在一件事实体一本书，章数写在书脊上的小角标里。
 */
export type ShelfBook = {
  key: string
  title: string
  kind: ItemView['kind']
  color: number
  species: ItemView['species']
  stage: Stage
  /** 这本书的「厚度」：坚持=走过天数，习惯=记过的天数，倒数=还有几天（0 = 已到） */
  days: number
  /** 当前这一章从哪天开始（倒数日是自己的起始日，排序也按它） */
  startedAt: number
  /** 倒数日的「下一次」那天；其它种类没有 */
  nextAt?: number
  /** 翻过的章节，新的在前 */
  chapters: ShelfChapter[]
}

export function collectBooks(views: readonly ItemView[]): ShelfBook[] {
  const chapters = collectChapters(views)
  return views
    .map((view): ShelfBook => {
      const mine = chapters.filter((chapter) => chapter.itemKey === view.key)
      const days =
        view.kind === 'since' ? view.days : view.kind === 'habit' ? view.growth : Math.max(0, view.days)
      const startedAt =
        view.kind === 'since'
          ? view.event.startedAt
          : view.kind === 'habit'
            ? (mine[0]?.endedAt ?? view.event.createdAt)
            : view.event.startedAt
      return {
        key: view.key,
        title: view.title,
        kind: view.kind,
        color: view.color,
        species: view.species,
        stage: view.stage,
        days,
        startedAt,
        nextAt: view.kind === 'countdown' ? view.next : undefined,
        chapters: mine,
      }
    })
    .sort((a, b) => b.startedAt - a.startedAt)
}

/** 图鉴总数：四个物种 × 五个形态 + 特别篇三格 */
export const DEX_TOTAL = SPECIES_WITH_DEX.length * DEX_STAGE_COUNT + 3

/** 已收集的图鉴格子数（信信默认在场） */
export function dexCount(collection: CollectionState): number {
  const own = collection.dex.filter((key) => !key.startsWith('post')).length
  return Math.min(own + 1 + (collection.badges.pumpkin ? 1 : 0), DEX_TOTAL)
}

/** 某个物种已收集几格（0..5） */
export function dexCountOf(collection: CollectionState, species: (typeof SPECIES_WITH_DEX)[number]): number {
  let total = 0
  for (let stage = 0; stage < DEX_STAGE_COUNT; stage += 1) {
    if (collection.dex.includes(dexKey(species, stage as Stage))) total += 1
  }
  return total
}

export function hasDex(collection: CollectionState, species: (typeof SPECIES_WITH_DEX)[number], stage: number): boolean {
  return collection.dex.includes(dexKey(species, stage as Stage))
}

/** 徽章解锁数 */
export function badgeCount(collection: CollectionState): number {
  return Object.keys(collection.badges).length
}
