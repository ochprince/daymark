/**
 * 倒数日的「一句备忘 + 待办清单」纯逻辑。
 *
 * 这里不碰 localStorage、不碰 React：进来的可能是任意脏数据（老版本、手改过的
 * JSON、同步过来的半截记录），出去的一定是能直接渲染的 TodoItem[]。
 *
 * 关于 id：落盘格式是 { text, done }（见 types.ts 的 TodoItem），没有 id 字段。
 * 为了不改已定型的数据、也不做迁移，一条待办的 id 就是它在数组里的位置
 * （'0'、'1'……，number 也行）。UI 每次点击用的都是当前这一帧看到的下标，
 * 拿到新数组后立刻重渲染，所以位置 id 在交互里是稳定的。id 越界或不是整数时，
 * 所有写操作都原样返回，不抛错。
 */
import type { TodoItem } from './types'

/** 一条待办最多这么长（字符） */
export const TODO_TEXT_MAX = 80
/** 清单最多这么多条，防止 localStorage 被塞爆 */
export const TODO_MAX_ITEMS = 50
/** 备忘最多这么长（字符） */
export const MEMO_TEXT_MAX = 140

export type TodoProgress = { done: number; total: number }

/**
 * 收敛一行文本：把换行 / 连续空白压成一个空格，去首尾空白，再截断。
 * 非字符串一律当成空串，调用方按「空 = 拒绝」处理。
 */
export function cleanTodoText(value: unknown, max = TODO_TEXT_MAX): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max).trim()
}

/**
 * 把任意脏数据收敛成 TodoItem[]：
 * - 不是数组 → 空清单
 * - 单项不是对象（字符串当作纯文本，其余丢掉）
 * - 文本压空白、限长，空的丢掉
 * - 同名（收敛后逐字相同）只留最先出现的那条
 * - 最多留 TODO_MAX_ITEMS 条
 *
 * 永远返回新数组，调用方可以放心当不可变值用。
 */
export function normalizeTodo(input: unknown): TodoItem[] {
  if (!Array.isArray(input)) return []
  const out: TodoItem[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    if (out.length >= TODO_MAX_ITEMS) break
    let text = ''
    let done = false
    if (typeof raw === 'string') {
      text = cleanTodoText(raw)
    } else if (typeof raw === 'object' && raw !== null) {
      const item = raw as Partial<TodoItem>
      text = cleanTodoText(item.text)
      done = item.done === true
    }
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push({ text, done })
  }
  return out
}

/** 位置 id：给 React key 和写操作一起用 */
export function todoId(index: number): string {
  return String(index)
}

/** 解析位置 id；不合法返回 -1（注意 '' 会被 Number 当成 0，所以只认纯数字串） */
function toIndex(id: string | number, length: number): number {
  const index = typeof id === 'number' ? id : /^\d+$/.test(id) ? Number(id) : Number.NaN
  if (!Number.isInteger(index) || index < 0 || index >= length) return -1
  return index
}

/**
 * 加一条。文本收敛后为空、和已有条目重名、或者清单已满，都会原样返回
 * （同一个数组引用，父组件可以靠 === 判断「什么都没发生」）。
 */
export function addTodo(list: readonly TodoItem[], text: string): TodoItem[] {
  const clean = cleanTodoText(text)
  const current = list as TodoItem[]
  if (!clean || current.length >= TODO_MAX_ITEMS) return current
  if (current.some((item) => item.text === clean)) return current
  return [...current, { text: clean, done: false }]
}

/** 勾上 / 取消勾选 */
export function toggleTodo(list: readonly TodoItem[], id: string | number): TodoItem[] {
  const current = list as TodoItem[]
  const index = toIndex(id, current.length)
  if (index < 0) return current
  return current.map((item, i) => (i === index ? { ...item, done: !item.done } : item))
}

/** 删掉一条 */
export function removeTodo(list: readonly TodoItem[], id: string | number): TodoItem[] {
  const current = list as TodoItem[]
  const index = toIndex(id, current.length)
  if (index < 0) return current
  return current.filter((_, i) => i !== index)
}

/**
 * 改一条的文字。空文本、或者改成另一条已有的名字，都原样返回；
 * done 状态跟着走，不会被重命名顺手清掉。
 */
export function renameTodo(list: readonly TodoItem[], id: string | number, text: string): TodoItem[] {
  const current = list as TodoItem[]
  const index = toIndex(id, current.length)
  if (index < 0) return current
  const clean = cleanTodoText(text)
  if (!clean) return current
  if (current.some((item, i) => i !== index && item.text === clean)) return current
  return current.map((item, i) => (i === index ? { text: clean, done: item.done } : item))
}

/** 进度：勾掉几条 / 共几条。脏数据按空清单算。 */
export function todoProgress(list: readonly TodoItem[] | null | undefined): TodoProgress {
  if (!Array.isArray(list)) return { done: 0, total: 0 }
  return {
    done: list.filter((item) => item?.done === true).length,
    total: list.length,
  }
}
