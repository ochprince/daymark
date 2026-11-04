import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Creature } from '../components/Creature'
import type { CreatureSpecies } from '../components/Creature'
import { formatDate, formatSpan } from '../lib/days'
import { dayKey } from '../lib/daykey'
import { nextStageAt, stageFills, stageOf } from '../lib/growth'
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
  onPoke: () => void
  /** 这张卡里有客人：连戳三下是喊两只一起玩 */
  visitor?: boolean
  /** 小伙伴手里有一张折起的纸条，点了才展开 */
  noteReady?: boolean
  onOpenNote?: () => void
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
  /** 卡片上直接勾待办（只有倒数日有） */
  onToggleTodo?: (index: number) => void
  /** 桌宠在外：卡片里保留原尺寸的空位（.pet-away），角色隐藏、不可点 */
  petAway?: boolean
  /** 别家那只正在这张卡上串门：家里这只打个招呼 */
  visited?: boolean
  /** 拖着桌宠悬停在这块空位上：亮起来提示可以放回去 */
  homeHot?: boolean
  /** 每回家一次 +1：卡片里的它重新出现并跳一下、气泡换成「我回来了。」、播一声 */
  homeNonce?: number
  /** 连戳三下（每下间隔 < 0.9s）：它兴奋乱跳，然后自己走出卡片 */
  onFrenzy?: () => void
}

/** 连戳判定：每下间隔小于这个才算「同一串」，慢摸不触发 */
export const POKE_STREAK_GAP = 900
/** 连戳几下它才出门 */
export const POKE_STREAK_N = 3
/** 兴奋乱跳多久之后才真的走出去 */
const FRENZY_MS = 760

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

export function StageCard({
  view,
  onLog,
  onPoke,
  visitor = false,
  noteReady,
  onOpenNote,
  onProfile,
  onToggleTodo,
  overrideLine,
  pokeNonce = 0,
  onShift,
  onToast,
  enterDir,
  fxNonce = 0,
  fxPlus = '+1',
  petAway = false,
  visited = false,
  homeHot = false,
  homeNonce = 0,
  onFrenzy,
}: StageCardProps) {
  const [charging, setCharging] = useState(false)
  const [jumping, setJumping] = useState(false)
  const [party, setParty] = useState(false)
  /** 连戳三下：兴奋乱跳中 */
  const [hyped, setHyped] = useState(false)
  /** 偶尔东张西望：一直只有呼吸浮动太单调 */
  const [looking, setLooking] = useState(false)
  /** 有客人在场：气泡换成招呼 */
  const [guest, setGuest] = useState(false)
  useEffect(() => {
    if (!visited) return undefined
    setGuest(true)
    const timer = window.setTimeout(() => setGuest(false), 2800)
    return () => window.clearTimeout(timer)
  }, [visited])
  /** 刚回家：气泡换成「我回来了。」 */
  const [back, setBack] = useState(false)
  // 横滑换焦点：跟手位移 + 松手后吸附回弹
  const [drag, setDrag] = useState<{ dx: number; active: boolean } | null>(null)
  const dragRef = useRef<{ x: number; y: number; dx: number; active: boolean } | null>(null)
  /** 蓄力期间挂的 pointermove 监听，取消/结束时统一摘掉 */
  const watchers = useRef<Set<() => void>>(new Set())
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

  /**
   * 回家：桌宠那边走完 420ms 才 +1，此时 petAway 已经变 false、它回到了原位。
   * 先撤掉 jump 再重排后加回，否则同一个类不会重播（原型也是这么干的）。
   */
  const seenHome = useRef(homeNonce)
  useEffect(() => {
    // 卡片重新挂载时 homeNonce 还是上一次的值：别把「我回来了」再放一遍
    if (homeNonce === seenHome.current) return undefined
    seenHome.current = homeNonce
    setBack(true)
    setJumping(false)
    let raf = 0
    const timers: number[] = []
    raf = window.requestAnimationFrame(() => {
      setJumping(true)
      timers.push(window.setTimeout(() => setJumping(false), 620))
    })
    timers.push(window.setTimeout(() => setBack(false), 2000))
    playSfx('settle')
    return () => {
      window.cancelAnimationFrame(raf)
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [homeNonce])

  // 连戳一串的进度：间隔超过 POKE_STREAK_GAP 就重新数
  const streak = useRef({ n: 0, t: 0 })
  const frenzyTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (frenzyTimer.current !== null) window.clearTimeout(frenzyTimer.current)
    },
    [],
  )

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
  useEffect(() => {
    if (petAway || sleeping) return undefined
    let on = false
    const timer = window.setInterval(() => {
      on = !on
      setLooking(on)
    }, 15000)
    return () => window.clearInterval(timer)
  }, [petAway, sleeping])
  const habitDone = view.kind === 'habit' && view.target !== null && view.count >= view.target

  function startHold(event?: ReactPointerEvent<HTMLElement>) {
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

    // 手指一挪开就算滑动，不是长按。
    // 只靠 startDrag 里那一下不够：横滑判定要等方向确认，慢一点的滑动
    // 会在确认之前就把 500ms 蓄满，于是滑卡的同时记了一笔，卡片中间冒出「+1」。
    const fromX = event?.clientX ?? 0
    const fromY = event?.clientY ?? 0
    const watch = (moveEvent: PointerEvent) => {
      if (Math.hypot(moveEvent.clientX - fromX, moveEvent.clientY - fromY) > 12) {
        stopWatch()
        cancelHold(true)
      }
    }
    const stopWatch = () => window.removeEventListener('pointermove', watch)
    window.addEventListener('pointermove', watch)
    watchers.current.add(stopWatch)
  }

  /** silent：横滑取消蓄力时不该弹「再按久一点」 */
  function cancelHold(silent = false) {
    watchers.current.forEach((stop) => stop())
    watchers.current.clear()
    const wasCharging = timer.current !== null
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    setCharging(false)
    // 按了一会儿但没蓄满：告诉用户差在哪。
    // 短按（<250ms）是「摸摸」，不该弹这句，否则每次摸它都被骂一次
    if (!silent && wasCharging && performance.now() - pressAt.current > 250) onToast?.(t('hold.tooShort'))
  }

  // 轻点摸摸：和原型一致——短按（<250ms）且没拖动，就是在摸它
  function tapPoke() {
    // pressAt 没被记上（比如按下那一帧被别的手势接走）时按轻点算，别把这次点击吞掉
    if (pressAt.current && performance.now() - pressAt.current > 250) return
    if (dragRef.current?.active) return
    // 手里捏着纸条时，先给你看纸条：这比再摸一下有意思，也省得去戳那个小图标
    if (noteReady && !petAway) {
      onOpenNote?.()
      return
    }
    onPoke()
    // 它已经出去了，空位里没人可戳，也别把连戳串续上
    if (petAway) return
    const now = performance.now()
    streak.current.n = now - streak.current.t < POKE_STREAK_GAP ? streak.current.n + 1 : 1
    streak.current.t = now
    if (streak.current.n < POKE_STREAK_N) return
    // 第三下：兴奋乱跳 + 喊一声，760ms 后自己走一遍出场
    streak.current.n = 0
    if (!onFrenzy) return
    setHyped(true)
    playSfx('tap')
    if (frenzyTimer.current !== null) window.clearTimeout(frenzyTimer.current)
    frenzyTimer.current = window.setTimeout(() => {
      frenzyTimer.current = null
      setHyped(false)
      onFrenzy()
    }, FRENZY_MS)
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
        cancelHold(true) // 一开始横滑，就不再算蓄力（也别弹「再按久一点」）
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

  const line = hyped
    ? t(visitor ? 'pet.say.playHost' : 'pet.say.frenzy')
    : guest
      ? t('pet.say.visitor')
      : back
      ? t('pet.say.back')
      : (overrideLine ?? bubbleLine(view))
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
      <div className="deco" aria-hidden="true" />
      <div className="sc-top">
        <span className="tag">{typeTag(view)}</span>
        <h2 className="sc-title">{view.title}</h2>
        <button className="sc-more" onClick={onProfile} type="button">
          {t('action.archive')} ›
        </button>
      </div>

      <div className="sc-hero">
        {/* 它出门了，卡片里就不该还留着它刚才说的话 */}
        {petAway ? null : <div className="bubble">{line}</div>}
        <div
          className={`cr-wrap ${sleeping ? 'sleep' : ''} ${jumping ? 'jump' : ''} ${
            hyped ? 'hyped' : ''
          }${petAway ? ' pet-away' : ''}${petAway && homeHot ? ' pet-home-hot' : ''}`}
          onPointerDown={startHold}
          onPointerUp={() => {
            cancelHold()
            tapPoke()
          }}
          onPointerLeave={() => cancelHold()}
          onPointerCancel={() => cancelHold()}
          role={canHold && !petAway ? 'button' : undefined}
          aria-label={
            canHold && !petAway ? t(sleeping ? 'action.holdWake' : 'action.hold') : undefined
          }
        >
          <svg className="charge-ring" viewBox="0 0 200 200" aria-hidden="true">
            <circle className="track" cx="100" cy="100" r="92.6" />
            <circle className="bar" cx="100" cy="100" r="92.6" />
          </svg>
          <Creature
            className={looking ? 'cr look' : 'cr'}
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
          {/* 它手里捏着一张小纸条：外形和「邮差」那只天生拿的信不一样，
              这是折起来的纸片。点了才展开。 */}
          {noteReady && !petAway ? (
            <button
              className={`sc-note${view.species === 'post' ? ' sc-note--left' : ''}`}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onOpenNote?.()
              }}
              aria-label={t('note.open')}
            >
              <span className="sc-note-paper" aria-hidden="true" />
            </button>
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

      {/* 两个槽位固定高度：三种卡因此一样高，没内容的地方留白 */}
      <div className="sc-slot sc-slot-num">
        <NumberBlock view={view} />
      </div>
      <div className="sc-slot sc-slot-extra">
        <ExtraBlock view={view} rest={rest} nextName={nextName} onToggleTodo={onToggleTodo} onProfile={onProfile} />
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
    // 过了那天的第二天还没「说过了」时，别写成「还有 -1 天」
    if (view.days < 0) {
      lead = t('stage.number.lead.past')
      num = String(Math.abs(view.days))
    } else {
      lead = t('stage.number.lead.left')
      num = String(view.days)
    }
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

type ExtraProps = {
  view: ItemView
  rest: number
  nextName: string
  onToggleTodo?: (index: number) => void
  onProfile: () => void
}

function ExtraBlock({ view, rest, nextName, onToggleTodo, onProfile }: ExtraProps) {
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

  // 倒数日：备忘和待办直接摆在卡片上（原型的 .memo 块），勾一勾不用进档案
  if (view.kind === 'countdown') {
    const todos = view.event.todo ?? []
    const memo = (view.event.memo ?? '').trim()
    if (!memo && todos.length === 0) return null
    const done = todos.filter((item) => item.done).length
    const shown = todos.slice(0, 2)
    return (
      <div className="c-memo" onClick={onProfile}>
        <div className="c-memo-h">
          <span>{t('notes.memo')}</span>
          {todos.length > 0 ? (
            <span className="c-memo-c">
              {done}/{todos.length}
            </span>
          ) : null}
        </div>
        {memo ? <p className="c-memo-p">{memo}</p> : null}
        {shown.length > 0 ? (
          <div className="c-memo-todo">
            {shown.map((item, index) => (
              <button
                key={index}
                type="button"
                className={item.done ? 'on' : ''}
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleTodo?.(index)
                }}
              >
                {item.done ? '✓' : '○'} {item.text}
              </button>
            ))}
            {todos.length > shown.length ? <i>+{todos.length - shown.length}</i> : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <>
      {cups ? <div className="cups">{cups}</div> : null}
      {view.species !== 'post' ? (
        <div className="growth">
          <div className="g-row">
            <span>{t('growth.total', { n: view.growth })}</span>
            <span>{sleeping ? t('growth.sleeping') : growthLabel}</span>
          </div>
          <div
            className={sleeping ? 'g-segs paused' : 'g-segs'}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={5}
            aria-valuenow={view.stage}
            aria-label={t('growth.progress', { n: view.growth, rest, next: nextName })}
          >
            {stageFills(view.growth).map((fill, index) => (
              <span className={`g-seg${index < view.stage ? ' past' : ''}${index === view.stage ? ' cur' : ''}`} key={index}>
                <i style={{ width: `${fill}%` }} />
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
