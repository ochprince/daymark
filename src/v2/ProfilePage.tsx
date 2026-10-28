import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Creature } from '../components/Creature'
import type { CreatureSpecies } from '../components/Creature'
import { formatDate } from '../lib/days'
import { dayKey } from '../lib/daykey'
import { monthOffsetFloor, monthSummary } from '../lib/calmonth'
import { STAGE_THRESHOLDS } from '../lib/growth'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import type { ItemView } from '../lib/itemview'
import { shareCopy } from '../lib/sharecard'
import { formatReminder, normalizeReminder } from '../lib/reminder'
import type { Reminder, TodoItem } from '../lib/types'
import { PhotoPicker } from './PhotoPicker'
import { CountdownNotes } from './CountdownNotes'
import { INTL_LOCALE, getLocale } from '../lib/i18n'
import { IconClose } from './icons'

export type ProfilePageProps = {
  view: ItemView
  /** 每件事的最终形态（可能是历史最高） */
  peakStage: number
  now: number
  onClose: () => void
  onEndChapter: (line: string) => void
  onDelete: () => void
  onChangeColor: (color: number) => void
  onRename: (title: string) => void
  onShare: () => void
  onReminder: (next: Reminder) => void
  onExportIcs: () => void
  onPhoto: (id: string | null) => void
  onMemo: (text: string) => void
  onTodo: (next: TodoItem[]) => void
  onToast: (message: string) => void
}

function stageLabel(species: CreatureSpecies, stage: number): string {
  if (species === 'post') return t('kind.countdown')
  return t(`stageName.${species}.${stage}` as MessageKey)
}

/** 档案页：成长之路、这个月的打戳、过去的章节、设置与结局动作 */
export function ProfilePage({
  view,
  peakStage,
  now,
  onClose,
  onEndChapter,
  onDelete,
  onChangeColor,
  onRename,
  onShare,
  onReminder,
  onExportIcs,
  onPhoto,
  onMemo,
  onTodo,
  onToast,
}: ProfilePageProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(view.title)
  const [confirm, setConfirm] = useState<'end' | 'delete' | null>(null)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [line, setLine] = useState('')

  const current: Reminder = view.remind && view.remind.kind !== 'none' ? view.remind : { kind: 'none' }

  function switchKind(kind: string) {
    const time = current.kind === 'none' ? '21:00' : current.time
    if (kind === 'none') return onReminder({ kind: 'none' })
    if (kind === 'daily') return onReminder({ kind: 'daily', time })
    if (kind === 'before') {
      return onReminder({ kind: 'before', daysBefore: current.kind === 'before' ? current.daysBefore : 3, time })
    }
    const weekdays = current.kind === 'weekly' ? current.weekdays : [1, 2, 3, 4, 5]
    return onReminder({ kind: 'weekly', weekdays, time })
  }

  function toggleWeekday(weekday: number) {
    const weekdays =
      current.kind === 'weekly'
        ? current.weekdays.includes(weekday)
          ? current.weekdays.filter((n) => n !== weekday)
          : [...current.weekdays, weekday]
        : [weekday]
    if (weekdays.length === 0) return onReminder({ kind: 'none' })
    return onReminder({ kind: 'weekly', weekdays: weekdays.sort((a, b) => a - b), time: current.kind === 'none' ? '21:00' : current.time })
  }

  const style = {
    '--c': `var(--h-${view.color})`,
    '--c2': `var(--h-${view.color}-2)`,
  } as CSSProperties

  const creatureName = t(`creature.${view.species}` as MessageKey)
  const meta =
    view.kind === 'countdown'
      ? t('profile.meta.said', { creature: creatureName })
      : t('profile.meta', {
          creature: creatureName,
          stage: stageLabel(view.species, view.stage),
          n: view.kind === 'since' ? (view.event.history?.length ?? 0) + 1 : (view.event.chapters?.length ?? 0) + 1,
        })

  const big =
    view.kind === 'since'
      ? t('stage.since.label', { n: view.days })
      : view.kind === 'countdown'
        ? view.days === 0
          ? t('stage.countdown.today')
          : t('stage.countdown.days', { n: view.days })
        : t('growth.total', { n: view.growth })

  const chapters = useMemo(() => {
    if (view.kind === 'since') return view.event.history ?? []
    if (view.kind === 'habit') return view.event.chapters ?? []
    return view.event.history?.map((item) => ({ days: 0, endedAt: item.at, line: item.line })) ?? []
  }, [view])

  function saveTitle() {
    const next = title.trim()
    if (next && next !== view.title) onRename(next)
    setEditing(false)
  }

  return (
    <div className="ov" style={{ zIndex: 45 }}>
      <div className="page detail" style={style}>
        <div className="page-h">
          <button className="back" type="button" onClick={onClose}>
            {t('common.back')}
          </button>
          <b className="page-t">{t('profile.title')}</b>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close')}>
            <IconClose />
          </button>
        </div>

        <div className="d-hero">
          <span className="sw-av">
            <Creature species={view.species} stage={Math.min(4, view.stage) as 0 | 1 | 2 | 3 | 4} size={88} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2>{view.title}</h2>
            <p>{meta}</p>
            <span className="d-big">{big}</span>
          </div>
        </div>

        {view.species !== 'post' ? (
          <>
            <div className="sec-title">{t('profile.path')}</div>
            <div className="card path">
              {STAGE_THRESHOLDS.map((threshold, index) => {
                const reached = index <= peakStage
                const current = index === view.stage
                return (
                  <div key={index} className={current ? 'path-node cur' : reached ? 'path-node' : 'path-node off'}>
                    <div className="pn-art">
                      <Creature
                        species={view.species}
                        stage={index as 0 | 1 | 2 | 3 | 4}
                        size={52}
                        extra={reached ? undefined : { silhouette: true }}
                      />
                    </div>
                    <b>{stageLabel(view.species, index)}</b>
                    <small>{threshold === 0 ? t('tag.start') : t('unit.day', { n: threshold })}</small>
                  </div>
                )
              })}
            </div>
            <div className="path-note">{t('profile.path.note')}</div>
          </>
        ) : null}

        {view.kind === 'habit' ? (
          <MonthCalendar
            days={view.event.days}
            times={view.event.times}
            target={view.event.target}
            now={now}
          />
        ) : null}

        <div className="sec-title">{t('profile.chapters')}</div>
        <div className="card list">
          {chapters.length === 0 ? (
            <div className="li">
              <span className="grow muted">{t('profile.chapters.empty')}</span>
            </div>
          ) : (
            chapters.map((chapter, index) => (
              <div className="li" key={`${chapter.endedAt}-${index}`}>
                <span className="grow">
                  {formatDate(chapter.endedAt)}
                  {chapter.line ? <small className="li-sub">{chapter.line}</small> : null}
                </span>
                <small>{t('profile.chapters.days', { n: chapter.days })}</small>
              </div>
            ))
          )}
        </div>

        <div className="sec-title">{t('profile.settings')}</div>
        <div className="card list">
          <button className="li" type="button" onClick={() => setEditing((value) => !value)}>
            <span className="grow">{t('profile.setting.name')}</span>
            <small>{view.title}</small>
          </button>
          <div className="li">
            <span className="grow">{t('profile.setting.creature')}</span>
            <small>{creatureName}</small>
          </div>
          <div className="li">
            <span className="grow">{view.kind === 'countdown' ? t('profile.setting.type') : t('profile.setting.cadence')}</span>
            <small>{cadenceText(view)}</small>
          </div>
          <button className="li" type="button" onClick={() => setReminderOpen((value) => !value)}>
            <span className="grow">{t('profile.setting.remind')}</span>
            <small>{formatReminder(view.remind ?? { kind: 'none' }, getLocale())}</small>
          </button>
          <div className="li" style={{ display: 'block', paddingTop: 10 }}>
            <PhotoPicker photoId={view.event.photoId ?? undefined} onChange={onPhoto} onToast={onToast} />
          </div>
          <div className="li">
            <span className="grow">{t('profile.edit')}</span>
            <span className="swatches">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChangeColor(color)}
                  aria-label={`color ${color}`}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 99,
                    border: view.color === color ? '3px solid var(--line)' : '2px solid var(--hair)',
                    background: `var(--h-${color})`,
                  }}
                />
              ))}
            </span>
          </div>
        </div>

        {editing ? (
          <div className="card" style={{ margin: '10px 16px 0', padding: 14 }}>
            <input
              className="input"
              value={title}
              autoFocus
              maxLength={40}
              onChange={(event) => setTitle(event.target.value)}
            />
            <div className="d-actions" style={{ marginTop: 10 }}>
              <button className="btn ghost" type="button" onClick={() => setEditing(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn" type="button" onClick={saveTitle}>
                {t('common.save')}
              </button>
            </div>
          </div>
        ) : null}

      {reminderOpen ? (
        <div className="card opt">
          <div className="opt-h">
            <span>{t('reminder.title')}</span>
            <small>{formatReminder(current, getLocale())}</small>
          </div>

          <div className="chips" style={{ marginBottom: 12 }}>
            {([
              ['none', 'reminder.off'],
              ['daily', 'reminder.daily'],
              ['weekly', 'reminder.weekly'],
              ...(view.kind === 'countdown' ? [['before', 'reminder.before'] as [string, MessageKey]] : []),
            ] as Array<[string, MessageKey]>).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className={`chip ${current.kind === kind ? 'is-on' : ''}`}
                onClick={() => switchKind(kind)}
              >
                {t(label)}
              </button>
            ))}
          </div>

          {current.kind === 'weekly' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 12 }}>
              {[1, 2, 3, 4, 5, 6, 0].map((weekday) => (
                <button
                  key={weekday}
                  type="button"
                  className={`chip ${current.weekdays.includes(weekday) ? 'is-on' : ''}`}
                  style={{ padding: '8px 0', justifyContent: 'center' }}
                  onClick={() => toggleWeekday(weekday)}
                >
                  {t(`weekday.${['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][(weekday + 6) % 7]}` as MessageKey)}
                </button>
              ))}
            </div>
          ) : null}

          {current.kind === 'before' ? (
            <label className="li" style={{ paddingLeft: 0 }}>
              <span className="grow">{t('reminder.before')}</span>
              <input
                className="input"
                style={{ width: 80, textAlign: 'right' }}
                type="number"
                min={0}
                max={365}
                value={current.daysBefore}
                onChange={(event) => onReminder(normalizeReminder({ ...current, daysBefore: Number(event.target.value) }))}
              />
            </label>
          ) : null}

          {current.kind !== 'none' ? (
            <label className="li" style={{ paddingLeft: 0 }}>
              <span className="grow">{t('reminder.time')}</span>
              <input
                className="input"
                style={{ width: 132, textAlign: 'right' }}
                type="time"
                value={current.time}
                onChange={(event) => onReminder(normalizeReminder({ ...current, time: event.target.value }))}
              />
            </label>
          ) : null}

          <p className="li-sub" style={{ margin: '8px 0 0' }}>
            {t('reminder.hint')}
          </p>

          <button className="li" type="button" style={{ paddingLeft: 0 }} onClick={onExportIcs}>
            <span className="grow">
              {t('reminder.calendar')}
              <small className="li-sub">{t('reminder.calendarHint')}</small>
            </span>
            <small>›</small>
          </button>
        </div>
      ) : null}

        {view.kind === 'countdown' ? (
          <CountdownNotes
            memo={view.event.memo ?? ''}
            todo={view.event.todo ?? []}
            onMemo={onMemo}
            onTodo={onTodo}
          />
        ) : null}

        <div className="d-actions">
          <button className="btn ghost" type="button" onClick={onShare}>
            {shareCopy('share.title')}
          </button>
          {view.kind !== 'countdown' ? (
            <button className="btn" type="button" onClick={() => setConfirm('end')}>
              {t('profile.endChapter')}
            </button>
          ) : null}
        </div>

        <button className="danger-link" type="button" onClick={() => setConfirm('delete')}>
          {t('profile.delete')}
        </button>
      </div>

      {confirm ? (
        <div className="dim" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>{t(confirm === 'end' ? 'profile.confirmEnd.title' : 'profile.confirmDelete.title')}</h3>
            <p className="sheet-sub">{t(confirm === 'end' ? 'profile.confirmEnd.body' : 'profile.confirmDelete.body')}</p>
            {confirm === 'end' ? (
              <input
                className="input"
                style={{ marginTop: 10 }}
                maxLength={40}
                placeholder={t('profile.confirmEnd.line')}
                value={line}
                onChange={(event) => setLine(event.target.value)}
              />
            ) : null}
            <div className="d-actions">
              <button className="btn ghost" type="button" onClick={() => setConfirm(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  const action = confirm
                  setConfirm(null)
                  if (action === 'end') onEndChapter(line.trim())
                  else onDelete()
                }}
              >
                {t('profile.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function cadenceText(view: ItemView): string {
  if (view.kind === 'countdown') return t('kind.countdown')
  if (view.kind === 'since') return t('kind.since')
  if (view.cadence === 'weekly') return t('tag.weekly')
  if (view.cadence === 'monthly') return t('tag.monthly')
  return t('tag.daily')
}

/**
 * 打卡日历：能往回翻月，每个记过的日子按次数深浅点亮，点一天看当天记了几次。
 *
 * 以前只画「这个月」、也不显示次数——习惯类（喝水这种一天记好几次的）过去的
 * 每日记录在档案里根本翻不到，看起来像只留了当月。
 */
function MonthCalendar({
  days,
  times,
  target,
  now,
}: {
  days: Record<string, number>
  times?: Record<string, number[]>
  target?: number | null
  now: number
}) {
  const [offset, setOffset] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)

  // 能往回翻到最早一条记录那个月；再往前就是空日历，没必要
  const earliest = useMemo(() => {
    const keys = Object.keys(days).sort()
    return keys.length > 0 ? keys[0] : dayKey(now)
  }, [days, now])

  const today = new Date(now)
  const shown = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const year = shown.getFullYear()
  const month = shown.getMonth()
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const total = new Date(year, month + 1, 0).getDate()
  const todayKey = dayKey(now)
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  // 最早那个月是能翻到的下限
  const minOffset = monthOffsetFloor(earliest, today)

  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, index) => index + 1),
  ]

  const summary = monthSummary(days, year, month)
  const dayCount = summary.days
  const hitCount = summary.hits
  // 深浅按「跟目标比」走；没设目标的就按这个月最多的一天算满格
  const full = Math.max(2, target && target > 0 ? target : summary.peak)

  const monthLabel = (() => {
    try {
      return new Intl.DateTimeFormat(INTL_LOCALE[getLocale()], { year: 'numeric', month: 'long' }).format(shown)
    } catch {
      return `${year}-${String(month + 1).padStart(2, '0')}`
    }
  })()

  const pickedCount = picked ? (days[picked] ?? 0) : 0
  const pickedTimes = picked && times ? (times[picked] ?? []) : []

  const move = (delta: number) => {
    setPicked(null)
    setOffset((value) => Math.min(0, Math.max(minOffset, value + delta)))
  }

  return (
    <div className="card cal">
      <div className="cal-h">
        <button
          className="cal-nav"
          type="button"
          aria-label={t('profile.calendar.prev')}
          disabled={offset <= minOffset}
          onClick={() => move(-1)}
        >
          ‹
        </button>
        <div className="cal-title">
          <b>{monthLabel}</b>
          <small>
            {dayCount === 0
              ? t('profile.calendar.empty')
              : t('profile.calendar.summary', { days: dayCount, times: hitCount })}
          </small>
        </div>
        <button
          className="cal-nav"
          type="button"
          aria-label={t('profile.calendar.next')}
          disabled={offset >= 0}
          onClick={() => move(1)}
        >
          ›
        </button>
      </div>

      <div className="cal-g">
        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((key) => (
          <div key={key} className="wd">
            {t(`weekday.${key}` as MessageKey)}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} />
          const key = `${monthPrefix}-${String(day).padStart(2, '0')}`
          const count = days[key] ?? 0
          // 记了 1 次也看得见（0.42），到目标就是满格
          const strength = count > 0 ? 0.42 + 0.58 * Math.min(1, count / full) : 0
          const className = [
            'd',
            count > 0 ? 'on' : '',
            key === todayKey ? 'today' : '',
            picked === key ? 'picked' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button key={key} className={className} type="button" onClick={() => setPicked(picked === key ? null : key)}>
              {count > 0 ? (
                <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
                  <circle cx="18" cy="18" r="14" fill="var(--c)" opacity={strength.toFixed(2)} />
                </svg>
              ) : null}
              <span>{day}</span>
              {count > 1 ? <i className="cnt">{count}</i> : null}
            </button>
          )
        })}
      </div>

      <div className={picked ? 'cal-foot on' : 'cal-foot'}>
        {picked ? (
          <>
            <b>{shortDay(picked)}</b>
            <span>
              {pickedCount === 0
                ? t('profile.calendar.dayNone')
                : [t('profile.calendar.times', { n: pickedCount }), ...pickedTimes.map(clock)]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
          </>
        ) : (
          <span className="cal-note">{t('profile.calendar.tapHint')}</span>
        )}
      </div>
    </div>
  )
}

/** 2026-10-24 → 10月24日 / Oct 24 */
function shortDay(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[getLocale()], { month: 'short', day: 'numeric' }).format(
      new Date(year, month - 1, day),
    )
  } catch {
    return `${month}/${day}`
  }
}

/** 打卡时刻 → 08:12 */
function clock(at: number): string {
  const date = new Date(at)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
