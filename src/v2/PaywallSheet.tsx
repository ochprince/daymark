import { useState } from 'react'
import { FREE_ITEM_LIMIT } from '../lib/entitlement'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import { purchasePro, restorePro } from '../lib/purchase'

export type PaywallSheetProps = {
  /** 'limit' = 撞到免费上限时弹的；'upgrade' = 主动点进来的 */
  mode?: 'limit' | 'upgrade'
  onClose: () => void
  onUnlocked: (message: string) => void
  onToast: (message: string) => void
}

const BENEFITS: MessageKey[] = ['pro.benefit.items', 'pro.benefit.skins', 'pro.benefit.museum', 'pro.benefit.share']

export function PaywallSheet({ mode = 'upgrade', onClose, onUnlocked, onToast }: PaywallSheetProps) {
  const [busy, setBusy] = useState(false)

  async function buy() {
    setBusy(true)
    const result = await purchasePro()
    setBusy(false)
    if (result.ok) {
      onUnlocked(t('pro.thanks'))
      return
    }
    if (result.reason === 'cancelled') onToast(t('pro.cancelled'))
    else if (result.reason === 'unavailable') onToast(t('pro.unavailable'))
    else onToast(t('pro.failed'))
  }

  async function restore() {
    setBusy(true)
    const result = await restorePro()
    setBusy(false)
    if (result.ok) onUnlocked(t('pro.restored'))
    else onToast(t('pro.failed'))
  }

  return (
    <div className="ov" style={{ zIndex: 65 }}>
      <div className="dim" onClick={onClose} />
      <div className="sheet paywall" role="dialog" aria-modal="true">
        <div className="sheet-h">{mode === 'limit' ? t('pro.limitTitle', { n: FREE_ITEM_LIMIT }) : t('pro.title')}</div>
        <p className="sheet-sub">
          {mode === 'limit' ? t('pro.limitBody') : t('pro.sub')}
        </p>

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

        <button className="btn block" type="button" disabled={busy} onClick={buy}>
          {t('pro.cta', { price: t('pro.price') })}
        </button>
        <button className="btn ghost block" type="button" disabled={busy} onClick={restore}>
          {t('pro.restore')}
        </button>
        <button className="link-row" type="button" onClick={onClose}>
          {mode === 'limit' ? t('pro.keepWriting') : t('pro.later')}
        </button>
      </div>
    </div>
  )
}
