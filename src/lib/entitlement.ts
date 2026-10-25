/**
 * 免费版 / 买断版的分界线。
 *
 * 口径（可在上架前调整，改这里一处就够）：
 * - 免费：2 件事、软糖皮肤、完整记录与档案、藏馆里最近 3 本书
 * - 买断：无限件事、四套皮肤、藏馆全部章节、分享卡、以及之后的新功能
 *
 * 原则：**不拿走用户已经写下的东西**。降级只影响「新增」和「陈列更多」，
 * 已有的数据一律可读、可导出——这条比任何转化率都重要。
 */
import { createJsonStore } from './jsonStore'

export const ENTITLEMENT_STORAGE_KEY = 'daymark.entitlement.v1'

export type EntitlementState = {
  /** 是否已经买断（永久） */
  pro: boolean
  /** 购买时间，仅作记录 */
  purchasedAt: number | null
  /** 上次校验时间（离线优先，不做强制回连） */
  checkedAt: number | null
}

export const DEFAULT_ENTITLEMENT: EntitlementState = {
  pro: false,
  purchasedAt: null,
  checkedAt: null,
}

/** 免费版能同时存在几件事 */
export const FREE_ITEM_LIMIT = 2

/** 免费版能在藏馆里翻开的章节数 */
export const FREE_CHAPTER_LIMIT = 3

/** 免费版能用的皮肤包 */
export const FREE_SKIN_PACKS = ['jelly'] as const

/** 免费版能不能用分享卡 */
export const FREE_SHARE_CARD = false

export function normalizeEntitlement(input: unknown): EntitlementState {
  if (typeof input !== 'object' || input === null) return { ...DEFAULT_ENTITLEMENT }
  const value = input as Partial<EntitlementState>
  return {
    pro: value.pro === true,
    // NaN 也是 'number'，这里必须用 isFinite 兜住
    purchasedAt: Number.isFinite(value.purchasedAt) ? (value.purchasedAt as number) : null,
    checkedAt: Number.isFinite(value.checkedAt) ? (value.checkedAt as number) : null,
  }
}

export const entitlementStore = createJsonStore<EntitlementState>({
  key: ENTITLEMENT_STORAGE_KEY,
  normalize: normalizeEntitlement,
})

export const subscribe = entitlementStore.subscribe

export function getEntitlement(): EntitlementState {
  return entitlementStore.get()
}

export function isPro(): boolean {
  return entitlementStore.get().pro
}

/** 拿到买断之后写入本地；幂等 */
export function grantPro(at: number = Date.now()): void {
  const state = entitlementStore.get()
  if (state.pro) return
  entitlementStore.patch({ pro: true, purchasedAt: at, checkedAt: at })
}

/** 撤销（退款 / 恢复失败）。不会删除用户数据，只是回到免费口径 */
export function revokePro(): void {
  entitlementStore.patch({ pro: false, purchasedAt: null, checkedAt: Date.now() })
}

/** 还能不能再加一件事 */
export function canAddItem(currentCount: number): boolean {
  if (isPro()) return true
  return currentCount < FREE_ITEM_LIMIT
}

/** 加不了事的时候还剩几个名额（给文案用） */
export function remainingSlots(currentCount: number): number {
  if (isPro()) return Number.POSITIVE_INFINITY
  return Math.max(0, FREE_ITEM_LIMIT - currentCount)
}

/** 某个皮肤包能不能用 */
export function canUseSkin(pack: string): boolean {
  if (isPro()) return true
  return (FREE_SKIN_PACKS as readonly string[]).includes(pack)
}

/** 藏馆里第 index 本书（从 0 开始）能不能翻开 */
export function canOpenChapter(index: number): boolean {
  if (isPro()) return true
  return index < FREE_CHAPTER_LIMIT
}

/** 分享卡 */
export function canShareCard(): boolean {
  return isPro() || FREE_SHARE_CARD
}

export function reloadEntitlement(): void {
  entitlementStore.reload()
}
