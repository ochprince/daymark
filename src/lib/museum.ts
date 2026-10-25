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
