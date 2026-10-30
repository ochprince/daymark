import { Fragment, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Badge, Creature } from '../components/Creature'
import type { CreatureSpecies } from '../components/Creature'
import { BADGES } from '../lib/collection'
import type { CollectionState } from '../lib/collection'
import { formatDate } from '../lib/days'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import type { ItemView } from '../lib/itemview'
import {
  DEX_TOTAL,
  SPECIES_WITH_DEX,
  badgeCount,
  collectBooks,
  dexCount,
  dexCountOf,
  hasDex,
} from '../lib/museum'
import type { ShelfBook } from '../lib/museum'
import { FREE_CHAPTER_LIMIT } from '../lib/entitlement'
import { BADGE_ART } from './BadgePopup'

type Pane = 'chapters' | 'dex' | 'badges' | 'notes'

export type MuseumPageProps = {
  views: readonly ItemView[]
  collection: CollectionState
  /** 买断版能翻开全部章节；免费版只给最近几本 */
  pro: boolean
  onUpgrade: () => void
}

export function MuseumPage({ views, collection, pro, onUpgrade }: MuseumPageProps) {
  const [pane, setPane] = useState<Pane>('chapters')
  const [opened, setOpened] = useState<ShelfBook | null>(null)
  // 翻书方向：翻的时候给 currentTarget 挂 flip-l / flip-r，0.5s 后自动落位
  const [flip, setFlip] = useState<'l' | 'r' | null>(null)
  // 一件事一本书：翻过的章夹在书里，点开才铺出来
  const books = useMemo(() => collectBooks(views), [views])

  /** 翻书：上一本 / 下一本，到头回绕。免费版翻到门外就弹付费墙，不放行 */
  function navChapter(dir: 1 | -1) {
    if (!opened) return
    const index = books.findIndex((book) => book.key === opened.key)
    if (index < 0) return
    const nextIndex = (index + dir + books.length) % books.length
    if (!pro && nextIndex >= FREE_CHAPTER_LIMIT) {
      onUpgrade()
      return
    }
    setFlip(dir > 0 ? 'r' : 'l')
    setOpened(books[nextIndex])
    window.setTimeout(() => setFlip(null), 520)
  }

  const panes: Array<[Pane, MessageKey]> = [
    ['chapters', 'museum.tab.chapters'],
    ['dex', 'museum.tab.dex'],
    ['badges', 'museum.tab.badges'],
    ['notes', 'museum.tab.notes'],
  ]

  return (
    <div className="museum">
      <header className="m-head">
        <h2>{t('museum.title')}</h2>
        <p>{t('museum.sub')}</p>
      </header>

      <div className="m-stats">
        <Stat value={String(books.length)} label={t('museum.stat.books')} />
        <Stat value={`${dexCount(collection)}`} sub={`/${DEX_TOTAL}`} label={t('museum.stat.dex')} />
        <Stat value={String(badgeCount(collection))} label={t('museum.stat.badges')} />
        <Stat value={String(collection.notes.length)} label={t('museum.stat.notes')} />
      </div>

      <div className="seg m-tabs" role="tablist">
        {panes.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={pane === key}
            className={pane === key ? 'is-on' : ''}
            onClick={() => setPane(key)}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {pane === 'chapters' ? (
        books.length === 0 ? (
          <p className="shelf-cap">{t('museum.chapters.empty')}</p>
        ) : (
          <>
            <Shelf
              books={books}
              pro={pro}
              onOpen={(book) => {
                const index = books.indexOf(book)
                if (!pro && index >= FREE_CHAPTER_LIMIT) {
                  onUpgrade()
                  return
                }
                setOpened(book)
              }}
            />
            <p className="shelf-cap">{t('museum.chapters.cap')}</p>
          </>
        )
      ) : null}

      {pane === 'dex' ? <DexPane collection={collection} /> : null}

      {pane === 'badges' ? (
        <>
          <div className="badges">
            {BADGES.map((badge) => {
              const got = Boolean(collection.badges[badge.id])
              const secret = badge.hidden && !got
              const art = BADGE_ART[badge.id]
              return (
                <div key={badge.id} className={`card bdg ${got ? '' : 'off'}`}>
                  <Badge kind={art.kind} label={art.label ?? ''} size={72} />
                  <b>{secret ? '???' : t(`badge.${badge.id}.name` as MessageKey)}</b>
                  <small>{secret ? t('museum.badge.hidden') : t(`badge.${badge.id}.desc` as MessageKey)}</small>
                </div>
              )
            })}
          </div>
          <p className="shelf-cap">{t('museum.badges.cap')}</p>
        </>
      ) : null}

      {pane === 'notes' ? (
        <div className="slips">
          {collection.notes.length === 0 ? (
            <p className="shelf-cap">{t('museum.notes.empty')}</p>
          ) : (
            collection.notes.map((note) => (
              <div className="slip" key={note.id}>
                {note.text}
                <small>
                  —— {note.from} · {formatDate(note.at)}
                </small>
              </div>
            ))
          )}
          <div className="slip locked">{t('museum.notes.locked', { n: Math.max(0, 45 - collection.notes.length) })}</div>
        </div>
      ) : null}

      {opened ? (
        <div className="ov" style={{ zIndex: 60 }}>
          <div className="dim" onClick={() => setOpened(null)} />
          <div
            key={`${opened.key}:${flip ?? ''}`}
            className={`modal bookpage${flip ? ` flip-${flip}` : ''}`}
            style={{ '--c': `var(--h-${opened.color})` } as CSSProperties}
          >
            <div className="bp-t">{opened.title}</div>
            <div className="bp-num">
              {opened.days > 0 ? opened.days : '★'}
              <small>{opened.days > 0 ? t('unit.dayShort') : ''}</small>
            </div>
            <div className="bp-meta">{bookMeta(opened)}</div>

            <div className="bp-chapters">
              <div className="bp-ch-h">{t('museum.book.past', { n: opened.chapters.length })}</div>
              {opened.chapters.length === 0 ? (
                <p className="bp-ch-empty">{t('museum.book.none')}</p>
              ) : (
                <div className="bp-ch-list">
                  {opened.chapters.map((chapter, index) => (
                    <div className="bp-ch" key={chapter.key}>
                      <b>{chapter.days > 0 ? t('unit.day', { n: chapter.days }) : '★'}</b>
                      <span>{formatDate(chapter.endedAt)}</span>
                      {chapter.line ? <small>{chapter.line}</small> : null}
                      <i>{opened.chapters.length - index}</i>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bp-dates">
              <Creature
                species={opened.species as CreatureSpecies}
                stage={Math.min(4, opened.stage) as 0 | 1 | 2 | 3 | 4}
                size={72}
              />
            </div>
            {books.length > 1 ? (
              <div className="bp-nav">
                <button type="button" onClick={() => navChapter(-1)}>
                  {t('museum.chapter.prev')}
                </button>
                <span>
                  {books.indexOf(opened) + 1} / {books.length}
                </span>
                <button type="button" onClick={() => navChapter(1)}>
                  {t('museum.chapter.next')}
                </button>
              </div>
            ) : null}
            <button className="btn block" type="button" onClick={() => setOpened(null)}>
              {t('common.ok')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Stat({ value, sub, label }: { value: string; sub?: string; label: string }) {
  return (
    <div className="card m-stat">
      <b>
        {value}
        {sub ? <small>{sub}</small> : null}
      </b>
      <span>{label}</span>
    </div>
  )
}

/** 书架：每排五本，书脊高度按天数长，薄的那本会歪一点 */
function Shelf({
  books,
  pro,
  onOpen,
}: {
  books: ShelfBook[]
  pro: boolean
  onOpen: (book: ShelfBook) => void
}) {
  const rows: ShelfBook[][] = []
  for (let index = 0; index < books.length; index += 5) rows.push(books.slice(index, index + 5))

  return (
    <>
      {rows.map((row, rowIndex) => (
        <div className="shelf-row" key={rowIndex}>
          {row.map((book, index) => {
            const height = Math.round(142 + Math.min(36, Math.log2(book.days + 1) * 5.5))
            const lean = index === row.length - 1 && row.length > 1 && row.length < 5 ? ' lean' : ''
            const locked = !pro && rowIndex * 5 + index >= FREE_CHAPTER_LIMIT
            return (
              <button
                key={book.key}
                type="button"
                className={`spine${lean}${locked ? ' locked' : ''}`}
                style={{ height, '--c': `var(--h-${book.color})` } as CSSProperties}
                onClick={() => onOpen(book)}
              >
                <span className="sp-band" />
                <span className="sp-t">{book.title.slice(0, 5)}</span>
                {book.chapters.length > 0 ? <span className="sp-ch">×{book.chapters.length + 1}</span> : null}
                <span className="sp-n">
                  {book.days > 0 ? book.days : '★'}
                  <small>{book.days > 0 ? t('unit.dayShort') : t('museum.book.arrived')}</small>
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </>
  )
}

/** 书页上的那一行小字：这本书现在讲到哪儿 */
function bookMeta(book: ShelfBook): string {
  if (book.kind === 'since') return t('museum.book.since', { date: formatDate(book.startedAt) })
  if (book.kind === 'habit') return t('museum.book.habit', { n: book.days })
  return book.days > 0
    ? t('museum.book.left', { n: book.days, date: formatDate(book.nextAt ?? book.startedAt) })
    : t('museum.book.arrivedOn')
}

function DexPane({ collection }: { collection: CollectionState }) {
  return (
    <div className="dex">
      {SPECIES_WITH_DEX.map((species) => (
        <Fragment key={species}>
          <div className="dex-name">
            <span>{t(`creature.${species}` as MessageKey)}</span>
            <small>{dexCountOf(collection, species)}/5</small>
          </div>
          {[0, 1, 2, 3, 4].map((stage) => {
            const on = hasDex(collection, species, stage)
            return (
              <div
                key={`${species}-${stage}`}
                className={`dex-cell ${on ? 'on' : 'off'}`}
                style={{ '--c': `var(--h-${(stage * 2) % 8})` } as CSSProperties}
              >
                <Creature
                  species={species}
                  stage={stage as 0 | 1 | 2 | 3 | 4}
                  size={54}
                  extra={on ? undefined : { silhouette: true }}
                />
              </div>
            )
          })}
        </Fragment>
      ))}

      <div className="dex-name">
        <span>
          {t('museum.dex.special')} <small>· {t('museum.dex.specialHint')}</small>
        </span>
        <small>{1 + (collection.badges.pumpkin ? 1 : 0)}/3</small>
      </div>
      <div className="dex-cell on" style={{ '--c': 'var(--h-5)' } as CSSProperties}>
        <Creature species="post" size={54} />
        <span>{t('museum.dex.letter')}</span>
      </div>
      <div
        className={`dex-cell ${collection.badges.pumpkin ? 'on' : 'off'}`}
        style={{ '--c': 'var(--h-4)' } as CSSProperties}
      >
        <Creature
          species="sprout"
          stage={2}
          size={54}
          extra={collection.badges.pumpkin ? { pumpkin: true } : { pumpkin: true, silhouette: true }}
        />
        <span>{collection.badges.pumpkin ? t('badge.pumpkin.name') : t('museum.dex.someday')}</span>
      </div>
      <div className="dex-cell off" style={{ '--c': 'var(--h-2)' } as CSSProperties}>
        <Creature species="drop" stage={1} size={54} extra={{ silhouette: true }} />
        <span>{t('museum.dex.winter')}</span>
      </div>

      <p className="shelf-cap">{t('museum.dex.cap')}</p>
    </div>
  )
}

