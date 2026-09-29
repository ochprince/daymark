import { useEffect, useState } from 'react'

/**
 * 一个会自己走动的「现在」。
 * 每 30 秒对一次表，切回前台/窗口聚焦时立刻刷新，
 * 这样跨过午夜后卡片上的天数是自动 +1 的，不需要用户手动刷新。
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = window.setInterval(tick, intervalMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('pageshow', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [intervalMs])

  return now
}
