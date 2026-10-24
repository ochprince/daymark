/**
 * 文案查找。用法：
 *
 *   t('stage.since.label', { n: 12 })
 *
 * 复数：值写成 { one, other } 时按 vars.n 取；中文两格一样，英文按 1 / 其他。
 * 占位符：{name} / {n} / {date} / {rest} / {target} / {price}。
 */
import { en } from './en'
import { getLocale, INTL_LOCALE, type Locale } from './locale'
import { zh, type MessageKey, type Msg } from './zh'

export type { MessageKey } from './zh'
export { getLocale, INTL_LOCALE, setLocale, subscribeLocale, detectLocale, LOCALES, LOCALE_LABELS } from './locale'
export type { Locale } from './locale'

export const MESSAGES: Record<Locale, Record<MessageKey, Msg>> = { zh, en }

export type Vars = Record<string, string | number | undefined>

function pick(value: Msg, vars?: Vars): string {
  if (typeof value === 'string') return value
  const n = vars?.n
  return typeof n === 'number' && n === 1 ? value.one : value.other
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name]
    return value === undefined ? match : String(value)
  })
}

/** 取一条文案（按当前语言） */
export function t(key: MessageKey, vars?: Vars): string {
  const table = MESSAGES[getLocale()] ?? zh
  const value = table[key] ?? zh[key]
  if (value === undefined) return key
  return interpolate(pick(value, vars), vars)
}

/** 指定语言取文案（调试、分享图渲染等需要显式语言的场景） */
export function tIn(locale: Locale, key: MessageKey, vars?: Vars): string {
  const table = MESSAGES[locale] ?? zh
  const value = table[key] ?? zh[key]
  if (value === undefined) return key
  return interpolate(pick(value, vars), vars)
}

/** 语言 → Intl 地区码 */
export function intlLocale(locale: Locale = getLocale()): string {
  return INTL_LOCALE[locale] ?? 'en-US'
}

/** 「3 天」/「3 days」 */
export function unitDay(n: number): string {
  return t('unit.day', { n })
}
