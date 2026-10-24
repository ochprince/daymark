/**
 * 单对象版的本地存储：localStorage 持久化 + useSyncExternalStore 订阅 + 多标签页同步。
 *
 * 集合类的数据（三类事）用 createStore（数组），而焦点、皮肤、收藏、偏好这些
 * 「整份就是一个对象」的状态用这里。两者共用同样的订阅语义，组件侧写法一致。
 */
export type JsonStoreOptions<T> = {
  key: string
  /** 把读出来的任意值修成合法状态；必须对损坏数据也返回可用值 */
  normalize: (value: unknown) => T
}

export type JsonStore<T> = {
  subscribe: (listener: () => void) => () => void
  get: () => T
  set: (next: T | ((current: T) => T)) => void
  patch: (partial: Partial<T>) => void
  /** 重新从 localStorage 读一遍（迁移、外部写入后用） */
  reload: () => void
  reset: () => void
}

export function createJsonStore<T>({ key, normalize }: JsonStoreOptions<T>): JsonStore<T> {
  const listeners = new Set<() => void>()
  let cache: T = read()

  function read(): T {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return normalize(undefined)
      return normalize(JSON.parse(raw))
    } catch {
      return normalize(undefined)
    }
  }

  function persist(): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(cache))
    } catch {
      // 隐私模式 / 配额不足：当次会话仍然可用
    }
  }

  function emit(): void {
    for (const listener of listeners) listener()
  }

  function commit(next: T): void {
    cache = next
    persist()
    emit()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== key) return
      cache = read()
      emit()
    })
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    get: (): T => cache,
    set(next: T | ((current: T) => T)): void {
      commit(typeof next === 'function' ? (next as (current: T) => T)(cache) : next)
    },
    patch(partial: Partial<T>): void {
      commit({ ...cache, ...partial })
    },
    reload(): void {
      cache = read()
      emit()
    },
    reset(): void {
      commit(normalize(undefined))
    },
  }
}

/** 非空字符串检查，各 store 的 normalize 里常用 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/** 有限数字检查 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 取整并限制在 [min, max] 区间内 */
export function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)))
}
