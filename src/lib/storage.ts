import { pickColorIndex } from './palette'
import { todayStart } from './days'
import type { DayEvent, EventDraft } from './types'

const STORAGE_KEY = 'daymark.events.v1'

const listeners = new Set<() => void>()
let cache: DayEvent[] = read()

function isDayEvent(value: unknown): value is DayEvent {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<DayEvent>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.startedAt === 'number' &&
    Number.isFinite(candidate.startedAt) &&
    typeof candidate.createdAt === 'number' &&
    Number.isFinite(candidate.createdAt) &&
    typeof candidate.color === 'number'
  )
}

function read(): DayEvent[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isDayEvent).map((event) => ({
      id: event.id,
      title: event.title.slice(0, 40),
      startedAt: event.startedAt,
      createdAt: event.createdAt,
      color: Math.trunc(event.color),
    }))
  } catch {
    return []
  }
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // 隐私模式 / 存储配额不足时静默降级：当次会话仍然可用
  }
}

function emit(): void {
  for (const listener of listeners) listener()
}

function commit(next: DayEvent[]): void {
  cache = next
  persist()
  emit()
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `daymark-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getEvents(): DayEvent[] {
  return cache
}

export function addEvent(draft: EventDraft): DayEvent {
  const created: DayEvent = {
    id: makeId(),
    title: draft.title.trim().slice(0, 40),
    startedAt: draft.startedAt,
    createdAt: Date.now(),
    color: draft.color,
  }
  commit([...cache, created])
  return created
}

export function updateEvent(id: string, patch: Partial<EventDraft>): void {
  commit(
    cache.map((event) =>
      event.id === id
        ? {
            ...event,
            title: patch.title !== undefined ? patch.title.trim().slice(0, 40) : event.title,
            startedAt: patch.startedAt ?? event.startedAt,
            color: patch.color ?? event.color,
          }
        : event,
    ),
  )
}

export function removeEvent(id: string): DayEvent | undefined {
  const removed = cache.find((event) => event.id === id)
  if (!removed) return undefined
  commit(cache.filter((event) => event.id !== id))
  return removed
}

export function restoreEvent(event: DayEvent): void {
  if (cache.some((item) => item.id === event.id)) return
  commit([...cache, event])
}

/** 新建事件时默认分配的颜色索引 */
export function suggestColor(): number {
  return pickColorIndex(cache.map((event) => event.color))
}

/** 默认起始时间：今天 */
export function defaultStart(): number {
  return todayStart(Date.now())
}

if (typeof window !== 'undefined') {
  // 多标签页 / 多窗口之间保持同步
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    cache = read()
    emit()
  })
}
