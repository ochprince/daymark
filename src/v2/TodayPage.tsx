import { formatDateHeading } from '../lib/days'
import { t } from '../lib/i18n'
import type { ItemView } from '../lib/itemview'
import { Creature } from '../components/Creature'
import { IconDown, IconPlus } from './icons'
import { StageCard } from './StageCard'

export type TodayPageProps = {
  views: ItemView[]
  focus: ItemView | null
  now: number
  onChangeFocus: (key: string) => void
  onOpenSwitcher: () => void
  onAdd: () => void
  onLog: () => void
  onSayDone: () => void
  onPoke: () => void
  onProfile: () => void
  overrideLine?: string | null
}

function greet(now: number): string {
  const hour = new Date(now).getHours()
  if (hour < 5) return t('greet.night')
  if (hour < 11) return t('greet.morning')
  if (hour < 14) return t('greet.noon')
  if (hour < 18) return t('greet.afternoon')
  return t('greet.evening')
}

export function TodayPage({
  views,
  focus,
  now,
  onChangeFocus,
  onOpenSwitcher,
  onAdd,
  onLog,
  onSayDone,
  onPoke,
  onProfile,
  overrideLine,
}: TodayPageProps) {
  if (!focus) {
    return (
      <div className="today">
        <header className="t-head">
          <div />
          <div className="t-actions">
            <button className="icon-btn" type="button" onClick={onAdd} aria-label={t('action.newItem')}>
              <IconPlus />
            </button>
          </div>
        </header>
        <div className="empty">
          <div className="empty-egg">
            <Creature stage="egg" size={150} extra={{ crack: 1 }} />
          </div>
          <h2>{t('stage.empty.title')}</h2>
          <p>{t('stage.empty.body')}</p>
          <button className="btn" type="button" onClick={onAdd}>
            {t('stage.empty.cta')}
          </button>
        </div>
      </div>
    )
  }

  const others = views.filter((view) => view.key !== focus.key).slice(0, 2)

  return (
    <div className="today">
      <header className="t-head">
        <div>
          <div className="t-date">{formatDateHeading(now)}</div>
          <div className="t-greet">{greet(now)}</div>
        </div>
        <div className="t-actions">
          <button
            className="pill-switch"
            type="button"
            onClick={onOpenSwitcher}
            aria-label={t('action.switch')}
          >
            <span className="stack">
              {others.map((other) => (
                <span
                  className="av"
                  key={other.key}
                  style={
                    {
                      '--c': `var(--h-${other.color})`,
                      '--c2': `var(--h-${other.color}-2)`,
                    } as React.CSSProperties
                  }
                >
                  <Creature species={other.species} stage={0} size={30} />
                </span>
              ))}
            </span>
            {t('switcher.count', { n: views.length })} <IconDown />
          </button>
          <button className="icon-btn" type="button" onClick={onAdd} aria-label={t('action.newItem')}>
            <IconPlus />
          </button>
        </div>
      </header>

      <StageCard
        view={focus}
        onLog={onLog}
        onSayDone={onSayDone}
        onPoke={onPoke}
        onProfile={onProfile}
        overrideLine={overrideLine}
      />

      <div className="focus-dots">
        {views.map((view) => (
          <button
            key={view.key}
            type="button"
            className={view.key === focus.key ? 'is-on' : ''}
            onClick={() => onChangeFocus(view.key)}
            aria-label={view.title}
          />
        ))}
      </div>
      <div className="swipe-hint">{t('today.hint')}</div>
    </div>
  )
}
