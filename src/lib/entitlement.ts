/**
 * 免费版 / Pro 的分界线（v3 双轨口径）。
 *
 * 口径（改这里一处就够）：
 * - 免费：同时 8 件事、软糖皮肤、完整记录与档案、宠物成长与藏馆、
 *   通知与小组件、藏馆里最近 3 本书
 * - Pro：更多宠物包、更多皮肤与配色、锁屏实时活动与灵动岛、
 *   闹钟式提醒、iCloud 同步、不限件数
 *
 * 状态机（`status` + `proUntil`）：
 *   free  ──试用──▶ trial ──到期──▶ free（自动回落，不写库）
 *   free  ──年费──▶ year  ──到期──▶ free（同上）
 *   free  ──买断──▶ life   （永不过期，proUntil 恒为 undefined）
 *
 * 旧数据 `{ pro: true }`（$0.99 买断时代）读出即视为 `life`：迁移不丢权益，
 * 存储 key 不变，第一次写入时自动换成新结构。
 *
 * 原则：**不拿走用户已经写下的东西**。降级只影响「新增」和「陈列更多」，
 * 已有的数据一律可读、可导出——这条比任何转化率都重要。
 */
import { createJsonStore } from './jsonStore'

export const ENTITLEMENT_STORAGE_KEY = 'daymark.entitlement.v1'

export type EntitlementStatus = 'free' | 'trial' | 'year' | 'life'

export type EntitlementState = {
  status: EntitlementStatus
  /** 试用 / 年费的到期时间（ISO 日期）；free 与 life 均为 undefined */
  proUntil?: string
  /** 首次购买时间，仅作记录 */
  purchasedAt: number | null
  /** 上次校验时间（离线优先，不做强制回连） */
  checkedAt: number | null
}

export const ENTITLEMENT_STATUSES: readonly EntitlementStatus[] = ['free', 'trial', 'year', 'life']

export const DEFAULT_ENTITLEMENT: EntitlementState = {
  status: 'free',
  proUntil: undefined,
  purchasedAt: null,
  checkedAt: null,
}

/** 免费版能同时存在几件事（用户定案：8） */
export const FREE_ITEM_LIMIT = 8

/** 免费版能在藏馆里翻开的章节数 */
export const FREE_CHAPTER_LIMIT = 3

/** 免费版能用的皮肤包 */
export const FREE_SKIN_PACKS = ['jelly'] as const

/** 免费版能不能用分享卡 */
export const FREE_SHARE_CARD = false

/** 年费试用天数（对应 App Store 的开场优惠） */
export const TRIAL_DAYS = 7

const DAY_MS = 86_400_000

function toMs(now: number | Date): number {
  return now instanceof Date ? now.getTime() : now
}

/** 合法 ISO 日期就归一成标准串，否则 null（坏数据一律当「没有」） */
function parseIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

export function normalizeEntitlement(input: unknown): EntitlementState {
  if (typeof input !== 'object' || input === null) return { ...DEFAULT_ENTITLEMENT }
  const value = input as Record<string, unknown>
  // NaN 也是 'number'，这里必须用 isFinite 兜住
  const purchasedAt = Number.isFinite(value.purchasedAt) ? (value.purchasedAt as number) : null
  const checkedAt = Number.isFinite(value.checkedAt) ? (value.checkedAt as number) : null

  if (typeof value.status === 'string' && (ENTITLEMENT_STATUSES as readonly string[]).includes(value.status)) {
    const status = value.status as EntitlementStatus
    if (status === 'trial' || status === 'year') {
      const proUntil = parseIsoDate(value.proUntil)
      // 有期限却说不清什么时候到期 → 宁可算免费，也不误开 Pro
      if (proUntil === null) return { status: 'free', proUntil: undefined, purchasedAt, checkedAt }
      return { status, proUntil, purchasedAt, checkedAt }
    }
    return { status, proUntil: undefined, purchasedAt, checkedAt }
  }

  // 旧结构：$0.99 买断过的用户迁移成永久（life），权益一份不丢
  if (value.pro === true) {
    return { status: 'life', proUntil: undefined, purchasedAt, checkedAt }
  }
  return { status: 'free', proUntil: undefined, purchasedAt, checkedAt }
}

export const entitlementStore = createJsonStore<EntitlementState>({
  key: ENTITLEMENT_STORAGE_KEY,
  normalize: normalizeEntitlement,
})

export const subscribe = entitlementStore.subscribe

export function getEntitlement(): EntitlementState {
  return entitlementStore.get()
}

/**
 * 预览构建（VITE_PREVIEW=1）里把所有付费闸门放开，方便审核时点到全部功能。
 *
 * 只认构建期变量：主站 CI（main）与本地普通构建都不带它；想在本机同样放开就
 * `VITE_PREVIEW=1 npm run dev`。上线前删掉这个常量即可，闸门全部回到下面的判断。
 */
const PREVIEW_UNLOCK = import.meta.env?.VITE_PREVIEW === '1'

/** 预览构建是否处于「全解锁」，UI 上用来提示，不参与任何持久化 */
export const previewUnlocked = PREVIEW_UNLOCK

/**
 * 现在算不算 Pro。
 *
 * 试用 / 年费过了 `proUntil` 就**当场**回落 free：不写库、不改用户数据，
 * 只让判断结果变 false（下次对账时状态自然被纠正）。
 * 日期坏掉（NaN）同样算免费——宁可少开，不可多开。
 */
export function isPro(now: number | Date = Date.now()): boolean {
  if (PREVIEW_UNLOCK) return true
  const state = entitlementStore.get()
  if (state.status === 'life') return true
  if (state.status === 'free') return false
  const until = state.proUntil ? Date.parse(state.proUntil) : Number.NaN
  if (!Number.isFinite(until)) return false
  return toMs(now) < until
}

/** 把「到期了但还没对账」的状态折成用户实际看到的那一档 */
export function effectiveStatus(now: number | Date = Date.now()): EntitlementStatus {
  const state = entitlementStore.get()
  if (state.status === 'life' || state.status === 'free') return state.status
  return isPro(now) ? state.status : 'free'
}

/** 还剩几天（不足一天算 1 天，已过期或永久返回 null） */
export function proDaysLeft(now: number | Date = Date.now()): number | null {
  const state = entitlementStore.get()
  if (state.status === 'life') return null
  if (!state.proUntil) return null
  const until = Date.parse(state.proUntil)
  if (!Number.isFinite(until)) return null
  const left = until - toMs(now)
  if (left <= 0) return null
  return Math.ceil(left / DAY_MS)
}

/** 试用：默认从现在起 7 天；商店回报了确切到期日就照它写 */
export function grantTrial(atMs: number = Date.now(), untilIso?: string): void {
  const parsed = parseIsoDate(untilIso)
  const proUntil = parsed ?? new Date(atMs + TRIAL_DAYS * DAY_MS).toISOString()
  entitlementStore.patch({
    status: 'trial',
    proUntil,
    purchasedAt: entitlementStore.get().purchasedAt ?? atMs,
    checkedAt: atMs,
  })
}

/** 年费：一年有效期（到期后由 isPro 自动回落，不写库） */
export function grantYear(atMs: number = Date.now()): void {
  entitlementStore.patch({
    status: 'year',
    proUntil: new Date(atMs + 365 * DAY_MS).toISOString(),
    purchasedAt: entitlementStore.get().purchasedAt ?? atMs,
    checkedAt: atMs,
  })
}

/** 永久买断：没有到期日 */
export function grantLife(atMs: number = Date.now()): void {
  entitlementStore.patch({
    status: 'life',
    proUntil: undefined,
    purchasedAt: entitlementStore.get().purchasedAt ?? atMs,
    checkedAt: atMs,
  })
}

/**
 * 旧接口：拿到买断之后写入本地；幂等。
 *
 * 已经开着 Pro（试用 / 年费 / 永久）就什么都不做——否则 App 壳里那句
 * 「onUnlocked 后 grantPro()」会把刚买的年费悄悄升级成永久。
 */
export function grantPro(atMs: number = Date.now()): void {
  if (isPro(atMs)) return
  grantLife(atMs)
}

/** 撤销（退款 / 恢复失败 / 商店说没有）。不会删除用户数据，只是回到免费口径 */
export function revokePro(atMs: number = Date.now()): void {
  entitlementStore.patch({ status: 'free', proUntil: undefined, purchasedAt: null, checkedAt: atMs })
}

/**
 * 统一门禁：所有「要不要拦」都从这里问，别在页面里各写一套。
 * 页面侧只需要 `canUse({ kind: 'skin', pack })` 这种一次判断。
 */
export type ProSubject =
  | { kind: 'item'; count: number }
  | { kind: 'chapter'; index: number }
  | { kind: 'skin'; pack: string }
  | { kind: 'shareCard' }
  | { kind: 'pets' }
  | { kind: 'liveActivity' }
  | { kind: 'alarm' }
  | { kind: 'icloud' }

export function canUse(subject: ProSubject, now: number | Date = Date.now()): boolean {
  switch (subject.kind) {
    case 'item':
      return isPro(now) || subject.count < FREE_ITEM_LIMIT
    case 'chapter':
      return isPro(now) || subject.index < FREE_CHAPTER_LIMIT
    case 'skin':
      return isPro(now) || (FREE_SKIN_PACKS as readonly string[]).includes(subject.pack)
    case 'shareCard':
      return isPro(now) || FREE_SHARE_CARD
    // 情绪层：宠物包 / 实时活动 / 闹钟 / 同步，只有 Pro 有
    case 'pets':
    case 'liveActivity':
    case 'alarm':
    case 'icloud':
      return isPro(now)
  }
}

/** 还能不能再加一件事 */
export function canAddItem(currentCount: number, now: number | Date = Date.now()): boolean {
  return canUse({ kind: 'item', count: currentCount }, now)
}

/** 加不了事的时候还剩几个名额（给文案用） */
export function remainingSlots(currentCount: number, now: number | Date = Date.now()): number {
  if (isPro(now)) return Number.POSITIVE_INFINITY
  return Math.max(0, FREE_ITEM_LIMIT - currentCount)
}

/** 某个皮肤包能不能用 */
export function canUseSkin(pack: string, now: number | Date = Date.now()): boolean {
  return canUse({ kind: 'skin', pack }, now)
}

/** 藏馆里第 index 本书（从 0 开始）能不能翻开 */
export function canOpenChapter(index: number, now: number | Date = Date.now()): boolean {
  return canUse({ kind: 'chapter', index }, now)
}

/** 分享卡 */
export function canShareCard(now: number | Date = Date.now()): boolean {
  return canUse({ kind: 'shareCard' }, now)
}

export function reloadEntitlement(): void {
  entitlementStore.reload()
}
