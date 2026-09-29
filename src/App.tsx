import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { AnimatePresence } from 'motion/react'
import { Background } from './components/Background'
import { TopBar } from './components/TopBar'
import { Hero } from './components/Hero'
import { EventList } from './components/EventList'
import { EmptyState } from './components/EmptyState'
import { Fab } from './components/Fab'
import { EventSheet } from './components/EventSheet'
import { Toast } from './components/Toast'
import type { ToastState } from './components/Toast'
import { sortEvents, summarize } from './lib/days'
import {
  addEvent,
  getEvents,
  removeEvent,
  restoreEvent,
  subscribe,
  suggestColor,
  updateEvent,
} from './lib/storage'
import { useNow } from './lib/useNow'
import { useTheme } from './lib/useTheme'
import type { DayEvent, EventDraft } from './lib/types'

type SheetState = { mode: 'add' } | { mode: 'edit'; event: DayEvent } | null

export default function App() {
  const now = useNow()
  const events = useSyncExternalStore(subscribe, getEvents, getEvents)
  const sorted = useMemo(() => sortEvents(events), [events])
  const summary = useMemo(() => summarize(events, now), [events, now])

  const [sheet, setSheet] = useState<SheetState>(null)
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('is-locked', sheet !== null)
    return () => document.body.classList.remove('is-locked')
  }, [sheet])

  const dismissToast = useCallback(() => setToast(null), [])

  const notifyDeleted = useCallback((event: DayEvent) => {
    setToast({
      id: Date.now(),
      message: `已删除「${event.title}」`,
      action: { label: '撤销', run: () => restoreEvent(event) },
    })
  }, [])

  const handleDelete = useCallback(
    (event: DayEvent) => {
      removeEvent(event.id)
      setRevealedId(null)
      setSheet(null)
      notifyDeleted(event)
    },
    [notifyDeleted],
  )

  const handleSubmit = (draft: EventDraft) => {
    if (sheet?.mode === 'edit') {
      updateEvent(sheet.event.id, draft)
      setToast({ id: Date.now(), message: '已保存修改' })
    } else {
      const created = addEvent(draft)
      setToast({ id: Date.now(), message: `「${created.title}」开始计时` })
    }
    setSheet(null)
  }

  const openAdd = useCallback(() => setSheet({ mode: 'add' }), [])

  return (
    <>
      {/* 背景层放在 .app 之外：.bg 是 fixed + z-index 0 的定位元素，
          若留在 .app 内部会盖住所有 static 内容（头图、列表、空状态）。 */}
      <Background />

      <div className="app">
        <TopBar scrolled={scrolled} theme={theme} onToggleTheme={toggleTheme} />

        <main className="shell">
          <Hero now={now} summary={summary} />

          {sorted.length > 0 ? (
            <>
              <EventList
                events={sorted}
                now={now}
                revealedId={revealedId}
                onReveal={setRevealedId}
                onOpen={(event) => {
                  setRevealedId(null)
                  setSheet({ mode: 'edit', event })
                }}
                onDelete={handleDelete}
              />
              <div className="foot">
                <span>点击编辑 · 左滑删除</span>
                <span>数据保存在本机</span>
              </div>
            </>
          ) : (
            <EmptyState onAdd={openAdd} />
          )}
        </main>

        <Fab onClick={openAdd} />

        <AnimatePresence initial={false}>
          {sheet ? (
            <EventSheet
              key={sheet.mode === 'edit' ? sheet.event.id : 'add'}
              mode={sheet.mode}
              event={sheet.mode === 'edit' ? sheet.event : undefined}
              suggestedColor={suggestColor()}
              onClose={() => setSheet(null)}
              onSubmit={handleSubmit}
              onDelete={sheet.mode === 'edit' ? () => handleDelete(sheet.event) : undefined}
            />
          ) : null}
        </AnimatePresence>

        <Toast toast={toast} onDismiss={dismissToast} />
      </div>
    </>
  )
}
