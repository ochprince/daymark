/**
 * 系统表面的时间模型。
 *
 * 原型 system.js 里用 `vsec()` 把 performance.now() 换成「从 9:41 起、一秒走 40 秒」，
 * 只为了演示「数字自己在走」。Web 版把它拆成两层：
 *
 *  - 事件层 `useSystemClock`（hook）：真实时间，或者 40× 的演示时钟；
 *  - 计算层（本文件）：给定「一个毫秒时刻」，算出格式化文本、剩余天数、当天进度。
 *
 * 组件只吃一个 `now`，不自己读表，所以截图能固定、单测不用等时间。
 * 本文件不 import 任何东西：纯函数，node:test 里直接跑。
 */

export const SECONDS_PER_DAY = 86_400
export const MS_PER_DAY = 86_400_000

/** 演示时钟的起点：上午 9:41 —— 和截图里 iPhone 的锁屏时间一致 */
export const DEMO_START_SECONDS = 9 * 3600 + 41 * 60
/** 原型里的 40× */
export const DEMO_SPEED = 40

export type ClockMode = 'real' | 'demo'

export type ClockSettings = {
  mode: ClockMode
  /** 演示倍速 */
  speed: number
  /** 演示起点（当天 0 点起的秒数） */
  startSeconds: number
}

export const DEFAULT_CLOCK: ClockSettings = {
  mode: 'real',
  speed: DEMO_SPEED,
  startSeconds: DEMO_START_SECONDS,
}

/** 组件拿到的时钟：值 + 几个控制方法（真机上是系统时钟，演示里可以播放/回拨） */
export type SystemClock = {
  mode: ClockMode
  /** 当前系统时刻（毫秒时间戳） */
  now: number
  /** 当天已走过的秒数 */
  secondsOfDay: number
  /** 当天已走过的百分比（0–100，带小数） */
  dayPercent: number
  /** 演示时钟是否在走 */
  playing: boolean
  speed: number
  /** 演示时钟已消耗的真实毫秒 */
  elapsedMs: number
  /** 从头播放（回到 9:41 再往下走） */
  play(): void
  pause(): void
  reset(): void
  toggle(): void
  /** 跳到演示轨迹上的某一刻（真实耗时，毫秒） */
  seek(elapsedMs: number): void
  setMode(mode: ClockMode): void
}

/* ------------------------------------------------------------------ */
/* 本地日界                                                            */
/* ------------------------------------------------------------------ */

const pad2 = (value: number): string => `${Math.trunc(value)}`.padStart(2, '0')

/** 本地时区当天 00:00 */
export function startOfLocalDay(ts: number): number {
  const date = new Date(ts)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 下一个本地 00:00（按真实日历，夏令时那天不是 24 小时） */
export function nextLocalMidnight(ts: number): number {
  const date = new Date(ts)
  date.setHours(24, 0, 0, 0)
  return date.getTime()
}

/** 本地日期键 yyyy-mm-dd */
export function localDayKey(ts: number): string {
  const date = new Date(ts)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 本地日历上加 n 天（跨月、跨年交给 Date） */
export function addLocalDays(ts: number, days: number): number {
  const date = new Date(ts)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export function isSameDay(a: number, b: number): boolean {
  return startOfLocalDay(a) === startOfLocalDay(b)
}

/* ------------------------------------------------------------------ */
/* 演示时钟                                                            */
/* ------------------------------------------------------------------ */

/** 演示起点：anchor 那一天的 9:41（默认） */
export function demoStartAt(anchorWallMs: number, startSeconds: number = DEMO_START_SECONDS): number {
  return startOfLocalDay(anchorWallMs) + startSeconds * 1000
}

/**
 * 演示时钟：真实过去 elapsedRealMs，屏幕上过去 elapsedRealMs × speed。
 * 不做 % 86400 —— 走过午夜就该是第二天，天数要跟着变。
 */
export function demoNow(
  anchorWallMs: number,
  elapsedRealMs: number,
  settings: Partial<Pick<ClockSettings, 'speed' | 'startSeconds'>> = {},
): number {
  const speed = settings.speed && settings.speed > 0 ? settings.speed : DEMO_SPEED
  const startSeconds = settings.startSeconds ?? DEMO_START_SECONDS
  return demoStartAt(anchorWallMs, startSeconds) + Math.max(0, elapsedRealMs) * speed
}

/** 演示时钟要「走完一整天」需要多少真实毫秒（40× = 36 分钟） */
export function realMsForDay(speed: number = DEMO_SPEED): number {
  return MS_PER_DAY / (speed > 0 ? speed : DEMO_SPEED)
}

/* ------------------------------------------------------------------ */
/* 格式化（纯展示）                                                     */
/* ------------------------------------------------------------------ */

/** 24 小时制、补零：09:41 */
export function formatClock(ts: number): string {
  const date = new Date(ts)
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** iOS 锁屏那种不补零的写法：9:41 */
export function formatClockShort(ts: number): string {
  const date = new Date(ts)
  return `${date.getHours()}:${pad2(date.getMinutes())}`
}

/** 倒计时 mm:ss（超过 99 分钟也照常显示 120:00） */
export function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${pad2(minutes)}:${pad2(seconds)}`
}

/** 百分比文本：40.3% */
export function formatPercent(percent: number, digits = 1): string {
  const safe = Number.isFinite(percent) ? percent : 0
  return `${safe.toFixed(digits)}%`
}

/* ------------------------------------------------------------------ */
/* 计算                                                               */
/* ------------------------------------------------------------------ */

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/** 距离目标日还有几天：今天 = 0，明天 = 1，已经过去为负数（按本地日界，不看钟点） */
export function remainingDays(targetTs: number, now: number): number {
  if (!Number.isFinite(targetTs) || !Number.isFinite(now)) return 0
  return Math.round((startOfLocalDay(targetTs) - startOfLocalDay(now)) / MS_PER_DAY)
}

/** 已经走过几天：从起始日 00:00 起算的完整自然日，未来 / 今天都是 0 */
export function elapsedDays(startTs: number, now: number): number {
  return Math.max(0, -remainingDays(startTs, now))
}

/** 当天已推进的比例 0–1（按真实日长，夏令时那天也能到 1） */
export function dayProgress(now: number): number {
  const start = startOfLocalDay(now)
  const end = nextLocalMidnight(now)
  if (!(end > start)) return 0
  return clamp((now - start) / (end - start), 0, 1)
}

/** 当天已推进的百分比 0–100（灵动岛 / 小组件上那个一直涨的数字） */
export function dayProgressPercent(now: number): number {
  return dayProgress(now) * 100
}

/** 当天已走过的秒数 */
export function secondsOfDay(now: number): number {
  return Math.min(SECONDS_PER_DAY, Math.max(0, Math.floor((now - startOfLocalDay(now)) / 1000)))
}

/** 进度比例：目标为空 / 0 时，记过就算满、没记就是 0 */
export function progressRatio(done: number, total: number | null | undefined): number {
  const value = Number.isFinite(done) ? done : 0
  if (total === null || total === undefined || total <= 0) return value > 0 ? 1 : 0
  return clamp(value / total, 0, 1)
}

/** 倒计时剩余秒数（不小于 0，向上取整：一开始正好是总时长） */
export function remainingSeconds(deadlineTs: number, now: number): number {
  if (!Number.isFinite(deadlineTs)) return 0
  return Math.max(0, Math.ceil((deadlineTs - now) / 1000))
}

/** 最近 count 天（旧 → 今天）是否记过。给习惯小组件的一周足迹用 */
export function weekFlags(
  loggedDays: Iterable<string>,
  now: number,
  count = 7,
): boolean[] {
  const seen = loggedDays instanceof Set ? loggedDays : new Set(loggedDays)
  const flags: boolean[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    flags.push(seen.has(localDayKey(addLocalDays(now, -offset))))
  }
  return flags
}

/* ------------------------------------------------------------------ */
/* 不传时钟时的兜底：冻结在某一刻                                        */
/* ------------------------------------------------------------------ */

const noop = (): void => undefined

/** 只读时钟：组件没接时钟时用，值固定，控制方法全是空操作 */
export function frozenClock(now: number = Date.now()): SystemClock {
  return {
    mode: 'real',
    now,
    secondsOfDay: secondsOfDay(now),
    dayPercent: dayProgressPercent(now),
    playing: false,
    speed: DEMO_SPEED,
    elapsedMs: 0,
    play: noop,
    pause: noop,
    reset: noop,
    toggle: noop,
    seek: noop,
    setMode: noop,
  }
}
