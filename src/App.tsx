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
import { AddMenu } from './components/AddMenu'
import { FestivalSheet } from './components/FestivalSheet'
import { Toast } from './components/Toast'
import type { ToastState } from './components/Toast'
import { buildCountdownList, sortEvents, summarize, summarizeCountdowns } from './lib/days'
import { SLOT_COUNT, pageOfSlot, usePager } from './lib/usePager'
import { useSharedScroll } from './lib/useSharedScroll'
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
import type { Festival } from './lib/festivals'
import { useNow } from './lib/useNow'
import { THEME_MODE_TOAST, useTheme } from './lib/useTheme'
import type { CountdownDraft, CountdownEvent, DayEvent, EventDraft, Streak } from './lib/types'

type SheetState =
  /** 新增入口的浮动选项框 */
  | { kind: 'menu' }
  /** 节日挑选 */
  | { kind: 'festival' }
  | { kind: 'event'; mode: 'add' }
  | { kind: 'event'; mode: 'edit'; event: DayEvent }
  | { kind: 'countdown'; mode: 'add' }
  | { kind: 'countdown'; mode: 'edit'; event: CountdownEvent }
  | null

/** 轨道上的一格：隐藏时用 inert 让里面的控件退出键盘与辅助技术的可达范围 */
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

/**
 * 列表滚动区。循环翻页要求同一页在轨道上存在不止一份 DOM，
 * 这里让同名的几份共享滚动位置，切回来时不会跳回顶部。
 */
function ScrollArea({
  pageKey,
  onScroll,
  children,
}: {
  pageKey: string
  onScroll: (event: UIEvent<HTMLDivElement>) => void
  children: ReactNode
}) {
  const ref = useSharedScroll(pageKey)
  return (
    <div className="scroll" ref={ref} onScroll={onScroll}>
      {children}
    </div>
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

  const { stageRef, x, width, index, activeSlot, goTo, draggedRef, handleProps } = usePager(2)

  // 翻页时的景深：离页边界越远（越靠中间）越淡、越小
  const travelOf = (value: number) => {
    if (!width) return 0
    const grid = -value / width
    return clamp01(Math.abs(grid - Math.round(grid)) * 2)
  }
  const pageStyle: MotionStyle = {
    opacity: useTransform(x, (value) => 1 - 0.32 * travelOf(value)),
    scale: useTransform(x, (value) => 1 - 0.022 * travelOf(value)),
  }

  const [sheet, setSheet] = useState<SheetState>(null)
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const { mode: themeMode, cycleTheme } = useTheme()

  const handleListScroll = useCallback((scrollEvent: UIEvent<HTMLDivElement>) => {
    setScrolled(scrollEvent.currentTarget.scrollTop > 8)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('is-locked', sheet !== null)
    // 节日弹层：列表底部留出弹层那么高的空间，新加的卡片才滚得上来、看得见
    document.body.classList.toggle('is-peeking', sheet?.kind === 'festival')
    return () => {
      document.body.classList.remove('is-locked')
      document.body.classList.remove('is-peeking')
    }
  }, [sheet])

  // 翻页时收起已经滑开的卡片（每页各自保留滚动位置）
  useEffect(() => {
    setRevealedId(null)
  }, [index])

  // 滑开删除后点其它任何地方 = 放弃这次删除，卡片归位。
  // 按下的位置在那一行内部（卡片本身、删除按钮）时不处理，交给它们自己。
  useEffect(() => {
    if (!revealedId) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.swipe')) return
      setRevealedId(null)
    }
    // 捕获阶段：先于这一下的其它处理，先把滑开状态收掉
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [revealedId])

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

  /** 左滑删掉一段历史：只改这条记录的 history，可撤销 */
  const handleDeleteStreak = useCallback((event: DayEvent, streak: Streak) => {
    const previous = event.history ?? []
    updateEvent(event.id, {
      history: previous.filter(
        (item) => !(item.endedAt === streak.endedAt && item.days === streak.days),
      ),
    })
    setToast({
      id: Date.now(),
      message: `已删除 ${streak.days} 天这段`,
      action: { label: '撤销', run: () => updateEvent(event.id, { history: previous }) },
    })
  }, [])

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
        const next = draft as EventDraft
        // 重置过（起始日改到今天）就会多出一段历史，提示里说明一下
        const added =
          (next.history?.length ?? 0) > (sheet.event.history?.length ?? 0) ? next.history![0] : null
        updateEvent(sheet.event.id, next)
        setToast({
          id: Date.now(),
          message: added ? `已重置，之前 ${added.days} 天记进历史了` : '已保存修改',
        })
      } else {
        const created = addEvent(draft as EventDraft)
        setToast({ id: Date.now(), message: `「${created.title}」开始计时` })
      }
    } else if (sheet?.kind === 'countdown') {
      if (sheet.mode === 'edit') {
        // 手动改过日期就清掉 festivalId，让填写的日期重新说了算
        const dateChanged = (draft as CountdownDraft).startedAt !== sheet.event.startedAt
        updateCountdown(sheet.event.id, {
          ...(draft as CountdownDraft),
          festivalId: dateChanged ? undefined : sheet.event.festivalId,
        })
        setToast({ id: Date.now(), message: '已保存修改' })
      } else {
        const created = addCountdown(draft as CountdownDraft)
        setToast({ id: Date.now(), message: `「${created.title}」已加入倒数` })
      }
    }
    setSheet(null)
  }

  /** 已经在列表里的节日 */
  const festivalIds = useMemo(
    () => new Set(countdowns.map((item) => item.festivalId).filter((id): id is string => Boolean(id))),
    [countdowns],
  )

  /**
   * 把主列表滚到刚加的那张卡片。
   * 弹层还盖着，所以列表底部留了空间（见 .is-peeking .scroll），
   * 这里直接把滚动容器滚到卡片位置，不用 scrollIntoView（它挑不到可见的那份 DOM）。
   */
  const scrollToCountdownCard = useCallback((id: string) => {
    window.setTimeout(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-card-id="${id}"]`))
      const node =
        nodes.find((item) => {
          const rect = item.getBoundingClientRect()
          return rect.left > -8 && rect.left < window.innerWidth
        }) ?? nodes[0]
      const scroller = node?.closest<HTMLElement>('.scroll')
      if (!node || !scroller) return
      const top =
        node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 8
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }, 130)
  }, [])

  /** 选中即加入（保持时序），再点一下移除 */
  const toggleFestival = useCallback(
    (festival: Festival, next: number | null) => {
      const existing = countdowns.find((item) => item.festivalId === festival.id)
      if (existing) {
        removeCountdown(existing.id)
        return
      }
      if (next === null) return
      const created = addCountdown({
        title: festival.name,
        startedAt: next,
        color: suggestCountdownColor(),
        repeat: 'yearly',
        festivalId: festival.id,
      })
      scrollToCountdownCard(created.id)
    },
    [countdowns, scrollToCountdownCard],
  )

  /** 整组一起加/删（全选 / 取消全选） */
  const toggleFestivalMany = useCallback(
    (entries: Array<{ festival: Festival; next: number | null }>) => {
      let anchor: { id: string; next: number } | null = null
      for (const entry of entries) {
        const existing = countdowns.find((item) => item.festivalId === entry.festival.id)
        if (existing) {
          removeCountdown(existing.id)
          continue
        }
        if (entry.next === null) continue
        const created = addCountdown({
          title: entry.festival.name,
          startedAt: entry.next,
          color: suggestCountdownColor(),
          repeat: 'yearly',
          festivalId: entry.festival.id,
        })
        // 一批加完只滚一次，滚到这批里最早发生的那个
        if (!anchor || entry.next < anchor.next) anchor = { id: created.id, next: entry.next }
      }
      if (anchor) scrollToCountdownCard(anchor.id)
    },
    [countdowns, scrollToCountdownCard],
  )

  const openAdd = useCallback(() => {
    // 倒数日页：先弹选项框（节日 / 自定义）；走过的日子页没有节日可挑
    setSheet(index === 0 ? { kind: 'event', mode: 'add' } : { kind: 'menu' })
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

  /** 每页的内容都一样，只是数据源不同；轨道上有几格就渲染几份 */
  const renderPage = (pageIndex: number) => (
    <div className="shell">
      <div className="shell__top">
        <Hero
          now={now}
          title={pageIndex === 0 ? '已经走过的日子' : '还在等待的日子'}
          stats={pageIndex === 0 ? sinceStats : untilStats}
          pages={2}
          active={index}
          action={
            <PagerHandle
              label={pageIndex === 0 ? '倒数日' : '走过的日子'}
              onActivate={() => goTo(pageIndex === 0 ? 1 : 0)}
              draggedRef={draggedRef}
            />
          }
        />
      </div>

      <ScrollArea pageKey={pageIndex === 0 ? 'since' : 'until'} onScroll={handleListScroll}>
        {pageIndex === 0 ? (
          sortedEvents.length > 0 ? (
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
              </div>
            </>
          ) : (
            <EmptyState
              title="还没有任何刻度"
              text={'记下一件想坚持的事\n它会一天天长起来'}
              cta="记录第一个日子"
              onAdd={openAdd}
            />
          )
        ) : countdownList.length > 0 ? (
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
      </ScrollArea>
    </div>
  )

  return (
    <>
      {/* 背景层放在 .app 之外：.bg 是 fixed + z-index 0 的定位元素，
          若留在 .app 内部会盖住所有 static 内容 */}
      <Background />

      <div className="app" {...handleProps}>
        <TopBar
          scrolled={scrolled}
          mode={themeMode}
          onCycleTheme={(origin) => {
            // 轮换：跟随系统 → 浅色 → 深色，切完用气泡说明当前状态
            const next = cycleTheme(origin)
            setToast({ id: Date.now(), message: THEME_MODE_TOAST[next] })
          }}
        />

        <div className="stage" ref={stageRef}>
          <motion.div className="pager" style={{ x }}>
            {Array.from({ length: SLOT_COUNT }, (_, slot) => (
              <Page key={slot} hidden={slot !== activeSlot} style={pageStyle}>
                {renderPage(pageOfSlot(slot, 2))}
              </Page>
            ))}
          </motion.div>
        </div>

        <Fab onClick={openAdd} label={index === 0 ? '记录一个日子' : '新增倒数日'} />

        <AnimatePresence initial={false}>
          {sheet?.kind === 'menu' ? (
            <AddMenu
              key="add-menu"
              onClose={() => setSheet(null)}
              onPick={(choice) =>
                setSheet(choice === 'festival' ? { kind: 'festival' } : { kind: 'countdown', mode: 'add' })
              }
            />
          ) : null}

          {sheet?.kind === 'festival' ? (
            <FestivalSheet
              key="festival"
              now={now}
              selectedIds={festivalIds}
              onToggle={toggleFestival}
              onToggleMany={toggleFestivalMany}
              onClose={() => setSheet(null)}
            />
          ) : null}

          {sheet?.kind === 'event' ? (
            <EventSheet
              key={sheet.mode === 'edit' ? sheet.event.id : 'event-add'}
              mode={sheet.mode}
              event={
                sheet.mode === 'edit'
                  ? // 取实时数据：历史条目删除 / 撤销后弹层要立刻反映
                    (events.find((item) => item.id === sheet.event.id) ?? sheet.event)
                  : undefined
              }
              suggestedColor={suggestEventColor()}
              onClose={() => setSheet(null)}
              onSubmit={handleSubmit}
              onDelete={sheet.mode === 'edit' ? () => handleDeleteEvent(sheet.event) : undefined}
              onDeleteStreak={
                sheet.mode === 'edit'
                  ? (streak) =>
                      handleDeleteStreak(
                        events.find((item) => item.id === sheet.event.id) ?? sheet.event,
                        streak,
                      )
                  : undefined
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
              onDelete={sheet.mode === 'edit' ? () => handleDeleteCountdown(sheet.event) : undefined}
            />
          ) : null}
        </AnimatePresence>

        <Toast toast={toast} onDismiss={dismissToast} />
      </div>
    </>
  )
}
