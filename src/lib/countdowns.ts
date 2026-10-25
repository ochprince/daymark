import { createStore } from './store'
import { todayStart } from './days'
import type { CountdownDraft, CountdownEvent, Repeat } from './types'

const STORAGE_KEY = 'daymark.countdowns.v1'

const REPEATS: Repeat[] = ['none', 'weekly', 'monthly', 'yearly']

function isValid(value: unknown): value is CountdownEvent {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<CountdownEvent>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.startedAt === 'number' &&
    Number.isFinite(candidate.startedAt) &&
    typeof candidate.createdAt === 'number' &&
    Number.isFinite(candidate.createdAt) &&
    typeof candidate.color === 'number' &&
    (candidate.festivalId === undefined || typeof candidate.festivalId === 'string') &&
    REPEATS.includes(candidate.repeat as Repeat)
  )
}

const countdowns = createStore<CountdownEvent>({
  key: STORAGE_KEY,
  isValid,
  normalize: (event) => ({
    ...event,
    title: event.title.slice(0, 40),
    color: Math.trunc(event.color),
  }),
  defaults: () => ({ title: '', startedAt: todayStart(Date.now()), color: 0, repeat: 'none' as Repeat }),
})

export const subscribe = countdowns.subscribe
export const reload = countdowns.reload
export const getCountdowns = countdowns.getAll
export const removeCountdown = countdowns.remove
export const restoreCountdown = countdowns.restore
export const suggestColor = countdowns.suggestColor

export function addCountdown(draft: CountdownDraft): CountdownEvent {
  return countdowns.add({
    title: draft.title.trim().slice(0, 40),
    startedAt: draft.startedAt,
    color: draft.color,
    repeat: draft.repeat,
    ...(draft.festivalId ? { festivalId: draft.festivalId } : {}),
  })
}

/** 当天点「说过了」：记进 ackedFor 与 history，当天态结束，重复型自动显示下一次 */
export function markSaid(id: string, occurrence: number): void {
  const current = countdowns.getAll().find((item) => item.id === id)
  if (!current) return
  const ackedFor = [...new Set([...(current.ackedFor ?? []), occurrence])]
  const history = [{ at: occurrence }, ...(current.history ?? [])].slice(0, 200)
  countdowns.update(id, { ackedFor, history })
}

/** 直接改一条记录的任意字段（备忘、待办、相片这类不在表单草稿里的字段走这里） */
export function patchCountdown(id: string, patch: Partial<Omit<CountdownEvent, 'id' | 'createdAt'>>): void {
  countdowns.update(id, patch)
}

export function updateCountdown(id: string, patch: Partial<CountdownDraft>): void {
  countdowns.update(id, {
    ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 40) } : {}),
    ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
    ...(patch.color !== undefined ? { color: patch.color } : {}),
    ...(patch.repeat !== undefined ? { repeat: patch.repeat } : {}),
    // 显式传 festivalId（哪怕是 undefined）才动这个字段：
    // 手动改过日期时传 undefined 把它清掉，让日期重新说了算。
    ...(Object.prototype.hasOwnProperty.call(patch, 'festivalId') ? { festivalId: patch.festivalId } : {}),
  })
}
