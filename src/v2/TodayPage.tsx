import { formatDateHeading } from '../lib/days'
import { t } from '../lib/i18n'
import type { ItemView } from '../lib/itemview'
import { Creature } from '../components/Creature'
import { PetThumb } from './pets/PetThumb'
import { IconDown, IconPlus } from './icons'
import { petHueVars } from './pets/petArt'
import { StageCard } from './StageCard'
import { useState, type CSSProperties } from 'react'

/** 空态蛋没有事项色相，用芽芽的青瓷；不写 --c 的话蛋体会被画成黑色 */
const emptyEggVars = petHueVars(4)
const emptyEggColor = {
  '--c': `var(--h-4, ${emptyEggVars['--c']})`,
  '--c2': `var(--h-4-2, ${emptyEggVars['--c2']})`,
} as CSSProperties

export type TodayPageProps = {
  views: ItemView[]
  focus: ItemView | null
  now: number
  onChangeFocus: (key: string) => void
  onOpenSwitcher: () => void
  onAdd: () => void
  onLog: () => void
  onPoke: () => void
  /** 当前这张卡里有客人（别的卡的萌宠串门过来） */
  visitor?: boolean
  /** 小伙伴手里有没有一张折起的纸条 */
  noteReady?: boolean
  onOpenNote?: () => void
  onProfile: () => void
  /** 卡片上勾待办 */
  onToggleTodo?: (index: number) => void
  /** 横滑换焦点 */
  onShift: (dir: 1 | -1) => void
  /** 卡片内的轻提示 */
  onToast: (message: string) => void
  /** 记一次 +1 的粒子 */
  fxNonce?: number
  fxPlus?: string
  overrideLine?: string | null
  pokeNonce?: number
  /** 桌宠在外：卡片里只留空位 */
  petAway?: boolean
  /** 别家那只正在这张卡上串门 */
  visited?: boolean
  /** 拖着它悬停在空位上：亮起来 */
  homeHot?: boolean
  /** 回家一次 +1：卡片里跳一下、换个气泡 */
  homeNonce?: number
  /** 连戳五下：让它自己出去 */
  onFrenzy?: () => void
  /** 倒数日就是今天：放到外面的徽章判定 */
  onCountdownToday?: () => void
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
  onPoke,
  visitor,
  noteReady,
  onOpenNote,
  onProfile,
  onToggleTodo,
  overrideLine,
  pokeNonce,
  onShift,
  onToast,
  fxNonce = 0,
  fxPlus = '+1',
  petAway = false,
  visited = false,
  homeHot = false,
  homeNonce = 0,
  onFrenzy,
  onCountdownToday,
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
          <div className="empty-egg" style={emptyEggColor}>
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
                  <PetThumb view={other} size={30} />
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
        onPoke={onPoke}
        visitor={visitor}
        noteReady={noteReady}
        onOpenNote={onOpenNote}
        onProfile={onProfile}
        onToggleTodo={onToggleTodo}
        overrideLine={overrideLine}
        pokeNonce={pokeNonce}
        fxNonce={fxNonce}
        fxPlus={fxPlus}
        onShift={(dir) => {
          setShiftDir(dir)
          onShift(dir)
        }}
        onToast={onToast}
        petAway={petAway}
        visited={visited}
        homeHot={homeHot}
        homeNonce={homeNonce}
        onFrenzy={onFrenzy}
        onCountdownToday={onCountdownToday}
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
