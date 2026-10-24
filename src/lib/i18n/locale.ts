/**
 * 语言与地区。
 *
 * 目标用户是全球的，所以 v2 的所有新界面从第一天起就走文案表，
 * 不再出现写死的中文字符串（老界面在重写时逐个替换）。
 *
 * 语言来自：用户显式选择（daymark.locale.v1）→ 设备语言 → 英语兜底。
 */
export type Locale = 'zh' | 'en'

export const LOCALE_STORAGE_KEY = 'daymark.locale.v1'

/** 各语言对应的 Intl 地区码（日期、数字、星期都按它格式化） */
export const INTL_LOCALE: Record<Locale, string> = { zh: 'zh-CN', en: 'en-US' }

/** 语言选择器里的显示名（永远用该语言自己的写法） */
export const LOCALE_LABELS: Record<Locale, string> = { zh: '简体中文', en: 'English' }

export const LOCALES: readonly Locale[] = ['zh', 'en']

const listeners = new Set<() => void>()
let current: Locale | null = null

function isLocale(value: unknown): value is Locale {
  return value === 'zh' || value === 'en'
}

/** 设备语言 → 支持的语言。中文（含繁体、港台）一律先用简体，其余走英语 */
export function detectLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    /* 隐私模式读不到就走设备语言 */
  }
  const candidates =
    typeof navigator !== 'undefined'
      ? [...(navigator.languages ?? []), navigator.language]
      : []
  for (const tag of candidates) {
    if (typeof tag !== 'string') continue
    if (tag.toLowerCase().startsWith('zh')) return 'zh'
    if (tag.toLowerCase().startsWith('en')) return 'en'
  }
  // 其他语言先用英语：英语是国际版的主语言
  return 'en'
}

export function getLocale(): Locale {
  if (current === null) current = detectLocale()
  return current
}

export function setLocale(locale: Locale): void {
  if (!isLocale(locale) || locale === current) return
  current = locale
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* 写不进去只影响下次启动 */
  }
  applyDocumentLang(locale)
  for (const listener of listeners) listener()
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 同步 <html lang>：读屏、断词、系统字体都会用到 */
export function applyDocumentLang(locale: Locale = getLocale()): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : 'en'
}

/** 测试用：直接钉住语言，不碰 localStorage */
export function setLocaleForTest(locale: Locale | null): void {
  current = locale
  if (locale) applyDocumentLang(locale)
}
