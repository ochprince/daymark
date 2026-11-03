/**
 * `?lab=sys` 演示台。
 *
 * 四块内容：小组件矩阵（3 尺寸 × 3 类型）、灵动岛（三形态各一个 + 一个会切换的）、
 * 锁屏卡、闹钟卡。顶部是演示时钟与皮肤切换。
 *
 * 这里的数据是造出来的（真机上来自 App Group），但走的是和 App 完全一样的
 * `buildItemViews → toSystemItem`，所以组件拿到的形状不会和线上漂移。
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { buildItemViews, type ItemSources } from '../../lib/itemview'
import { getPrefs, reduceMotionOn, subscribe as subscribePrefs } from '../../lib/prefs'
import { getSkin, patchSkin, SKIN_PACKS, subscribe as subscribeSkin, type SkinPack } from '../../lib/skin'
import { t } from '../../lib/i18n'
import { addLocalDays, formatClock, formatPercent, localDayKey, remainingSeconds, startOfLocalDay } from './clock'
import { useSystemClock } from './useSystemClock'
import { toSystemItem, type SystemItem } from './model'
import { Widget } from './Widget'
import { DynamicIsland, type IslandState, type IslandTimer } from './DynamicIsland'
import { LockCard } from './LockCard'
import { AlarmCard } from './AlarmCard'
import '../system.css'

const SKIN_LABEL: Record<SkinPack, string> = {
  jelly: '软糖',
  paper: '纸本',
  night: '夜航',
  pixel: '像素',
}

function buildDemoSources(now: number): ItemSources {
  const today = startOfLocalDay(now)
  const day = 86_400_000
  const key = (offset: number) => localDayKey(addLocalDays(now, offset))

  const events: ItemSources['events'] = [
    {
      id: 'sleep',
      title: '早睡',
      startedAt: today - 128 * day,
      createdAt: today - 128 * day,
      color: 2,
      species: 'moon',
    },
    {
      id: 'smoke',
      title: '不抽烟',
      startedAt: today - 421 * day,
      createdAt: today - 421 * day,
      color: 4,
      species: 'sprout',
    },
    {
      id: 'run',
      title: '晨跑',
      startedAt: today - 46 * day,
      createdAt: today - 46 * day,
      color: 1,
      species: 'star',
    },
  ]

  const waterDays: Record<string, number> = {}
  const waterTimes: Record<string, number[]> = {}
  for (let offset = -11; offset <= 0; offset += 1) {
    const count = offset === 0 ? 2 : (offset * 3 + 11) % 7
    if (count > 0) {
      const dayStart = startOfLocalDay(addLocalDays(now, offset))
      waterDays[key(offset)] = count
      waterTimes[key(offset)] = Array.from({ length: count }, (_, index) =>
        Math.min(now, dayStart + 8 * 3_600_000 + index * 3_600_000),
      )
    }
  }

  const checkins: ItemSources['checkins'] = [
    {
      id: 'water',
      title: '喝水',
      createdAt: today - 90 * day,
      color: 3,
      cadence: 'daily',
      days: waterDays,
      times: waterTimes,
      species: 'drop',
      target: 8,
      growthDays: 64,
    },
    {
      id: 'read',
      title: '读书',
      createdAt: today - 40 * day,
      color: 0,
      cadence: 'daily',
      days: { [key(0)]: 1, [key(-1)]: 1, [key(-2)]: 1, [key(-3)]: 1, [key(-5)]: 1 },
      times: { [key(0)]: [today + 8 * 3_600_000] },
      species: 'sprout',
      target: 1,
      growthDays: 31,
    },
    {
      id: 'gym',
      title: '健身',
      createdAt: today - 60 * day,
      color: 6,
      cadence: 'weekly',
      days: { [key(-1)]: 1, [key(-3)]: 1 },
      times: {},
      species: 'star',
      target: 3,
      growthDays: 22,
    },
  ]

  const countdowns: ItemSources['countdowns'] = [
    {
      id: 'mom',
      title: '妈妈生日',
      startedAt: new Date(2020, 5, 2, 9, 0).getTime(),
      createdAt: today - 200 * day,
      color: 1,
      repeat: 'yearly',
      memo: '订一束花',
      todo: [
        { text: '订花', done: true },
        { text: '写卡片', done: false },
        { text: '订蛋糕', done: false },
      ],
    },
    {
      id: 'trip',
      title: '去京都',
      startedAt: today + 12 * day,
      createdAt: today - 30 * day,
      color: 3,
      repeat: 'none',
      memo: '带上相机',
      todo: [
        { text: '订机票', done: true },
        { text: '订民宿', done: false },
      ],
    },
  ]

  return { events, countdowns, checkins }
}

function useLabSkin() {
  const skin = useSyncExternalStore(subscribeSkin, getSkin)
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.skin = skin.pack
    root.dataset.accent = typeof skin.accent === 'number' ? String(skin.accent) : 'auto'
    root.dataset.num = skin.num
    root.dataset.texture = skin.texture
    root.classList.toggle('reduce-motion', reduceMotionOn(prefs))
  }, [skin, prefs])

  return skin
}

export function SystemLab() {
  const clock = useSystemClock({ mode: 'demo', speed: 40 })
  const skin = useLabSkin()
  const [logs, setLogs] = useState<Record<string, number>>({})
  const [island, setIsland] = useState<IslandState>('idle')
  const [timer, setTimer] = useState<IslandTimer | null>(null)
  const [alarmOpen, setAlarmOpen] = useState(true)
  const nowRef = useRef(clock.now)
  nowRef.current = clock.now
  const timersRef = useRef<number[]>([])

  const sources = useMemo(() => buildDemoSources(Date.now()), [])
  const items = useMemo(() => {
    const views = buildItemViews(sources, clock.now)
    return views.map((view) => {
      const base = toSystemItem(view, clock.now)
      const extra = logs[base.id] ?? 0
      if (!extra) return base
      return {
        ...base,
        count: (base.count ?? 0) + extra,
        week: base.week ? base.week.map((on, index) => (index === base.week!.length - 1 ? true : on)) : base.week,
      }
    })
  }, [sources, clock.now, logs])

  const pick = (kind: SystemItem['kind'], id?: string): SystemItem | null =>
    items.find((item) => item.kind === kind && (!id || item.id === id)) ?? null

  const sinceItem = pick('since', 'sleep') ?? pick('since')
  const habitItem = pick('habit', 'water') ?? pick('habit')
  const countdownItem = pick('countdown', 'trip') ?? pick('countdown')
  const alarmItem = pick('countdown', 'mom') ?? countdownItem

  useEffect(() => () => timersRef.current.forEach((id) => window.clearTimeout(id)), [])

  // 计时到点自动切 done：系统的 Live Activity 结束态也是这么来的
  useEffect(() => {
    if (island !== 'charging' || !timer) return
    if (remainingSeconds(timer.startedAt + timer.totalSeconds * 1000, clock.now) <= 0) {
      setIsland('done')
    }
  }, [island, timer, clock.now])

  const logHabit = (item: SystemItem) => setLogs((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }))

  const startCharging = () => {
    setIsland('charging')
    setTimer({ startedAt: clock.now - 9 * 60 * 1000, totalSeconds: 25 * 60 })
  }

  /** 跑一遍：闲时 → 计时 → 完成。计时 90 秒，40× 下约 2.3 秒走完 */
  const runIsland = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
    setTimer(null)
    setIsland('idle')
    clock.play()
    timersRef.current.push(
      window.setTimeout(() => {
        setTimer({ startedAt: nowRef.current, totalSeconds: 90 })
        setIsland('charging')
      }, 900),
    )
  }

  const togglePlay = () => {
    if (clock.playing) clock.pause()
    else clock.play()
  }

  return (
    <div className="syslab">
      <header className="syslab-head">
        <div>
          <h1>{t('sys.lab.title')}</h1>
          <p>{t('sys.lab.sub')}</p>
        </div>
        <div className="syslab-clock">
          <small>{t('sys.lab.clock')}</small>
          <b data-testid="syslab-now">{formatClock(clock.now)}</b>
          <span>
            {formatPercent(clock.dayPercent)} · {clock.playing ? '▶ 40×' : '⏸ 9:41'}
          </span>
          <div className="syslab-actions">
            <button type="button" onClick={togglePlay} data-testid="syslab-play">
              {clock.playing ? t('sys.lab.pause') : t('sys.lab.play')}
            </button>
            <button type="button" onClick={clock.reset} data-testid="syslab-reset">
              {t('sys.lab.reset')}
            </button>
          </div>
          <div className="syslab-skins">
            {SKIN_PACKS.map((pack) => (
              <button
                key={pack}
                type="button"
                className={skin.pack === pack ? 'is-on' : ''}
                onClick={() => patchSkin({ pack })}
                data-skin-option={pack}
              >
                {SKIN_LABEL[pack]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="syslab-sec" id="sec-widgets">
        <h2>{t('sys.lab.widgets')}</h2>
        <div className="syslab-matrix">
          {(['sm', 'md', 'lg'] as const).map((size) =>
            (['since', 'habit', 'countdown'] as const).map((kind) => (
              <div className="syslab-cell" key={`${size}-${kind}`} data-cell={`${size}-${kind}`}>
                <Widget
                  size={size}
                  kind={kind}
                  data={kind === 'since' ? sinceItem : kind === 'habit' ? habitItem : countdownItem}
                  clock={clock}
                  onLog={logHabit}
                />
              </div>
            )),
          )}
        </div>
        <p className="syslab-note">
          {t('sys.lab.size')}：sm 2×2 / md 4×2 / lg 4×4；第四种「锁屏」在下面单独陈列。
        </p>
      </section>

      <section className="syslab-sec" id="sec-island">
        <h2>{t('sys.lab.island')}</h2>
        <div className="syslab-islands">
          <div className="syslab-island-slot" data-island-sample="idle">
            <small>idle</small>
            <DynamicIsland state="idle" item={sinceItem} clock={clock} />
          </div>
          <div className="syslab-island-slot" data-island-sample="charging">
            <small>charging</small>
            <DynamicIsland
              state="charging"
              item={habitItem}
              clock={clock}
              timer={{ startedAt: clock.now - 9 * 60 * 1000, totalSeconds: 25 * 60 }}
            />
          </div>
          <div className="syslab-island-slot" data-island-sample="done">
            <small>done</small>
            <DynamicIsland state="done" item={habitItem} clock={clock} />
          </div>
        </div>

        <div className="syslab-island-live">
          <div className="syslab-row">
            <small>{t('sys.lab.state')}</small>
            <button type="button" className={island === 'idle' ? 'is-on' : ''} onClick={() => setIsland('idle')} data-island-btn="idle">
              idle
            </button>
            <button type="button" className={island === 'charging' ? 'is-on' : ''} onClick={startCharging} data-island-btn="charging">
              charging
            </button>
            <button type="button" className={island === 'done' ? 'is-on' : ''} onClick={() => setIsland('done')} data-island-btn="done">
              done
            </button>
            <button type="button" className="is-primary" onClick={runIsland} data-island-run="1">
              {t('sys.lab.runIsland')}
            </button>
          </div>
          <div className="syslab-island-stage">
            <DynamicIsland state={island} item={sinceItem} clock={clock} timer={timer ?? undefined} />
          </div>
        </div>
      </section>

      <section className="syslab-sec" id="sec-lock-alarm">
        <h2>
          {t('sys.lab.lock')} · {t('sys.lab.alarm')}
        </h2>
        <div className="syslab-phones">
          <div className="syslab-phone">
            <LockCard item={sinceItem} clock={clock} />
            <div className="syslab-phone-foot">LockCard · backdrop-filter</div>
          </div>
          <div className="syslab-phone is-alarm">
            {alarmOpen ? (
              <AlarmCard
                item={alarmItem}
                scene="countdown"
                clock={clock}
                onSnooze={() => setAlarmOpen(false)}
                onDismiss={() => setAlarmOpen(false)}
              />
            ) : (
              <button type="button" className="syslab-again" onClick={() => setAlarmOpen(true)}>
                再响一次
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
