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
import { patchCountdown, removeCountdown } from '../lib/countdowns'
import { patchEvent, removeEvent } from '../lib/storage'
import { anchorOf, todayStart } from '../lib/days'
import { dayKey, parseDayKey } from '../lib/daykey'
import { focusAfterRemoval } from '../lib/itemview'
import { collectBooks } from '../lib/museum'
import { archiveBook } from '../lib/collection'
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
import { WelcomeFlow } from './WelcomeFlow'
import type { HatchInfo } from './HatchOverlay'
import {
  addNote,
  collectionStore,
  dexKey,
  evaluateBadges,
  getCollection,
  noteStage,
  subscribe as subscribeCollection,
  unlockBadges,
  unlockDex,
} from '../lib/collection'
import type { BadgeContext, BadgeId } from '../lib/collection'
import { bumpWeek, nextNoteText, shouldOfferNote } from '../lib/notes'
import { FESTIVALS, festivalDateIn } from '../lib/festivals'
import type { ItemView } from '../lib/itemview'
import './app.css'
import { PetLayer, type PetStage } from './pets/PetLayer'
import { frenzyKind } from './pets/frenzy'
import { getPetOut, savePetOut } from '../lib/petout'
import type { PetArtSpecies } from './pets/petArt'

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

/** 看过首启引导没有：看过（或跳过）就不再拦着 */
const WELCOME_KEY = 'daymark.welcome.v1'

function hasSeenWelcome(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_KEY) === '1'
  } catch {
    return true
  }
}

function markWelcomeSeen(): void {
  try {
    window.localStorage.setItem(WELCOME_KEY, '1')
  } catch {
    /* 写不进去就下次再引导，不影响使用 */
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
    /**
     * 底层令牌（--bg / --surface …）还是按 data-theme 分的。
     * 它必须跟着**真正挂上去的皮肤**走，不能跟着系统：
     * 关掉「跟随系统」之后，系统切深色，data-skin 还是软糖，
     * 但 data-theme 跟着系统翻黑，屏幕底色就整块暗下去了。
     */
    const dark = pack === 'night'
    root.dataset.theme = dark ? 'dark' : 'light'
    root.style.colorScheme = dark ? 'dark' : 'light'
    // 原生状态栏跟着皮肤走：'dark' 是深底浅字，'light' 是浅底深字
    setStatusBarTheme(dark ? 'dark' : 'light')
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
  // 桌宠在外 / 在卡片里：两种互斥状态，卡片那只与桌上那只是同一只
  const [petOut, setPetOut] = useState(
    // ?out=1：开发时直接把桌宠放到外面，方便看「出门之后」的界面。
    // 平时看上次存下来的：它出门了就是出门了，刷新一下不该被塞回卡片。
    () =>
      (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('out')) ||
      (typeof window !== 'undefined' && getPetOut().out),
  )
  /** 出门那一刻它是谁（换卡片期间保持不变：颜色、形态、物种都不跟着切卡变） */
  const [outPet, setOutPet] = useState<{ species: PetArtSpecies; stage: PetStage; hue: number } | null>(
    () => {
      const saved = getPetOut()
      if (!saved.out || !saved.species || saved.stage === null || saved.hue === null) return null
      return { species: saved.species as PetArtSpecies, stage: saved.stage as PetStage, hue: saved.hue }
    },
  )
  /** 它是从哪张卡出去的：只有那张卡的家空着，别的卡家里还有自己的那一只 */
  const [outFrom, setOutFrom] = useState<string | null>(() => {
    const saved = getPetOut()
    return saved.out ? saved.from : null
  })
  // 让它自己走出去（连戳三下 / 演示）：+1 就播一遍出场
  const [debutSeq, setDebutSeq] = useState(0)
  /** 串门时连戳三下：两只一起玩（不送主人出门） */
  const [playSeq, setPlaySeq] = useState(0)
  // 回家一次 +1：卡片里的它跳一下、气泡换成「我回来了。」
  const [homeNonce, setHomeNonce] = useState(0)
  // 拖着桌宠悬停在卡片原位上：那块空位亮起来
  const [homeHot, setHomeHot] = useState(false)
  const [evolve, setEvolve] = useState<EvolveInfo | null>(null)
  /** 桌宠的两条反应计数：形态升级、切焦点 */
  const [evolveSeq, setEvolveSeq] = useState(0)
  const [focusSeq, setFocusSeq] = useState(0)
  // 徽章排队：一次只弹一个，而且要让进化过场先播完（两层同时盖住会挡住按钮）
  const [badges, setBadges] = useState<BadgeId[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const prevStage = useRef<Record<string, number>>({})

  const { views, focus } = useV2Data(now)
  const collection = useSyncExternalStore(subscribeCollection, getCollection)
  /** 小纸条：进前台按 §6.9 判一次，满足条件时小伙伴手里多一张折起的纸条 */
  const [noteReady, setNoteReady] = useState(false)
  const [noteOpen, setNoteOpen] = useState<{ text: string; n: number } | null>(null)
  useEffect(() => {
    const check = () => {
      // 开发时 ?note=1 直接给一张，方便验证
      const force = new URLSearchParams(window.location.search).has('note')
      if (force || shouldOfferNote(getCollection(), Date.now())) setNoteReady(true)
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') check()
    }
    check()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const prefs = useSyncExternalStore(subscribePrefs, getPrefs)
  const locale = useSyncExternalStore(subscribeLocale, getLocale)
  const pro = useSyncExternalStore(subscribeEntitlement, () => isPro())
  const [paywall, setPaywall] = useState<'limit' | 'upgrade' | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [hatch, setHatch] = useState<HatchInfo | null>(null)
  const [flight, setFlight] = useState<{ from: DOMRect; to: DOMRect; color: number } | null>(null)
  const [backupPending, setBackupPending] = useState<{ file: BackupFile; summary: BackupSummary } | null>(null)
  // 首启欢迎：一件东西都没有、也没看过，就先给这一屏。
  // 只在挂载这一刻判断一次——之后新建/删除都不会再把它请回来。
  const [welcome, setWelcome] = useState(() => views.length === 0 && !hasSeenWelcome())

  const notify = useCallback((text: string, action?: { label: string; run: () => void }) => {
    setToast({ text, action })
  }, [])

  // 焦点不存在时把第一件写回存储，保证下次打开还是它
  useEffect(() => {
    if (focus) setFocusKey(focus.key)
  }, [focus?.key])

  /**
   * 换焦点、或者焦点没了（'post' 不养宠物）：桌宠回卡片原位。
   *
   * 换页不回：它出去玩就是出去玩了，翻到藏馆、装扮也该看得见它在那儿晃。
   * 页面上没有卡片时它自然没有回家的落点，拖不回去而已，仍然在地面上走。
   */
  /**
   * 滑到别的卡片时它不回卡片：出去玩就是出去玩，一次只有这一只在外面。
   * 出门那一刻记住它是谁，换卡片期间保持不变——不然一划就变成新卡片那只，像换了个角色。
   */
  useEffect(() => {
    if (!focus) {
      setPetOut(false)
      setOutPet(null)
      setOutFrom(null)
      return
    }
    if (!petOut) {
      setOutPet(null)
      setOutFrom(null)
      return
    }
    setOutPet(
      (prev) =>
        prev ?? {
          species: focus.species as PetArtSpecies,
          stage: focus.stage as PetStage,
          // 跟档案里设的颜色走，不要掉回物种默认色（萌芽默认绿会盖掉石板灰等）
          hue: focus.color,
        },
    )
    setOutFrom((prev) => prev ?? focus.key)
  }, [focus?.key, focus?.species, focus?.stage, focus?.color, petOut])

  /**
   * 上次出门那张卡被删了：回来的落点不存在了。
   * 不处理的话，卡片里会同时出现「它自己」和「在外面那只」，看像分身。
   */
  useEffect(() => {
    if (!petOut || !outFrom || outFrom === '__guest__') return
    if (!views.some((v) => v.key === outFrom)) setOutFrom(focus?.key ?? null)
  }, [petOut, outFrom, views, focus?.key])

  // 它在外面的这件事要过夜：写回本地存储，下次打开还在外面（身份一起存）
  useEffect(() => {
    // 串门那位是调试出来的客人，不是自己的宠物，不记
    if (outFrom === '__guest__') return
    savePetOut({
      out: petOut,
      from: outFrom,
      species: outPet?.species ?? null,
      stage: outPet?.stage ?? null,
      hue: outPet?.hue ?? null,
    })
  }, [petOut, outFrom, outPet])

  // ?visit=1：开发时直接让「已经有一只是来串门的」，方便调两只一起玩的那段。
  // 放在同步 effect 之后跑，否则会被上面那轮 setOutFrom(null) 抹掉。
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('visit')) return
    const id = window.setTimeout(() => {
      setOutPet({ species: 'sprout', stage: 2, hue: 4 })
      setOutFrom('__guest__')
      setPetOut(true)
      // ?visit=1&play=1：再自动喊一次「一起玩」，省得手点三下
      if (new URLSearchParams(window.location.search).has('play')) {
        window.setTimeout(() => setPlaySeq((n) => n + 1), 1200)
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    // 带「撤销」的要多留一会儿，否则手还没移到就没了
    const timer = window.setTimeout(() => setToast(null), toast.action ? 5000 : 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  /**
   * 徽章判定：基础条件（几件事、最长成长、有没有翻篇）+ 这次的额外上下文。
   * 之前只有「形态升级」一处会判，叫醒睡着的小伙伴、半夜记一笔、倒数日走到当天
   * 这些条件压根没人往上送，于是那几个徽章永远解锁不了。
   */
  const checkBadges = useCallback(
    (extra: Partial<BadgeContext> = {}) => {
      const fresh = evaluateBadges(
        {
          itemCount: views.length,
          maxGrowth: maxGrowthOf(views),
          hasChapter: hasAnyChapter(views),
          ...extra,
        },
        getCollection(),
      )
      const unlocked = unlockBadges(fresh)
      if (unlocked.length) setBadges((queue) => [...queue, ...unlocked])
    },
    [views],
  )

  // 万圣节当天打开 App：南瓜帽（隐藏徽章）
  useEffect(() => {
    const today = new Date()
    const monthDay = `${today.getMonth() + 1}-${today.getDate()}`
    const hit = FESTIVALS.find((festival) => {
      const at = festivalDateIn(festival, today.getFullYear())
      return at ? `${at.month}-${at.day}` === monthDay : false
    })
    if (hit) checkBadges({ festivalId: hit.id })
    // 只在挂载时判一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      setEvolveSeq((n) => n + 1)
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
    setFocusSeq((n) => n + 1)
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
    // 夜猫子 / 早起鸟：这两个徽章看的是「记这一笔的时刻」，以前没人把时间传上去
    checkBadges({ recordedAt: Date.now() })
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
  }, [focus, checkBadges])

  /**
   * 收进藏馆只写一次。
   * 以前写在 setState 的更新函数里，开发模式下那函数会被再跑一遍，
   * 同一次点击就落成两张一模一样的纸条。
   */
  const keepingNote = useRef(false)
  const openNote = useCallback(() => {
    keepingNote.current = false
    const state = getCollection()
    setNoteOpen({ text: nextNoteText(state), n: state.notes.length + 1 })
  }, [])

  const keepNote = useCallback(() => {
    if (keepingNote.current || !noteOpen) return
    keepingNote.current = true
    const now = Date.now()
    const from = focus ? t(`creature.${focus.species}` as MessageKey) : t('creature.sprout')
    addNote({ id: `note-${now}`, text: noteOpen.text, from, at: now })
    collectionStore.patch({ notesThisWeek: bumpWeek(getCollection().notesThisWeek, now) })
    notify(t('note.saved'))
    setNoteOpen(null)
    setNoteReady(false)
  }, [noteOpen, focus, notify])

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
      /*
       * 档案页的删除确认写的是「它会从今天页消失，但这一章会留在藏馆里」。
       * 事一删，它的 chapters / history 就跟着没了，这本书在藏馆里也就空了——
       * 所以先把整本书抄一份进 collection.shelves，再删。
       */
      const book = collectBooks(views).find((item) => item.key === view.key)
      if (book) {
        // 事一删，备忘和待办也跟着没了——趁还在，一起抄进书里，藏馆里点开才看得到
        const memo = view.kind === 'countdown' ? view.event.memo : undefined
        const todo = view.kind === 'countdown' ? view.event.todo : undefined
        // 打卡记录也一起收：删掉之后还能在书里翻「那几个月都哪天打过卡」
        const checkedDays = view.kind === 'habit' ? view.event.days : undefined
        const checkedTimes = view.kind === 'habit' ? view.event.times : undefined
        const target = view.kind === 'habit' ? (view.event.target ?? null) : undefined
        archiveBook({
          ...book,
          deletedAt: Date.now(),
          ...(memo ? { memo } : {}),
          ...(todo?.length ? { todo } : {}),
          ...(checkedDays && Object.keys(checkedDays).length > 0 ? { checkedDays } : {}),
          ...(checkedTimes && Object.keys(checkedTimes).length > 0 ? { checkedTimes } : {}),
          ...(typeof target === 'number' ? { target } : {}),
        })
      }
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

      {/* v3 桌宠：站在卡片 / 按钮 / 底栏上，能走能睡能拖能扔 */}
      {focus ? (
        <PetLayer
          species={(outPet?.species ?? focus.species) as PetArtSpecies}
          stage={outPet?.stage ?? focus.stage}
          hue={outPet?.hue ?? focus.color}
          size={92}
          out={petOut}
          onOut={setPetOut}
          debutSeq={debutSeq}
          playSeq={playSeq}
          onHomed={() => setHomeNonce((n) => n + 1)}
          onHomeHot={setHomeHot}
          logSeq={fxCount}
          milestoneSeq={evolveSeq}
          focusSeq={focusSeq}
          pokeSeq={pokeCount}
          onHoldLog={onLog}
          onWake={() => checkBadges({ wokeUp: true })}
          /* 头顶那块名字：它从哪件事出来的。串门时也还是原来那件事 */
          name={views.find((view) => view.key === outFrom)?.title ?? focus.title}
          visiting={petOut && !!outFrom && outFrom !== focus?.key}
        />
      ) : null}

      {tab === 'today' ? (
        <TodayPage
          views={views}
          focus={focus}
          now={now}
          onChangeFocus={changeFocus}
          onOpenSwitcher={() => setSheet('switcher')}
          onAdd={openAdd}
          onLog={onLog}
          onPoke={onPoke}
          onCountdownToday={() => checkBadges({ celebratedCountdown: true })}
          noteReady={noteReady}
          onOpenNote={openNote}
          onProfile={() => setProfileOpen(true)}
          onToggleTodo={(index) => {
            // 卡片上直接勾待办：不用进档案页
            const todos = focus?.kind === 'countdown' ? (focus.event.todo ?? []) : []
            if (focus?.kind !== 'countdown' || !todos[index]) return
            const next = todos.map((item, i) => (i === index ? { ...item, done: !item.done } : item))
            patchCountdown(focus.id, { todo: next })
          }}
          overrideLine={override}
          pokeNonce={pokeCount}
          fxNonce={fxCount}
          fxPlus={fxPlus}
          petAway={petOut && outFrom === focus?.key}
          visited={petOut && !!outFrom && outFrom !== focus?.key}
          homeHot={homeHot}
          visitor={petOut && !!outFrom && outFrom !== focus?.key}
          homeNonce={homeNonce}
          onFrenzy={() => {
            // 有客人在场：连戳三下是「喊它俩一起玩」，不是把主人也送出门
            if (frenzyKind(!!(petOut && outFrom && outFrom !== focus?.key)) === 'play') {
              setPlaySeq((n) => n + 1)
            } else {
              setDebutSeq((n) => n + 1)
            }
          }}
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
          collection={collection}
          pro={pro}
          onUpgrade={() => setPaywall('upgrade')}
          onNotify={notify}
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
          sampleTitle={focus?.title}
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
          onToast={notify}
          onHatched={(info) => {
            // 第一次建东西才播孵化，后续都直接落回今天页
            if (hasHatched()) return
            // 打招呼的是小伙伴自己，不是这件事的标题（「我是芽芽」而不是「我是戒烟」）
            setHatch({
              species: info.species,
              color: info.color,
              name: t(`creature.${info.species}` as MessageKey),
              title: info.name,
            })
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

      {welcome ? (
        <WelcomeFlow
          onSkip={() => {
            markWelcomeSeen()
            setWelcome(false)
          }}
          onStart={() => {
            markWelcomeSeen()
            setWelcome(false)
            openAdd()
          }}
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

      {noteOpen ? (
        <div className="ov note-ov" style={{ zIndex: 58 }}>
          <div className="dim" onClick={() => setNoteOpen(null)} aria-hidden="true" />
          <div className="note-card" role="dialog" aria-modal="true" aria-label={t('note.title')}>
            <button
              className="note-card-x"
              type="button"
              aria-label={t('common.close')}
              onClick={() => setNoteOpen(null)}
            >
              ×
            </button>
            <span className="note-card-t">{t('note.title')}</span>
            <p className="note-card-body">{noteOpen.text}</p>
            <span className="note-card-sign">
              —— {focus ? t(`creature.${focus.species}` as MessageKey) : t('creature.sprout')} ·{' '}
              {t('note.count', { n: noteOpen.n })}
            </span>
            <button className="btn" type="button" onClick={keepNote}>
              {t('note.keep')}
            </button>
          </div>
        </div>
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
