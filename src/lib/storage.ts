import { createStore } from './store'
import { todayStart } from './days'
import { normalizeStreaks } from './streaks'
import type { DayEvent, EventDraft } from './types'

const STORAGE_KEY = 'daymark.events.v1'

function isValid(value: unknown): value is DayEvent {
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

const events = createStore<DayEvent>({
  key: STORAGE_KEY,
  isValid,
  normalize: (event) => ({
    ...event,
    // 坏掉的锚点直接丢掉，退回起始日的 00:00，不要把整条记录判为无效
    ...(typeof event.anchorAt === 'number' && Number.isFinite(event.anchorAt)
      ? {}
      : { anchorAt: undefined }),
    title: event.title.slice(0, 40),
    color: Math.trunc(event.color),
    ...(event.history ? { history: normalizeStreaks(event.history) } : {}),
  }),
  defaults: () => ({ title: '', startedAt: todayStart(Date.now()), color: 0 }),
})

export const subscribe = events.subscribe
export const reload = events.reload
export const getEvents = events.getAll
export const removeEvent = events.remove
export const restoreEvent = events.restore
export const suggestColor = events.suggestColor

export function addEvent(draft: EventDraft): DayEvent {
  return events.add({
    title: draft.title.trim().slice(0, 40),
    startedAt: draft.startedAt,
    color: draft.color,
    ...(draft.anchorAt !== undefined ? { anchorAt: draft.anchorAt } : {}),
  })
}

export function updateEvent(id: string, patch: Partial<EventDraft>): void {
  events.update(id, {
    ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 40) } : {}),
    ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
    // 改了起始日就一定重写锚点：挑历史日期时是 undefined，正好把旧锚点清掉
    ...(patch.startedAt !== undefined || patch.anchorAt !== undefined
      ? { anchorAt: patch.anchorAt }
      : {}),
    ...(patch.color !== undefined ? { color: patch.color } : {}),
    ...(patch.history !== undefined ? { history: normalizeStreaks(patch.history) } : {}),
  })
}

/** 默认起始时间：今天 */
export function defaultStart(): number {
  return todayStart(Date.now())
}
