import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Badge, Creature } from '../components/Creature'
import type { CreatureSpecies } from '../components/Creature'
import { BADGES, removeNote, updateNote } from '../lib/collection'
import type { CollectionState } from '../lib/collection'
import { formatDate } from '../lib/days'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import {
  DEX_TOTAL,
  SPECIES_WITH_DEX,
  badgeCount,
  dexCount,
  dexCountOf,
  hasDex,
  shelfBooks,
  speciesHue,
  stageTint,
} from '../lib/museum'
import type { ShelfBook } from '../lib/museum'
import { removeShelfBook } from '../lib/collection'
import { FREE_CHAPTER_LIMIT } from '../lib/entitlement'
import { BADGE_ART } from './BadgePopup'

type Pane = 'chapters' | 'dex' | 'badges' | 'notes'

export type MuseumPageProps = {
  collection: CollectionState
  /** 买断版能翻开全部章节；免费版只给最近几本 */
  pro: boolean
  onUpgrade: () => void
  onNotify: (message: string) => void
}

export function MuseumPage({ collection, pro, onUpgrade, onNotify }: MuseumPageProps) {
  const [pane, setPane] = useState<Pane>('notes')
  const [opened, setOpened] = useState<ShelfBook | null>(null)
  /**
   * 纸条弹层：卡片只是"铺在藏馆里"，点开才有地方放复制 / 编辑 / 撕掉这些动作。
   * 撕掉一律两步（不管是谁写的），交互统一，也免得手滑。
   */
  const [detail, setDetail] = useState<string | null>(null)
  const [sure, setSure] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const openDetail = useCallback((id: string) => {
    setDetail(id)
    setSure(false)
    setEditing(false)
  }, [])
  const closeDetail = useCallback(() => {
    setDetail(null)
    setSure(false)
    setEditing(false)
  }, [])
  const detailNote = detail ? collection.notes.find((note) => note.id === detail) ?? null : null

  /** 复制：先走剪贴板 API，浏览器不给（非 https / 老内核）就退回老办法 */
  async function copyNote(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      onNotify(t('note.copied'))
      return
    } catch {
      // 忽略，走下面的兜底
    }
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
      onNotify(t('note.copied'))
    } catch {
      onNotify(t('note.copyFail'))
    }
  }

  function tear() {
    if (!detailNote) return
    if (!sure) {
      setSure(true)
      return
    }
    removeNote(detailNote.id)
    onNotify(t(detailNote.mine ? 'museum.notes.gone' : 'museum.notes.goneSys'))
    closeDetail()
  }
  // 翻书方向：翻的时候给 currentTarget 挂 flip-l / flip-r，0.5s 后自动落位
  const [flip, setFlip] = useState<'l' | 'r' | null>(null)
  /** 书也能从藏馆里拿走：和撕纸条一样两步确认 */
  const [pullSure, setPullSure] = useState(false)
  // 一件事一本书：翻过的章夹在书里，点开才铺出来
  // 第二参是「删掉的事留下的书」，它们已经没有对应的今天页条目了
  /*
   * 架子上只摆「收起来的书」——删掉的那些。
   * 还在今天页的事不上架：藏馆是过去，今天页是现在。
   * （`views` 现在只用来判断哪些书还没被删，见下面的统计口径。）
   */
  const books = useMemo(() => shelfBooks(collection.shelves), [collection.shelves])
  /**
   * 章多了列表是要滚的，但滚动条是藏起来的：不提示的话，
   * 「翻过的 9 章」下面只露出 5 条，看着像是丢了几章。
   */
  const chapterListRef = useRef<HTMLDivElement | null>(null)
  const [moreChapters, setMoreChapters] = useState(false)
  const syncMoreChapters = useCallback(() => {
    const el = chapterListRef.current
    if (!el) return
    setMoreChapters(el.scrollHeight - el.scrollTop - el.clientHeight > 8)
  }, [])
  useEffect(() => {
    // 弹窗换了一本书 / 刚挂载：重新量一次
    const id = window.setTimeout(syncMoreChapters, 0)
    return () => window.clearTimeout(id)
  }, [opened?.key, syncMoreChapters])

  /** 把这本书从藏馆里拿走（它本来就已经不在今天页了） */
  function pullBook() {
    if (!opened) return
    if (!pullSure) {
      setPullSure(true)
      return
    }
    removeShelfBook(opened.key)
    onNotify(t('museum.book.gone'))
    setPullSure(false)
    setOpened(null)
  }

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

  // 顺序按用户要的：纸条 → 徽章 → 图鉴 → 章节
  const panes: Array<[Pane, MessageKey]> = [
    ['notes', 'museum.tab.notes'],
    ['badges', 'museum.tab.badges'],
    ['dex', 'museum.tab.dex'],
    ['chapters', 'museum.tab.chapters'],
  ]

  return (
    <div className="museum">
      <header className="m-head">
        <h2>{t('museum.title')}</h2>
        <p>{t('museum.sub')}</p>
      </header>

      {/* 四个数字跟下面的 tab 一一对应：纸条 / 徽章 / 图鉴 / 章节 */}
      <div className="m-stats">
        <Stat value={String(collection.notes.length)} label={t('museum.stat.notes')} />
        <Stat value={String(badgeCount(collection))} label={t('museum.stat.badges')} />
        <Stat value={`${dexCount(collection)}`} sub={`/${DEX_TOTAL}`} label={t('museum.stat.dex')} />
        <Stat value={String(books.length)} label={t('museum.stat.books')} />
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
                setPullSure(false)
                setOpened(book)
              }}
            />
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
        </>
      ) : null}

      {pane === 'notes' ? (
        <div className="slips">
          {collection.notes.length === 0 ? (
            <p className="shelf-cap">{t('museum.notes.empty')}</p>
          ) : (
            collection.notes.map((note) => (
              <button
                type="button"
                className="slip"
                key={note.id}
                onClick={() => openDetail(note.id)}
                aria-label={t('note.openOne')}
              >
                {note.text}
                <small>
                  —— {note.mine ? t('museum.notes.mine') : note.from} · {formatDate(note.at)}
                </small>
              </button>
            ))
          )}
          {/* 自己写的那几张不算在「还有 N 张在路上」里，那是小伙伴要给你的 */}
          <div className="slip locked">
            {t('museum.notes.locked', {
              n: Math.max(0, 45 - collection.notes.filter((note) => note.mine !== true).length),
            })}
          </div>
        </div>
      ) : null}

      {detailNote ? (
        <div className="ov note-ov" style={{ zIndex: 60 }}>
          <div className="dim" onClick={closeDetail} aria-hidden="true" />
          <div className="note-card slip-card" role="dialog" aria-modal="true" aria-label={t('note.title')}>
            <button
              type="button"
              className="note-card-x"
              aria-label={t('common.close')}
              onClick={closeDetail}
            >
              ×
            </button>
            <p className="note-card-t">
              {detailNote.mine ? t('museum.notes.mine') : detailNote.from} · {formatDate(detailNote.at)}
            </p>
            {editing ? (
              <textarea
                className="input note-write slip-edit"
                value={draft}
                autoFocus
                rows={4}
                maxLength={120}
                onChange={(event) => setDraft(event.target.value.slice(0, 120))}
              />
            ) : (
              <p className="note-card-body">{detailNote.text}</p>
            )}
            <div className="slip-acts">
              <button type="button" onClick={() => copyNote(detailNote.text)}>
                {t('note.copy')}
              </button>
              {detailNote.mine ? (
                <button
                  type="button"
                  onClick={() => {
                    if (editing) {
                      const next = draft.trim()
                      if (next) updateNote(detailNote.id, next)
                      setEditing(false)
                      return
                    }
                    setDraft(detailNote.text)
                    setEditing(true)
                  }}
                  disabled={editing && !draft.trim()}
                >
                  {editing ? t('note.editSave') : t('note.edit')}
                </button>
              ) : null}
              <button type="button" className={sure ? 'danger is-sure' : 'danger'} onClick={tear}>
                {sure ? t('museum.notes.del.sure') : t('museum.notes.del')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {opened ? (
        <div className="ov" style={{ zIndex: 60 }}>
          <div className="dim" onClick={() => setOpened(null)} aria-hidden="true" />
          <div
            key={`${opened.key}:${flip ?? ''}`}
            className={`modal bookpage${flip ? ` flip-${flip}` : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={opened.title}
            style={{ '--c': `var(--h-${opened.color})` } as CSSProperties}
          >
            <div className="bp-t">{opened.title}</div>
            <div className="bp-num">
              {opened.days > 0 ? opened.days : '★'}
              <small>{opened.days > 0 ? t('unit.dayShort') : ''}</small>
            </div>
            <div className="bp-meta">{bookMeta(opened)}</div>

            {/* 备忘和待办跟着书一起收进来：事没了，字还在 */}
            {opened.memo ? (
              <div className="bp-memo">
                <div className="bp-ch-h">{t('museum.book.memo')}</div>
                <p>{opened.memo}</p>
              </div>
            ) : null}
            {opened.todo && opened.todo.length > 0 ? (
              <div className="bp-todo">
                <div className="bp-ch-h">
                  {t('museum.book.todo', {
                    n: opened.todo.filter((item) => item.done).length,
                    total: opened.todo.length,
                  })}
                </div>
                <ul>
                  {opened.todo.map((item, index) => (
                    <li key={index} className={item.done ? 'done' : ''}>
                      <i aria-hidden="true">{item.done ? '✓' : ''}</i>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="bp-chapters">
              <div className="bp-ch-h">{chapterTitle(opened)}</div>
              {opened.chapters.length === 0 ? (
                <p className="bp-ch-empty">{chapterEmpty(opened)}</p>
              ) : (
                <div className={`bp-ch-wrap${moreChapters ? ' more' : ''}`}>
                <div className="bp-ch-list" ref={chapterListRef} onScroll={syncMoreChapters}>
                  {opened.chapters.map((chapter, index) => (
                    <div className="bp-ch" key={chapter.key}>
                      <b>{chapter.days > 0 ? t('unit.day', { n: chapter.days }) : '★'}</b>
                      <span>{formatDate(chapter.endedAt)}</span>
                      {chapter.line ? <small>{chapter.line}</small> : null}
                      <i>{opened.chapters.length - index}</i>
                    </div>
                  ))}
                </div>
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
                  {/* 按 key 找：books 每次 views 变化都会重建，拿对象引用去 indexOf 会得 -1 */}
                  {books.findIndex((book) => book.key === opened.key) + 1} / {books.length}
                </span>
                <button type="button" onClick={() => navChapter(1)}>
                  {t('museum.chapter.next')}
                </button>
              </div>
            ) : null}
            <button className="btn block" type="button" onClick={() => setOpened(null)}>
              {t('common.ok')}
            </button>
            {/* 和纸条一个逻辑：藏馆里的东西也能拿走，两步确认 */}
            <button type="button" className={pullSure ? 'danger is-sure' : 'danger'} onClick={pullBook}>
              {pullSure ? t('museum.book.del.sure') : t('museum.book.del')}
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
/** 章节区标题：没有章节时按种类说人话——每日打卡本来就不分章 */
function chapterTitle(book: ShelfBook): string {
  if (book.chapters.length > 0) return t('museum.book.past', { n: book.chapters.length })
  if (book.kind === 'habit') return t('museum.book.habitTitle')
  if (book.kind === 'countdown') return t('museum.book.countdownTitle')
  return t('museum.book.sinceTitle')
}

function chapterEmpty(book: ShelfBook): string {
  if (book.kind === 'habit') return t('museum.book.noneHabit')
  if (book.kind === 'countdown') return t('museum.book.noneCountdown')
  return t('museum.book.none')
}

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
                style={
                  {
                    '--c': `var(--h-${speciesHue(species)})`,
                    '--c2': `var(--h-${speciesHue(species)}-2)`,
                    '--tint': `${stageTint(stage)}%`,
                  } as CSSProperties
                }
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

    </div>
  )
}

