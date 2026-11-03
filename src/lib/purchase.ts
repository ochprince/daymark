/**
 * 购买入口（v3 双轨：年费订阅 + 永久买断）。
 *
 * App Store 的数字商品必须走 IAP（StoreKit / StoreKit 2），不能放外部支付链接。
 * 这里只做一层薄桥：原生壳里由 Capacitor 插件实现 `window.__DAYMARK_STORE__`。
 * **Web 环境下没有这个对象，就统一返回 `unavailable`**，由调用方弹「商店暂时连不上」——
 * 绝不写假权益、绝不本地解锁。
 *
 * 商品（App Store Connect 里要建的，人工完成）：
 * 1. `com.liangyi.daymark.pro.year` — 自动续期订阅，含 7 天开场优惠，¥18 / 年
 * 2. `com.liangyi.daymark.pro.life` — 非消耗型，¥28 一次买断
 *
 * 原生壳约定（换原生实现时照这个签名）：
 * - `purchase(productId)` 成功回 `true`，或回 `{ ok: true, trialEndsAt }` 告诉你
 *   这笔走的是开场优惠（JS 侧据此记成 `trial`）
 * - `restore()` 回 **命中的 productId 或 id 数组**（StoreKit 的
 *   `transaction.productIdentifier`）；只回 `true` 的话无法区分年费与永久，
 *   JS 侧宁可报「没有完成」，也不会猜一个档位写进本地
 */
import { grantLife, grantTrial, grantYear, isPro, revokePro } from './entitlement'

/** 年费（自动续期订阅） */
export const PRO_PRODUCT_ID_YEAR = 'com.liangyi.daymark.pro.year'

/** 永久买断（非消耗型） */
export const PRO_PRODUCT_ID_LIFE = 'com.liangyi.daymark.pro.life'

export type ProPlan = 'year' | 'life'

export type ProProduct = {
  id: string
  plan: ProPlan
  /** subscription = 自动续期；nonConsumable = 一次买断 */
  kind: 'subscription' | 'nonConsumable'
}

export const PRO_PRODUCTS: readonly ProProduct[] = [
  { id: PRO_PRODUCT_ID_YEAR, plan: 'year', kind: 'subscription' },
  { id: PRO_PRODUCT_ID_LIFE, plan: 'life', kind: 'nonConsumable' },
]

/** 旧常量：$0.99 买断那个 id 对应的就是现在的永久版，留着给旧原生层引用 */
export const PRO_PRODUCT_ID = PRO_PRODUCT_ID_LIFE

/** 统一结果：`unavailable` = 商店连不上（Web 无桥一律走这条） */
export type PurchaseResult =
  | { ok: true; plan: ProPlan }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'pending' | 'none' | 'failed'; detail?: string }

type NativePurchaseResult = boolean | { ok: boolean; trialEndsAt?: string }

type NativeStore = {
  /** 商店在本机可用（已绑 Apple ID、能拉起支付面板） */
  isAvailable: () => Promise<boolean>
  /** 拉起支付；成功回 true，或回 { ok, trialEndsAt } */
  purchase: (productId: string) => Promise<NativePurchaseResult>
  /** 恢复购买；回命中的 productId（或数组），没有则回 false */
  restore: () => Promise<boolean | string | string[]>
  /** 查询当前是否已购；旧壳只有布尔，新壳建议补 ownedProducts */
  isPurchased: () => Promise<boolean>
  /** 可选：直接告诉 JS 侧当前有效的 productId 列表（最准的对账方式） */
  ownedProducts?: () => Promise<string[]>
}

declare global {
  interface Window {
    __DAYMARK_STORE__?: NativeStore
  }
}

function store(): NativeStore | null {
  if (typeof window === 'undefined') return null
  return window.__DAYMARK_STORE__ ?? null
}

export function storeAvailable(): boolean {
  return store() !== null
}

/** Web（没有原生桥）时的统一答复 */
const UNAVAILABLE: PurchaseResult = { ok: false, reason: 'unavailable' }

function readPurchaseResult(raw: NativePurchaseResult): { ok: boolean; trialEndsAt?: string } {
  if (typeof raw === 'boolean') return { ok: raw }
  if (typeof raw === 'object' && raw !== null) {
    return { ok: raw.ok === true, trialEndsAt: raw.trialEndsAt }
  }
  return { ok: false }
}

function productIds(raw: unknown): string[] {
  if (typeof raw === 'string') return [raw]
  if (Array.isArray(raw)) return raw.filter((value): value is string => typeof value === 'string')
  return []
}

/** 把商店回报的已购商品写进本地权益；命中返回 true */
function applyOwnedProducts(ids: readonly string[], atMs: number): boolean {
  if (ids.includes(PRO_PRODUCT_ID_LIFE)) {
    grantLife(atMs)
    return true
  }
  if (ids.includes(PRO_PRODUCT_ID_YEAR)) {
    grantYear(atMs)
    return true
  }
  return false
}

async function buy(plan: ProPlan): Promise<PurchaseResult> {
  const product = PRO_PRODUCTS.find((item) => item.plan === plan)
  if (!product) return { ok: false, reason: 'failed', detail: `unknown plan ${plan}` }

  const native = store()
  if (!native) return UNAVAILABLE

  try {
    const available = await native.isAvailable()
    if (!available) return UNAVAILABLE

    const { ok, trialEndsAt } = readPurchaseResult(await native.purchase(product.id))
    if (!ok) return { ok: false, reason: 'cancelled' }

    const atMs = Date.now()
    if (plan === 'life') grantLife(atMs)
    else if (trialEndsAt && Number.isFinite(Date.parse(trialEndsAt))) grantTrial(atMs, trialEndsAt)
    else grantYear(atMs)
    return { ok: true, plan }
  } catch (error) {
    return { ok: false, reason: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }
}

/** 年费：自动续期订阅（含 7 天开场优惠） */
export async function purchaseYear(): Promise<PurchaseResult> {
  return buy('year')
}

/** 永久：一次买断，不再扣费 */
export async function purchaseLife(): Promise<PurchaseResult> {
  return buy('life')
}

/** 恢复购买：换机、重装之后点这个 */
export async function restore(): Promise<PurchaseResult> {
  const native = store()
  if (!native) return UNAVAILABLE
  try {
    const raw = await native.restore()
    const ids = productIds(raw)
    if (ids.length > 0) {
      const atMs = Date.now()
      if (applyOwnedProducts(ids, atMs)) {
        return { ok: true, plan: ids.includes(PRO_PRODUCT_ID_LIFE) ? 'life' : 'year' }
      }
      return { ok: false, reason: 'none' }
    }
    // 只回布尔 true 的旧壳：分不清年费还是永久，如实说没恢复，不猜一个档位写进去
    if (raw === true) {
      return { ok: false, reason: 'failed', detail: 'store did not report which product was restored' }
    }
    return { ok: false, reason: 'none' }
  } catch (error) {
    return { ok: false, reason: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }
}

/** 启动时对一次账（离线优先：查不到就保持本地状态，不因为断网降级） */
export async function syncEntitlement(atMs: number = Date.now()): Promise<void> {
  const native = store()
  if (!native) return
  try {
    if (native.ownedProducts) {
      const ids = await native.ownedProducts()
      if (applyOwnedProducts(ids, atMs)) return
      if (isPro(atMs)) revokePro(atMs)
      return
    }
    const owned = await native.isPurchased()
    if (owned) {
      // 旧壳只有布尔，且那时只有买断一个商品：按永久口径补齐，不覆盖已开通的年费
      if (!isPro(atMs)) grantLife(atMs)
      return
    }
    if (isPro(atMs)) revokePro(atMs)
  } catch {
    // 查不到就维持现状
  }
}
