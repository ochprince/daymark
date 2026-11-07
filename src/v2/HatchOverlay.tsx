import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Creature } from '../components/Creature'
import type { CreatureSpecies } from '../components/Creature'
import { t } from '../lib/i18n'
import { hapticSuccess, hapticTap, isHapticsOn } from '../lib/native'
import { playSfx } from '../lib/sfx'

export type HatchInfo = {
  species: CreatureSpecies
  color: number
  /** 小伙伴自己的名字，打招呼用 */
  name: string
  /** 这件事的名字，出生后那句「陪着它一起长大」用 */
  title: string
}

export type HatchOverlayProps = {
  info: HatchInfo
  onDone: () => void
}

const TAPS_TO_HATCH = 3
const CONFETTI_COLORS = ['var(--h-coral)', 'var(--h-lemon)', 'var(--h-mint)', 'var(--h-sky)', 'var(--h-grape)']

/**
 * 揉面团：整个应用里只发生一次。
 * 轻点三下，每一下换一团更醒的面团（dough-*-1/2/3），并响一声。
 * 第三下之后小家伙从面团里出来，说第一句话。
 * 之后所有新建都直接回今天页（调用方写 daymark.hatched.v1 记住）。
 *
 * reduced-motion 下不抖、不放彩纸，但三下的面团和声音都还在——那是仪式，不是动效。
 */
export function HatchOverlay({ info, onDone }: HatchOverlayProps) {
  const [taps, setTaps] = useState(0)
  const [born, setBorn] = useState(false)
  const [shake, setShake] = useState(0)
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  const confetti = useMemo(() => {
    if (!born) return []
    return Array.from({ length: 30 }, (_, index) => ({
      left: `${Math.random() * 100}%`,
      background: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      animationDelay: `${(Math.random() * 3).toFixed(2)}s`,
      animationDuration: `${(2.6 + Math.random() * 1.6).toFixed(2)}s`,
    }))
  }, [born])

  function tap() {
    if (born || taps >= TAPS_TO_HATCH) return
    const next = taps + 1
    setTaps(next)
    setShake(next)
    playSfx('crack')
    hapticTap('light')
    if (next >= TAPS_TO_HATCH) {
      timer.current = window.setTimeout(() => {
        setBorn(true)
        playSfx('hatch')
        hapticSuccess()
        if (isHapticsOn()) {
          try {
            navigator.vibrate?.([12, 40, 22])
          } catch {
            /* 浏览器没有震动也没关系 */
          }
        }
      }, 450)
    }
  }

  const hue = {
    '--c': `var(--h-${info.color})`,
    '--c2': `var(--h-${info.color}-2)`,
  } as CSSProperties

  return (
    <div className="ov" style={{ zIndex: 80 }}>
      <div
        className="hatch"
        role="dialog"
        aria-modal="true"
        aria-label={born ? t('hatch.born', { name: info.name }) : t('hatch.title')}
        style={hue}
      >
        {born ? (
          <div className="confetti" aria-hidden="true">
            {confetti.map((bit, index) => (
              <i key={index} style={bit} />
            ))}
          </div>
        ) : null}
        <h3>{born ? t('hatch.born', { name: info.name }) : t('hatch.title')}</h3>
        <p>{born ? t('hatch.with', { title: info.title }) : t('hatch.lead')}</p>
        <div className="hatch-mid">
          {born ? <p className="bubble">{t('hatch.hello', { name: info.name })}</p> : null}
          <button
            className={born ? 'hatch-egg born' : shake > 0 ? 'hatch-egg shake' : 'hatch-egg'}
            type="button"
            onClick={tap}
            aria-label={t('hatch.knead')}
            key={born ? 'born' : `dough-${shake}`}
          >
            <Creature
              species={info.species}
              stage={born ? 0 : 'egg'}
              mood={born ? 'happy' : 'idle'}
              size={210}
              extra={born ? undefined : { crack: taps }}
            />
          </button>
        </div>
        {born ? (
          <button className="btn block" type="button" onClick={onDone}>
            {t('hatch.start')}
          </button>
        ) : (
          <div className="taps" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <i key={index} className={index < taps ? 'on' : ''} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
