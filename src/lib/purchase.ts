/**
 * 购买入口。
 *
 * App Store 的数字商品必须走 IAP（StoreKit / StoreKit 2），不能放外部支付链接。
 * 这里只做一层薄桥：原生壳里由 Capacitor 插件实现 `window.__DAYMARK_STORE__`，
 * Web 环境下没有这个对象，就如实告诉用户「商店还没准备好」，不做假购买。
 *
 * 上架时要做的事（不在代码里，人工完成）：
 * 1. App Store Connect 建一个非消耗型 IAP，productId `com.liangyi.daymark.pro`
 * 2. 价格选最低档 $0.99
 * 3. 原生插件把 buy/restore 的结果回调到这里
 */
import { grantPro, isPro, revokePro } from './entitlement'

export const PRO_PRODUCT_ID = 'com.liangyi.daymark.pro'

export type PurchaseResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'pending' | 'failed'; detail?: string }

type NativeStore = {
  /** 商店在本机可用（已绑 Apple ID、能拉起支付面板） */
  isAvailable: () => Promise<boolean>
  /** 拉起支付；成功返回 true */
  purchase: (productId: string) => Promise<boolean>
  /** 恢复购买（换机、重装） */
  restore: () => Promise<boolean>
  /** 查询当前是否已购 */
  isPurchased: () => Promise<boolean>
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

/** 买断 */
export async function purchasePro(): Promise<PurchaseResult> {
  const native = store()
  if (!native) return { ok: false, reason: 'unavailable' }
  try {
    const available = await native.isAvailable()
    if (!available) return { ok: false, reason: 'unavailable' }
    const bought = await native.purchase(PRO_PRODUCT_ID)
    if (!bought) return { ok: false, reason: 'cancelled' }
    grantPro()
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }
}

/** 恢复购买：换机之后点这个 */
export async function restorePro(): Promise<PurchaseResult> {
  const native = store()
  if (!native) return { ok: false, reason: 'unavailable' }
  try {
    const owned = await native.restore()
    if (!owned) return { ok: false, reason: 'failed' }
    grantPro()
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }
}

/** 启动时对一次账（离线优先：查不到就保持本地状态，不因为断网降级） */
export async function syncEntitlement(): Promise<void> {
  const native = store()
  if (!native) return
  try {
    const owned = await native.isPurchased()
    if (owned) grantPro()
    else if (isPro()) revokePro()
  } catch {
    // 查不到就维持现状
  }
}
