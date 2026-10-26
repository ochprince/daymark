import { formatDateHeading } from '../lib/days'
import { t } from '../lib/i18n'
import type { ItemView } from '../lib/itemview'
import { Creature } from '../components/Creature'
import { IconDown, IconPlus } from './icons'
import { StageCard } from './StageCard'
import { useState } from 'react'

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
  /** 横滑换焦点 */
  onShift: (dir: 1 | -1) => void
  /** 卡片内的轻提示 */
  onToast: (message: string) => void
  /** 记一次 +1 的粒子 */
  fxNonce?: number
  fxPlus?: string
  overrideLine?: string | null
  pokeNonce?: number
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
  pokeNonce,
  onShift,
  onToast,
  fxNonce = 0,
  fxPlus = '+1',
}: TodayPageProps) {
  // 换焦点时新卡片从哪边滑进来：+1 从右边，-1 从左边
  const [shiftDir, setShiftDir] = useState<1 | -1>(1)
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
        key={`${focus.key}:${shiftDir}`}
        enterDir={shiftDir}
        view={focus}
        onLog={onLog}
        onSayDone={onSayDone}
        onPoke={onPoke}
        onProfile={onProfile}
        overrideLine={overrideLine}
        pokeNonce={pokeNonce}
        fxNonce={fxNonce}
        fxPlus={fxPlus}
        onShift={(dir) => {
          setShiftDir(dir)
          onShift(dir)
        }}
        onToast={onToast}
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
