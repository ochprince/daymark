import { useEffect, useRef } from 'react'

type Shared = { top: number; nodes: Set<HTMLElement> }

/**
 * 循环翻页要求同一页在轨道上存在不止一份 DOM（左右两侧各要接得上），
 * 这份注册表让它们的滚动位置保持同步，切换页回来时不会跳。
 */
const registry = new Map<string, Shared>()

export function useSharedScroll(key: string) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let shared = registry.get(key)
    if (!shared) {
      shared = { top: 0, nodes: new Set() }
      registry.set(key, shared)
    }
    const entry = shared
    entry.nodes.add(element)
    element.scrollTop = entry.top

    const onScroll = () => {
      entry.top = element.scrollTop
      for (const node of entry.nodes) {
        if (node !== element && Math.abs(node.scrollTop - entry.top) > 1) {
          node.scrollTop = entry.top
        }
      }
    }

    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      element.removeEventListener('scroll', onScroll)
      entry.nodes.delete(element)
    }
  }, [key])

  return ref
}
