import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNow } from '../lib/useNow'
import { getSkin, patchSkin, resolveNum, resolveTexture, subscribe as subscribeSkin } from '../lib/skin'
import { getPrefs, reduceMotionOn, setPrefs, subscribe as subscribePrefs } from '../lib/prefs'
import { getLocale, setLocale, subscribeLocale } from '../lib/i18n'
import { setFocusKey } from '../lib/focus'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import { bubbleLine } from '../lib/lines'
import { patchCheckIn, removeCheckIn, tapCheckIn, untapCheckIn } from '../lib/checkins'
import { markSaid, patchCountdown, removeCountdown } from '../lib/countdowns'
import { patchEvent, removeEvent } from '../lib/storage'
import { anchorOf, todayStart } from '../lib/days'
import { dayKey, parseDayKey } from '../lib/daykey'
import { focusAfterRemoval } from '../lib/itemview'
import { ProfilePage } from './ProfilePage'
import { MuseumPage } from './MuseumPage'
import { DressPage } from './DressPage'
import { PaywallSheet } from './PaywallSheet'
import { ShareSheet } from './ShareSheet'
import { BackupSheet } from './BackupSheet'
import { canShareCard } from '../lib/entitlement'
import { shareCopy } from '../lib/sharecard'
import { buildIcs, icsFileName, isDue, nextTrigger } from '../lib/reminder'
import { applyBackup, backupFileName, buildBackup, parseBackup, type BackupSummary, type BackupFile } from '../lib/backup'
import type { Reminder } from '../lib/types'
import { hapticTap, setHapticsEnabled, setStatusBarTheme } from '../lib/native'
import { playSfx, setSoundOn } from '../lib/sfx'
import { canAddItem, grantPro, isPro, subscribe as subscribeEntitlement } from '../lib/entitlement'
import { syncEntitlement } from '../lib/purchase'
import { TodayPage } from './TodayPage'
import { TabBar, type TabKey } from './TabBar'
import { Switcher } from './Switcher'
import { AddSheet } from './AddSheet'
import { useV2Data } from './useV2Data'
import { EvolveOverlay } from './EvolveOverlay'
import type { EvolveInfo } from './EvolveOverlay'
import { BadgePopup } from './BadgePopup'
import { HatchOverlay } from './HatchOverlay'
import { BookFlight } from './BookFlight'
import type { HatchInfo } from './HatchOverlay'
import {
  dexKey,
  evaluateBadges,
  getCollection,
  noteStage,
  subscribe as subscribeCollection,
  unlockBadges,
  unlockDex,
} from '../lib/collection'
import type { BadgeId } from '../lib/collection'
import type { ItemView } from '../lib/itemview'
import './app.css'

type Sheet = 'switcher' | 'add' | null

/** 所有事里最大的成长天数（徽章门槛用） */
function maxGrowthOf(views: readonly ItemView[]): number {
  return views.reduce((max, view) => (view.growth > max ? view.growth : max), 0)
}

/** 孵化过没有：只播一次，之后新建直接回今天页 */
const HATCHED_KEY = 'daymark.hatched.v1'

function hasHatched(): boolean {
  try {
    return window.localStorage.getItem(HATCHED_KEY) === '1'
  } catch {
    return true
  }
}

/** 每件事最近一次弹过的提醒日期，避免同一天重复弹 */
const REMINDER_FIRED_KEY = 'daymark.reminderFired.v1'

/** 某一天 00:00（提醒换算目标日时用） */
function dayStartTs(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 某一章区间里记过几天（章节收尾用） */
function recordedDaysBetween(days: Record<string, number>, start: number, end: number): number {
  let total = 0
  for (const [key, count] of Object.entries(days)) {
    if (!(count > 0)) continue
    const ts = parseDayKey(key)
    if (Number.isNaN(ts) || ts < todayStart(start) || ts > end) continue
    total += 1
  }
  return total
}

/** 有没有结束过至少一章（「翻篇」徽章） */
function hasAnyChapter(views: readonly ItemView[]): boolean {
  return views.some((view) => {
    if (view.kind === 'since') return (view.event.history?.length ?? 0) > 0
    if (view.kind === 'habit') return (view.event.chapters?.length ?? 0) > 0
    return (view.event.history?.length ?? 0) > 0
  })
}

/** 皮肤令牌挂到根节点：换风格只换这一层属性，组件一行不改 */
/** 系统是不是深色：跟随系统这个开关要真的读它，否则就是个假开关 */
function useSystemDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return undefined
    const onChange = () => setDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return dark
}

function useApplyReduceMotion() {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs)
  useEffect(() => {
    // 用户开关与系统设置任一为真都算（reduceMotionOn 里已经 OR 过）
    document.documentElement.classList.toggle('reduce-motion', reduceMotionOn(prefs))
  }, [prefs])
}

function useApplySkin() {
  const skin = useSyncExternalStore(subscribeSkin, getSkin)
  const systemDark = useSystemDark()
  // 跟随系统 = 深色时切夜航，浅色时回到用户自己选的包
  const pack = skin.followSystem && systemDark ? 'night' : skin.pack
  useEffect(() => {
    const root = document.documentElement
    root.dataset.skin = pack
    root.dataset.accent = typeof skin.accent === 'number' ? String(skin.accent) : 'auto'
    root.dataset.num = resolveNum(pack, skin.num)
    root.dataset.texture = resolveTexture(pack, skin.texture)
    // 原生状态栏跟着皮肤走：'dark' 是深底浅字，'light' 是浅底深字
    setStatusBarTheme(pack === 'night' ? 'dark' : 'light')
  }, [skin, pack])
  // skin 是用户存的偏好；applied 是真正挂在根节点上、画在屏幕上的那套
  return { skin, applied: pack }
}

export function AppV2() {
  // 一分钟一跳：跨天时天数、睡着状态跟着变
  const now = useNow(60_000)
  useApplyReduceMotion()
  const { skin, applied: appliedPack } = useApplySkin()
  const [tab, setTab] = useState<TabKey>('today')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null)
  const [override, setOverride] = useState<string | null>(null)
  // 每记一次 +1：卡片上炸一次粒子与「+1」
  const [fxCount, setFxCount] = useState(0)
  const [pokeCount, setPokeCount] = useState(0)
  const [evolve, setEvolve] = useState<EvolveInfo | null>(null)
  // 徽章排队：一次只弹一个，而且要让进化过场先播完（两层同时盖住会挡住按钮）
  const [badges, setBadges] = useState<BadgeId[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const prevStage = useRef<Record<string, number>>({})

  const { views, focus } = useV2Data(now)
  const collection = useSyncExternalStore(subscribeCollection, getCollection)
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs)
  const locale = useSyncExternalStore(subscribeLocale, getLocale)
  const pro = useSyncExternalStore(subscribeEntitlement, () => isPro())
  const [paywall, setPaywall] = useState<'limit' | 'upgrade' | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [hatch, setHatch] = useState<HatchInfo | null>(null)
  const [flight, setFlight] = useState<{ from: DOMRect; to: DOMRect; color: number } | null>(null)
  const [backupPending, setBackupPending] = useState<{ file: BackupFile; summary: BackupSummary } | null>(null)

  const notify = useCallback((text: string, action?: { label: string; run: () => void }) => {
    setToast({ text, action })
  }, [])

  // 焦点不存在时把第一件写回存储，保证下次打开还是它
  useEffect(() => {
    if (focus) setFocusKey(focus.key)
  }, [focus?.key])

  useEffect(() => {
    if (!toast) return undefined
    // 带「撤销」的要多留一会儿，否则手还没移到就没了
    const timer = window.setTimeout(() => setToast(null), toast.action ? 5000 : 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  // 形态升级：写图鉴、记 peak、播过场（只挂低频节点，日常记录不弹）
  useEffect(() => {
    for (const view of views) {
      if (view.species === 'post') continue
      // 首次渲染时拿「看过的形态」当基准：关着 App 长出来的形态，打开时补播一次
      const before =
        prevStage.current[view.key] ?? getCollection().seenStage[view.key] ?? view.stage
      prevStage.current[view.key] = view.stage
      if (view.stage <= before) continue
      noteStage(view.key, view.stage, 'peak')
      unlockDex([dexKey(view.species, view.stage)])
      const fresh = evaluateBadges(
        {
          itemCount: views.length,
          maxGrowth: maxGrowthOf(views),
          hasChapter: hasAnyChapter(views),
        },
        getCollection(),
      )
      const unlocked = unlockBadges(fresh)
      playSfx('evolve')
      setEvolve({
        key: view.key,
        species: view.species,
        color: view.color,
        growth: view.growth,
        from: before as EvolveInfo['from'],
        to: view.stage,
        badgeName:
          unlocked.length > 0 ? t(`badge.${unlocked[0]}.name` as MessageKey) : undefined,
      })
      if (unlocked.length > 0) {
        playSfx('stamp')
        setBadges((queue) => [...queue, ...unlocked])
      }
    }
  }, [views])

  const changeFocus = useCallback((key: string) => {
    setFocusKey(key)
    setOverride(null)
    setPokeCount(0)
    setSheet(null)
  }, [])

  // 落定那一下浮起来的字。多单位习惯以后要显示「+1 杯」时从这里改
  const fxPlus = '+1'

  const onLog = useCallback(() => {
    if (!focus || focus.kind !== 'habit') return
    const next = focus.count + 1
    const result = tapCheckIn(focus.id, Date.now())
    // 记一次落定：一下中等触感 + 一声上行小铃；动效已经够多，声音点到为止
    hapticTap('medium')
    playSfx('settle')
    setFxCount((count) => count + 1)
    setOverride(next > 1 ? t('line.habit.count', { n: next }) : t('line.habit.done'))
    window.setTimeout(() => setOverride(null), 4000)
    // 记错了能立刻收回：原型里这一步是 toast 上的「撤销」
    notify(t('toast.logged', { title: focus.title }), {
      label: t('common.undo'),
      run: () => {
        if (result) untapCheckIn(focus.id, result.key)
        setOverride(null)
      },
    })
  }, [focus])

  const onSayDone = useCallback(() => {
    if (!focus || focus.kind !== 'countdown') return
    markSaid(focus.id, focus.next)
    notify(t('action.said'))
  }, [focus])

  const onPoke = useCallback(() => {
    if (!focus) return
    const next = pokeCount + 1
    setPokeCount(next)
    setOverride(bubbleLine(focus, { pokeIndex: next }))
    window.setTimeout(() => setOverride(null), 3200)
  }, [focus, pokeCount])

  const setReminderFocus = useCallback((view: ItemView, next: Reminder) => {
    if (view.kind === 'since') patchEvent(view.id, { remind: next })
    else if (view.kind === 'habit') patchCheckIn(view.id, { remind: next })
    else patchCountdown(view.id, { remind: next })
  }, [])

  /** 提醒导出成 .ics：真正靠系统日历响的只有这一条路（不做服务器推送） */
  const exportIcs = useCallback(() => {
    if (!focus) return
    const reminder = focus.remind
    if (!reminder || reminder.kind === 'none') {
      notify(t('reminder.off'))
      return
    }
    const targetAt = focus.kind === 'countdown' ? dayStartTs(focus.next) : undefined
    const from = nextTrigger(reminder, now, targetAt) ?? now
    const ics = buildIcs({
      uid: focus.key,
      title: focus.title,
      reminder,
      from,
      targetAt,
      now,
    })
    try {
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = icsFileName(focus.title)
      anchor.click()
      URL.revokeObjectURL(url)
      notify(t('reminder.calendarDone'))
    } catch {
      notify(t('dress.exportFailed'))
    }
  }, [focus, now])

  const renameFocus = useCallback((view: ItemView, title: string) => {
    if (view.kind === 'since') patchEvent(view.id, { title })
    else if (view.kind === 'habit') patchCheckIn(view.id, { title })
    else patchCountdown(view.id, { title })
  }, [])

  const recolorFocus = useCallback((view: ItemView, color: number) => {
    if (view.kind === 'since') patchEvent(view.id, { color })
    else if (view.kind === 'habit') patchCheckIn(view.id, { color })
    else patchCountdown(view.id, { color })
  }, [])

  const endChapter = useCallback(
    (view: ItemView, line = '') => {
      const at = Date.now()
      const endedAt = todayStart(at)
      if (view.kind === 'since') {
        const chapter = { days: view.days, endedAt, stage: view.stage, startedAt: anchorOf(view.event), ...(line ? { line } : {}) }
        patchEvent(view.id, {
          history: [chapter, ...(view.event.history ?? [])],
          startedAt: at,
          anchorAt: at,
        })
      } else if (view.kind === 'habit') {
        const start = view.event.chapterStartedAt ?? view.event.createdAt
        const chapter = { days: recordedDaysBetween(view.event.days, start, at), endedAt, stage: view.stage, startedAt: start, ...(line ? { line } : {}) }
        patchCheckIn(view.id, {
          chapters: [chapter, ...(view.event.chapters ?? [])],
          chapterStartedAt: at,
        })
      }
      // 合上书 → 飞进藏馆：量一次起点终点，420ms 沿弧线落进 tab
      const card = document.querySelector('.stage-card')?.getBoundingClientRect()
      const tab = document.querySelectorAll('.tabbar button')[1]?.getBoundingClientRect()
      if (card && tab) setFlight({ from: card, to: tab, color: view.color })
      notify(t('profile.endChapter'))
    },
    [],
  )

  const deleteFocus = useCallback(
    (view: ItemView) => {
      const next = focusAfterRemoval(views, view.key)
      if (view.kind === 'since') removeEvent(view.id)
      else if (view.kind === 'habit') removeCheckIn(view.id)
      else removeCountdown(view.id)
      if (next) setFocusKey(next)
      setProfileOpen(false)
    },
    [views],
  )

  // 免费版名额用完时，新建入口直接变成付费墙
  const openAdd = useCallback(() => {
    if (!canAddItem(views.length)) {
      setPaywall('limit')
      setSheet(null)
      return
    }
    setSheet('add')
  }, [views.length])

  // 到点提醒：只在 App 开着时弹（不做服务器推送，见 docs/plan-v2.md D12）
  useEffect(() => {
    if (!focus || !focus.remind || focus.remind.kind === 'none') return
    const stored = window.localStorage.getItem(REMINDER_FIRED_KEY)
    const fired: Record<string, string> = stored ? (JSON.parse(stored) as Record<string, string>) : {}
    const targetAt = focus.kind === 'countdown' ? dayStartTs(focus.next) : undefined
    if (!isDue(focus.remind, now, fired[focus.key] ?? null, { windowMinutes: 5, targetAt })) return
    fired[focus.key] = dayKey(now)
    window.localStorage.setItem(REMINDER_FIRED_KEY, JSON.stringify(fired))
    notify(`${t('reminder.title')} · ${focus.title}`)
    hapticTap('medium')
  }, [focus, now])

  // 偏好推给原生桥：轻震开关跟着走
  useEffect(() => {
    setHapticsEnabled(prefs.haptic)
  }, [prefs.haptic])

  // 音效开关：sfx 模块自己有静音状态，装扮页一改就同步过去
  useEffect(() => {
    setSoundOn(prefs.sound)
  }, [prefs.sound])

  // 启动时对一次账（离线优先，失败就保持本地状态）
  useEffect(() => {
    void syncEntitlement()
  }, [])

  /** 选完文件先只做校验，让用户看清要恢复多少再动手 */
  const pickBackup = useCallback(async (file: File) => {
    let text = ''
    try {
      text = await file.text()
    } catch {
      notify(t('backup.badFile'))
      return
    }
    const result = parseBackup(text)
    if (!result.ok) {
      const message =
        result.reason === 'not-json'
          ? t('backup.badFile')
          : result.reason === 'too-new'
            ? t('backup.tooNew')
            : result.reason === 'empty'
              ? t('backup.empty')
              : t('backup.notBackup')
      notify(message)
      return
    }
    setBackupPending({ file: result.file, summary: result.summary })
  }, [])

  const confirmRestore = useCallback(() => {
    if (!backupPending) return
    applyBackup(window.localStorage, backupPending.file)
    setBackupPending(null)
    notify(t('backup.done'))
    // 覆盖式恢复：store 都是模块加载时读的快照，重新加载最干净
    window.setTimeout(() => window.location.reload(), 700)
  }, [backupPending])

  const exportBackup = useCallback(() => {
    try {
      // 走 backup.ts 的白名单：运行时标记（如 migrated.v2）不该跟着搬去新设备
      const file = buildBackup(window.localStorage)
      const payload = JSON.stringify(file, null, 2)
      const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = backupFileName(file.exportedAt)
      anchor.click()
      URL.revokeObjectURL(url)
      notify(t('dress.exported'))
    } catch {
      notify(t('dress.exportFailed'))
    }
  }, [])

  return (
    <div className="dm-screen" data-tab={tab}>
      <div className="dm-texture" aria-hidden="true" />

      {tab === 'today' ? (
        <TodayPage
          views={views}
          focus={focus}
          now={now}
          onChangeFocus={changeFocus}
          onOpenSwitcher={() => setSheet('switcher')}
          onAdd={openAdd}
          onLog={onLog}
          onSayDone={onSayDone}
          onPoke={onPoke}
          onProfile={() => setProfileOpen(true)}
          overrideLine={override}
          pokeNonce={pokeCount}
          fxNonce={fxCount}
          fxPlus={fxPlus}
          onShift={(dir) => {
            // 横滑换焦点：到头就回绕，只有一件时什么也不做
            if (views.length < 2) return
            const index = views.findIndex((view) => view.key === focus?.key)
            if (index < 0) return
            const next = views[(index + dir + views.length) % views.length]
            changeFocus(next.key)
          }}
          onToast={notify}
        />
      ) : null}

      {tab === 'museum' ? (
        <MuseumPage
          views={views}
          collection={collection}
          pro={pro}
          onUpgrade={() => setPaywall('upgrade')}
        />
      ) : null}

      {tab === 'dress' ? (
        <DressPage
          skin={skin}
          appliedPack={appliedPack}
          onSkin={patchSkin}
          prefs={prefs}
          onPrefs={setPrefs}
          locale={locale}
          onLocale={(next) => setLocale(next)}
          onExport={exportBackup}
          onImport={(file) => void pickBackup(file)}
          pro={pro}
          onUpgrade={() => setPaywall('upgrade')}
        />
      ) : null}

      <TabBar active={tab} onChange={setTab} />

      {shareOpen && focus ? (
        <ShareSheet
          view={focus}
          now={now}
          onClose={() => setShareOpen(false)}
          onShared={() => {
            unlockBadges(['share'])
            notify(shareCopy('share.saved'))
          }}
        />
      ) : null}

      {backupPending ? (
        <BackupSheet
          summary={backupPending.summary}
          onCancel={() => setBackupPending(null)}
          onConfirm={confirmRestore}
        />
      ) : null}

      {paywall ? (
        <PaywallSheet
          mode={paywall}
          onClose={() => setPaywall(null)}
          onToast={(message) => notify(message)}
          onUnlocked={(message) => {
            grantPro()
            setPaywall(null)
            setSheet(null)
            notify(message)
          }}
        />
      ) : null}

      {profileOpen && focus ? (
        <ProfilePage
          view={focus}
          peakStage={collection.peakStage[focus.key] ?? focus.stage}
          now={now}
          onClose={() => setProfileOpen(false)}
          onRename={(title) => renameFocus(focus, title)}
          onReminder={(next) => setReminderFocus(focus, next)}
          onExportIcs={exportIcs}
          onPhoto={(id) => {
            if (focus.kind === 'since') patchEvent(focus.id, { photoId: id ?? undefined })
            else if (focus.kind === 'habit') patchCheckIn(focus.id, { photoId: id ?? undefined })
            else patchCountdown(focus.id, { photoId: id ?? undefined })
          }}
          onMemo={(text) => {
            if (focus.kind === 'countdown') patchCountdown(focus.id, { memo: text })
          }}
          onTodo={(next) => {
            if (focus.kind === 'countdown') patchCountdown(focus.id, { todo: next })
          }}
          onToast={notify}
          onShare={() => {
            if (!canShareCard()) {
              setPaywall('upgrade')
              return
            }
            setShareOpen(true)
          }}
          onChangeColor={(color) => recolorFocus(focus, color)}
          onEndChapter={(line) => {
            endChapter(focus, line)
            setProfileOpen(false)
          }}
          onDelete={() => {
            deleteFocus(focus)
            setProfileOpen(false)
          }}
        />
      ) : null}

      {sheet === 'switcher' ? (
        <Switcher
          views={views}
          activeKey={focus?.key ?? ''}
          onPick={changeFocus}
          onAdd={openAdd}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'add' ? (
        <AddSheet
          onClose={() => setSheet(null)}
          onCreated={(message) => {
            setSheet(null)
            notify(message)
          }}
          onHatched={(info) => {
            // 第一次建东西才播孵化，后续都直接落回今天页
            if (hasHatched()) return
            // 打招呼的是小伙伴自己，不是这件事的标题（「我是芽芽」而不是「我是戒烟」）
            setHatch({ ...info, name: t(`creature.${info.species}` as MessageKey) })
          }}
        />
      ) : null}

      {flight ? (
        <BookFlight
          from={flight.from}
          to={flight.to}
          color={flight.color}
          onDone={() => setFlight(null)}
        />
      ) : null}

      {hatch ? (
        <HatchOverlay
          info={hatch}
          onDone={() => {
            try {
              window.localStorage.setItem(HATCHED_KEY, '1')
            } catch {
              /* 写不进去就下次再播，不影响使用 */
            }
            setHatch(null)
          }}
        />
      ) : null}

      {evolve ? (
        <EvolveOverlay
          info={evolve}
          onDone={() => {
            noteStage(evolve.key, evolve.to, 'seen')
            setEvolve(null)
          }}
        />
      ) : null}

      {!evolve && badges.length > 0 ? (
        <BadgePopup
          badge={badges[0]}
          onClose={() => setBadges((queue) => queue.slice(1))}
        />
      ) : null}

      {toast ? (
        <div className={toast.action ? 'toast' : 'toast only'}>
          <span>{toast.text}</span>
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.run()
                setToast(null)
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
