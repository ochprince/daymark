import type { CSSProperties } from 'react'
import { Creature } from '../components/Creature'
import type { CreatureSpecies } from '../components/Creature'
import { t } from '../lib/i18n'
import './welcome.css'

export type WelcomeFlowProps = {
  /** 「我先随便看看」：不再引导，落到空态 */
  onSkip: () => void
  /** 「领一团面团回家」：进入新建 */
  onStart: () => void
}

type Hue = 'mint' | 'grape' | 'sky' | 'lemon'

type Orbit = {
  species: CreatureSpecies
  stage: 2 | 3
  hue: Hue
  mood: 'happy' | 'sleep'
  x: string
  y: string
  delay: number
}

/** 环绕面团的四只，位置和色相跟原型欢迎页一致 */
const ORBIT: readonly Orbit[] = [
  { species: 'sprout', stage: 3, hue: 'mint', mood: 'happy', x: '8%', y: '14%', delay: 0 },
  { species: 'moon', stage: 2, hue: 'grape', mood: 'sleep', x: '72%', y: '6%', delay: 0.8 },
  { species: 'drop', stage: 3, hue: 'sky', mood: 'happy', x: '2%', y: '62%', delay: 1.6 },
  { species: 'star', stage: 2, hue: 'lemon', mood: 'happy', x: '74%', y: '58%', delay: 2.4 },
]

function hueStyle(hue: Hue): CSSProperties {
  return {
    '--c': `var(--h-${hue})`,
    '--c2': `var(--h-${hue}-2)`,
  } as CSSProperties
}

/**
 * 首次见面。只在「一件东西都没有、也没看过引导」时由 AppV2 挂上来（key daymark.welcome.v1）。
 * 一屏讲完：品牌、承诺、一团面团。领回家才进新建，先看看就落到空态。
 */
export function WelcomeFlow({ onSkip, onStart }: WelcomeFlowProps) {
  const lines = t('welcome.body').split('\n')

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label={t('welcome.title')}>
      <div className="w-brand">{t('welcome.brand')}</div>
      <h1>{t('welcome.title')}</h1>
      <p>
        {lines.map((line, index) => (
          <span key={index}>
            {index > 0 ? <br /> : null}
            {line}
          </span>
        ))}
      </p>
      <div className="w-hero">
        {ORBIT.map((item) => (
          <span
            key={item.species}
            className="orbit"
            style={{ ...hueStyle(item.hue), left: item.x, top: item.y, animationDelay: `${item.delay}s` }}
          >
            <Creature species={item.species} stage={item.stage} size={78} mood={item.mood} />
          </span>
        ))}
        <span className="w-egg" style={hueStyle('lemon')}>
          <Creature species="sprout" stage="egg" size={190} />
          <i className="w-egg-shadow" />
        </span>
      </div>
      <button className="btn" type="button" onClick={onStart}>
        {t('welcome.cta')}
      </button>
      <button className="w-skip" type="button" onClick={onSkip}>
        {t('welcome.skip')}
      </button>
    </div>
  )
}
