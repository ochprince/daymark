/**
 * 桌面小组件 · 三种尺寸 × 三种事项类型。
 *
 * 一个组件吃三种尺寸和三种 kind，是因为 iOS WidgetKit 也是这样：
 * 一张 Widget 声明 supportedFamilies，四种尺寸共用一份 timeline entry。
 * 造型差异全部由 CSS 的 `.is-sm / .is-md / .is-lg` 与 `.is-since / .is-habit / .is-countdown`
 * 组合出来，React 这边只决定「哪几块内容出现」。
 *
 * 可交互部分（iOS 17 Interactive Widget）：习惯类的环形按钮点了就记一次。
 */
import type { CSSProperties } from 'react'
import { Creature } from '../../components/Creature'
import { formatShortDate, formatSpan } from '../../lib/days'
import { intlLocale, t } from '../../lib/i18n'
import { IconCheck } from '../icons'
import { Ring } from './Ring'
import { formatPercent, frozenClock, progressRatio, type SystemClock } from './clock'
import { speciesName, stageName, stagePercent, type SystemItem, type SystemKind } from './model'

export type WidgetSize = 'sm' | 'md' | 'lg'

export type WidgetProps = {
  size: WidgetSize
  kind: SystemKind
  /** 没有数据时传 null，会渲染「还没有这类事」 */
  data: SystemItem | null | undefined
  /** 当天进度（「今天 已走」那条自己涨的进度条）；不给就按此刻算一次 */
  clock?: SystemClock
  /** 轻点环形按钮记一次；不给就没有交互 */
  onLog?: (item: SystemItem) => void
  /** 点整张卡（iOS 上会 deep link 回 App） */
  onOpen?: (item: SystemItem) => void
}

/** 没接时钟时的兜底：模块加载那一刻 */
const STATIC_CLOCK = frozenClock()

const WEEK_FORMAT = new Map<string, Intl.DateTimeFormat>()

function weekdayNarrow(ts: number): string {
  const locale = intlLocale()
  let formatter = WEEK_FORMAT.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
    WEEK_FORMAT.set(locale, formatter)
  }
  return formatter.format(new Date(ts))
}

function hue(item: SystemItem): CSSProperties {
  return { '--c': `var(--h-${item.color})`, '--c2': `var(--h-${item.color}-2)` } as CSSProperties
}

/** 今天已走：小组件底部那条一直在涨的细线 */
function DayBar({ clock }: { clock: SystemClock }) {
  return (
    <div className="sys-day">
      <div className="sys-day-t">
        <span>{t('sys.todayWalk')}</span>
        <b>{formatPercent(clock.dayPercent)}</b>
      </div>
      <div className="sys-day-b">
        <i style={{ width: `${clock.dayPercent}%` }} />
      </div>
    </div>
  )
}

function BigNumber({ value, className }: { value: number; className?: string }) {
  return (
    <div className={className ? `sys-num-row ${className}` : 'sys-num-row'}>
      <b className="sys-num">{value}</b>
      <small>{t('sys.unitDay')}</small>
    </div>
  )
}

function WeekDots({ week }: { week: boolean[] }) {
  const today = new Date()
  const length = week.length
  return (
    <div className="sys-week">
      {week.map((on, index) => {
        const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (length - 1 - index))
        return (
          <span key={index} className={`${on ? 'is-on' : ''} ${index === length - 1 ? 'is-now' : ''}`.trim()}>
            <i />
            <u>{weekdayNarrow(day.getTime())}</u>
          </span>
        )
      })}
    </div>
  )
}

function habitLabel(item: SystemItem): string {
  const target = item.target ?? null
  const done = item.count ?? 0
  if (item.cadence === 'weekly') return t('sys.habit.week', { done, target: target ?? done })
  if (target !== null && target > 1) return t('sys.habit.today', { done, target })
  return done >= 1 ? t('sys.habit.done') : t('sys.habit.none')
}

function habitDone(item: SystemItem): boolean {
  const target = item.target ?? null
  if (target === null) return (item.count ?? 0) > 0
  return (item.count ?? 0) >= target
}

function habitPercent(item: SystemItem): number {
  return progressRatio(item.count ?? 0, item.target ?? null) * 100
}

function countdownLabel(days: number): string {
  if (days <= 0) return t('sys.countdown.today')
  if (days === 1) return t('sys.countdown.tomorrow')
  return t('sys.countdown.in')
}

/** 旅途进度：离得越近走得越远，28 天内画得下 */
function travelPercent(days: number): number {
  return Math.min(88, Math.max(4, (1 - Math.max(0, days) / 30) * 100))
}

function Track({ item }: { item: SystemItem }) {
  const date = item.date ?? Date.now()
  return (
    <div className="sys-track">
      <i className="sys-road" />
      <span className="sys-walker" style={{ left: `${travelPercent(item.days).toFixed(1)}%` }}>
        <Creature species="post" stage={0} size={52} />
      </span>
      <span className="sys-goal">
        <b>{new Date(date).getDate()}</b>
        <small>{new Date(date).getMonth() + 1}</small>
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 三类身体                                                            */
/* ------------------------------------------------------------------ */

function SinceWidget({ item, size, clock }: { item: SystemItem; size: WidgetSize; clock: SystemClock }) {
  const span = item.startedAt ? formatSpan(item.startedAt, clock.now) : ''
  const sinceLine = span
    ? t('sys.since.sub', { span })
    : item.startedAt
      ? t('stage.since.sub', { date: formatShortDate(item.startedAt) })
      : ''
  if (size === 'sm') {
    return (
      <>
        <header className="sys-w-top">
          <span className="sys-w-title">{item.title}</span>
          <i className="sys-live dot">
            <b />
          </i>
        </header>
        <BigNumber value={item.days} />
        <div className="sys-w-cr">
          <Creature species={item.species} stage={item.stage} size={64} />
        </div>
        <DayBar clock={clock} />
      </>
    )
  }

  if (size === 'md') {
    return (
      <>
        <div className="sys-m-cr">
          <span className="sys-halo" />
          <Creature species={item.species} stage={item.stage} size={102} />
        </div>
        <div className="sys-m-main">
          <header className="sys-w-top">
            <span className="sys-w-title">{item.title}</span>
            <i className="sys-live">
              <b />
              {t('sys.live')}
            </i>
          </header>
          <BigNumber value={item.days} className="is-big" />
          <p className="sys-sub">{sinceLine}</p>
          <DayBar clock={clock} />
        </div>
      </>
    )
  }

  const percent = stagePercent(item.stage, item.days)
  return (
    <>
      <header className="sys-w-top">
        <span className="sys-w-title">{item.title}</span>
        <i className="sys-live">
          <b />
          {t('sys.live')}
        </i>
      </header>
      <div className="sys-l-cr">
        <span className="sys-halo" />
        <Creature species={item.species} stage={item.stage} size={116} />
        <i className="sys-ground" />
      </div>
      <BigNumber value={item.days} className="is-huge is-center" />
      <p className="sys-sub is-center">{sinceLine}</p>
      <div className="sys-stage">
        <span>{t('sys.stageLabel', { name: speciesName(item.species), stage: stageName(item.species, item.stage) })}</span>
        <div className="sys-day-b">
          <i style={{ width: `${percent}%` }} />
        </div>
        <span>{percent}%</span>
      </div>
      <DayBar clock={clock} />
    </>
  )
}

function HabitWidget({
  item,
  size,
  onLog,
}: {
  item: SystemItem
  size: WidgetSize
  onLog?: (item: SystemItem) => void
}) {
  const done = habitDone(item)
  const percent = habitPercent(item)
  const canLog = !done && typeof onLog === 'function'

  const ringButton = (ringSize: number, stroke: number, creatureSize: number) => {
    const inner = (
      <>
        <Ring percent={percent} size={ringSize} stroke={stroke}>
          <Creature species={item.species} stage={item.stage} size={creatureSize} />
        </Ring>
        {canLog ? (
          <span className="sys-tapfx" aria-hidden="true">
            <i />
            <i />
          </span>
        ) : (
          <span className="sys-chk" aria-hidden="true">
            <IconCheck size={13} />
          </span>
        )}
      </>
    )
    if (!canLog) return <span className="sys-ringbtn is-done">{inner}</span>
    return (
      <button
        type="button"
        className="sys-ringbtn"
        aria-label={t('sys.habit.log')}
        onClick={(event) => {
          event.stopPropagation()
          onLog?.(item)
        }}
      >
        {inner}
      </button>
    )
  }

  if (size === 'sm') {
    return (
      <>
        <header className="sys-w-top">
          <span className="sys-w-title">{item.title}</span>
          <i className="sys-live dot">
            <b />
          </i>
        </header>
        <div className="sys-hab-ring">{ringButton(92, 8, 50)}</div>
        <p className="sys-hab-t">{habitLabel(item)}</p>
      </>
    )
  }

  if (size === 'md') {
    return (
      <>
        <div className="sys-m-ring">{ringButton(110, 10, 62)}</div>
        <div className="sys-m-main">
          <header className="sys-w-top">
            <span className="sys-w-title">{item.title}</span>
          </header>
          <BigNumber value={item.days} className="is-mid" />
          <p className="sys-sub">
            {habitLabel(item)}
            {item.streak && item.streak > 1 ? ` · ${t('sys.since.streak', { n: item.streak })}` : ''}
          </p>
          {item.week ? <WeekDots week={item.week} /> : null}
          <LogButton item={item} done={done} onLog={onLog} />
        </div>
      </>
    )
  }

  return (
    <>
      <header className="sys-w-top">
        <span className="sys-w-title">{item.title}</span>
        <i className="sys-live">
          <b />
          {t('sys.live')}
        </i>
      </header>
      <div className="sys-l-ring">{ringButton(146, 12, 82)}</div>
      <BigNumber value={item.days} className="is-huge is-center" />
      <p className="sys-sub is-center">
        {habitLabel(item)}
        {item.streak && item.streak > 1 ? ` · ${t('sys.since.streak', { n: item.streak })}` : ''}
      </p>
      {item.week ? <WeekDots week={item.week} /> : null}
      <LogButton item={item} done={done} onLog={onLog} />
    </>
  )
}

function LogButton({ item, done, onLog }: { item: SystemItem; done: boolean; onLog?: (item: SystemItem) => void }) {
  if (done || !onLog) {
    return (
      <span className="sys-wbtn is-off">
        <IconCheck size={13} />
        {t('sys.habit.logged')}
      </span>
    )
  }
  return (
    <button
      type="button"
      className="sys-wbtn"
      onClick={(event) => {
        event.stopPropagation()
        onLog(item)
      }}
    >
      {t('sys.habit.log')}
    </button>
  )
}

function CountdownWidget({ item, size }: { item: SystemItem; size: WidgetSize }) {
  const date = item.date ?? Date.now()
  if (size === 'sm') {
    return (
      <>
        <header className="sys-w-top">
          <span className="sys-w-title">{item.title}</span>
        </header>
        <p className="sys-sub is-up">{countdownLabel(item.days)}</p>
        <BigNumber value={Math.max(0, item.days)} />
        <div className="sys-w-cr">
          <Creature species="post" stage={0} size={68} />
        </div>
        <p className="sys-sub is-low">
          {formatShortDate(date)}
          {item.repeat ? ` · ${item.repeat}` : ''}
        </p>
      </>
    )
  }

  if (size === 'md') {
    return (
      <>
        <header className="sys-w-top">
          <span className="sys-w-title">{item.title}</span>
          <i className="sys-live">
            <b />
            {t('sys.countdown.way')}
          </i>
        </header>
        <div className="sys-wait-row">
          {item.days > 0 ? <BigNumber value={item.days} className="is-mid" /> : <b className="sys-today">{t('sys.countdown.today')}</b>}
          <p className="sys-sub">
            {formatShortDate(date)}
            {item.repeat ? ` · ${item.repeat}` : ''}
          </p>
        </div>
        <Track item={item} />
      </>
    )
  }

  const todo = (item.todo ?? []).slice(0, 3)
  return (
    <>
      <header className="sys-w-top">
        <span className="sys-w-title">{item.title}</span>
        <i className="sys-live">
          <b />
          {t('sys.countdown.way')}
        </i>
      </header>
      <div className="sys-wait-row">
        {item.days > 0 ? <BigNumber value={item.days} className="is-huge" /> : <b className="sys-today is-huge">{t('sys.countdown.today')}</b>}
        <p className="sys-sub">
          {formatShortDate(date)}
          {item.repeat ? ` · ${item.repeat}` : ''}
        </p>
      </div>
      <Track item={item} />
      <ul className="sys-todo">
        {todo.length > 0 ? (
          todo.map((entry, index) => (
            <li key={index} className={entry.done ? 'is-on' : ''}>
              <i>{entry.done ? <IconCheck size={10} /> : null}</i>
              {entry.text}
            </li>
          ))
        ) : (
          <li className="is-none">{t('sys.countdown.todoEmpty')}</li>
        )}
      </ul>
      {item.memo ? <p className="sys-memo">“{item.memo}”</p> : null}
    </>
  )
}

/* ------------------------------------------------------------------ */

export function Widget({ size, kind, data, clock, onLog, onOpen }: WidgetProps) {
  const dayClock = clock ?? STATIC_CLOCK

  if (!data || data.kind !== kind) {
    return (
      <div className={`sys-w is-${size} is-empty`}>
        <Creature species="moon" stage={0} size={size === 'sm' ? 54 : 82} />
        <b>{t('sys.empty')}</b>
      </div>
    )
  }

  const className = `sys-w is-${size} is-${kind}`
  const clickable = typeof onOpen === 'function'

  return (
    <div
      className={className}
      style={hue(data)}
      data-kind={kind}
      data-size={size}
      data-item={data.id}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={() => onOpen?.(data)}
      onKeyDown={(event) => {
        if (!clickable) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen?.(data)
        }
      }}
    >
      {kind === 'since' ? <SinceWidget item={data} size={size} clock={dayClock} /> : null}
      {kind === 'habit' ? <HabitWidget item={data} size={size} onLog={onLog} /> : null}
      {kind === 'countdown' ? <CountdownWidget item={data} size={size} /> : null}
    </div>
  )
}
