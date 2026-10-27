import { useRef, useState } from 'react'
import { Creature } from '../components/Creature'
import type { CreatureSpecies } from '../components/Creature'
import { addCheckIn } from '../lib/checkins'
import { setFocusKey } from '../lib/focus'
import { itemKey } from '../lib/itemview'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import './welcome.css'

export type WelcomeResult = {
  species: CreatureSpecies
  color: number
  /** 用户给它起的名字（也是第一件事的标题） */
  name: string
}

export type WelcomeFlowProps = {
  /** 「先看看」：不再引导，直接落到空态 */
  onSkip: () => void
  /** 建好第一件事之后交出孵化要用的信息，调用方直接进孵化过场 */
  onDone: (result: WelcomeResult) => void
}

type Pick = {
  species: CreatureSpecies
  /** 颜色索引：选中时的光晕、卡片配色、孵化光都用它 */
  color: number
  /** 一句话性格，文案 key */
  line: MessageKey
}

/** 三个选项都是现有物种，一个不多造 */
const PICKS: readonly Pick[] = [
  { species: 'sprout', color: 4, line: 'welcome.pick.sprout' },
  { species: 'moon', color: 2, line: 'welcome.pick.moon' },
  { species: 'star', color: 0, line: 'welcome.pick.star' },
]

const STEPS = 3

/**
 * 首次见面：欢迎 → 选一只小家伙 → 起名字 → 直接孵化。
 *
 * 只在「一件东西都没有、也没看过引导」时由 AppV2 挂上来（key daymark.welcome.v1）。
 * 每一步都能退回上一步，没有强制流：想跳过随时可以。
 * 创建走的是 checkins 的 addCheckIn（和 AddSheet 的习惯分支同一套入口），这里不碰存储。
 */
export function WelcomeFlow({ onSkip, onDone }: WelcomeFlowProps) {
  const [step, setStep] = useState(0)
  const [pick, setPick] = useState<Pick>(PICKS[0])
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const title = name.trim()

  function finish() {
    if (!title) return
    const event = addCheckIn({
      title,
      color: pick.color,
      cadence: 'daily',
      species: pick.species,
    })
    setFocusKey(itemKey('habit', event.id))
    onDone({ species: pick.species, color: event.color, name: title })
  }

  function next() {
    if (step < STEPS - 1) {
      setStep(step + 1)
      return
    }
    finish()
  }

  return (
    <div className="wf" role="dialog" aria-modal="true" aria-label={t('welcome.1.title')}>
      <div className="wf-glow" aria-hidden="true" style={{ '--c': `var(--h-${pick.color})` } as React.CSSProperties} />

      <div className="wf-top">
        {step > 0 ? (
          <button className="wf-back" type="button" onClick={() => setStep(step - 1)}>
            ‹ {t('welcome.back')}
          </button>
        ) : (
          <span className="wf-back is-void" aria-hidden="true" />
        )}

        <div className="wf-dots" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, index) => (
            <i key={index} className={index <= step ? 'is-on' : ''} />
          ))}
        </div>

        {step === 0 ? (
          <button className="wf-skip" type="button" onClick={onSkip}>
            {t('welcome.skip')}
          </button>
        ) : (
          <span className="wf-skip is-void" aria-hidden="true" />
        )}
      </div>

      {step === 0 ? (
        <div className="wf-body" key="step-1">
          <div className="wf-egg">
            <Creature stage="egg" size={150} extra={{ crack: 0 }} />
          </div>
          <h2>{t('welcome.1.title')}</h2>
          <p>{t('welcome.1.body')}</p>
          <div className="wf-foot">
            <button className="btn block" type="button" onClick={next}>
              {t('welcome.1.cta')}
            </button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="wf-body" key="step-2">
          <h2>{t('welcome.2.title')}</h2>
          <p>{t('welcome.2.body')}</p>
          <div className="wf-picks">
            {PICKS.map((option) => {
              const on = option.species === pick.species
              return (
                <button
                  key={option.species}
                  type="button"
                  className={on ? 'wf-pick is-on' : 'wf-pick'}
                  aria-pressed={on}
                  style={{ '--c': `var(--h-${option.color})` } as React.CSSProperties}
                  onClick={() => setPick(option)}
                >
                  <span className="wf-pick-art">
                    <Creature species={option.species} stage={0} size={84} mood={on ? 'happy' : 'idle'} />
                  </span>
                  <b>{t(`creature.${option.species}` as MessageKey)}</b>
                  <small>{t(option.line)}</small>
                </button>
              )
            })}
          </div>
          <div className="wf-foot">
            <button className="btn block" type="button" onClick={next}>
              {t('welcome.2.cta')}
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <form
          className="wf-body"
          key="step-3"
          onSubmit={(event) => {
            event.preventDefault()
            finish()
          }}
        >
          <div className="wf-preview" style={{ '--c': `var(--h-${pick.color})` } as React.CSSProperties}>
            <Creature species={pick.species} stage={0} size={118} mood="happy" />
          </div>
          <h2>{t('welcome.3.title')}</h2>
          <p>{t('welcome.3.body')}</p>
          <input
            ref={inputRef}
            className="input"
            value={name}
            autoFocus
            maxLength={40}
            enterKeyHint="done"
            placeholder={t('welcome.3.placeholder')}
            aria-label={t('welcome.3.title')}
            onChange={(event) => setName(event.target.value.slice(0, 40))}
          />
          <div className="wf-foot">
            <button className="btn block" type="submit" disabled={!title}>
              {t('welcome.3.cta')}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
