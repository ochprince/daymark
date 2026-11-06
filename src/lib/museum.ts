import { dexKey } from './collection'
import type { CollectionState } from './collection'
import type { ItemView } from './itemview'
import type { Stage, TodoItem } from './types'

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

/**
 * 每种小伙伴一套底色，形态只在这套底色里做深浅，不换色相。
 *
 * 原来是「形态换颜色」：第 0 到第 4 形态铺开 lemon→grape→mint→rose→lemon，
 * 同一只芽芽在五个阶段像五只不同的生物。颜色是「这是谁」的标记，不该随成长跳色。
 * 依据原型 docs/prototype-v2/tabs.js 的 DEX_HUE。
 */
export const SPECIES_HUE = {
  sprout: 'mint',
  moon: 'grape',
  drop: 'sky',
  star: 'lemon',
  post: 'coral',
} as const

export type SpeciesHue = (typeof SPECIES_HUE)[keyof typeof SPECIES_HUE]

export function speciesHue(species: string): SpeciesHue {
  return (SPECIES_HUE as Record<string, SpeciesHue>)[species] ?? SPECIES_HUE.sprout
}

/** 色相名 → 颜色索引（--h-0 … --h-7 的顺序），新建时默认配色用 */
const HUE_INDEX: Record<string, number> = {
  lemon: 0,
  coral: 1,
  grape: 2,
  sky: 3,
  mint: 4,
  lime: 5,
  rose: 6,
  slate: 7,
}

/** 新建一件事时的默认颜色：跟物种走，不按剩余色轮流分 */
export function speciesColor(species: string): number {
  return HUE_INDEX[speciesHue(species)] ?? 0
}

/** 形态越靠后，底色越沉一点：同一色相内 0→4 递增，只用来看进度 */
export function stageTint(stage: number): number {
  const clamped = Math.max(0, Math.min(4, Math.trunc(stage)))
  return 14 + clamped * 6
}
export const DEX_STAGE_COUNT = 5

/**
 * 倒数日「到过」的那些日子。
 *
 * 光靠 history 不够：history 是用户点「说过了」才写进去的，而 App 里根本没有
 * 那个入口（markSaid 没人调），于是卡上写着「那天已经到过」、藏馆里却空着，
 * 还配一句「那天到过之后会收进这里」——自相矛盾。
 * 「到过」是事实，不是操作：到点的那一刻就该算一章。
 */
export function countdownArrivals(
  view: ItemView & { kind: 'countdown' },
): { at: number; line?: string }[] {
  const out = [...(view.event.history ?? [])]
  const repeating = view.event.repeat !== undefined && view.event.repeat !== 'none'
  const arrived = repeating ? view.days === 0 : view.days <= 0
  const occurrence = view.next ?? view.event.startedAt
  if (arrived && !out.some((entry) => new Date(entry.at).toDateString() === new Date(occurrence).toDateString())) {
    out.unshift({ at: occurrence })
  }
  return out
}

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
      /*
       * 倒数日的「到过」一天只算一章。以前点两次「说过了」会插两条
       * （markSaid 没有去重），藏馆里就成了同一天两章，看着像记重了。
       */
      const seenDays = new Set<string>()
      countdownArrivals(view).forEach((entry, index) => {
        const day = new Date(entry.at).toDateString()
        if (seenDays.has(day)) return
        seenDays.add(day)
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
  /** 收进藏馆的那一刻（只有删掉的事才有）——架子上的书都是「过去」 */
  deletedAt?: number
  /** 删除时抄下来的备忘 / 待办：事没了，这些字还留在书里 */
  memo?: string
  todo?: TodoItem[]
  /** 每日打卡的原始记录（日期 → 当天次数）：删掉之后还能翻那本打卡日历 */
  checkedDays?: Record<string, number>
  /** 每次打卡的时刻（日期 → 时刻数组），日历点某一天时用来列几点几分 */
  checkedTimes?: Record<string, number[]>
  /** 打卡目标次数：决定日历里一天点亮到多深 */
  target?: number | null
}

export function collectBooks(
  views: readonly ItemView[],
  archived: readonly ShelfBook[] = [],
): ShelfBook[] {
  const chapters = collectChapters(views)
  const live = views
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
  // 删掉的事：书和章都还在架上，但已经不在今天页了
  const kept = archived.filter((book) => !views.some((view) => view.key === book.key))
  return [...live, ...kept].sort((a, b) => b.startedAt - a.startedAt)
}

/**
 * 藏馆书架上真正摆出来的书
 *
 * 还在今天页的事不上架：藏馆是「过去」，今天页是「现在」。
 * 以前两处都列，用户会问「这本书到底是删了还是没删」。
 */
export function shelfBooks(archived: readonly ShelfBook[]): ShelfBook[] {
  const seen = new Set<string>()
  const books: ShelfBook[] = []
  for (const book of archived) {
    if (seen.has(book.key)) continue
    seen.add(book.key)
    books.push(book)
  }
  return books.sort((a, b) => (b.deletedAt ?? b.startedAt) - (a.deletedAt ?? a.startedAt))
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
