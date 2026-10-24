import { t } from '../lib/i18n'
import { IconDress, IconMuseum, IconToday } from './icons'

export type TabKey = 'today' | 'museum' | 'dress'

export type TabBarProps = {
  active: TabKey
  onChange: (tab: TabKey) => void
}

const TABS: { key: TabKey; label: () => string; icon: () => JSX.Element }[] = [
  { key: 'today', label: () => t('tab.today'), icon: () => <IconToday /> },
  { key: 'museum', label: () => t('tab.museum'), icon: () => <IconMuseum /> },
  { key: 'dress', label: () => t('tab.dress'), icon: () => <IconDress /> },
]

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tabbar" aria-label={t('tab.today')}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={active === tab.key ? 'is-on' : ''}
          onClick={() => onChange(tab.key)}
          aria-current={active === tab.key ? 'page' : undefined}
        >
          {tab.icon()}
          <span>{tab.label()}</span>
        </button>
      ))}
    </nav>
  )
}
