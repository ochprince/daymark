import { pickColorIndex } from './palette'

type Base = { id: string; createdAt: number; color: number }

type StoreOptions<T extends Base> = {
  key: string
  /** 校验一条从 localStorage 读出来的数据 */
  isValid: (value: unknown) => value is T
  /** 修正读出来的数据（截断过长标题等） */
  normalize: (value: T) => T
  /** 保留哪些字段（提交表单时用） */
  defaults: () => Omit<T, 'id' | 'createdAt'>
}

let idSeed = 0

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  idSeed += 1
  return `daymark-${Date.now().toString(36)}-${idSeed}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 一个极小的本地集合：localStorage 持久化 + useSyncExternalStore 订阅 + 多标签页同步。
 * 两个列表（走过的日子 / 倒数日）共用这套逻辑，只是数据结构不同。
 */
export function createStore<T extends Base>({ key, isValid, normalize, defaults }: StoreOptions<T>) {
  const listeners = new Set<() => void>()
  let cache: T[] = read()

  function read(): T[] {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(isValid).map(normalize)
    } catch {
      return []
    }
  }

  function persist(): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(cache))
    } catch {
      // 隐私模式 / 配额不足时静默降级：当次会话仍然可用
    }
  }

  function emit(): void {
    for (const listener of listeners) listener()
  }

  function commit(next: T[]): void {
    cache = next
    persist()
    emit()
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  if (typeof window !== 'undefined') {
    // 多标签页 / 多窗口之间保持同步
    window.addEventListener('storage', (event) => {
      if (event.key !== key) return
      cache = read()
      emit()
    })
  }

  return {
    subscribe,
    getAll: (): T[] => cache,
    add(input: Partial<Omit<T, 'id' | 'createdAt'>>): T {
      const created = { ...defaults(), ...input, id: makeId(), createdAt: Date.now() } as T
      commit([...cache, created])
      return created
    },
    update(id: string, patch: Partial<Omit<T, 'id' | 'createdAt'>>): void {
      commit(cache.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    },
    remove(id: string): T | undefined {
      const removed = cache.find((item) => item.id === id)
      if (!removed) return undefined
      commit(cache.filter((item) => item.id !== id))
      return removed
    },
    restore(item: T): void {
      if (cache.some((existing) => existing.id === item.id)) return
      commit([...cache, item])
    },
    /** 新建时默认分配的颜色索引 */
    suggestColor(): number {
      return pickColorIndex(cache.map((item) => item.color))
    },
    reset(): void {
      commit([])
    },
  }
}
