import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Creature } from '../components/Creature'
import type { CreatureSpecies } from '../components/Creature'
import { formatDate, formatSpan } from '../lib/days'
import { STAGE_THRESHOLDS, nextStageAt, stageOf } from '../lib/growth'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import type { ItemView } from '../lib/itemview'
import { bubbleLine } from '../lib/lines'

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
}

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
}: StageCardProps) {
  const [charging, setCharging] = useState(false)
  const [jumping, setJumping] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  // 摸摸它：跳一下就好，不加粒子（日常交互的动效节点要省着用）
  useEffect(() => {
    if (pokeNonce === 0) return undefined
    setJumping(true)
    const timer = window.setTimeout(() => setJumping(false), 620)
    return () => window.clearTimeout(timer)
  }, [pokeNonce])

  const canHold = view.kind === 'habit'
  const sleeping = view.mood === 'sleep'
  const habitDone = view.kind === 'habit' && view.target !== null && view.count >= view.target

  function startHold() {
    if (!canHold || habitDone) return
    setCharging(true)
    timer.current = window.setTimeout(() => {
      timer.current = null
      setCharging(false)
      onLog()
    }, HOLD_MS)
  }

  function cancelHold() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    setCharging(false)
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
    <section className={charging ? 'stage-card charging' : 'stage-card'} style={style}>
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
          onPointerUp={cancelHold}
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
            mood={view.mood}
            size={158}
          />
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
