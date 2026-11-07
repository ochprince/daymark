import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { startOfDay, todayStart } from '../lib/days'
import { addCheckIn, patchCheckIn } from '../lib/checkins'
import { addCountdown, patchCountdown } from '../lib/countdowns'
import { addEvent, patchEvent } from '../lib/storage'
import { addNote } from '../lib/collection'
import { setFocusKey } from '../lib/focus'
import { itemKey } from '../lib/itemview'
import { t, type MessageKey } from '../lib/i18n'
import { getLocale, INTL_LOCALE } from '../lib/i18n/locale'
import type { Hue } from '../lib/hue'
import { getPhotoUrl, savePhoto } from '../lib/photos'
import { Creature, type CreatureSpecies } from '../components/Creature'
import type { ItemKind, Reminder } from '../lib/types'
import { IconClose } from './icons'
import { FestivalSheet } from './FestivalSheet'

export type AddSheetProps = {
  onClose: () => void
  onCreated: (message: string) => void
  onHatched?: (info: { species: CreatureSpecies; color: number; name: string }) => void
  /** 相片没存上时说一句，不挡着继续记 */
  onToast?: (message: string) => void
}

type Step = 1 | 2 | 3
type StartMode = 'today' | 'past'
type Cadence = 'daily' | 'weekly'
type HabitRemind = 'none' | '09:00' | '22:30'
type CountRemind = 0 | 1 | 3 | 7

type Egg = { species: CreatureSpecies; hue: Hue; color: number }

/** 第一步三张卡：物种、色相和文案都跟原型对齐 */
const ADD_KINDS: readonly {
  kind: ItemKind
  species: CreatureSpecies
  hue: Hue
  title: MessageKey
  desc: MessageKey
}[] = [
  { kind: 'since', species: 'sprout', hue: 'mint', title: 'add.kind.since', desc: 'add.kind.since.desc' },
  { kind: 'habit', species: 'moon', hue: 'grape', title: 'add.kind.habit', desc: 'add.kind.habit.desc' },
  { kind: 'countdown', species: 'post', hue: 'coral', title: 'add.kind.countdown', desc: 'add.kind.countdown.desc' },
]

const PRESETS: Record<ItemKind, readonly MessageKey[]> = {
  since: ['add.preset.smoke', 'add.preset.sugar', 'add.preset.late', 'add.preset.together', 'add.preset.city'],
  habit: ['add.preset.sleep', 'add.preset.water', 'add.preset.run', 'add.preset.read', 'add.preset.meditate', 'add.preset.words'],
  countdown: ['add.preset.birthday', 'add.preset.anniv', 'add.preset.exam', 'add.preset.trip', 'add.preset.payday'],
}

const PLACEHOLDER: Record<ItemKind, MessageKey> = {
  since: 'add.ph.since',
  habit: 'add.ph.habit',
  countdown: 'add.ph.countdown',
}

/** 非倒数日：五团面团。倒数日全是信信，只换颜色，推荐落在珊瑚色 */
const EGGS: readonly Egg[] = [
  { species: 'sprout', hue: 'mint', color: 4 },
  { species: 'moon', hue: 'grape', color: 2 },
  { species: 'drop', hue: 'sky', color: 3 },
  { species: 'star', hue: 'lemon', color: 0 },
  { species: 'star', hue: 'coral', color: 1 },
]
const POST_EGGS: readonly Egg[] = [
  { species: 'post', hue: 'mint', color: 4 },
  { species: 'post', hue: 'sky', color: 3 },
  { species: 'post', hue: 'grape', color: 2 },
  { species: 'post', hue: 'lemon', color: 0 },
  { species: 'post', hue: 'coral', color: 1 },
]

const DAY_OFFSETS: readonly { days: number; label: MessageKey }[] = [
  { days: 7, label: 'add.inWeek' },
  { days: 30, label: 'add.inMonth' },
  { days: 90, label: 'add.inSeason' },
]

const COUNT_REMINDS: readonly { days: CountRemind; label: MessageKey }[] = [
  { days: 0, label: 'add.remindSame' },
  { days: 1, label: 'add.remindDay1' },
  { days: 3, label: 'add.remindDay3' },
  { days: 7, label: 'add.remindWeek' },
]

function hueStyle(hue: Hue): CSSProperties {
  return { '--c': `var(--h-${hue})`, '--c2': `var(--h-${hue}-2)` } as CSSProperties
}

function recommendEgg(kind: ItemKind, cadence: Cadence, times: number): number {
  if (kind === 'countdown') return 4
  if (kind === 'since') return 0
  if (cadence === 'weekly') return 3
  if (times > 1) return 2
  return 1
}

function growLine(species: CreatureSpecies): string {
  if (species === 'post') return t('add.eggPost')
  const names = [1, 2, 3, 4].map((stage) => t(`stageName.${species}.${stage}` as MessageKey))
  return t('add.eggGrow', { stages: names.join(' → ') })
}

export function AddSheet({ onClose, onCreated, onHatched, onToast }: AddSheetProps) {
  const [step, setStep] = useState<Step>(1)
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
  const [date, setDate] = useState(() => isoOffset(0))
  const [startMode, setStartMode] = useState<StartMode>('today')
  const [cadence, setCadence] = useState<Cadence>('daily')
  const [times, setTimes] = useState(1)
  const [habitRemind, setHabitRemind] = useState<HabitRemind>('22:30')
  const [countRemind, setCountRemind] = useState<CountRemind>(1)
  const [photoId, setPhotoId] = useState<string | null>(null)
  const [egg, setEgg] = useState(0)
  const [eggTouched, setEggTouched] = useState(false)

  const name = title.trim()

  /** 名字里写着「生日」、或者挑的是过去的日期，默认就该每年一次 */
  function autoYearly(nextTitle: string, nextDate: string) {
    if (yearlyTouched) return
    const at = parseDate(nextDate, Date.now())
    const isPast = startOfDay(at) < todayStart(Date.now())
    setYearly(isPast || /生日|生诞|诞辰|birthday/i.test(nextTitle))
  }

  function choose(next: ItemKind) {
    setKind(next)
    setTitle('')
    setStartMode('today')
    setCadence('daily')
    setTimes(1)
    setHabitRemind('22:30')
    setCountRemind(1)
    setYearly(false)
    setYearlyTouched(false)
    setPhotoId(null)
    setEggTouched(false)
    setDate(isoOffset(next === 'countdown' ? 7 : 0))
    setStep(2)
  }

  function goEgg() {
    if (!name || !kind) return
    if (!eggTouched) setEgg(recommendEgg(kind, cadence, times))
    setStep(3)
  }

  function back() {
    if (step === 3) {
      setStep(2)
      return
    }
    setStep(1)
    setKind(null)
  }

  /** 自己写的纸条：直接收进藏馆（系统那张是「点了才收」） */
  function saveNote() {
    const text = noteText.trim()
    if (!text) return
    const now = Date.now()
    addNote({ id: `note-${now}`, text, from: '', at: now, mine: true })
    onCreated(t('note.saved'))
  }

  function finish() {
    if (!name || !kind) return
    const now = Date.now()
    const picked = (kind === 'countdown' ? POST_EGGS : EGGS)[egg] ?? EGGS[0]
    const photo = photoId ? { photoId } : {}

    if (kind === 'since') {
      const startedAt = startMode === 'today' ? todayStart(now) : parseDate(date, now)
      const fromNow = startMode === 'today' || startOfDay(startedAt) === todayStart(now)
      const event = addEvent({
        title: name,
        startedAt,
        anchorAt: fromNow ? now : undefined,
        color: picked.color,
        hue: picked.hue,
        species: picked.species,
      })
      patchEvent(event.id, { species: picked.species, hue: picked.hue, color: picked.color, ...photo })
      setFocusKey(itemKey('since', event.id))
    } else if (kind === 'habit') {
      const remind: Reminder =
        habitRemind === 'none' ? { kind: 'none' } : { kind: 'daily', time: habitRemind }
      const event = addCheckIn({
        title: name,
        color: picked.color,
        hue: picked.hue,
        cadence,
        species: picked.species,
        target: times,
        remind,
        photoId,
      })
      patchCheckIn(event.id, {
        species: picked.species,
        hue: picked.hue,
        color: picked.color,
        target: times,
        remind,
        ...photo,
      })
      setFocusKey(itemKey('habit', event.id))
    } else {
      const remind: Reminder = { kind: 'before', daysBefore: countRemind, time: '09:00' }
      const event = addCountdown({
        title: name,
        startedAt: parseDate(date, now),
        color: picked.color,
        hue: picked.hue,
        repeat: yearly ? 'yearly' : 'none',
        remind,
        photoId,
      })
      patchCountdown(event.id, { hue: picked.hue, color: picked.color, remind, ...photo })
      setFocusKey(itemKey('countdown', event.id))
    }

    onCreated(name)
    onHatched?.({ species: picked.species, color: picked.color, name })
  }

  const heading = writing
    ? t('note.title')
    : step === 1
      ? t('add.title')
      : step === 2
        ? t('add.nameTitle')
        : t('add.eggTitle')

  return (
    <div className="ov">
      <div className="dim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={heading}>
        <div className="grab" />
        {step > 1 && !writing ? (
          <div className="add-top">
            <button className="add-back" type="button" onClick={back}>
              <BackIcon />
              {t('add.back')}
            </button>
            <div className="steps-dots" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <i key={n} className={n === step ? 'on' : ''} />
              ))}
            </div>
            <button className="x" type="button" onClick={onClose} aria-label={t('common.close')}>
              <IconClose />
            </button>
          </div>
        ) : (
          <div className="sheet-h">
            <h3>{heading}</h3>
            <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close')}>
              <IconClose />
            </button>
          </div>
        )}

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
        ) : step === 1 || !kind ? (
          <>
            <p className="sheet-sub">{t('add.lead')}</p>
            {ADD_KINDS.map((option) => (
              <button
                key={option.kind}
                type="button"
                className="type-card"
                style={hueStyle(option.hue)}
                onClick={() => choose(option.kind)}
              >
                <span className="tc-art">
                  <Creature species={option.species} stage="egg" size={62} />
                </span>
                <span>
                  <h4>{t(option.title)}</h4>
                  <p>{t(option.desc)}</p>
                </span>
              </button>
            ))}
            <button type="button" className="type-card" style={hueStyle('lemon')} onClick={() => setWriting(true)}>
              <span className="tc-art">
                <i className="tc-slip" aria-hidden="true" />
              </span>
              <span>
                <h4>{t('add.note')}</h4>
                <p>{t('add.note.desc')}</p>
              </span>
            </button>
            <button className="link-row" type="button" onClick={() => setFestivals(true)}>
              {t('add.fromFestival')}
            </button>
          </>
        ) : step === 2 ? (
          <>
            <div className="sheet-h">
              <h3>{t('add.nameTitle')}</h3>
            </div>
            <p className="sheet-sub">{t('add.nameLead')}</p>
            <div className="field">
              <input
                className="input"
                value={title}
                autoFocus
                maxLength={12}
                placeholder={t(PLACEHOLDER[kind])}
                onChange={(event) => {
                  const next = event.target.value.slice(0, 12)
                  setTitle(next)
                  if (kind === 'countdown') autoYearly(next, date)
                }}
              />
            </div>
            <div className="field">
              <div className="chips">
                {PRESETS[kind].map((key) => {
                  const label = t(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      className={title === label ? 'chip is-on' : 'chip'}
                      onClick={() => {
                        setTitle(label)
                        if (kind === 'countdown') autoYearly(label, date)
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {kind === 'since' ? (
              <div className="field">
                <label>{t('add.fromWhen')}</label>
                <div className="chips">
                  <button
                    type="button"
                    className={startMode === 'today' ? 'chip is-on' : 'chip'}
                    onClick={() => setStartMode('today')}
                  >
                    {t('add.fromNow')}
                  </button>
                  <button
                    type="button"
                    className={startMode === 'past' ? 'chip is-on' : 'chip'}
                    onClick={() => {
                      setStartMode('past')
                      setDate((current) => (current >= isoOffset(0) ? isoOffset(-30) : current))
                    }}
                  >
                    {t('add.fromPast')}
                  </button>
                </div>
                {startMode === 'past' ? (
                  <DateField
                    value={date}
                    max={isoOffset(0)}
                    onChange={setDate}
                  />
                ) : null}
                <p className="add-note">
                  {startMode === 'past' ? t('add.fromPastNote', { date: formatDay(date) }) : t('add.fromNowNote')}
                </p>
              </div>
            ) : null}

            {kind === 'habit' ? (
              <>
                <div className="field">
                  <label>{t('add.round')}</label>
                  <div className="seg">
                    <button
                      type="button"
                      className={cadence === 'daily' ? 'is-on' : ''}
                      onClick={() => {
                        setCadence('daily')
                        setTimes(1)
                      }}
                    >
                      {t('add.everyDay')}
                    </button>
                    <button
                      type="button"
                      className={cadence === 'weekly' ? 'is-on' : ''}
                      onClick={() => {
                        setCadence('weekly')
                        setTimes(3)
                      }}
                    >
                      {t('add.everyWeek')}
                    </button>
                  </div>
                </div>
                <div className="field row-between">
                  <label style={{ margin: 0 }}>
                    {t(cadence === 'weekly' ? 'add.timesWeek' : 'add.timesDay')}
                    <small className="muted" style={{ display: 'block', fontWeight: 500 }}>
                      {t(times > 1 ? 'add.timesMany' : 'add.timesOnce')}
                    </small>
                  </label>
                  <div className="stepper">
                    <button
                      className="icon-btn"
                      type="button"
                      onClick={() => setTimes((n) => Math.max(1, n - 1))}
                      aria-label="−"
                    >
                      −
                    </button>
                    <b>{times}</b>
                    <button
                      className="icon-btn"
                      type="button"
                      onClick={() => setTimes((n) => Math.min(cadence === 'weekly' ? 7 : 12, n + 1))}
                      aria-label="+"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label>{t('add.remindAsk')}</label>
                  <div className="chips">
                    {(
                      [
                        ['none', 'add.remindOff'],
                        ['09:00', 'add.remindMorning'],
                        ['22:30', 'add.remindNight'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={habitRemind === value ? 'chip is-on' : 'chip'}
                        onClick={() => setHabitRemind(value)}
                      >
                        {t(label)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {kind === 'countdown' ? (
              <>
                <div className="field">
                  <label>{t('add.whichDay')}</label>
                  <div className="chips">
                    {DAY_OFFSETS.map((option) => (
                      <button
                        key={option.days}
                        type="button"
                        className={daysUntil(date) === option.days ? 'chip is-on' : 'chip'}
                        onClick={() => {
                          const next = isoOffset(option.days)
                          setDate(next)
                          autoYearly(title, next)
                        }}
                      >
                        {t(option.label)}
                      </button>
                    ))}
                  </div>
                  <DateField
                    value={date}
                    onChange={(next) => {
                      setDate(next)
                      autoYearly(title, next)
                    }}
                  />
                  <p className="add-note">
                    {daysUntil(date) >= 0
                      ? t('add.whenLine', {
                          date: formatDay(date),
                          weekday: weekdayOf(date),
                          n: daysUntil(date),
                        })
                      : formatDay(date)}
                  </p>
                </div>
                <div className="field">
                  <label>{t('add.repeatAsk')}</label>
                  <div className="seg">
                    <button
                      type="button"
                      className={yearly ? '' : 'is-on'}
                      onClick={() => {
                        setYearly(false)
                        setYearlyTouched(true)
                      }}
                    >
                      {t('add.repeatOnce')}
                    </button>
                    <button
                      type="button"
                      className={yearly ? 'is-on' : ''}
                      onClick={() => {
                        setYearly(true)
                        setYearlyTouched(true)
                      }}
                    >
                      {t('add.repeatYear')}
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label>{t('add.remindWhen')}</label>
                  <div className="chips">
                    {COUNT_REMINDS.map((option) => (
                      <button
                        key={option.days}
                        type="button"
                        className={countRemind === option.days ? 'chip is-on' : 'chip'}
                        onClick={() => setCountRemind(option.days)}
                      >
                        {t(option.label)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            <div className="field">
              <AddPhoto photoId={photoId} onChange={setPhotoId} onToast={onToast} />
            </div>
            <button className="btn block" type="button" onClick={goEgg} disabled={!name}>
              {t('add.nextEgg')}
            </button>
          </>
        ) : (
          <EggStep
            kind={kind}
            title={name}
            index={egg}
            suggested={recommendEgg(kind, cadence, times)}
            onPick={(index) => {
              setEgg(index)
              setEggTouched(true)
            }}
            onDone={finish}
          />
        )}
      </div>

      {festivals ? (
        <FestivalSheet
          onClose={() => setFestivals(false)}
          onCreated={(made) => {
            setFestivals(false)
            onCreated(made)
          }}
        />
      ) : null}
    </div>
  )
}

function EggStep({
  kind,
  title,
  index,
  suggested,
  onPick,
  onDone,
}: {
  kind: ItemKind
  title: string
  index: number
  suggested: number
  onPick: (index: number) => void
  onDone: () => void
}) {
  const eggs = kind === 'countdown' ? POST_EGGS : EGGS
  const picked = eggs[index] ?? eggs[0]
  return (
    <>
      <div className="sheet-h">
        <h3>{t('add.eggTitle')}</h3>
      </div>
      <p className="sheet-sub">{t('add.eggLead', { name: title })}</p>
      <div className="eggs">
        {eggs.map((option, i) => (
          <button
            key={`${option.species}-${option.hue}`}
            type="button"
            className={i === index ? 'egg-btn is-on' : 'egg-btn'}
            style={hueStyle(option.hue)}
            aria-label={t(`creature.${option.species}`)}
            aria-pressed={i === index}
            onClick={() => onPick(i)}
          >
            {i === suggested ? <span className="egg-rec">{t('add.eggRec')}</span> : null}
            <Creature species={option.species} stage="egg" size={66} />
          </button>
        ))}
      </div>
      <div className="egg-info" style={hueStyle(picked.hue)}>
        <h4>{t(`creature.${picked.species}`)}</h4>
        <p>{t(`creature.intro.${picked.species}`)}</p>
        <p className="egg-grow">{growLine(picked.species)}</p>
      </div>
      <button className="btn block" type="button" onClick={onDone}>
        {t('add.eggDone')}
      </button>
    </>
  )
}

function DateField({
  value,
  max,
  onChange,
}: {
  value: string
  max?: string
  onChange: (value: string) => void
}) {
  return (
    <span className="date-box" style={{ marginTop: 10 }}>
      <span className="date-val">{formatDay(value)}</span>
      <span className="date-ico" aria-hidden="true">
        ▾
      </span>
      <input
        className="date-native"
        type="date"
        value={value}
        max={max}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value)
        }}
      />
    </span>
  )
}

function AddPhoto({
  photoId,
  onChange,
  onToast,
}: {
  photoId: string | null
  onChange: (id: string | null) => void
  onToast?: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!photoId) {
      setUrl(null)
      return undefined
    }
    let cancelled = false
    void getPhotoUrl(photoId).then((next) => {
      if (!cancelled) setUrl(next)
    })
    return () => {
      cancelled = true
    }
  }, [photoId])

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const id = await savePhoto(file)
      if (!id) {
        onToast?.(t('photo.failed'))
        return
      }
      onChange(id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className={url ? 'add-photo on' : 'add-photo'} aria-disabled={busy}>
      <span className="thumb">{url ? <img src={url} alt="" /> : <CameraIcon />}</span>
      <span>
        {url ? t('add.photoOn') : t('add.photo')}
        <small>{busy ? t('photo.loading') : url ? t('add.photoOnHint') : t('add.photoHint')}</small>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={busy}
        aria-label={t('add.photo')}
        onChange={(event) => {
          void pick(event)
        }}
      />
    </label>
  )
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 22 22" aria-hidden="true">
      <path
        d="M13.5 4.5 7 11l6.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path
        d="M3 7.5A1.5 1.5 0 0 1 4.5 6h2.2L8 4h6l1.3 2h2.2A1.5 1.5 0 0 1 19 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 16.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="11" cy="11.5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function isoOffset(days: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function daysUntil(value: string): number {
  const at = parseDate(value, Date.now())
  return Math.round((at - todayStart(Date.now())) / 86_400_000)
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

function weekdayOf(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return ''
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (getLocale() === 'zh') return '日一二三四五六'[date.getDay()] ?? ''
  return new Intl.DateTimeFormat(INTL_LOCALE.en, { weekday: 'short' }).format(date)
}

function parseDate(value: string, fallback: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return todayStart(fallback)
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(parsed.getTime())) return todayStart(fallback)
  parsed.setHours(0, 0, 0, 0)
  return parsed.getTime()
}
