/**
 * 可注入的系统时钟。
 *
 * 默认真实时间（跟手机一致，用于真机 / 未来原生打版对照）；
 * 演示模式从 9:41 出发、40× 速进 —— 也就是原型里的 `vsec()`。
 *
 * 四个系统表面组件都只接一个 `SystemClock`，不自己读表：
 *  - 真实时间：每秒走一下，跨午夜天数自动 +1；
 *  - 演示：由「播放一天」按钮驱动，可以暂停、回拨。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEMO_SPEED,
  DEMO_START_SECONDS,
  dayProgressPercent,
  demoNow,
  secondsOfDay,
  type ClockMode,
  type SystemClock,
} from './clock'

export type UseSystemClockOptions = {
  /** 默认真实时间；lab 里传 'demo' */
  mode?: ClockMode
  /** 演示倍速，默认 40 */
  speed?: number
  /** 演示起点（当天 0 点起的秒数），默认 9:41 */
  startSeconds?: number
  /** 真实模式的刷新间隔 */
  intervalMs?: number
  /** 演示模式的刷新间隔（40× 下 200ms 一跳 ≈ 8 秒演示时间） */
  demoIntervalMs?: number
  /** 演示时间的锚点，默认挂载时刻那一天；测试可以固定 */
  anchor?: number
}

export function useSystemClock(options: UseSystemClockOptions = {}): SystemClock {
  const {
    mode: initialMode = 'real',
    speed = DEMO_SPEED,
    startSeconds = DEMO_START_SECONDS,
    intervalMs = 1000,
    demoIntervalMs = 200,
    anchor,
  } = options

  const [mode, setMode] = useState<ClockMode>(initialMode)
  const [playing, setPlaying] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [realNow, setRealNow] = useState(() => Date.now())
  const anchorRef = useRef(anchor ?? Date.now())
  const lastTickRef = useRef(0)

  // 真实时间：每秒对一次表，页面重新可见时立刻对
  useEffect(() => {
    if (mode !== 'real') return
    const tick = () => setRealNow(Date.now())
    const timer = window.setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [mode, intervalMs])

  // 演示时间：按真实流逝累加，不做 moment-to-moment 的乘法，避免定时器抖动放大
  useEffect(() => {
    if (mode !== 'demo' || !playing) return
    lastTickRef.current = Date.now()
    const timer = window.setInterval(() => {
      const stamp = Date.now()
      const delta = stamp - lastTickRef.current
      lastTickRef.current = stamp
      if (delta > 0) setElapsedMs((value) => value + delta)
    }, demoIntervalMs)
    return () => window.clearInterval(timer)
  }, [mode, playing, demoIntervalMs])

  const play = useCallback(() => {
    setElapsedMs(0)
    setMode('demo')
    setPlaying(true)
  }, [])

  const pause = useCallback(() => setPlaying(false), [])

  const reset = useCallback(() => {
    setElapsedMs(0)
    setPlaying(false)
  }, [])

  const toggle = useCallback(() => {
    setMode('demo')
    setPlaying((value) => !value)
  }, [])

  const seek = useCallback((value: number) => {
    setElapsedMs(Math.max(0, value))
  }, [])

  return useMemo<SystemClock>(() => {
    const now =
      mode === 'demo' ? demoNow(anchorRef.current, elapsedMs, { speed, startSeconds }) : realNow
    return {
      mode,
      now,
      secondsOfDay: secondsOfDay(now),
      dayPercent: dayProgressPercent(now),
      playing,
      speed,
      elapsedMs,
      play,
      pause,
      reset,
      toggle,
      seek,
      setMode,
    }
  }, [mode, elapsedMs, playing, play, pause, reset, seek, realNow, speed, startSeconds, toggle])
}
