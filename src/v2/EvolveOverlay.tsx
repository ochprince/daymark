import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Creature } from '../components/Creature'
import { prefersReducedMotion } from '../lib/motion'
import type { CreatureSpecies } from '../components/Creature'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import type { Stage } from '../lib/types'

export type EvolveInfo = {
  /** 这件事的 ItemView key，收下之后用来记 seen */
  key: string
  species: CreatureSpecies
  color: number
  growth: number
  from: Stage
  to: Stage
  /** 这一级顺带解锁的徽章名（没有就不显示） */
  badgeName?: string
}

export type EvolveOverlayProps = {
  info: EvolveInfo
  onDone: () => void
}

function stageName(species: CreatureSpecies, stage: Stage): string {
  return t(`stageName.${species}.${stage}` as MessageKey)
}

/**
 * 进化过场：只挂低频节点（形态升级），可跳过。
 * 时间线沿用原型：光束淡入 → 旧形态闪白 → 闪光 → 新形态弹出 → 文字上浮。
 */
export function EvolveOverlay({ info, onDone }: EvolveOverlayProps) {
  const [skipped, setSkipped] = useState(false)

  // 减弱动效：直接到终帧，不播过场
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (prefersReducedMotion()) setSkipped(true)
  }, [])

  const style = {
    '--c': `var(--h-${info.color})`,
    '--c2': `var(--h-${info.color}-2)`,
  } as CSSProperties

  const sparks = Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2
    const radius = 110 + (index % 3) * 26
    return (
      <i
        key={index}
        className="ev-spark"
        style={
          {
            left: 112,
            top: 112,
            '--dx': `${Math.round(Math.cos(angle) * radius)}px`,
            '--dy': `${Math.round(Math.sin(angle) * radius)}px`,
            animationDelay: `${(1.5 + (index % 4) * 0.05).toFixed(2)}s`,
          } as CSSProperties
        }
      />
    )
  })

  return (
    <div className="ov" style={{ zIndex: 50 }}>
    <div className={skipped ? 'evolve skipped' : 'evolve'} style={style} role="dialog" aria-modal="true">
      <div className="ev-rays" aria-hidden="true" />
      <button className="ev-skip" type="button" onClick={() => setSkipped(true)}>
        {t('common.skip')}
      </button>

      <div className="ev-stage">
        <div className="ev-old">
          <Creature species={info.species} stage={info.from} size={200} />
        </div>
        <div className="ev-flash" aria-hidden="true" />
        <div className="ev-new">
          <Creature species={info.species} stage={info.to} mood="happy" size={220} />
        </div>
        {sparks}
      </div>

      <div className="ev-text">
        <span className="ev-kicker">{t('evolve.kicker', { n: info.growth })}</span>
        <h3>{t('evolve.title', { name: t(`creature.${info.species}` as MessageKey) })}</h3>
        <span className="ev-chip">
          {stageName(info.species, info.from)} → <b>{stageName(info.species, info.to)}</b>
        </span>
        <p>{t(`evolve.line.${info.to}` as MessageKey)}</p>
        <div className="ev-unlock">
          <span>{t('evolve.dex', { name: stageName(info.species, info.to) })}</span>
          {info.badgeName ? <span>{t('evolve.badge', { name: info.badgeName })}</span> : null}
        </div>
        <div className="ev-btns">
          <button className="btn" type="button" onClick={onDone}>
            {t('evolve.keep')}
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}
