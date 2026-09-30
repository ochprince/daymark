import { LUNAR_FESTIVAL_DATES } from './lunar-dates'

/**
 * 节日的日期规则：
 *  - solar      公历固定日期
 *  - lunar      农历（查离线表，超出表的范围用 Intl 的 Chinese 日历现算）
 *  - nth-weekday 某月第 n 个星期 x（母亲节、感恩节这类）
 *  - easter     复活节（西方教会 computus）
 *  - qingming   清明（节气，用 21 世纪适用的近似式）
 */
export type FestivalRule =
  | { kind: 'solar'; month: number; day: number }
  | { kind: 'lunar'; key: string }
  | { kind: 'nth-weekday'; month: number; weekday: number; nth: number }
  | { kind: 'easter' }
  | { kind: 'qingming' }

export type Festival = {
  id: string
  name: string
  rule: FestivalRule
}

export type FestivalGroup = {
  id: string
  title: string
  items: readonly Festival[]
}

/** 农历十二月（腊月）的节日落在下一个公历年，查表时要退一年 */
const LATE_LUNAR = new Set(['laba', 'xiaonian'])

export const FESTIVAL_GROUPS: readonly FestivalGroup[] = [
  {
    id: 'cn-traditional',
    title: '中国传统节日',
    items: [
      { id: 'spring-festival', name: '春节', rule: { kind: 'lunar', key: 'chunjie' } },
      { id: 'lantern', name: '元宵节', rule: { kind: 'lunar', key: 'yuanxiao' } },
      { id: 'dragon-head', name: '龙抬头', rule: { kind: 'lunar', key: 'longtaitou' } },
      { id: 'qingming', name: '清明节', rule: { kind: 'qingming' } },
      { id: 'dragon-boat', name: '端午节', rule: { kind: 'lunar', key: 'duanwu' } },
      { id: 'qixi', name: '七夕', rule: { kind: 'lunar', key: 'qixi' } },
      { id: 'ghost', name: '中元节', rule: { kind: 'lunar', key: 'zhongyuan' } },
      { id: 'mid-autumn', name: '中秋节', rule: { kind: 'lunar', key: 'zhongqiu' } },
      { id: 'double-ninth', name: '重阳节', rule: { kind: 'lunar', key: 'chongyang' } },
      { id: 'laba', name: '腊八节', rule: { kind: 'lunar', key: 'laba' } },
      { id: 'xiaonian', name: '小年', rule: { kind: 'lunar', key: 'xiaonian' } },
      // 除夕 = 次年正月初一的前一天，见 resolveFestival
      { id: 'chuxi', name: '除夕', rule: { kind: 'lunar', key: 'chuxi' } },
    ],
  },
  {
    id: 'cn-statutory',
    title: '法定节假日',
    items: [
      { id: 'new-year', name: '元旦', rule: { kind: 'solar', month: 1, day: 1 } },
      { id: 'womens-day', name: '妇女节', rule: { kind: 'solar', month: 3, day: 8 } },
      { id: 'labour-day', name: '劳动节', rule: { kind: 'solar', month: 5, day: 1 } },
      { id: 'youth-day', name: '青年节', rule: { kind: 'solar', month: 5, day: 4 } },
      { id: 'childrens-day', name: '儿童节', rule: { kind: 'solar', month: 6, day: 1 } },
      { id: 'army-day', name: '建军节', rule: { kind: 'solar', month: 8, day: 1 } },
      { id: 'national-day', name: '国庆节', rule: { kind: 'solar', month: 10, day: 1 } },
    ],
  },
  {
    id: 'western',
    title: '欧美节日',
    items: [
      { id: 'valentines', name: '情人节', rule: { kind: 'solar', month: 2, day: 14 } },
      { id: 'april-fools', name: '愚人节', rule: { kind: 'solar', month: 4, day: 1 } },
      { id: 'easter', name: '复活节', rule: { kind: 'easter' } },
      { id: 'mothers-day', name: '母亲节', rule: { kind: 'nth-weekday', month: 5, weekday: 0, nth: 2 } },
      { id: 'fathers-day', name: '父亲节', rule: { kind: 'nth-weekday', month: 6, weekday: 0, nth: 3 } },
      { id: 'halloween', name: '万圣夜', rule: { kind: 'solar', month: 10, day: 31 } },
      { id: 'thanksgiving', name: '感恩节', rule: { kind: 'nth-weekday', month: 11, weekday: 4, nth: 4 } },
      { id: 'christmas-eve', name: '平安夜', rule: { kind: 'solar', month: 12, day: 24 } },
      { id: 'christmas', name: '圣诞节', rule: { kind: 'solar', month: 12, day: 25 } },
    ],
  },
]

export const FESTIVALS: readonly Festival[] = FESTIVAL_GROUPS.flatMap((group) => group.items)

const FESTIVAL_BY_ID = new Map(FESTIVALS.map((festival) => [festival.id, festival]))

export function festivalById(id: string): Festival | undefined {
  return FESTIVAL_BY_ID.get(id)
}

/** 复活节：Anonymous Gregorian computus */
function easterOf(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

/** 清明：21 世纪适用的节气近似式（20 世纪用 C=5.59，此处不必） */
function qingmingOf(year: number): { month: number; day: number } {
  const y = year % 100
  const day = Math.floor(y * 0.2422 + 4.81) - Math.floor(y / 4)
  return { month: 4, day }
}

/** 某月第 n 个星期 x */
function nthWeekdayOf(year: number, month: number, weekday: number, nth: number): { month: number; day: number } {
  const first = new Date(year, month - 1, 1)
  const shift = (weekday - first.getDay() + 7) % 7
  return { month, day: 1 + shift + (nth - 1) * 7 }
}

/** 用 Intl 的 Chinese 日历现算农历节日（离线表覆盖范围之外时才走这里） */
function lunarViaIntl(year: number, key: string): { month: number; day: number } | null {
  const target: Record<string, [number, number]> = {
    chunjie: [1, 1],
    yuanxiao: [1, 15],
    longtaitou: [2, 2],
    duanwu: [5, 5],
    qixi: [7, 7],
    zhongyuan: [7, 15],
    zhongqiu: [8, 15],
    chongyang: [9, 9],
    laba: [12, 8],
    xiaonian: [12, 23],
  }
  const wanted = target[key]
  if (!wanted) return null
  try {
    const md = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      month: 'numeric',
      day: 'numeric',
      numberingSystem: 'latn',
    })
    const long = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', numberingSystem: 'latn' })
    const cursor = new Date(year - 1, 11, 1)
    const end = new Date(year + 1, 2, 1)
    while (cursor <= end) {
      if (!long.format(cursor).includes('闰')) {
        const [month, day] = md
          .format(cursor)
          .replace(/[^\d-]/g, '')
          .split('-')
          .map(Number)
        if (month === wanted[0] && day === wanted[1]) {
          return { month: cursor.getMonth() + 1, day: cursor.getDate() }
        }
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  } catch {
    return null
  }
  return null
}

/** 农历节日在指定公历年的日期 */
function lunarIn(year: number, key: string): { month: number; day: number } | null {
  if (key === 'chuxi') {
    // 除夕：本公历年春节的前一天（春节总在 1–2 月，除夕同在该年）
    const spring = lunarIn(year, 'chunjie')
    if (!spring) return null
    const date = new Date(year, spring.month - 1, spring.day)
    date.setDate(date.getDate() - 1)
    return { month: date.getMonth() + 1, day: date.getDate() }
  }
  const tableYear = LATE_LUNAR.has(key) ? year - 1 : year
  const mmdd = LUNAR_FESTIVAL_DATES[tableYear]?.[key]
  if (mmdd) {
    const [month, day] = mmdd.split('-').map(Number)
    return { month, day }
  }
  return lunarViaIntl(tableYear, key)
}

/** 节日在某个公历年的日期（月/日，不含时区信息） */
export function festivalDateIn(festival: Festival, year: number): { month: number; day: number } | null {
  const rule = festival.rule
  if (rule.kind === 'solar') return { month: rule.month, day: rule.day }
  if (rule.kind === 'lunar') return lunarIn(year, rule.key)
  if (rule.kind === 'easter') return easterOf(year)
  if (rule.kind === 'qingming') return qingmingOf(year)
  return nthWeekdayOf(year, rule.month, rule.weekday, rule.nth)
}

/** 节日从 from（时间戳）起最近的一次，含当天；返回当天 00:00 的时间戳 */
export function nextFestivalDate(festival: Festival, from: number): number | null {
  const base = new Date(from)
  const startOfDay = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime()
  for (const year of [base.getFullYear(), base.getFullYear() + 1, base.getFullYear() + 2]) {
    const found = festivalDateIn(festival, year)
    if (!found) continue
    const stamp = new Date(year, found.month - 1, found.day).getTime()
    if (stamp >= startOfDay) return stamp
  }
  return null
}

/** 距离今天还有多少天（0 = 今天） */
export function daysToFestival(festival: Festival, from: number): number | null {
  const next = nextFestivalDate(festival, from)
  if (next === null) return null
  const base = new Date(from)
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime()
  return Math.round((next - today) / 86400000)
}
