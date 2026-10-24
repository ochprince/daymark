import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNow } from '../lib/useNow'
import { getSkin, subscribe as subscribeSkin } from '../lib/skin'
import { setFocusKey } from '../lib/focus'
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import { bubbleLine } from '../lib/lines'
import { tapCheckIn } from '../lib/checkins'
import { markSaid } from '../lib/countdowns'
import { TodayPage } from './TodayPage'
import { TabBar, type TabKey } from './TabBar'
import { Switcher } from './Switcher'
import { AddSheet } from './AddSheet'
import { useV2Data } from './useV2Data'
import { EvolveOverlay } from './EvolveOverlay'
import type { EvolveInfo } from './EvolveOverlay'
import { BadgePopup } from './BadgePopup'
import {
  dexKey,
  evaluateBadges,
  getCollection,
  noteStage,
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

/** 有没有结束过至少一章（「翻篇」徽章） */
function hasAnyChapter(views: readonly ItemView[]): boolean {
  return views.some((view) => {
    if (view.kind === 'since') return (view.event.history?.length ?? 0) > 0
    if (view.kind === 'habit') return (view.event.chapters?.length ?? 0) > 0
    return (view.event.history?.length ?? 0) > 0
  })
}

/** 皮肤令牌挂到根节点：换风格只换这一层属性，组件一行不改 */
function useApplySkin() {
  const skin = useSyncExternalStore(subscribeSkin, getSkin)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.skin = skin.pack
    root.dataset.accent = typeof skin.accent === 'number' ? String(skin.accent) : 'auto'
    root.dataset.num = skin.num
    root.dataset.texture = skin.texture
    if (skin.followSystem) {
      root.dataset.followSystem = 'true'
    } else {
      delete root.dataset.followSystem
    }
  }, [skin])
  return skin
}

export function AppV2() {
  // 一分钟一跳：跨天时天数、睡着状态跟着变
  const now = useNow(60_000)
  const skin = useApplySkin()
  const [tab, setTab] = useState<TabKey>('today')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [override, setOverride] = useState<string | null>(null)
  const [pokeCount, setPokeCount] = useState(0)
  const [evolve, setEvolve] = useState<EvolveInfo | null>(null)
  // 徽章排队：一次只弹一个，而且要让进化过场先播完（两层同时盖住会挡住按钮）
  const [badges, setBadges] = useState<BadgeId[]>([])
  const prevStage = useRef<Record<string, number>>({})

  const { views, focus } = useV2Data(now)

  // 焦点不存在时把第一件写回存储，保证下次打开还是它
  useEffect(() => {
    if (focus) setFocusKey(focus.key)
  }, [focus?.key])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 2600)
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
      if (unlocked.length > 0) setBadges((queue) => [...queue, ...unlocked])
    }
  }, [views])

  const changeFocus = useCallback((key: string) => {
    setFocusKey(key)
    setOverride(null)
    setPokeCount(0)
    setSheet(null)
  }, [])

  const onLog = useCallback(() => {
    if (!focus || focus.kind !== 'habit') return
    const next = focus.count + 1
    tapCheckIn(focus.id, Date.now())
    setOverride(next > 1 ? t('line.habit.count', { n: next }) : t('line.habit.done'))
    window.setTimeout(() => setOverride(null), 4000)
  }, [focus])

  const onSayDone = useCallback(() => {
    if (!focus || focus.kind !== 'countdown') return
    markSaid(focus.id, focus.next)
    setToast(t('action.said'))
  }, [focus])

  const onPoke = useCallback(() => {
    if (!focus) return
    const next = pokeCount + 1
    setPokeCount(next)
    setOverride(bubbleLine(focus, { pokeIndex: next }))
    window.setTimeout(() => setOverride(null), 3200)
  }, [focus, pokeCount])

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
          onAdd={() => setSheet('add')}
          onLog={onLog}
          onSayDone={onSayDone}
          onPoke={onPoke}
          onProfile={() => setToast(t('pro.title'))}
          overrideLine={override}
          pokeNonce={pokeCount}
        />
      ) : null}

      {tab === 'museum' ? (
        <div className="placeholder">
          <h2>{t('museum.title')}</h2>
          <p>{t('museum.chapters.empty')}</p>
        </div>
      ) : null}

      {tab === 'dress' ? (
        <div className="placeholder">
          <h2>{t('dress.title')}</h2>
          <p>
            {t('dress.skin')} · {skin.pack}
          </p>
          <p>{t('dress.dataNote')}</p>
        </div>
      ) : null}

      <TabBar active={tab} onChange={setTab} />

      {sheet === 'switcher' ? (
        <Switcher
          views={views}
          activeKey={focus?.key ?? ''}
          onPick={changeFocus}
          onAdd={() => setSheet('add')}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'add' ? (
        <AddSheet
          onClose={() => setSheet(null)}
          onCreated={(message) => {
            setSheet(null)
            setToast(message)
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

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
