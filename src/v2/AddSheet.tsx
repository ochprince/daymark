import { useState } from 'react'
import { startOfDay, todayStart } from '../lib/days'
import { addCheckIn, suggestColor as suggestCheckInColor } from '../lib/checkins'
import { addCountdown, updateCountdown, suggestColor as suggestCountdownColor } from '../lib/countdowns'
import { addEvent, suggestColor as suggestEventColor } from '../lib/storage'
import { pickSpecies } from '../lib/migrate'
import { setFocusKey } from '../lib/focus'
import { itemKey } from '../lib/itemview'
import { t } from '../lib/i18n'
import type { ItemKind } from '../lib/types'
import { IconClose } from './icons'

export type AddSheetProps = {
  onClose: () => void
  onCreated: (message: string) => void
}

const NAME_PLACEHOLDER: Record<ItemKind, string> = {
  since: '戒烟 / 在一起',
  habit: '喝水 / 跑步',
  countdown: '妈妈的生日 / 出发旅行',
}

export function AddSheet({ onClose, onCreated }: AddSheetProps) {
  const [kind, setKind] = useState<ItemKind | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  function create() {
    const name = title.trim()
    if (!name || !kind) return
    const now = Date.now()

    if (kind === 'since') {
      const startedAt = parseDate(date, now)
      const isToday = startOfDay(startedAt) === todayStart(now)
      const event = addEvent({
        title: name,
        startedAt,
        // 起始日就是今天时，计时锚点写按下的那一刻（满 24 小时才 +1）
        anchorAt: isToday ? now : undefined,
        color: suggestEventColor(),
        species: 'sprout',
      })
      setFocusKey(itemKey('since', event.id))
    } else if (kind === 'habit') {
      const species = pickSpecies(name)
      const event = addCheckIn({ title: name, color: suggestCheckInColor(), cadence: 'daily', species })
      setFocusKey(itemKey('habit', event.id))
    } else {
      const startedAt = parseDate(date, now)
      const past = startOfDay(startedAt) < todayStart(now)
      const event = addCountdown({
        title: name,
        startedAt,
        color: suggestCountdownColor(),
        repeat: past ? 'yearly' : 'none',
      })
      if (past) updateCountdown(event.id, { repeat: 'yearly' })
      setFocusKey(itemKey('countdown', event.id))
    }

    onCreated(name)
  }

  return (
    <div className="ov">
      <div className="dim" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <div className="sheet-h">
          <h3>{kind === null ? t('add.title') : t('add.step2')}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close')}>
            <IconClose />
          </button>
        </div>

        {kind === null ? (
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
          </div>
        ) : (
          <>
            <input
              className="input"
              value={title}
              autoFocus
              placeholder={NAME_PLACEHOLDER[kind]}
              onChange={(event) => setTitle(event.target.value.slice(0, 40))}
            />
            {kind !== 'habit' ? (
              <input
                className="input"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                aria-label={t('add.startNow')}
              />
            ) : null}
            <button className="btn block" type="button" onClick={create} disabled={!title.trim()}>
              {t('common.done')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function parseDate(value: string, fallback: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return todayStart(fallback)
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(parsed.getTime())) return todayStart(fallback)
  parsed.setHours(0, 0, 0, 0)
  return parsed.getTime()
}
