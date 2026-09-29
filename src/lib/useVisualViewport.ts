import { useEffect, useState } from 'react'

type Viewport = { height: number; offsetTop: number }

/**
 * iOS 上软键盘弹出时，visualViewport 会变小、整体上移，
 * 但 position: fixed 的元素仍然锚在 layout viewport 上 —— 底部弹层就会被键盘盖住。
 * 这里把 visualViewport 的尺寸和位移同步给弹层，让它始终贴着可见区域底部。
 */
export function useVisualViewport(active: boolean): Viewport | null {
  const [viewport, setViewport] = useState<Viewport | null>(null)

  useEffect(() => {
    if (!active) {
      setViewport(null)
      return
    }

    const vv = window.visualViewport
    if (!vv) return

    const sync = () => setViewport({ height: vv.height, offsetTop: vv.offsetTop })
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [active])

  return viewport
}
