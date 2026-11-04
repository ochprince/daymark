/**
 * 节日面板：法定 / 中国传统 / 欧美三组，点一下就把这个节日加成倒数日。
 *
 * 节日走 `festivalId`：日期由 festivals.ts 现算（农历用离线表），
 * 所以春节、清明、中秋这些每年变的日子不用用户自己填；
 * 加进来之后它就是一条 `repeat: yearly` 的普通倒数日。
 *
 * 已经加过的节日灰掉，不重复建。
 */
import { useMemo } from 'react'
import { addCountdown, getCountdowns } from '../lib/countdowns'
import { daysToFestival, FESTIVAL_GROUPS, type Festival } from '../lib/festivals'
import { nextFestivalDate } from '../lib/festivals'
import { speciesColor } from '../lib/museum'
import { itemKey } from '../lib/itemview'
import { setFocusKey } from '../lib/focus'
import { t } from '../lib/i18n'
import { IconClose } from './icons'

export type FestivalSheetProps = {
  onClose: () => void
  onCreated: (message: string) => void
}

export function FestivalSheet({ onClose, onCreated }: FestivalSheetProps) {
  const now = Date.now()
  const added = useMemo(
    () => new Set(getCountdowns().map((item) => item.festivalId).filter(Boolean) as string[]),
    [],
  )

  function pick(festival: Festival) {
    const at = nextFestivalDate(festival, now)
    if (at === null) return
    const event = addCountdown({
      title: festival.name,
      startedAt: at,
      color: speciesColor('post'),
      repeat: 'yearly',
      festivalId: festival.id,
    })
    setFocusKey(itemKey('countdown', event.id))
    onCreated(festival.name)
  }

  return (
    <div className="ov" style={{ zIndex: 45 }}>
      <div className="dim" onClick={onClose} aria-hidden="true" />
      <div className="sheet fest-sheet" role="dialog" aria-modal="true" aria-label={t('festival.title')}>
        <div className="grab" />
        <div className="sheet-h">
          <h3>{t('festival.title')}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close')}>
            <IconClose />
          </button>
        </div>

        {FESTIVAL_GROUPS.map((group) => (
          <section className="fest-group" key={group.id}>
            <h4 className="fest-group-t">{group.title}</h4>
            <div className="fest-grid">
              {group.items.map((festival) => {
                const isAdded = added.has(festival.id)
                const days = daysToFestival(festival, now)
                return (
                  <button
                    key={festival.id}
                    className={isAdded ? 'fest-chip is-on' : 'fest-chip'}
                    type="button"
                    disabled={isAdded || days === null}
                    onClick={() => pick(festival)}
                  >
                    <b>{festival.name}</b>
                    <span>
                      {isAdded
                        ? t('festival.added')
                        : days === 0
                          ? t('festival.today')
                          : t('festival.days', { n: days ?? 0 })}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
