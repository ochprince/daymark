import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode, UIEvent } from 'react'
import type { MotionStyle } from 'motion/react'
import { AnimatePresence, motion, useTransform } from 'motion/react'
import { Background } from './components/Background'
import { TopBar } from './components/TopBar'
import { Hero } from './components/Hero'
import { EventList } from './components/EventList'
import { CountdownList } from './components/CountdownList'
import { EmptyState } from './components/EmptyState'
import { Fab } from './components/Fab'
import { EventSheet } from './components/EventSheet'
import { CountdownSheet } from './components/CountdownSheet'
import { PagerHandle } from './components/PagerHandle'
import { Toast } from './components/Toast'
import type { ToastState } from './components/Toast'
import { buildCountdownList, sortEvents, summarize, summarizeCountdowns } from './lib/days'
import {
  addEvent,
  getEvents,
  removeEvent,
  restoreEvent,
  subscribe as subscribeEvents,
  suggestColor as suggestEventColor,
  updateEvent,
} from './lib/storage'
import {
  addCountdown,
  getCountdowns,
  removeCountdown,
  restoreCountdown,
  subscribe as subscribeCountdowns,
  suggestColor as suggestCountdownColor,
  updateCountdown,
} from './lib/countdowns'
import { useNow } from './lib/useNow'
import { usePager } from './lib/usePager'
import { useTheme } from './lib/useTheme'
import type { CountdownDraft, CountdownEvent, DayEvent, EventDraft } from './lib/types'

type SheetState =
  | { kind: 'event'; mode: 'add' }
  | { kind: 'event'; mode: 'edit'; event: DayEvent }
  | { kind: 'countdown'; mode: 'add' }
  | { kind: 'countdown'; mode: 'edit'; event: CountdownEvent }
  | null

/** 轨道上的一页：隐藏时用 inert 让里面的控件退出键盘与辅助技术的可达范围 */
function Page({ hidden, style, children }: { hidden: boolean; style?: MotionStyle; children: ReactNode }) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const element = ref.current as (HTMLElement & { inert?: boolean }) | null
    if (element) element.inert = hidden
  }, [hidden])

  return (
    <motion.section className="page" ref={ref} style={style} aria-hidden={hidden}>
      {children}
    </motion.section>
  )
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export default function App() {
  const now = useNow()
  const events = useSyncExternalStore(subscribeEvents, getEvents, getEvents)
  const countdowns = useSyncExternalStore(subscribeCountdowns, getCountdowns, getCountdowns)

  const sortedEvents = useMemo(() => sortEvents(events), [events])
  const countdownList = useMemo(() => buildCountdownList(countdowns, now), [countdowns, now])
  const eventSummary = useMemo(() => summarize(events, now), [events, now])
  const countdownSummary = useMemo(() => summarizeCountdowns(countdownList), [countdownList])

  const { stageRef, x, width, index, goTo, draggedRef, handleProps } = usePager(2)

  // 翻页时的「前后景深」：离屏的那一页淡下去、略微缩小，切页更像翻页而不是生硬平移
  const travel = (value: number) => clamp01(Math.abs(value) / (width || 1))
  const pageStyle = {
    opacity: useTransform(x, (value) => 1 - 0.32 * travel(value)),
    scale: useTransform(x, (value) => 1 - 0.022 * travel(value)),
  }
  const nextPageStyle = {
    opacity: useTransform(x, (value) => 1 - 0.32 * (1 - travel(value))),
    scale: useTransform(x, (value) => 1 - 0.022 * (1 - travel(value))),
  }
  const [sheet, setSheet] = useState<SheetState>(null)
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const { theme, toggleTheme } = useTheme()

  // 顶栏的「已滚动」态跟随列表容器，而不是 window
  const handleListScroll = useCallback((scrollEvent: UIEvent<HTMLDivElement>) => {
    setScrolled(scrollEvent.currentTarget.scrollTop > 8)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('is-locked', sheet !== null)
    return () => document.body.classList.remove('is-locked')
  }, [sheet])

  // 翻页时收起已经滑开的卡片（两页各自保留自己的滚动位置）
  useEffect(() => {
    setRevealedId(null)
  }, [index])

  const dismissToast = useCallback(() => setToast(null), [])

  const notifyDeleted = useCallback((title: string, undo: () => void) => {
    setToast({ id: Date.now(), message: `已删除「${title}」`, action: { label: '撤销', run: undo } })
  }, [])

  const handleDeleteEvent = useCallback(
    (event: DayEvent) => {
      removeEvent(event.id)
      setRevealedId(null)
      setSheet(null)
      notifyDeleted(event.title, () => restoreEvent(event))
    },
    [notifyDeleted],
  )

  const handleDeleteCountdown = useCallback(
    (event: CountdownEvent) => {
      removeCountdown(event.id)
      setRevealedId(null)
      setSheet(null)
      notifyDeleted(event.title, () => restoreCountdown(event))
    },
    [notifyDeleted],
  )

  const handleSubmit = (draft: EventDraft | CountdownDraft) => {
    if (sheet?.kind === 'event') {
      if (sheet.mode === 'edit') {
        updateEvent(sheet.event.id, draft as EventDraft)
        setToast({ id: Date.now(), message: '已保存修改' })
      } else {
        const created = addEvent(draft as EventDraft)
        setToast({ id: Date.now(), message: `「${created.title}」开始计时` })
      }
    } else if (sheet?.kind === 'countdown') {
      if (sheet.mode === 'edit') {
        updateCountdown(sheet.event.id, draft as CountdownDraft)
        setToast({ id: Date.now(), message: '已保存修改' })
      } else {
        const created = addCountdown(draft as CountdownDraft)
        setToast({ id: Date.now(), message: `「${created.title}」已加入倒数` })
      }
    }
    setSheet(null)
  }

  const openAdd = useCallback(() => {
    setSheet(index === 0 ? { kind: 'event', mode: 'add' } : { kind: 'countdown', mode: 'add' })
  }, [index])

  const sinceStats =
    eventSummary.count > 0 ? (
      <>
        <span>共 {eventSummary.count} 个刻度</span>
        <span className="hero__sep" />
        <span>最长 {eventSummary.longest} 天</span>
      </>
    ) : (
      <span>记录一件事，然后看它长成多少天</span>
    )

  const untilStats =
    countdownSummary.count > 0 ? (
      <>
        <span>共 {countdownSummary.count} 个倒数</span>
        {countdownSummary.nearest !== null ? (
          <>
            <span className="hero__sep" />
            <span>{countdownSummary.nearest === 0 ? '最近就是今天' : `最近 ${countdownSummary.nearest} 天`}</span>
          </>
        ) : null}
      </>
    ) : (
      <span>生日、纪念日，写下来就不用再数了</span>
    )

  return (
    <>
      {/* 背景层放在 .app 之外：.bg 是 fixed + z-index 0 的定位元素，
          若留在 .app 内部会盖住所有 static 内容 */}
      <Background />

      <div className="app">
        <TopBar scrolled={scrolled} theme={theme} onToggleTheme={toggleTheme} />

        <div className="stage" ref={stageRef}>
          <motion.div className="pager" style={{ x }}>
            <Page hidden={index !== 0} style={pageStyle}>
              <div className="shell">
                <div className="shell__top" {...handleProps}>
                <Hero
                  now={now}
                  title="已经走过的日子"
                  stats={sinceStats}
                  pages={2}
                  active={index}
                  action={
                    <PagerHandle
                      direction="next"
                      label="倒数日"
                      onActivate={() => goTo(1)}
                      draggedRef={draggedRef}
                      handleProps={handleProps}
                    />
                  }
                />
                </div>

                <div className="scroll" onScroll={handleListScroll}>
                {sortedEvents.length > 0 ? (
                  <>
                    <EventList
                      events={sortedEvents}
                      now={now}
                      revealedId={revealedId}
                      onReveal={setRevealedId}
                      onOpen={(event) => {
                        setRevealedId(null)
                        setSheet({ kind: 'event', mode: 'edit', event })
                      }}
                      onDelete={handleDeleteEvent}
                    />
                    <div className="foot">
                      <span>点击编辑 · 左滑删除</span>
                      <span>数据保存在本机</span>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="还没有任何刻度"
                    text={'记下一件想坚持的事\n它会一天天长起来'}
                    cta="记录第一个日子"
                    onAdd={openAdd}
                  />
                )}
                </div>
              </div>
            </Page>

            <Page hidden={index !== 1} style={nextPageStyle}>
              <div className="shell">
                <div className="shell__top" {...handleProps}>
                <Hero
                  now={now}
                  title="还在等待的日子"
                  stats={untilStats}
                  pages={2}
                  active={index}
                  action={
                    <PagerHandle
                      direction="prev"
                      label="走过的日子"
                      onActivate={() => goTo(0)}
                      draggedRef={draggedRef}
                      handleProps={handleProps}
                    />
                  }
                />
                </div>

                <div className="scroll" onScroll={handleListScroll}>
                {countdownList.length > 0 ? (
                  <>
                    <CountdownList
                      views={countdownList}
                      revealedId={revealedId}
                      onReveal={setRevealedId}
                      onOpen={(view) => {
                        setRevealedId(null)
                        setSheet({ kind: 'countdown', mode: 'edit', event: view.event })
                      }}
                      onDelete={handleDeleteCountdown}
                    />
                    <div className="foot">
                      <span>点击编辑 · 左滑删除</span>
                      <span>数据保存在本机</span>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="还没有倒数日"
                    text={'生日、纪念日、出发那天\n都可以写在这里'}
                    cta="记录第一个倒数日"
                    onAdd={openAdd}
                  />
                )}
                </div>
              </div>
            </Page>
          </motion.div>
        </div>

        <Fab onClick={openAdd} label={index === 0 ? '记录一个日子' : '记录一个倒数日'} />

        <AnimatePresence initial={false}>
          {sheet?.kind === 'event' ? (
            <EventSheet
              key={sheet.mode === 'edit' ? sheet.event.id : 'event-add'}
              mode={sheet.mode}
              event={sheet.mode === 'edit' ? sheet.event : undefined}
              suggestedColor={suggestEventColor()}
              onClose={() => setSheet(null)}
              onSubmit={handleSubmit}
              onDelete={
                sheet.mode === 'edit' ? () => handleDeleteEvent(sheet.event) : undefined
              }
            />
          ) : null}

          {sheet?.kind === 'countdown' ? (
            <CountdownSheet
              key={sheet.mode === 'edit' ? sheet.event.id : 'countdown-add'}
              mode={sheet.mode}
              event={sheet.mode === 'edit' ? sheet.event : undefined}
              suggestedColor={suggestCountdownColor()}
              onClose={() => setSheet(null)}
              onSubmit={handleSubmit}
              onDelete={
                sheet.mode === 'edit' ? () => handleDeleteCountdown(sheet.event) : undefined
              }
            />
          ) : null}
        </AnimatePresence>

        <Toast toast={toast} onDismiss={dismissToast} />
      </div>
    </>
  )
}
