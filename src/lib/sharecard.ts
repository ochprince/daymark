/**
 * 分享卡片的纯逻辑：把一件事转成一张卡片需要的全部数据。
 *
 * 这里不碰 DOM、不碰 canvas，所以能直接单测；画在屏幕上的在 v2/ShareCard.tsx，
 * 画进 PNG 的在 v2/share.tsx，两边都只读 ShareModel。
 *
 * 文案口径：
 * - 大数字优先复用舞台卡的现成 key（stage.number.lead.day / unit.daySuffix / unit.day …），
 *   这样分享卡和首页上的数字读起来是同一句话，不用维护第二套文案。
 * - 剩下的几句（底部署名、分享弹层按钮、分享文案）在 SHARE_TEXT 里自带中英双份，
 *   一旦主控把 docs/share/INTEGRATION.md 里的 key 合进 zh.ts / en.ts，
 *   shareCopy() 会自动改用 t()，本文件不用再改一行。
 */
import { intlLocale, getLocale } from './i18n'
import type { Locale, MessageKey, Vars } from './i18n'
import { tIn } from './i18n'
import { MESSAGES } from './i18n'
import type { Msg } from './i18n/zh'
import { STAGE_THRESHOLDS } from './growth'
import type { ItemKind, Species, Stage } from './types'
import type { ItemView, Mood } from './itemview'

/** 卡片逻辑尺寸（9:16）。预览按屏宽等比缩放，导出 PNG 固定这个尺寸。 */
export const SHARE_SIZE = { width: 1080, height: 1920 } as const

/** 卡片上要显示的一切 */
export type ShareModel = {
  /** `since:id` / `habit:id` / `countdown:id` */
  key: string
  kind: ItemKind
  title: string
  /** 大数字前面的小字：第 / Day / 空 */
  lead: string
  /** 主体：纯数字串，或一句话（「还有 12 天」「就是今天」） */
  number: string
  /** 大数字后面的小字：天 / 空 */
  unit: string
  /** number 是一句话而不是纯数字：字号更小、不走等宽数字排版 */
  isPhrase: boolean
  /** 标题下面那行小字：开始日期 / 目标日（习惯类再带上今天的次数） */
  subtitle: string
  /** 卡片顶部右侧：今天是几号 */
  dateText: string
  /** 底部署名 */
  footer: string
  /** 类型标签：坚持 / 习惯 / 等待的日子 */
  kindLabel: string
  /** 配色索引 0–7（对应 --h-N / --h-N-2） */
  colorIndex: number
  species: Species
  stage: Stage
  /** 角色表情：倒数日当天是 happy，其余 idle / happy / sleep 原样带出 */
  mood: Mood
  /** 是否画成长条（信使不长大，倒数日不画） */
  showGrowth: boolean
  /** 成长天数 */
  growth: number
  /** 成长条左边的文案：成长 N 天（语言跟 buildShareModel 的 locale 走） */
  growthLabel: string
  /** 当前形态内的进度 0–100 */
  growthPct: number
}

export type ShareOptions = {
  /** 「今天」取哪一刻，默认 Date.now()；测试里显式传 */
  now?: number
  /** 卡片文案用哪种语言，默认当前语言 */
  locale?: Locale
}

/* ==========================================================================
   分享专用的几句文案
   —— 主控合进 i18n 之后，shareCopy() 会自动切到 t()，这里的表退化成兜底
   ========================================================================== */

export type ShareTextKey =
  | 'share.title'
  | 'share.save'
  | 'share.share'
  | 'share.close'
  | 'share.rendering'
  | 'share.saved'
  | 'share.shared'
  | 'share.failed'
  | 'share.noShare'
  | 'share.hint'
  | 'share.footer'
  | 'share.caption.since'
  | 'share.caption.habit'
  | 'share.caption.countdown'
  | 'share.caption.countdown.today'
  | 'share.caption.countdown.past'

export const SHARE_TEXT: Record<Locale, Record<ShareTextKey, Msg>> = {
  zh: {
    'share.title': '分享卡片',
    'share.save': '保存图片',
    'share.share': '分享',
    'share.close': '关闭',
    'share.rendering': '正在生成…',
    'share.saved': '图片已保存',
    'share.shared': '已分享',
    'share.failed': '生成图片失败，请再试一次',
    'share.noShare': '这个浏览器不能直接分享图片，长按预览或点「保存图片」',
    'share.hint': '卡片上只有你愿意给人看的：数字、一句话、小伙伴',
    'share.footer': '刻度 DAYMARK · 一次只看一件事',
    'share.caption.since': '「{title}」已经第 {n} 天了。一天一天，都算数。 #刻度',
    'share.caption.habit': { one: '和「{title}」一起走过 {n} 天。 #刻度', other: '和「{title}」一起走过 {n} 天。 #刻度' },
    'share.caption.countdown': '还有 {n} 天就是「{title}」。 #刻度',
    'share.caption.countdown.today': '就是今天：「{title}」。 #刻度',
    'share.caption.countdown.past': '「{title}」已经过去 {n} 天了。 #刻度',
  },
  en: {
    'share.title': 'Share card',
    'share.save': 'Save image',
    'share.share': 'Share',
    'share.close': 'Close',
    'share.rendering': 'Rendering…',
    'share.saved': 'Image saved',
    'share.shared': 'Shared',
    'share.failed': 'Could not render the image. Try again.',
    'share.noShare': 'This browser cannot share images directly — long-press the preview or save it',
    'share.hint': 'Only what you are happy to show: the number, one line, and your buddy',
    'share.footer': 'DAYMARK · one thing at a time',
    'share.caption.since': 'Day {n} of "{title}". One day at a time. #Daymark',
    'share.caption.habit': {
      one: 'One day together with "{title}". #Daymark',
      other: '{n} days together with "{title}". #Daymark',
    },
    'share.caption.countdown': '{n} days until "{title}". #Daymark',
    'share.caption.countdown.today': 'It is today: "{title}". #Daymark',
    'share.caption.countdown.past': '{n} days since "{title}". #Daymark',
  },
}

/** i18n 已经有的表里查（主控合并 key 之后就会命中） */
function bridged(locale: Locale, key: ShareTextKey): Msg | undefined {
  const table = MESSAGES[locale] as Record<string, Msg | undefined>
  return table[key]
}

function pick(value: Msg, vars?: Vars): string {
  if (typeof value === 'string') return value
  return typeof vars?.n === 'number' && vars.n === 1 ? value.one : value.other
}

function fill(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name]
    return value === undefined ? match : String(value)
  })
}

/**
 * 取一句分享文案。
 * 优先走 i18n（主控把 key 合进 zh.ts / en.ts 之后自动生效），没有再退回本文件的表。
 */
export function shareCopy(key: ShareTextKey, vars?: Vars, locale: Locale = getLocale()): string {
  if (bridged(locale, key) !== undefined) return tIn(locale, key as MessageKey, vars)
  const value = SHARE_TEXT[locale]?.[key] ?? SHARE_TEXT.zh[key]
  return fill(pick(value, vars), vars)
}

/* ==========================================================================
   日期与数字
   ========================================================================== */

const DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>()

/** 2026年10月25日 / October 25, 2026 —— 语言显式传入，测试才稳定 */
export function shareDateText(ts: number, locale: Locale): string {
  const key = intlLocale(locale)
  let formatter = DATE_FORMATTERS.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(key, { year: 'numeric', month: 'long', day: 'numeric' })
    DATE_FORMATTERS.set(key, formatter)
  }
  return formatter.format(new Date(ts))
}

/** 本地日历日 2026-10-25（文件名用，跟 dayKey 同一口径：不转 UTC） */
export function shareStamp(date: number): string {
  const value = new Date(date)
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

/* ==========================================================================
   模型
   ========================================================================== */

function numberBlock(view: ItemView, locale: Locale): Pick<ShareModel, 'lead' | 'number' | 'unit' | 'isPhrase'> {
  if (view.kind === 'since') {
    return {
      lead: tIn(locale, 'stage.number.lead.day'),
      number: String(Math.max(0, view.days)),
      unit: tIn(locale, 'unit.daySuffix'),
      isPhrase: false,
    }
  }
  if (view.kind === 'habit') {
    const growth = Math.max(0, view.growth)
    // 「128 天」/「128 days」：复数交给 i18n，中文英文都不会出现 1 days
    return { lead: '', number: tIn(locale, 'unit.day', { n: growth }), unit: '', isPhrase: true }
  }
  if (view.days === 0) {
    return { lead: '', number: tIn(locale, 'stage.countdown.today'), unit: '', isPhrase: true }
  }
  if (view.days < 0) {
    return { lead: '', number: tIn(locale, 'stage.countdown.past', { n: -view.days }), unit: '', isPhrase: true }
  }
  return { lead: '', number: tIn(locale, 'stage.countdown.days', { n: view.days }), unit: '', isPhrase: true }
}

function subtitleOf(view: ItemView, locale: Locale): string {
  if (view.kind === 'since') {
    return tIn(locale, 'stage.since.sub', { date: shareDateText(view.event.startedAt, locale) })
  }
  if (view.kind === 'countdown') {
    return shareDateText(view.next, locale)
  }
  const start = view.event.chapterStartedAt ?? view.event.createdAt
  const parts = [tIn(locale, 'stage.since.sub', { date: shareDateText(start, locale) })]
  if (view.target !== null && view.target > 1) {
    parts.push(
      view.cadence === 'weekly'
        ? tIn(locale, 'stage.habit.weekTarget', { n: view.count, target: view.target })
        : tIn(locale, 'stage.habit.todayTarget', { n: view.count, target: view.target }),
    )
  } else if (view.count > 0) {
    parts.push(tIn(locale, 'stage.habit.today', { n: view.count }))
  }
  return parts.join(' · ')
}

/** 当前形态内的进度 0–100（与舞台卡同一口径，满形态恒为 100） */
export function growthPercent(growth: number, stage: Stage): number {
  const from = STAGE_THRESHOLDS[stage] ?? 0
  const to = STAGE_THRESHOLDS[stage + 1]
  if (to === undefined) return 100
  const span = to - from
  if (span <= 0) return 100
  const value = ((Math.max(0, growth) - from) / span) * 100
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** 把一件事转成分享卡需要的纯数据 */
export function buildShareModel(view: ItemView, options: ShareOptions = {}): ShareModel {
  const locale = options.locale ?? getLocale()
  const now = options.now ?? Date.now()
  const colorIndex = Number.isFinite(view.color) ? Math.min(7, Math.max(0, Math.trunc(view.color))) : 0
  const stage = Math.min(4, Math.max(0, Math.trunc(view.stage))) as Stage
  const growth = Math.max(0, Math.trunc(view.growth))

  return {
    key: view.key,
    kind: view.kind,
    title: view.title,
    ...numberBlock(view, locale),
    subtitle: subtitleOf(view, locale),
    dateText: shareDateText(now, locale),
    footer: shareCopy('share.footer', undefined, locale),
    kindLabel: tIn(locale, `kind.${view.kind}` as MessageKey),
    colorIndex,
    species: view.species,
    stage,
    mood: view.mood,
    showGrowth: view.species !== 'post' && view.kind !== 'countdown',
    growth,
    growthLabel: view.species !== 'post' ? tIn(locale, 'growth.total', { n: growth }) : '',
    growthPct: growthPercent(growth, stage),
  }
}

/* ==========================================================================
   文件名
   ========================================================================== */

/** 文件名里最多留多少个标题字符 */
const SLUG_MAX = 32

/**
 * 标题 → 文件系统安全的 slug。
 * 只留 a-z 0-9，其余一律变连字符；中文/日文/emoji 这类没法转 ASCII 的，
 * 回退到 fallback（三类事的 kind 名），保证「daymark-since-12d-2026-10-25.png」这种
 * 一定读得懂、一定存得下。
 */
export function slugifyTitle(title: string, fallback = 'card'): string {
  // 去掉拉丁重音（Café → Cafe），剩下的非 ASCII 一律当分隔符
  const plain = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const chunks = plain.toLowerCase().match(/[a-z0-9]+/g) ?? []
  // 只有数字（例如「戒烟 128 天」里剩下的 128）说明标题基本不是 ASCII，也回退
  if (!chunks.some((chunk) => /[a-z]/.test(chunk))) return fallback
  const slug = chunks.join('-').slice(0, SLUG_MAX).replace(/-+$/, '')
  return slug.length > 0 ? slug : fallback
}

/** 数字段：128d / in12d / today / past3d */
export function shareNumSlug(view: ItemView): string {
  if (view.kind === 'countdown') {
    if (view.days === 0) return 'today'
    return view.days > 0 ? `in${view.days}d` : `past${-view.days}d`
  }
  if (view.kind === 'habit') return `${Math.max(0, view.growth)}d`
  return `${Math.max(0, view.days)}d`
}

/**
 * 导出的文件名：daymark-quit-128d-2026-10-25.png
 * 只用 [a-z0-9.-]，任何系统 / 分享面板都能存。
 */
export function shareFileName(view: ItemView, date: number = Date.now()): string {
  const slug = slugifyTitle(view.title, view.kind)
  return `daymark-${slug}-${shareNumSlug(view)}-${shareStamp(date)}.png`
}

/* ==========================================================================
   分享文案
   ========================================================================== */

/** 分享时带的文案，中英各一份，调用方按当前语言选 */
export function shareCaption(view: ItemView): { zh: string; en: string } {
  const n = Math.max(0, view.kind === 'habit' ? view.growth : Math.abs(view.days))
  return { zh: captionFor(view, n, 'zh'), en: captionFor(view, n, 'en') }
}

function captionFor(view: ItemView, n: number, locale: Locale): string {
  const vars: Vars = { title: view.title, n }
  if (view.kind === 'since') return shareCopy('share.caption.since', vars, locale)
  if (view.kind === 'habit') return shareCopy('share.caption.habit', vars, locale)
  if (view.days === 0) return shareCopy('share.caption.countdown.today', vars, locale)
  if (view.days < 0) return shareCopy('share.caption.countdown.past', vars, locale)
  return shareCopy('share.caption.countdown', vars, locale)
}
