import { t } from '../lib/i18n'
import type { ItemView } from '../lib/itemview'
import { Creature } from '../components/Creature'
import { IconClose, IconPlus } from './icons'

export type SwitcherProps = {
  views: ItemView[]
  activeKey: string
  onPick: (key: string) => void
  onAdd: () => void
  onClose: () => void
}

const GROUPS: { kind: ItemView['kind']; label: () => string }[] = [
  { kind: 'since', label: () => t('kind.since') },
  { kind: 'habit', label: () => t('kind.habit') },
  { kind: 'countdown', label: () => t('kind.countdown') },
]

export function Switcher({ views, activeKey, onPick, onAdd, onClose }: SwitcherProps) {
  return (
    <div className="ov">
      <div className="dim" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <div className="sheet-h">
          <h3>{t('switcher.title')}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close')}>
            <IconClose />
          </button>
        </div>

        {GROUPS.map((group) => {
          const items = views.filter((view) => view.kind === group.kind)
          if (items.length === 0) return null
          return (
            <div key={group.kind}>
              <div className="sw-group">
                {group.label()} · {items.length}
              </div>
              {items.map((view) => (
                <button
                  key={view.key}
                  type="button"
                  className="li"
                  onClick={() => onPick(view.key)}
                  aria-current={view.key === activeKey ? 'true' : undefined}
                >
                  <span
                    className="sw-av"
                    style={
                      {
                        '--c': `var(--h-${view.color})`,
                        '--c2': `var(--h-${view.color}-2)`,
                      } as React.CSSProperties
                    }
                  >
                    <Creature species={view.species} stage={view.stage} size={36} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block' }}>{view.title}</span>
                    <span className="li-sub">{statusOf(view)}</span>
                  </span>
                  <span style={{ color: 'var(--ink3)', fontSize: 13, fontWeight: 700 }}>
                    {view.key === activeKey ? t('switcher.current') : ''}
                  </span>
                </button>
              ))}
            </div>
          )
        })}

        <button className="btn block ghost sw-add" type="button" onClick={onAdd}>
          <IconPlus size={18} /> {t('action.newItem')}
        </button>
      </div>
    </div>
  )
}

function statusOf(view: ItemView): string {
  if (view.kind === 'since') return t('stage.since.label', { n: view.days })
  if (view.kind === 'countdown') {
    return view.days === 0 ? t('stage.countdown.today') : t('stage.countdown.days', { n: view.days })
  }
  if (view.mood === 'sleep') return t('switcher.sleeping')
  if (view.count === 0) return t('switcher.notToday')
  return t('stage.habit.today', { n: view.count })
}
