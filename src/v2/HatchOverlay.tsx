import { useEffect, useRef, useState } from 'react'
import { Creature } from '../components/Creature'
import type { CreatureSpecies } from '../components/Creature'
import { t } from '../lib/i18n'
import { playSfx } from '../lib/sfx'

export type HatchInfo = {
  species: CreatureSpecies
  color: number
  name: string
}

export type HatchOverlayProps = {
  info: HatchInfo
  onDone: () => void
}

const TAPS_TO_HATCH = 3

/**
 * 孵化：三件事只在这个应用里发生一次。
 * 轻点三下蛋 → 裂开 → 小伙伴出来说第一句话 → 开始吧。
 * 之后所有新建都直接回今天页（调用方写 daymark.hatched.v1 记住）。
 *
 * reduced-motion 下不抖、不放彩纸，但仍然保留三下的节奏——那是仪式感，不是动效。
 */
export function HatchOverlay({ info, onDone }: HatchOverlayProps) {
  const [taps, setTaps] = useState(0)
  const [born, setBorn] = useState(false)
  const [shake, setShake] = useState(0)
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  function tap() {
    if (born) return
    const next = taps + 1
    setTaps(next)
    setShake(next)
    playSfx('tap')
    if (next >= TAPS_TO_HATCH) {
      timer.current = window.setTimeout(() => {
        setBorn(true)
        playSfx('settle')
      }, 220)
    }
  }

  return (
    <div className="ov" style={{ zIndex: 80 }}>
      <div className="hatch" style={{ '--c': `var(--h-${info.color})` } as React.CSSProperties}>
        <div className="hatch-mid">
          {born ? <div className="confetti" aria-hidden="true" /> : null}
          <button
            className={born ? 'hatch-egg born' : 'hatch-egg'}
            type="button"
            onClick={tap}
            aria-label={t('hatch.tap')}
            key={`shake-${shake}`}
            style={born ? undefined : { animation: shake > 0 ? `eggShake 0.36s ease-in-out` : undefined }}
          >
            <Creature species={info.species} stage={0} mood={born ? 'happy' : 'idle'} size={168} />
          </button>

          {born ? (
            <p className="bubble">{t('hatch.hello', { name: info.name })}</p>
          ) : (
            <p className="sheet-sub" style={{ marginTop: 12 }}>
              {t('hatch.tap')}
              {taps > 0 ? ` · ${TAPS_TO_HATCH - taps}` : ''}
            </p>
          )}
        </div>

        {born ? (
          <button className="btn block" type="button" onClick={onDone}>
            {t('hatch.start')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
