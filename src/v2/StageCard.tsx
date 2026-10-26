import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Creature } from '../components/Creature'
import type { CreatureSpecies } from '../components/Creature'
import { formatDate, formatSpan } from '../lib/days'
import { dayKey } from '../lib/daykey'
import { STAGE_THRESHOLDS, nextStageAt, stageOf } from '../lib/growth'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import type { ItemView } from '../lib/itemview'
import { bubbleLine } from '../lib/lines'
import { getPhotoUrl } from '../lib/photos'
import { playSfx } from '../lib/sfx'
import { PhotoBackdrop } from './PhotoBackdrop'

/** 蓄力时长：与 CheckInCard 同一个口径（500ms），改这里要连带改 CSS 的 transition */
const HOLD_MS = 500

export type StageCardProps = {
  view: ItemView
  /** 记录完成（习惯类蓄满 / 倒数日「说过了」） */
  onLog: () => void
  onSayDone: () => void
  onPoke: () => void
  onProfile: () => void
  /** 记录之后临时换一句气泡 */
  overrideLine?: string | null
  /** 每摸一次 +1：用来触发跳一下的动画 */
  pokeNonce?: number
  /** 横滑换焦点：-1 上一件，1 下一件。不给就关掉滑动 */
  onShift?: (dir: 1 | -1) => void
  /** 卡片内部的轻提示（蓄力没满、今天已记过） */
  onToast?: (message: string) => void
  /** 换个焦点滑进来的方向：1 从右边，-1 从左边 */
  enterDir?: 1 | -1
  /** 每记一次 +1：用来炸一次粒子与「+1」 */
  fxNonce?: number
  /** 「+1」上的字，多单位习惯是「+1 杯」 */
  fxPlus?: string
}

/** 落定那一下的粒子：角度固定，避免每次看起来都不一样 */
const PARTICLES = Array.from({ length: 8 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 8
  return {
    dx: `${Math.cos(angle) * 46}px`,
    dy: `${Math.sin(angle) * 46}px`,
    rotate: `${index * 45}deg`,
  }
})

/** 「就是今天」的庆祝一天只放一次，别每次切回来都炸一遍彩纸 */
const PARTY_KEY = 'daymark.party.v1'

function partyFiredToday(key: string): boolean {
  try {
    const raw = window.localStorage.getItem(PARTY_KEY)
    const seen: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    return seen[key] === dayKey(Date.now())
  } catch {
    return true
  }
}

function markParty(key: string): void {
  try {
    const raw = window.localStorage.getItem(PARTY_KEY)
    const seen: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    seen[key] = dayKey(Date.now())
    window.localStorage.setItem(PARTY_KEY, JSON.stringify(seen))
  } catch {
    /* 记不住就下次再放一遍，不影响使用 */
  }
}

const CONFETTI = [
  { left: '8%', delay: 0, color: 'var(--h-0)', rotate: 12 },
  { left: '21%', delay: 0.4, color: 'var(--h-2)', rotate: -8 },
  { left: '34%', delay: 0.9, color: 'var(--h-4)', rotate: 20 },
  { left: '47%', delay: 0.2, color: 'var(--h-1)', rotate: -16 },
  { left: '61%', delay: 1.1, color: 'var(--h-5)', rotate: 6 },
  { left: '74%', delay: 0.6, color: 'var(--h-3)', rotate: -22 },
  { left: '87%', delay: 1.3, color: 'var(--h-6)', rotate: 14 },
]

function stageName(species: CreatureSpecies, stage: number): string {
  if (species === 'post') return ''
  const key = `stageName.${species}.${stage}` as MessageKey
  return t(key)
}

/** 当前形态内的进度（0–100） */
function stagePercent(growth: number, stage: number): number {
  const from = STAGE_THRESHOLDS[stage] ?? 0
  const to = STAGE_THRESHOLDS[stage + 1]
  if (to === undefined) return 100
  const span = to - from
  if (span <= 0) return 100
  return Math.max(0, Math.min(100, ((growth - from) / span) * 100))
}

export function StageCard({
  view,
  onLog,
  onSayDone,
  onPoke,
  onProfile,
  overrideLine,
  pokeNonce = 0,
  onShift,
  onToast,
  enterDir,
  fxNonce = 0,
  fxPlus = '+1',
}: StageCardProps) {
  const [charging, setCharging] = useState(false)
  const [jumping, setJumping] = useState(false)
  const [party, setParty] = useState(false)
  // 横滑换焦点：跟手位移 + 松手后吸附回弹
  const [drag, setDrag] = useState<{ dx: number; active: boolean } | null>(null)
  const dragRef = useRef<{ x: number; y: number; dx: number; active: boolean } | null>(null)
  const pressAt = useRef(0)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  // 记一次落定：粒子 + 「+1」+ 闪一下，900ms 后自己收
  const [fxOn, setFxOn] = useState(false)
  useEffect(() => {
    if (fxNonce === 0) return undefined
    setFxOn(true)
    const stop = window.setTimeout(() => setFxOn(false), 900)
    return () => window.clearTimeout(stop)
  }, [fxNonce])

  // 「就是今天」：当天第一次打开这一件时放一次彩纸，戴一次派对帽
  useEffect(() => {
    if (view.kind !== 'countdown') return undefined
    if (view.days !== 0) {
      setParty(false)
      return undefined
    }
    if (partyFiredToday(view.key)) return undefined
    markParty(view.key)
    setParty(true)
    const stop = window.setTimeout(() => setParty(false), 6200)
    return () => window.clearTimeout(stop)
  }, [view])

  // 摸摸它：跳一下就好，不加粒子（日常交互的动效节点要省着用）
  useEffect(() => {
    if (pokeNonce === 0) return undefined
    setJumping(true)
    const timer = window.setTimeout(() => setJumping(false), 620)
    return () => window.clearTimeout(timer)
  }, [pokeNonce])

  // 相片背景：id 在记录里，图在 IndexedDB 里，这里只负责换成 objectURL
  const photoId = view.event.photoId
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    if (!photoId) {
      setPhotoUrl(null)
      return undefined
    }
    void getPhotoUrl(photoId).then((url) => {
      if (alive) setPhotoUrl(url)
    })
    return () => {
      alive = false
    }
  }, [photoId])

  const canHold = view.kind === 'habit'
  const sleeping = view.mood === 'sleep'
  const habitDone = view.kind === 'habit' && view.target !== null && view.count >= view.target

  function startHold() {
    pressAt.current = performance.now()
    if (!canHold) return
    if (habitDone) {
      onToast?.(t('hold.already'))
      return
    }
    playSfx('tap')
    setCharging(true)
    timer.current = window.setTimeout(() => {
      timer.current = null
      setCharging(false)
      onLog()
    }, HOLD_MS)
  }

  function cancelHold() {
    const wasCharging = timer.current !== null
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    setCharging(false)
    // 按了一会儿但没蓄满：告诉用户差在哪。
    // 短按（<250ms）是「摸摸」，不该弹这句，否则每次摸它都被骂一次
    if (wasCharging && performance.now() - pressAt.current > 250) onToast?.(t('hold.tooShort'))
  }

  // 轻点摸摸：和原型一致——短按（<250ms）且没拖动，就是在摸它
  function tapPoke() {
    if (performance.now() - pressAt.current > 250) return
    if (dragRef.current?.active) return
    onPoke()
  }

  /**
   * 横滑换焦点：和原型一样用 window 级的 pointermove/pointerup。
   * 只挂在卡片上会在「卡片被重新挂载」的那一帧丢事件，手指就白滑了。
   */
  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!onShift) return
    const target = event.target as HTMLElement
    if (target.closest('button:not(.cr-wrap)')) return

    const startX = event.clientX
    const startY = event.clientY
    let active = false
    let dx = 0

    const move = (moveEvent: PointerEvent) => {
      const stepX = moveEvent.clientX - startX
      const stepY = moveEvent.clientY - startY
      if (!active) {
        // 先判方向：竖着划是别的手势，不抢
        if (Math.abs(stepX) < 10 || Math.abs(stepX) <= Math.abs(stepY)) return
        active = true
        cancelHold() // 一开始横滑，就不再算蓄力
      }
      dx = stepX
      setDrag({ dx, active: true })
    }

    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      dragRef.current = null
      setDrag(null)
      if (active && Math.abs(dx) > 70) onShift(dx < 0 ? 1 : -1)
    }

    dragRef.current = { x: startX, y: startY, dx: 0, active: false }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const style = {
    '--c': `var(--h-${view.color})`,
    '--c2': `var(--h-${view.color}-2)`,
  } as CSSProperties

  const line = overrideLine ?? bubbleLine(view)
  const growthPct = stagePercent(view.growth, view.stage)
  const nextStage = nextStageAt(view.growth)
  const rest = nextStage === null ? 0 : nextStage - view.growth
  const nextName = nextStage === null ? '' : stageName(view.species, stageOf(nextStage))

  return (
    <section
      className={`stage-card${charging ? ' charging' : ''}${photoUrl ? ' has-photo' : ''}${
        drag?.active ? ' dragging' : ''
      }${enterDir ? (enterDir === 1 ? ' enter-r' : ' enter-l') : ''}`}
      style={
        drag
          ? { ...style, transform: `translateX(${drag.dx}px) rotate(${(drag.dx * 0.02).toFixed(2)}deg)` }
          : style
      }
      onPointerDown={startDrag}
    >
      <PhotoBackdrop url={photoUrl}>
      {fxOn ? (
        <div className="fx" aria-hidden="true">
          {PARTICLES.map((piece, index) => (
            <span
              key={index}
              className="p"
              style={{ '--dx': piece.dx, '--dy': piece.dy, '--r': piece.rotate } as CSSProperties}
            />
          ))}
          <span className="plus1">{fxPlus}</span>
        </div>
      ) : null}
      {fxOn ? <div className="flash" aria-hidden="true" /> : null}
      <div className="deco" />
      <div className="sc-top">
        <span className="tag">{typeTag(view)}</span>
        <h2 className="sc-title">{view.title}</h2>
        <button className="sc-more" onClick={onProfile} type="button">
          {t('action.archive')} ›
        </button>
      </div>

      <div className="sc-hero">
        <div className="bubble">{line}</div>
        <div
          className={`cr-wrap ${sleeping ? 'sleep' : ''} ${jumping ? 'jump' : ''}`}
          onPointerDown={startHold}
          onPointerUp={() => {
            cancelHold()
            tapPoke()
          }}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          role={canHold ? 'button' : undefined}
          aria-label={canHold ? t(sleeping ? 'action.holdWake' : 'action.hold') : undefined}
        >
          <svg className="charge-ring" viewBox="0 0 200 200" aria-hidden="true">
            <circle className="track" cx="100" cy="100" r="92.6" />
            <circle className="bar" cx="100" cy="100" r="92.6" />
          </svg>
          <Creature
            species={view.species}
            stage={Math.min(4, view.stage) as 0 | 1 | 2 | 3 | 4}
            mood={party ? 'wow' : view.mood}
            size={158}
            extra={party ? { hold: 'party' } : undefined}
          />
          {party ? (
            <div className="confetti" aria-hidden="true">
              {CONFETTI.map((piece, index) => (
                <i
                  key={index}
                  style={{
                    left: piece.left,
                    background: piece.color,
                    animationDelay: `${piece.delay}s`,
                    transform: `rotate(${piece.rotate}deg)`,
                  }}
                />
              ))}
            </div>
          ) : null}
          <div className="ground" />
          {sleeping ? (
            <div className="zzz" aria-hidden="true">
              <span>z</span>
              <span>z</span>
              <span>Z</span>
            </div>
          ) : null}
        </div>
      </div>

      <NumberBlock view={view} />
      <ExtraBlock view={view} growthPct={growthPct} rest={rest} nextName={nextName} />

      <div className="sc-actions">
        {canHold ? (
          <button
            className={habitDone ? 'hold done' : 'hold'}
            type="button"
            onPointerDown={(event) => {
              event.preventDefault()
              startHold()
            }}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            disabled={habitDone}
          >
            <span className="hold-fill" />
            <span className="hold-label">
              {habitDone ? t('action.logged') : t(sleeping ? 'action.holdWake' : 'action.hold')}
            </span>
          </button>
        ) : null}

        {view.kind === 'since' ? (
          <button className="btn ghost" type="button" onClick={onPoke}>
            {t('action.poke')}
          </button>
        ) : null}

        {view.kind === 'countdown' && view.days === 0 ? (
          <button className="btn block" type="button" onClick={onSayDone}>
            {t('action.said')}
          </button>
        ) : null}
      </div>
      </PhotoBackdrop>
    </section>
  )
}

function typeTag(view: ItemView): string {
  if (view.kind === 'since') return t('kind.since')
  if (view.kind === 'countdown') return t('kind.countdown')
  if (view.cadence === 'weekly') {
    return view.target && view.target > 1 ? t('add.period.weekly', { n: view.target }) : t('tag.weekly')
  }
  if (view.cadence === 'monthly') return t('tag.monthly')
  return view.target && view.target > 1 ? t('add.period.daily', { n: view.target }) : t('tag.daily')
}

function NumberBlock({ view }: { view: ItemView }) {
  if (view.kind === 'countdown' && view.days === 0) {
    return (
      <>
        <div className="sc-num">
          <span className="num word">{t('stage.countdown.today')}</span>
        </div>
        <div className="sc-sub">{formatDate(view.next)}</div>
      </>
    )
  }

  let lead = ''
  let num = ''
  let unit = ''

  if (view.kind === 'since') {
    lead = t('stage.number.lead.day')
    num = String(view.days)
    unit = t('unit.daySuffix')
  } else if (view.kind === 'countdown') {
    lead = t('stage.number.lead.left')
    num = String(view.days)
    unit = t('unit.dayShort')
  } else if (view.target !== null && view.target > 1) {
    lead = view.cadence === 'weekly' ? t('time.thisWeek') : t('time.today')
    num = String(view.count)
    unit = `/ ${view.target} ${t('unit.timesShort')}`
  } else {
    lead = t('time.today')
    num = String(view.count)
    unit = t('unit.timesShort')
  }

  // 副行只放工具信息（日期）；成长已经在成长条里说过了，同一屏不重复第二遍
  const sub =
    view.kind === 'since'
      ? `${formatDate(view.event.startedAt)} · ${formatSpan(view.event.startedAt, Date.now()) || ''}`.trim()
      : view.kind === 'countdown'
        ? formatDate(view.next)
        : ''

  return (
    <>
      <div className="sc-num">
        {lead ? <span className="lead">{lead}</span> : null}
        <span className="num">{num}</span>
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      <div className="sc-sub">{sub}</div>
    </>
  )
}

type ExtraProps = { view: ItemView; growthPct: number; rest: number; nextName: string }

function ExtraBlock({ view, growthPct, rest, nextName }: ExtraProps) {
  const cups =
    view.kind === 'habit' && view.target !== null && view.target > 1 && view.cadence === 'daily'
      ? Array.from({ length: view.target }, (_, index) => (
          <span key={index} className={index < view.count ? 'cup on' : 'cup'} />
        ))
      : null

  const sleeping = view.mood === 'sleep'
  const growthLabel =
    view.species === 'post'
      ? t('kind.countdown')
      : view.stage >= 4
        ? t('growth.maxed')
        : t('growth.next', { n: rest, name: nextName })

  return (
    <>
      {cups ? <div className="cups">{cups}</div> : null}
      {view.species !== 'post' ? (
        <div className="growth">
          <div className="g-row">
            <span>{t('growth.total', { n: view.growth })}</span>
            <span>{sleeping ? t('growth.sleeping') : growthLabel}</span>
          </div>
          <div className={sleeping ? 'g-track paused' : 'g-track'}>
            <i style={{ width: `${sleeping ? 0 : growthPct}%` }} />
          </div>
        </div>
      ) : null}
    </>
  )
}
