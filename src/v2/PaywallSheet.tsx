import { useState } from 'react'
import { FREE_ITEM_LIMIT } from '../lib/entitlement'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import { purchaseLife, purchaseYear, restore } from '../lib/purchase'
import type { ProPlan, PurchaseResult } from '../lib/purchase'
import './paywall.css'

export type PaywallSheetProps = {
  /** 'limit' = 撞到免费上限时弹的；'upgrade' = 主动点进来的 */
  mode?: 'limit' | 'upgrade'
  onClose: () => void
  onUnlocked: (message: string) => void
  onToast: (message: string) => void
}

/** Pro 多给的东西：宠物包、皮肤、实时活动、闹钟、同步、不限件数 */
const BENEFITS: MessageKey[] = [
  'pay.benefit.items',
  'pay.benefit.pets',
  'pay.benefit.skins',
  'pay.benefit.live',
  'pay.benefit.alarm',
  'pay.benefit.sync',
]

type Busy = ProPlan | 'restore' | null

export function PaywallSheet({ mode = 'upgrade', onClose, onUnlocked, onToast }: PaywallSheetProps) {
  const [busy, setBusy] = useState<Busy>(null)

  function reportFailure(result: Extract<PurchaseResult, { ok: false }>): void {
    if (result.reason === 'unavailable') onToast(t('pro.unavailable'))
    else if (result.reason === 'cancelled') onToast(t('pro.cancelled'))
    else if (result.reason === 'none') onToast(t('pay.nothingToRestore'))
    else onToast(t('pro.failed'))
  }

  async function buy(plan: ProPlan) {
    if (busy) return
    setBusy(plan)
    const result = plan === 'year' ? await purchaseYear() : await purchaseLife()
    setBusy(null)
    if (result.ok) {
      onUnlocked(t(result.plan === 'life' ? 'pay.thanks.life' : 'pay.thanks.year'))
      return
    }
    reportFailure(result)
  }

  async function restorePurchase() {
    if (busy) return
    setBusy('restore')
    const result = await restore()
    setBusy(null)
    if (result.ok) {
      onUnlocked(t('pro.restored'))
      return
    }
    reportFailure(result)
  }

  return (
    <div className="ov" style={{ zIndex: 65 }}>
      <div className="dim" onClick={onClose} aria-hidden="true" />
      <div className="sheet paywall pw" role="dialog" aria-modal="true">
        <div className="sheet-h">{mode === 'limit' ? t('pro.limitTitle', { n: FREE_ITEM_LIMIT }) : t('pay.title')}</div>
        <p className="sheet-sub">{mode === 'limit' ? t('pro.limitBody') : t('pay.sub')}</p>

        <ul className="paywall-list">
          {BENEFITS.map((key) => (
            <li key={key}>
              <span className="paywall-tick" aria-hidden="true">
                ✓
              </span>
              {t(key, { n: FREE_ITEM_LIMIT })}
            </li>
          ))}
        </ul>

        <p className="pw-free">{t('pay.freeNote', { n: FREE_ITEM_LIMIT })}</p>

        <div className="pw-plans">
          <button
            className="pw-plan is-on"
            type="button"
            disabled={busy !== null}
            aria-pressed="true"
            onClick={() => void buy('year')}
          >
            <span className="pw-ribbon">{t('pay.recommend')}</span>
            <b className="pw-name">{t('pay.year.name')}</b>
            <span className="pw-price">
              {t('pay.year.price')}
              <small>{t('pay.year.unit')}</small>
            </span>
            <span className="pw-meta">{t('pay.year.monthly')}</span>
            <span className="pw-tag">{t('pay.year.trial')}</span>
          </button>

          <button
            className="pw-plan"
            type="button"
            disabled={busy !== null}
            aria-pressed="false"
            onClick={() => void buy('life')}
          >
            <b className="pw-name">{t('pay.life.name')}</b>
            <span className="pw-price">
              {t('pay.life.price')}
              <small>{t('pay.life.unit')}</small>
            </span>
            <span className="pw-meta">{t('pay.life.note')}</span>
          </button>
        </div>

        <p className="pw-note">{t('pay.year.note')}</p>

        <div className="pw-foot">
          <p className="pw-status">{busy ? t(busy === 'restore' ? 'pay.restoring' : 'pay.buying') : t('pay.fine')}</p>
          <button className="pw-restore" type="button" disabled={busy !== null} onClick={() => void restorePurchase()}>
            {busy === 'restore' ? t('pay.restoring') : t('pay.restore')}
          </button>
          <button className="link-row" type="button" onClick={onClose}>
            {mode === 'limit' ? t('pro.keepWriting') : t('pro.later')}
          </button>
        </div>
      </div>
    </div>
  )
}
