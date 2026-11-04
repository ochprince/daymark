import { useState } from 'react'
import { startOfDay, todayStart } from '../lib/days'
import { addCheckIn } from '../lib/checkins'
import { speciesColor } from '../lib/museum'
import { addCountdown, updateCountdown } from '../lib/countdowns'
import { addEvent } from '../lib/storage'
import { addNote } from '../lib/collection'
import { pickSpecies } from '../lib/migrate'
import { setFocusKey } from '../lib/focus'
import { itemKey } from '../lib/itemview'
import { t } from '../lib/i18n'
import { getLocale, INTL_LOCALE } from '../lib/i18n/locale'
import type { CreatureSpecies } from '../components/Creature'
import type { ItemKind } from '../lib/types'
import { IconClose } from './icons'
import { FestivalSheet } from './FestivalSheet'

export type AddSheetProps = {
  onClose: () => void
  onCreated: (message: string) => void
  onHatched?: (info: { species: CreatureSpecies; color: number; name: string }) => void
}

// 占位符前面加「比如」，否则深色主题下灰字容易被当成已经填好的内容
const NAME_PLACEHOLDER: Record<ItemKind, string> = {
  since: '比如：戒烟、在一起',
  habit: '比如：喝水、跑步',
  countdown: '比如：妈妈的生日、出发旅行',
}

export function AddSheet({ onClose, onCreated, onHatched }: AddSheetProps) {
  const [kind, setKind] = useState<ItemKind | null>(null)
  /** 写张小纸条：自己写的默认就进藏馆，不像系统那张还要点一下才收 */
  const [writing, setWriting] = useState(false)
  const [noteText, setNoteText] = useState('')
  /** 节日面板：从「新建」第一步直接进去，挑完就把这个节日加成倒数日 */
  const [festivals, setFestivals] = useState(false)
  /** 倒数日是否每年重来一次；用户自己点过就不再自动改 */
  const [yearly, setYearly] = useState(false)
  const [yearlyTouched, setYearlyTouched] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  /** 名字里写着「生日」、或者挑的是过去的日期，默认就该每年一次 */
  function autoYearly(nextTitle: string, nextDate: string) {
    if (yearlyTouched) return
    const at = parseDate(nextDate, Date.now())
    const isPast = startOfDay(at) < todayStart(Date.now())
    setYearly(isPast || /生日|生诞|诞辰/.test(nextTitle))
  }

  /** 自己写的纸条：直接收进藏馆（系统那张是「点了才收」） */
  function saveNote() {
    const text = noteText.trim()
    if (!text) return
    const now = Date.now()
    addNote({ id: `note-${now}`, text, from: '', at: now, mine: true })
    onCreated(t('note.saved'))
  }

  function create() {
    const name = title.trim()
    if (!name || !kind) return
    const now = Date.now()

    // 孵化要用到新建这件事的物种/配色/名字，先兜住再分派
    let born: { species: CreatureSpecies; color: number; name: string } | null = null

    if (kind === 'since') {
      const startedAt = parseDate(date, now)
      const isToday = startOfDay(startedAt) === todayStart(now)
      const event = addEvent({
        title: name,
        startedAt,
        // 起始日就是今天时，计时锚点写按下的那一刻（满 24 小时才 +1）
        anchorAt: isToday ? now : undefined,
        color: speciesColor('sprout'),
        species: 'sprout',
      })
      born = { species: event.species ?? 'sprout', color: event.color, name: name }
      setFocusKey(itemKey('since', event.id))
    } else if (kind === 'habit') {
      const species = pickSpecies(name)
      const event = addCheckIn({ title: name, color: speciesColor(species), cadence: 'daily', species })
      born = { species, color: event.color, name }
      setFocusKey(itemKey('habit', event.id))
    } else {
      const startedAt = parseDate(date, now)
      const event = addCountdown({
        title: name,
        startedAt,
        color: speciesColor('post'),
        repeat: yearly ? 'yearly' : 'none',
      })
      if (yearly) updateCountdown(event.id, { repeat: 'yearly' })
      born = { species: 'star', color: event.color, name }
      setFocusKey(itemKey('countdown', event.id))
    }

    onCreated(name)
    if (born) onHatched?.(born)
  }

  return (
    <div className="ov">
      <div className="dim" onClick={onClose} aria-hidden="true" />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={writing ? t('note.title') : kind === null ? t('add.title') : t('add.step2')}
      >
        <div className="grab" />
        <div className="sheet-h">
          <h3>{writing ? t('note.title') : kind === null ? t('add.title') : t('add.step2')}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close')}>
            <IconClose />
          </button>
        </div>

        {writing ? (
          <>
            <label className="field">
              <span className="field-t">{t('add.note')}</span>
              <textarea
                className="input note-write"
                value={noteText}
                autoFocus
                rows={4}
                maxLength={120}
                placeholder={t('add.note.placeholder')}
                onChange={(event) => setNoteText(event.target.value.slice(0, 120))}
              />
            </label>
            <button className="btn block" type="button" onClick={saveNote} disabled={!noteText.trim()}>
              {t('add.note.done')}
            </button>
          </>
        ) : kind === null ? (
          <div className="add-kinds">
            {(['since', 'habit', 'countdown'] as ItemKind[]).map((option) => (
              <button key={option} type="button" className="add-kind" onClick={() => setKind(option)}>
                <b>{t(option === 'since' ? 'kind.since' : option === 'habit' ? 'kind.habit' : 'kind.countdown')}</b>
                <span>
                  {t(
                    option === 'since'
                      ? 'kind.since.desc'
                      : option === 'habit'
                        ? 'kind.habit.desc'
                        : 'kind.countdown.desc',
                  )}
                </span>
              </button>
            ))}
            <button className="add-kind" type="button" onClick={() => setWriting(true)}>
              <b>{t('add.note')}</b>
              <span>{t('add.note.desc')}</span>
            </button>
            <button className="add-fest" type="button" onClick={() => setFestivals(true)}>
              {t('add.fromFestival')}
            </button>
          </div>
        ) : (
          <>
            <label className="field">
              <span className="field-t">{t('add.name')}</span>
              <input
                className="input"
                value={title}
                autoFocus
                placeholder={NAME_PLACEHOLDER[kind]}
              onChange={(event) => {
                const next = event.target.value.slice(0, 40)
                setTitle(next)
                if (kind === 'countdown') autoYearly(next, date)
                }}
              />
            </label>
            {kind !== 'habit' ? (
              <label className="field">
                <span className="field-t">
                  {kind === 'countdown' ? t('add.date') : t('add.startNow')}
                </span>
                {/* 原生日期框在 iOS 上会按系统语言显示成 11/04/2026，中文界面下容易读错，
                    所以自己排一行「2026年11月4日」，原生控件铺在上面透明接管点击。 */}
                <span className="date-box">
                  <span className="date-val">{formatDay(date)}</span>
                  <span className="date-ico" aria-hidden="true">
                    ▾
                  </span>
                  <input
                    className="date-native"
                    type="date"
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value)
                      if (kind === 'countdown') autoYearly(title, event.target.value)
                    }}
                  />
                </span>
              </label>
            ) : null}
            {kind === 'countdown' ? (
              <div className="field">
                <span className="field-t">{t('add.repeat')}</span>
                <div className="chips">
                  <button
                    type="button"
                    className={yearly ? 'chip' : 'chip is-on'}
                    onClick={() => {
                      setYearly(false)
                      setYearlyTouched(true)
                    }}
                  >
                    {yearly ? t('add.once') : `✓ ${t('add.once')}`}
                  </button>
                  <button
                    type="button"
                    className={yearly ? 'chip is-on' : 'chip'}
                    onClick={() => {
                      setYearly(true)
                      setYearlyTouched(true)
                    }}
                  >
                    {yearly ? `✓ ${t('add.yearly')}` : t('add.yearly')}
                  </button>
                </div>
              </div>
            ) : null}
            <button className="btn block" type="button" onClick={create} disabled={!title.trim()}>
              {t('common.done')}
            </button>
          </>
        )}
      </div>

      {festivals ? (
        <FestivalSheet
          onClose={() => setFestivals(false)}
          onCreated={(name) => {
            setFestivals(false)
            onCreated(name)
          }}
        />
      ) : null}
    </div>
  )
}

/** 2026-11-04 → 中文「2026年11月4日」，英文「Nov 4, 2026」 */
function formatDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Intl.DateTimeFormat(INTL_LOCALE[getLocale()], {
    year: 'numeric',
    month: getLocale() === 'zh' ? 'long' : 'short',
    day: 'numeric',
  }).format(date)
}

function parseDate(value: string, fallback: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return todayStart(fallback)
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(parsed.getTime())) return todayStart(fallback)
  parsed.setHours(0, 0, 0, 0)
  return parsed.getTime()
}
