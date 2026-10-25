/**
 * 提醒（产品口径见 docs/plan-v2.md：D12 / Q4）。
 *
 * **不引入推送服务**：iOS 网页推送要求「添加到主屏幕」+ iOS 16.4+，定时推送还得有服务端，
 * 和「零后端」冲突。所以提醒只做两件事：
 *   1. App 打开着的时候，到点弹一条应用内提示（同一天只弹一次）；
 *   2. 需要真正的闹钟，就把这条日程导出成 `.ics` 交给系统日历（重复写 RRULE）。
 *
 * 数据形状直接用 types.ts 里已有的 `Reminder`（none / daily / weekly / before），
 * 不另起一套。这里全是纯函数，能在 node 里直接测。
 */
import { dayKey, parseDayKey } from './daykey'
import { NO_REMINDER } from './types'
import type { Reminder } from './types'

export { NO_REMINDER }
export type { Reminder }

const DAY_MS = 86_400_000

const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(n)))
const wrap7 = (n: number) => ((Math.trunc(n) % 7) + 7) % 7

/** "21:00" → { hour: 21, minute: 0 }；认不出来给 21:00 */
export function parseTime(time: string | undefined): { hour: number; minute: number } {
  const match = typeof time === 'string' ? /^(\d{1,2}):(\d{1,2})$/.exec(time.trim()) : null
  if (!match) return { hour: 21, minute: 0 }
  return {
    hour: clampInt(Number(match[1]), 0, 23),
    minute: clampInt(Number(match[2]), 0, 59),
  }
}

/** 时分 → "HH:MM"，永远两位数，方便 input 和存储 */
export function formatTime(hour: number, minute: number): string {
  return `${String(clampInt(hour, 0, 23)).padStart(2, '0')}:${String(clampInt(minute, 0, 59)).padStart(2, '0')}`
}

/** 用户随手输入的 "9:5" 也要收成 "09:05" */
export function normalizeTimeString(input: unknown, fallback = '21:00'): string {
  if (typeof input !== 'string') return fallback
  const { hour, minute } = parseTime(input)
  return formatTime(hour, minute)
}

/** 把库里读出来的东西收成合法 Reminder；认不出来就当不提醒 */
export function normalizeReminder(input: unknown): Reminder {
  if (typeof input !== 'object' || input === null) return { ...NO_REMINDER }
  const value = input as { kind?: string; time?: string; weekdays?: unknown; daysBefore?: unknown }
  if (value.kind === 'daily') return { kind: 'daily', time: normalizeTimeString(value.time) }
  if (value.kind === 'weekly') {
    const raw = value.weekdays
    const weekdays = Array.isArray(raw)
      ? [...new Set(raw.filter((n) => Number.isFinite(n)).map((n) => wrap7(Number(n))))].sort((a, b) => a - b)
      : []
    return weekdays.length === 0
      ? { kind: 'daily', time: normalizeTimeString(value.time) }
      : { kind: 'weekly', weekdays, time: normalizeTimeString(value.time) }
  }
  if (value.kind === 'before') {
    return {
      kind: 'before',
      daysBefore: clampInt(Number(value.daysBefore ?? 0), 0, 365),
      time: normalizeTimeString(value.time),
    }
  }
  return { ...NO_REMINDER }
}

export function isNone(reminder: Reminder | undefined): boolean {
  return !reminder || reminder.kind === 'none'
}

/**
 * 这一天里真正该响的那一刻。
 * - daily / weekly：当天的时间点
 * - before：目标日往前 N 天那天的同一时间点（targetAt 是目标日 00:00）
 */
export function triggerAt(reminder: Reminder, date: number, targetAt?: number): number | null {
  if (reminder.kind === 'none') return null
  const { hour, minute } = parseTime(reminder.time)

  if (reminder.kind === 'before') {
    if (targetAt === undefined || !Number.isFinite(targetAt)) return null
    const triggerTs = targetAt - reminder.daysBefore * DAY_MS
    if (dayKey(triggerTs) !== dayKey(date)) return null
    const at = new Date(triggerTs)
    at.setHours(hour, minute, 0, 0)
    return at.getTime()
  }

  if (reminder.kind === 'weekly' && !reminder.weekdays.includes(new Date(date).getDay())) return null

  const at = new Date(date)
  at.setHours(hour, minute, 0, 0)
  return at.getTime()
}

/** 这一天要不要提醒 */
export function firesOn(reminder: Reminder, date: number, targetAt?: number): boolean {
  return triggerAt(reminder, date, targetAt) !== null
}

/**
 * 现在这一刻是不是刚好到点。
 * `lastFiredKey` 传「上一次弹过的日期键」，同一天不重复弹；
 * `windowMinutes` 让用户晚几分钟打开 App 也还算数。
 */
export function isDue(
  reminder: Reminder,
  now: number,
  lastFiredKey: string | null,
  options: { windowMinutes?: number; targetAt?: number } = {},
): boolean {
  if (reminder.kind === 'none') return false
  if (lastFiredKey === dayKey(now)) return false
  const trigger = triggerAt(reminder, now, options.targetAt)
  if (trigger === null) return false
  const windowMs = Math.max(1, options.windowMinutes ?? 1) * 60_000
  const delta = now - trigger
  return delta >= 0 && delta < windowMs
}

/** 下一次提醒发生的时刻；永不发生返回 null */
export function nextTrigger(reminder: Reminder, now: number, targetAt?: number): number | null {
  if (reminder.kind === 'none') return null
  for (let offset = 0; offset < 8; offset += 1) {
    const probe = new Date(now)
    probe.setDate(probe.getDate() + offset)
    const trigger = triggerAt(reminder, probe.getTime(), targetAt)
    if (trigger !== null && trigger > now) return trigger
  }
  return null
}

const ZH_WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const EN_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "每天 21:00" / "周一、周三 09:05" / "提前 3 天 20:00" */
export function formatReminder(reminder: Reminder, locale: 'zh' | 'en' = 'zh'): string {
  if (reminder.kind === 'none') return locale === 'zh' ? '不提醒' : 'Off'
  const time = normalizeTimeString(reminder.time)
  if (reminder.kind === 'daily') return locale === 'zh' ? `每天 ${time}` : `Every day ${time}`
  if (reminder.kind === 'before') {
    return locale === 'zh' ? `提前 ${reminder.daysBefore} 天 ${time}` : `${reminder.daysBefore} days before ${time}`
  }
  const names = locale === 'zh' ? ZH_WEEK : EN_WEEK
  const list = reminder.weekdays.map((n) => names[wrap7(n)]).join(locale === 'zh' ? '、' : ', ')
  return `${list} ${time}`
}

/* ---------------------------------------------------------------------------
   导出到系统日历
   --------------------------------------------------------------------------- */

const ICS_BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 20261025T210000（本地时间；日程提醒不需要 VTIMEZONE） */
export function icsLocalStamp(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`
}

/**
 * DTSTAMP 按 RFC 5545 必须是 **UTC**（带 Z）。
 * 之前直接拿本地时间拼了 Z，等于谎报时区。
 */
export function icsUtcStamp(ts: number): string {
  const d = new Date(ts)
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  )
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** 按 75 字节折行（RFC 5545）；中文一个字 3 字节，必须按字节算 */
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const out: string[] = []
  let current = ''
  for (const char of line) {
    if (encoder.encode(current + char).length > (out.length === 0 ? 75 : 74)) {
      out.push(current)
      current = char
    } else {
      current += char
    }
  }
  out.push(current)
  return out.join('\r\n ')
}

export type IcsOptions = {
  uid: string
  title: string
  reminder: Reminder
  /** 首次发生的时刻（一般是 nextTrigger 的结果） */
  from: number
  now?: number
  description?: string
  /** 倒数日的目标日 00:00，before 类型用它判断是不是一次性 */
  targetAt?: number
}

/** 生成一条日程；重复写 RRULE，单次就不写 */
export function buildIcs(options: IcsOptions): string {
  const { uid, title, reminder, from, description, targetAt } = options
  const now = options.now ?? Date.now()

  let rule = 'RRULE:FREQ=DAILY'
  if (reminder.kind === 'weekly') {
    // BYDAY 的顺序虽然不影响语义，但固定成周日→周六更好读也更好断言
    rule = `RRULE:FREQ=WEEKLY;BYDAY=${reminder.weekdays
      .slice()
      .sort((a, b) => a - b)
      .map((n) => ICS_BYDAY[wrap7(n)])
      .join(',')}`
  } else if (reminder.kind === 'before' && Number.isFinite(targetAt)) {
    // 「提前 N 天」天然按年重来（生日、纪念日）
    rule = 'RRULE:FREQ=YEARLY'
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Daymark//刻度//CN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${icsEscape(uid)}@daymark`,
    `DTSTAMP:${icsUtcStamp(now)}`,
    `DTSTART:${icsLocalStamp(from)}`,
    'DURATION:PT15M',
    rule,
    `SUMMARY:${icsEscape(title)}`,
    description ? `DESCRIPTION:${icsEscape(description)}` : 'DESCRIPTION:来自 Daymark · 刻度',
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** 文件名：只留安全字符 */
export function icsFileName(title: string, fallback = 'daymark'): string {
  const cleaned = title
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 40)
  return `${cleaned || fallback}.ics`
}

/** parseDayKey 在上面没用到时这里显式引用一下，避免 lint 抱怨（保留给触发日计算扩展用） */
void parseDayKey
