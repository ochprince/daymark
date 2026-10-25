import { Badge } from '../components/Creature'
import { BADGE_BY_ID } from '../lib/collection'
import type { BadgeId } from '../lib/collection'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'

/** 徽章图形：同一套目录，不同 id 用不同图案（见 prototype badge()） */
export const BADGE_ART: Record<BadgeId, { kind: string; label?: string }> = {
  first: { kind: 'foot' },
  d7: { kind: 'num', label: '7' },
  d30: { kind: 'num', label: '30' },
  d100: { kind: 'num', label: '100' },
  d365: { kind: 'num', label: '365' },
  back: { kind: 'back' },
  night: { kind: 'moon' },
  early: { kind: 'sun' },
  chapter: { kind: 'book' },
  bday: { kind: 'gift' },
  share: { kind: 'share' },
  pumpkin: { kind: 'pumpkin' },
}

export type BadgePopupProps = {
  badge: BadgeId
  onClose: () => void
}

export function BadgePopup({ badge, onClose }: BadgePopupProps) {
  const def = BADGE_BY_ID[badge]
  const art = BADGE_ART[badge]
  if (!def || !art) return null

  return (
    <div className="ov" style={{ zIndex: 55 }}>
      <div className="dim" onClick={onClose} />
      <div className="badge-pop" role="dialog" aria-modal="true">
        <Badge kind={art.kind} label={art.label ?? ''} size={96} />
        <div className="badge-pop__title">{t('badge.title')}</div>
        <div className="badge-pop__name">{t(`badge.${badge}.name` as MessageKey)}</div>
        <p>{t(`badge.${badge}.desc` as MessageKey)}</p>
        <button className="btn block" type="button" onClick={onClose}>
          {t('common.ok')}
        </button>
      </div>
    </div>
  )
}
