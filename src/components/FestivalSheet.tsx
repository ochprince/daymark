import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Sheet } from './Sheet'
import { CheckIcon } from './icons'
import { FESTIVAL_GROUPS, daysToFestival, nextFestivalDate } from '../lib/festivals'
import type { Festival } from '../lib/festivals'

type Props = {
  /** 现在（用于算还有多少天），跨午夜时由上层刷新 */
  now: number
  /** 已经在列表里的节日 id */
  selectedIds: ReadonlySet<string>
  onToggle: (festival: Festival, next: number | null) => void
  onClose: () => void
}

function shortDate(stamp: number): string {
  const date = new Date(stamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function daysLabel(days: number | null): string {
  if (days === null) return '—'
  if (days === 0) return '就是今天'
  if (days < 0) return `已过去 ${Math.abs(days)} 天`
  return `还有 ${days} 天`
}

/**
 * 节日挑选：分组列出节日，点一下即加入主列表（再点一下移除）。
 * 选中状态直接写在格子上，配合主列表自动滚动，做到所加即所得。
 */
export function FestivalSheet({ now, selectedIds, onToggle, onClose }: Props) {
  const reduced = useReducedMotion()
  const [justToggled, setJustToggled] = useState<string | null>(null)

  // 每个节日算一次「下一个日期 / 还有几天」，分组渲染时复用
  const resolved = useMemo(() => {
    const map = new Map<string, { next: number | null; days: number | null }>()
    for (const group of FESTIVAL_GROUPS) {
      for (const festival of group.items) {
        const next = nextFestivalDate(festival, now)
        map.set(festival.id, { next, days: daysToFestival(festival, now) })
      }
    }
    return map
  }, [now])

  const selectedCount = selectedIds.size

  return (
    <Sheet label="挑选节日" className="sheet--festival" onClose={onClose}>
      <header className="festival__head">
        <div className="festival__title-row">
          <h2 className="sheet__title">节日</h2>
          {selectedCount > 0 ? (
            <span className="festival__tally" aria-live="polite">
              已加入 {selectedCount} 个
            </span>
          ) : null}
        </div>
        <p className="sheet__sub">点一下加入，再点一下移除；主列表会自动按日期排好。</p>
      </header>

      <div className="festival__body">
        {FESTIVAL_GROUPS.map((group) => {
          return (
            <section key={group.id} className="festival__group">
              <h3 className="festival__group-title">{group.title}</h3>
              <div className="festival__grid">
                {group.items.map((festival) => {
                  const info = resolved.get(festival.id)
                  const selected = selectedIds.has(festival.id)
                  return (
                    <motion.button
                      key={festival.id}
                      type="button"
                      className="fchip"
                      data-selected={selected}
                      aria-pressed={selected}
                      aria-label={`${festival.name}，${daysLabel(info?.days ?? null)}`}
                      onClick={() => {
                        setJustToggled(festival.id)
                        onToggle(festival, info?.next ?? null)
                      }}
                      whileTap={reduced ? undefined : { scale: 0.965 }}
                      animate={
                        justToggled === festival.id && !reduced ? { scale: [1, 1.045, 1] } : { scale: 1 }
                      }
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <span className="fchip__top">
                        <span className="fchip__box" aria-hidden="true">
                          <CheckIcon />
                        </span>
                        <span className="fchip__name">{festival.name}</span>
                      </span>
                      <span className="fchip__meta">
                        <span className="fchip__date">
                          {info?.next ? shortDate(info.next) : '日期待定'}
                        </span>
                        <span className="fchip__sep" aria-hidden="true">
                          ·
                        </span>
                        <span className="fchip__days">{daysLabel(info?.days ?? null)}</span>
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </Sheet>
  )
}
