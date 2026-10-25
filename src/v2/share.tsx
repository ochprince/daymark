/**
 * 分享卡片的导出与分享（不引任何第三方库）。
 *
 * 为什么手绘而不是 html2canvas：那类库要序列化整页 CSS（颜色函数、令牌、字体回退），
 * 在 iOS WebView 上既慢又容易画错。分享卡只有圆角、文字、一条进度、一个内联 SVG，
 * 用 Canvas 2D 按同一套坐标重画一遍（1080×1920），结果稳定、可控，而且零依赖。
 *
 * 与屏幕上那一版的对齐约定：
 * - 尺寸、留白、字号都按「设计稿像素」写死在 layout 常量里，
 *   改 v2/ShareCard.tsx + sharecard.css 的排版时要一起改这里（两处不一致会看出来）。
 * - 颜色 / 字体 / 数字投影从真实 DOM 上解析（themeFromElement），所以换皮肤后
 *   PNG 里的配色和字体跟屏幕上一致；角色 SVG 里的 var(--c) 这类变量会先替换成
 *   具体颜色，否则 data: URL 里的 SVG 读不到页面变量。
 */
import { creature as creatureSvg } from '../components/creature-art'
import { getPhotoUrl } from '../lib/photos'
import type { Locale } from '../lib/i18n'
import { getLocale } from '../lib/i18n'
import type { ShareModel, ShareTemplate } from '../lib/sharecard'
import { SHARE_SIZE, shareCopy } from '../lib/sharecard'
import { coverCrop, ticketHoles, ticketSerial } from '../lib/sharefit'
import type { Segment } from '../lib/sharefit'
import type { SkinPack } from '../lib/skin'

/* ---------------------------------------------------------------- 布局常量 */

const W = SHARE_SIZE.width
const H = SHARE_SIZE.height
const PAD = 96
const TOP = 104
const BRAND_SIZE = 52
const DATE_SIZE = 34
const TAG_SIZE = 32
const NUM_SIZE = 280
const PHRASE_SIZE = 124
const UNIT_SIZE = 64
const TITLE_SIZE = 86
const TITLE_LINE = 1.16
const LINE_SIZE = 40
const GROWTH_SIZE = 32
const FOOT_SIZE = 30
const ART_MAX = 520
const FOOT_BOTTOM = H - PAD

/* 票根：票框内缩、两条打孔线、缺口半径 */
const T_FRAME = 40
const T_HOLE_TOP = 452
const T_HOLE_BOTTOM = 1408
const T_NOTCH = 44
const T_NUM_SIZE = 300
const T_ADMIT_SIZE = 46
const T_SERIAL_SIZE = 32

/* 相片：白字 + 压暗 */
const P_NUM_SIZE = 300

/** 卡片底色里主色占多少（与 sharecard.css 里各皮肤的 color-mix 比例一致） */
const CARD_TINT: Record<SkinPack, number> = { jelly: 0.32, paper: 0.16, night: 0.34, pixel: 0.38 }
/** 角色背后的柔光强度（纸本 / 像素是 0） */
const GLOW_ALPHA: Record<SkinPack, number> = { jelly: 0.55, paper: 0, night: 0.34, pixel: 0 }

/* ------------------------------------------------------------------ 主题 */

export type ShareShadow = { x: number; y: number; blur: number; color: string }

export type ShareTheme = {
  skin: SkinPack
  /** 解析后的具体颜色（rgb/rgba/hex），可以直接喂给 canvas */
  bg: string
  surface: string
  ink: string
  ink2: string
  ink3: string
  line: string
  /** 事项主色 --c */
  accent: string
  /** 深一档 --c2 */
  accent2: string
  numFont: string
  numWeight: string
  numStyle: string
  uiFont: string
  titleFont: string
  /** --num-shadow 解析结果；纸本这类没有投影就是 null */
  numShadow: ShareShadow | null
  /** 角色 SVG 里用到的令牌，已解析成具体值 */
  creatureVars: Record<string, string>
}

/** 角色 SVG 里会读到的令牌（data: URL 里没有 CSS，必须逐个换成字面值） */
const CREATURE_VARS = [
  '--c',
  '--c2',
  '--cr-line',
  '--leaf',
  '--petal',
  '--pistil',
  '--spark',
  '--shell',
  '--gold',
  '--band',
  '--foam',
  '--mouth',
  '--blush',
  '--gift',
  '--paper',
  '--b-ink',
  '--b-fill',
  '--b-face',
  '--b-ribbon',
  '--sil',
] as const

/**
 * 从真实 DOM 上读令牌。
 * 自定义属性里可能还是 `var(--h-1)` 或者 `color-mix(...)`，直接读 raw 值没法用，
 * 所以都塞进一个隐藏探针元素，让浏览器算完再读计算值。
 */
export function themeFromElement(host: HTMLElement): ShareTheme {
  const probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText =
    'position:absolute;left:-9999px;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none;'
  host.appendChild(probe)

  const color = (value: string): string => {
    probe.style.color = ''
    probe.style.color = value
    return getComputedStyle(probe).color || value
  }
  const family = (value: string): string => {
    probe.style.fontFamily = ''
    probe.style.fontFamily = value
    return getComputedStyle(probe).fontFamily || 'sans-serif'
  }
  const raw = (name: string, fallback: string): string => {
    const value = getComputedStyle(host).getPropertyValue(name).trim()
    return value.length > 0 ? value : fallback
  }

  // 数字投影：CSS 算完之后是「rgb(...) 0px 5px 0px 0px」，解析成 canvas 的四个参数
  const shadowRaw = (() => {
    probe.style.boxShadow = ''
    probe.style.boxShadow = raw('--num-shadow', 'none')
    return getComputedStyle(probe).boxShadow
  })()

  const creatureVars: Record<string, string> = {}
  for (const name of CREATURE_VARS) {
    creatureVars[name] = color(raw(name, '#2b2638'))
  }

  probe.remove()

  const skinAttr = host.closest('[data-skin]')?.getAttribute('data-skin') ?? document.documentElement.dataset.skin

  return {
    skin: (skinAttr === 'paper' || skinAttr === 'night' || skinAttr === 'pixel' ? skinAttr : 'jelly') as SkinPack,
    bg: color(raw('--bg', '#fff5e6')),
    surface: color(raw('--surface', '#ffffff')),
    ink: color(raw('--ink', '#2b2638')),
    ink2: color(raw('--ink2', '#5e566e')),
    ink3: color(raw('--ink3', '#9a91a8')),
    line: color(raw('--line', '#2b2638')),
    accent: color(raw('--c', '#ffb4a2')),
    accent2: color(raw('--c2', '#e5664b')),
    numFont: family(raw('--font-num', 'sans-serif')),
    numWeight: raw('--num-w', '800'),
    numStyle: raw('--num-style', 'normal'),
    uiFont: family(raw('--font-ui', 'sans-serif')),
    titleFont: family(raw('--font-title', 'sans-serif')),
    numShadow: parseShadow(shadowRaw),
    creatureVars,
  }
}

function parseShadow(value: string): ShareShadow | null {
  if (!value || value === 'none') return null
  const color = /(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})/.exec(value)?.[1]
  const nums = [...value.matchAll(/(-?[\d.]+)px/g)].map((match) => Number(match[1]))
  if (!color || nums.length < 2) return null
  return { x: nums[0], y: nums[1], blur: nums[2] ?? 0, color }
}

/* ---------------------------------------------------------------- 颜色工具 */

/** 任何 CSS 颜色（含 color-mix / oklab）→ sRGB 分量的办法：画一个像素读回来 */
function colorBytes(scratch: CanvasRenderingContext2D, css: string): [number, number, number, number] {
  scratch.clearRect(0, 0, 1, 1)
  scratch.fillStyle = '#000000'
  scratch.fillStyle = css
  scratch.fillRect(0, 0, 1, 1)
  const data = scratch.getImageData(0, 0, 1, 1).data
  return [data[0], data[1], data[2], data[3]]
}

function mixCss(scratch: CanvasRenderingContext2D, base: string, over: string, amount: number): string {
  const a = colorBytes(scratch, base)
  const b = colorBytes(scratch, over)
  const channel = (index: number) => Math.round(a[index] + (b[index] - a[index]) * amount)
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${(a[3] + (b[3] - a[3]) * amount) / 255})`
}

/* ---------------------------------------------------------------- 画布 */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

/** 中文没有空格，按字符贪心断行就够了；英文也在空格处断 */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = []
  let current = ''
  for (const char of text) {
    const next = current + char
    if (ctx.measureText(next).width > maxWidth && current.length > 0) {
      lines.push(current)
      current = char.trimStart()
      if (lines.length === maxLines) break
    } else {
      current = next
    }
  }
  if (lines.length < maxLines && current.length > 0) lines.push(current)

  if (lines.length === maxLines) {
    // 还有没画完的字：最后一行用省略号收尾
    const consumed = lines.join('').length
    if (consumed < text.trim().length) {
      let last = lines[maxLines - 1]
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
      lines[maxLines - 1] = `${last.replace(/\s+$/, '')}…`
    }
  }
  return lines
}

function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: 'left' | 'right' | 'center',
): void {
  const chars = [...text]
  const width = chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) + spacing * (chars.length - 1)
  let cursor = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x
  for (const char of chars) {
    ctx.fillText(char, cursor, y)
    cursor += ctx.measureText(char).width + spacing
  }
}

function svgDataUrl(svg: string): string {
  const withNs = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
  const bytes = new TextEncoder().encode(withNs)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:image/svg+xml;base64,${btoa(binary)}`
}

/** 把角色 SVG 里的 var(--x) 换成具体值（带兜底值优先用兜底值） */
function inlineVars(svg: string, vars: Record<string, string>): string {
  return svg.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]*))?\)/g, (_match, name: string, fallback?: string) => {
    return vars[name] ?? fallback?.trim() ?? vars['--cr-line'] ?? '#2b2638'
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'sync'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('share card image failed to load'))
    image.src = src
  })
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob returned null'))
    }, 'image/png')
  })
}

function font(size: number, family: string, weight = '700', style = 'normal'): string {
  return `${style} ${weight} ${size}px ${family}`
}

/**
 * 贴纸卡（默认模板）：角色 + 标签 + 超大数字 + 标题 + 成长条。
 * 与 sharecard.css 的 .share-card 一一对应，坐标是设计稿像素。
 */
async function drawSticker(
  ctx: CanvasRenderingContext2D,
  scratch: CanvasRenderingContext2D,
  model: ShareModel,
  theme: ShareTheme,
): Promise<void> {
  const tint = CARD_TINT[theme.skin] ?? 0.32
  const cardBg = mixCss(scratch, theme.surface, theme.accent, tint)

  // 底色：夜航是上深下浅的渐变，其余是平的
  ctx.fillStyle = cardBg
  ctx.fillRect(0, 0, W, H)
  if (theme.skin === 'night') {
    const gradient = ctx.createLinearGradient(0, 0, 0, H * 0.74)
    gradient.addColorStop(0, cardBg)
    gradient.addColorStop(1, theme.surface)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, W, H)
  }

  // 角色背后的柔光
  const glow = GLOW_ALPHA[theme.skin] ?? 0
  if (glow > 0) {
    const glowColor = theme.skin === 'night' ? theme.accent : '#ffffff'
    const radius = H * 0.46
    const gradient = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, radius)
    const [r, g, b] = colorBytes(scratch, glowColor)
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glow})`)
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, W, H)
  }

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // 顶栏：品牌 + 今天日期
  ctx.fillStyle = theme.ink
  ctx.font = font(BRAND_SIZE, theme.titleFont, '800')
  tracked(ctx, 'DAYMARK', PAD, TOP + BRAND_SIZE, BRAND_SIZE * 0.26, 'left')

  ctx.font = font(DATE_SIZE, theme.uiFont, '700')
  ctx.fillStyle = theme.ink3
  // 右对齐，否则从 W-PAD 往右写会把日期顶出画布（之前就是这样被裁掉的）
  ctx.textAlign = 'right'
  ctx.fillText(model.dateText, W - PAD, TOP + BRAND_SIZE - (BRAND_SIZE - DATE_SIZE) * 0.32)
  ctx.textAlign = 'left'

  const topEdge = TOP + BRAND_SIZE + 34

  // 从下往上排：脚注 → 成长条 → 小字 → 标题 → 大数字 → 类型标签
  ctx.font = font(FOOT_SIZE, theme.uiFont, '700')
  ctx.fillStyle = theme.ink3
  ctx.textAlign = 'center'
  tracked(ctx, model.footer, W / 2, FOOT_BOTTOM, FOOT_SIZE * 0.1, 'center')

  let cursor = FOOT_BOTTOM - FOOT_SIZE - 46

  if (model.showGrowth) {
    const trackY = cursor - 22
    ctx.font = font(GROWTH_SIZE, theme.uiFont, '700')
    const labelBaseline = trackY - 16
    ctx.textAlign = 'left'
    ctx.fillStyle = theme.ink2
    ctx.fillText(model.growthLabel, PAD, labelBaseline)
    ctx.textAlign = 'right'
    ctx.font = font(40, theme.numFont, theme.numWeight, theme.numStyle)
    ctx.fillStyle = theme.ink
    ctx.fillText(`${model.growthPct}%`, W - PAD, labelBaseline)

    ctx.fillStyle = mixCss(scratch, 'rgba(0, 0, 0, 0)', theme.ink, 0.12)
    roundRect(ctx, PAD, trackY, W - PAD * 2, 22, theme.skin === 'pixel' ? 0 : 999)
    ctx.fill()
    const filled = Math.max(0, Math.min(100, model.growthPct)) / 100
    if (filled > 0) {
      ctx.fillStyle = theme.accent2
      roundRect(ctx, PAD, trackY, Math.max(22, (W - PAD * 2) * filled), 22, theme.skin === 'pixel' ? 0 : 999)
      ctx.fill()
    }
    cursor = trackY - 44
  }

  // 小字：开始日期 / 目标日
  ctx.textAlign = 'center'
  ctx.font = font(LINE_SIZE, theme.uiFont, '600')
  ctx.fillStyle = theme.ink2
  const lineBaseline = cursor
  ctx.fillText(model.subtitle, W / 2, lineBaseline)
  cursor = lineBaseline - LINE_SIZE * 1.4 - 22

  // 标题（最多两行）
  ctx.font = font(TITLE_SIZE, theme.titleFont, '800')
  ctx.fillStyle = theme.ink
  const titleLines = wrapLines(ctx, model.title, W - PAD * 2, 2)
  const titleStep = TITLE_SIZE * TITLE_LINE
  // cursor 是最后一行（最靠下那行）的基线；第一行要再往上挪
  const lastTitleBaseline = cursor
  const firstTitleBaseline = lastTitleBaseline - (titleLines.length - 1) * titleStep
  titleLines.forEach((line, index) => {
    ctx.fillText(line, W / 2, firstTitleBaseline + index * titleStep)
  })
  // 标题字形往上长，基线到字顶大约 0.78 个字号
  const titleInkTop = firstTitleBaseline - TITLE_SIZE * 0.78
  cursor = titleInkTop - 48

  // 大数字
  const numFont = font(model.isPhrase ? PHRASE_SIZE : NUM_SIZE, theme.numFont, theme.numWeight, theme.numStyle)
  const unitFont = font(UNIT_SIZE, theme.uiFont, '700')
  ctx.font = numFont
  const numberWidth = ctx.measureText(model.number).width
  ctx.font = unitFont
  const leadWidth = model.lead ? ctx.measureText(model.lead).width : 0
  const unitWidth = model.unit ? ctx.measureText(model.unit).width : 0
  const gap = 22
  const total =
    leadWidth + unitWidth + numberWidth + (model.lead ? gap : 0) + (model.unit ? gap : 0)
  const numSize = model.isPhrase ? PHRASE_SIZE : NUM_SIZE
  const numBaseline = cursor - numSize * 0.08

  let x = W / 2 - total / 2
  ctx.textAlign = 'left'
  if (model.lead) {
    ctx.font = unitFont
    ctx.fillStyle = theme.ink2
    ctx.fillText(model.lead, x, numBaseline)
    x += leadWidth + gap
  }

  ctx.save()
  if (theme.numShadow) {
    ctx.shadowColor = theme.numShadow.color
    ctx.shadowOffsetX = theme.numShadow.x
    ctx.shadowOffsetY = theme.numShadow.y
    ctx.shadowBlur = theme.numShadow.blur
  }
  ctx.font = numFont
  ctx.fillStyle = theme.ink
  ctx.fillText(model.number, x, numBaseline)
  ctx.restore()
  x += numberWidth
  if (model.unit) {
    ctx.font = unitFont
    ctx.fillStyle = theme.ink2
    ctx.fillText(model.unit, x + gap, numBaseline)
  }

  const numTop = numBaseline - numSize * 0.78
  cursor = numTop - 34

  // 类型标签
  ctx.font = font(TAG_SIZE, theme.uiFont, '700')
  const tagText = model.kindLabel
  const tagTextWidth = ctx.measureText(tagText).width
  const tagPadX = 30
  const tagHeight = TAG_SIZE * 1.2 + 20
  const tagWidth = tagTextWidth + tagPadX * 2
  const tagY = cursor - tagHeight
  const tagRadius = theme.skin === 'pixel' ? 0 : tagHeight / 2
  roundRect(ctx, W / 2 - tagWidth / 2, tagY, tagWidth, tagHeight, tagRadius)
  // 纸本用淡描边，其余按令牌描边
  ctx.fillStyle = theme.surface
  ctx.fill()
  ctx.lineWidth = theme.skin === 'paper' ? 2 : 3
  ctx.strokeStyle = theme.skin === 'paper' ? mixCss(scratch, 'rgba(0, 0, 0, 0)', theme.ink, 0.1) : theme.line
  ctx.stroke()
  ctx.fillStyle = theme.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(tagText, W / 2, tagY + tagHeight / 2 + 1)
  ctx.textBaseline = 'alphabetic'

  // 角色：占据标签上方到顶栏之间的空地
  const artTop = topEdge
  const artBottom = tagY - 28
  const artBox = Math.max(160, artBottom - artTop)
  const artSize = Math.min(ART_MAX, artBox - 24, W - PAD * 2)
  const artSvg = inlineVars(
    creatureSvg({
      species: model.species,
      stage: model.stage,
      mood: model.mood,
      size: artSize,
    }),
    theme.creatureVars,
  )
  const image = await loadImage(svgDataUrl(artSvg))
  ctx.drawImage(image, W / 2 - artSize / 2, artTop + (artBox - artSize) / 2, artSize, artSize)
}

/* ------------------------------------------------------------ 模板零件 */

/** 卡片底色（各皮肤主色占比跟 sharecard.css 的 color-mix 一致） */
function cardBackground(scratch: CanvasRenderingContext2D, theme: ShareTheme): string {
  return mixCss(scratch, theme.surface, theme.accent, CARD_TINT[theme.skin] ?? 0.32)
}

/** 数字太长就按 8px 一档缩字号，保证不顶出左右留白 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  weight: string,
  style: string,
  start: number,
  maxWidth: number,
  min = 120,
): number {
  let size = start
  while (size > min) {
    ctx.font = font(size, family, weight, style)
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 8
  }
  return Math.max(min, size)
}

/** 一段段画虚线（不用 setLineDash：相位一致、也不会画到缺口里） */
function strokeSegments(
  ctx: CanvasRenderingContext2D,
  segments: readonly Segment[],
  color: string,
  width: number,
): void {
  if (segments.length === 0) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  for (const segment of segments) {
    ctx.moveTo(segment.x1, segment.y1)
    ctx.lineTo(segment.x2, segment.y2)
  }
  ctx.stroke()
}

/**
 * 数字 + 前后小字，整体居中。返回实际用的字号（调用方按字形高度排版要用）。
 * 与贴纸卡同一套口径：lead / unit 用 UI 字体，数字用皮肤的 num 令牌与投影。
 */
function paintNumber(
  ctx: CanvasRenderingContext2D,
  model: ShareModel,
  theme: ShareTheme,
  opts: {
    size: number
    phraseSize: number
    unitSize: number
    baseline: number
    ink: string
    sub: string
    shadow: ShareShadow | null
    maxWidth: number
  },
): number {
  const size = fitFontSize(
    ctx,
    model.number,
    theme.numFont,
    theme.numWeight,
    theme.numStyle,
    model.isPhrase ? opts.phraseSize : opts.size,
    opts.maxWidth,
    120,
  )
  const numFont = font(size, theme.numFont, theme.numWeight, theme.numStyle)
  const unitFont = font(opts.unitSize, theme.uiFont, '700')
  ctx.font = numFont
  const numberWidth = ctx.measureText(model.number).width
  ctx.font = unitFont
  const leadWidth = model.lead ? ctx.measureText(model.lead).width : 0
  const unitWidth = model.unit ? ctx.measureText(model.unit).width : 0
  const gap = 22
  const total = leadWidth + unitWidth + numberWidth + (model.lead ? gap : 0) + (model.unit ? gap : 0)
  let x = W / 2 - total / 2
  ctx.textAlign = 'left'
  if (model.lead) {
    ctx.font = unitFont
    ctx.fillStyle = opts.sub
    ctx.fillText(model.lead, x, opts.baseline)
    x += leadWidth + gap
  }

  ctx.save()
  if (opts.shadow) {
    ctx.shadowColor = opts.shadow.color
    ctx.shadowOffsetX = opts.shadow.x
    ctx.shadowOffsetY = opts.shadow.y
    ctx.shadowBlur = opts.shadow.blur
  }
  ctx.font = numFont
  ctx.fillStyle = opts.ink
  ctx.fillText(model.number, x, opts.baseline)
  ctx.restore()
  x += numberWidth
  if (model.unit) {
    ctx.font = unitFont
    ctx.fillStyle = opts.sub
    ctx.fillText(model.unit, x + gap, opts.baseline)
  }
  return size
}

/* ---------------------------------------------------------------- 票根 */

/**
 * 票根：整张是「一张撕下来的入场券」。
 * 页面底色上放一个圆角票框，上下各一道打孔线（缺口之间是虚线，两端挖半圆），
 * 顶条写 ADMIT ONE / 入场券 + 类型，中间是超大天数，底条写票面日期与序列号。
 * 序列号来自 sharefit.ticketSerial(标题 slug + 今天)，稳定不随机。
 */
function drawTicket(
  ctx: CanvasRenderingContext2D,
  scratch: CanvasRenderingContext2D,
  model: ShareModel,
  theme: ShareTheme,
  locale: Locale,
): void {
  // 页面底色（缺口露出来的就是它）
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, W, H)

  const boxX = T_FRAME
  const boxY = T_FRAME
  const boxW = W - T_FRAME * 2
  const boxH = H - T_FRAME * 2
  const radius = 48

  // 票面
  ctx.fillStyle = cardBackground(scratch, theme)
  roundRect(ctx, boxX, boxY, boxW, boxH, radius)
  ctx.fill()

  // 顶条压一层主色，票根才不像白纸
  const [ar, ag, ab] = colorBytes(scratch, theme.accent)
  const wash = ctx.createLinearGradient(0, boxY, 0, T_HOLE_TOP)
  wash.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, 0.26)`)
  wash.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0)`)
  ctx.fillStyle = wash
  roundRect(ctx, boxX, boxY, boxW, boxH, radius)
  ctx.fill()

  // 票框线
  ctx.lineWidth = 4
  ctx.strokeStyle = theme.line
  roundRect(ctx, boxX, boxY, boxW, boxH, radius)
  ctx.stroke()

  // 打孔线 + 两侧半圆缺口
  const holes = ticketHoles(
    { width: W, height: H },
    [T_HOLE_TOP, T_HOLE_BOTTOM],
    { inset: T_FRAME, notchRadius: T_NOTCH, dash: 22, gap: 18 },
  )
  const dashColor = mixCss(scratch, 'rgba(0, 0, 0, 0)', theme.ink, 0.4)
  for (const hole of holes) {
    strokeSegments(ctx, hole.segments, dashColor, 4)
    for (const notch of hole.notches) {
      // 缺口：先用页面底色挖掉，再描一道缺口边
      ctx.beginPath()
      ctx.moveTo(notch.points[0].x, notch.points[0].y)
      for (const point of notch.points.slice(1)) ctx.lineTo(point.x, point.y)
      ctx.closePath()
      ctx.fillStyle = theme.bg
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(notch.points[0].x, notch.points[0].y)
      for (const point of notch.points.slice(1)) ctx.lineTo(point.x, point.y)
      ctx.lineWidth = 4
      ctx.strokeStyle = theme.line
      ctx.stroke()
    }
  }

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // 顶条：品牌 + 今天
  ctx.fillStyle = theme.ink
  ctx.font = font(BRAND_SIZE, theme.titleFont, '800')
  tracked(ctx, 'DAYMARK', PAD, T_FRAME + 112, BRAND_SIZE * 0.26, 'left')
  ctx.font = font(DATE_SIZE, theme.uiFont, '700')
  ctx.fillStyle = theme.ink3
  ctx.textAlign = 'right'
  ctx.fillText(model.dateText, W - PAD, T_FRAME + 112 - (BRAND_SIZE - DATE_SIZE) * 0.32)
  ctx.textAlign = 'left'

  // ADMIT ONE / 入场券
  ctx.font = font(T_ADMIT_SIZE, theme.uiFont, '800')
  ctx.fillStyle = theme.accent2
  tracked(ctx, shareCopy('share.tpl.admit', undefined, locale), W / 2, T_HOLE_TOP - 132, T_ADMIT_SIZE * 0.3, 'center')
  ctx.font = font(TAG_SIZE, theme.uiFont, '700')
  ctx.fillStyle = theme.ink3
  tracked(ctx, model.kindLabel, W / 2, T_HOLE_TOP - 60, TAG_SIZE * 0.16, 'center')

  // 中间：超大天数 + 标题 + 小字，整块在两条打孔线之间竖直居中
  const numSize = model.isPhrase
    ? fitFontSize(ctx, model.number, theme.numFont, theme.numWeight, theme.numStyle, PHRASE_SIZE, W - PAD * 2 - 40)
    : fitFontSize(ctx, model.number, theme.numFont, theme.numWeight, theme.numStyle, T_NUM_SIZE, W - PAD * 2 - 40)
  const numH = numSize * 0.78

  ctx.font = font(TITLE_SIZE, theme.titleFont, '800')
  const titleLines = wrapLines(ctx, model.title, W - PAD * 2, 2)
  const titleStep = TITLE_SIZE * TITLE_LINE
  const titleH = TITLE_SIZE * 0.78 + (titleLines.length - 1) * titleStep

  const subSize = fitFontSize(ctx, model.subtitle, theme.uiFont, '600', 'normal', LINE_SIZE, W - PAD * 2, 24)
  const subH = subSize * 0.78
  const gapNumTitle = 56
  const gapTitleSub = 34

  // 中间那块内容竖直居中：band 中心 = 打孔线中点 930，与 DOM 版 tpl-ticket 一致
  const bandTop = T_HOLE_TOP + 56
  const bandBottom = T_HOLE_BOTTOM - 56
  const stackH = numH + gapNumTitle + titleH + gapTitleSub + subH
  const stackTop = bandTop + Math.max(0, (bandBottom - bandTop - stackH) / 2)

  const numBaseline = stackTop + numH
  paintNumber(ctx, model, theme, {
    size: T_NUM_SIZE,
    phraseSize: PHRASE_SIZE,
    unitSize: 56,
    baseline: numBaseline,
    ink: theme.ink,
    sub: theme.ink2,
    shadow: theme.numShadow,
    maxWidth: W - PAD * 2 - 40,
  })

  const firstTitleBaseline = numBaseline + gapNumTitle + TITLE_SIZE * 0.78
  ctx.font = font(TITLE_SIZE, theme.titleFont, '800')
  ctx.fillStyle = theme.ink
  ctx.textAlign = 'center'
  titleLines.forEach((line, index) => {
    ctx.fillText(line, W / 2, firstTitleBaseline + index * titleStep)
  })

  const lastTitleBaseline = firstTitleBaseline + (titleLines.length - 1) * titleStep
  ctx.font = font(subSize, theme.uiFont, '600')
  ctx.fillStyle = theme.ink2
  ctx.fillText(model.subtitle, W / 2, lastTitleBaseline + gapTitleSub + subSize * 0.78)

  // 底条：票面日期（左）+ 序列号（右）+ 品牌（中）
  const stampBaseline = T_HOLE_BOTTOM + T_NOTCH + 132
  ctx.font = font(T_SERIAL_SIZE, theme.uiFont, '700')
  ctx.fillStyle = theme.ink3
  ctx.textAlign = 'left'
  tracked(ctx, model.stamp, PAD, stampBaseline, T_SERIAL_SIZE * 0.16, 'left')
  ctx.textAlign = 'right'
  ctx.fillStyle = theme.ink2
  tracked(
    ctx,
    `NO. ${ticketSerial(`${model.slug}|${model.key}`, model.stamp)}`,
    W - PAD,
    stampBaseline,
    T_SERIAL_SIZE * 0.16,
    'right',
  )
  // 序列号下面的短虚线，票根的收尾
  const ruleY = stampBaseline + 52
  strokeSegments(
    ctx,
    [
      { x1: PAD, y1: ruleY, x2: PAD + 160, y2: ruleY },
      { x1: W - PAD - 160, y1: ruleY, x2: W - PAD, y2: ruleY },
    ],
    dashColor,
    3,
  )

  ctx.textAlign = 'center'
  ctx.font = font(FOOT_SIZE, theme.uiFont, '700')
  ctx.fillStyle = theme.ink3
  tracked(ctx, model.footer, W / 2, FOOT_BOTTOM, FOOT_SIZE * 0.1, 'center')
}

/* ---------------------------------------------------------------- 相片 */

/**
 * 相片：这件事的相片按 cover 铺满整张画布，叠一层「上淡下浓」的压暗渐变，
 * 文字一律白色 —— 不管皮肤是纸本还是夜航，压在照片上都读得清。
 * 没有相片时上游会退回贴纸，这里只处理「确实拿到图」的情况。
 */
function drawPhoto(
  ctx: CanvasRenderingContext2D,
  model: ShareModel,
  theme: ShareTheme,
  image: HTMLImageElement,
): void {
  ctx.fillStyle = '#0b0912'
  ctx.fillRect(0, 0, W, H)

  const crop = coverCrop(
    { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height },
    { width: W, height: H },
  )
  if (crop) ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, W, H)

  // 压暗：整体一层薄 + 顶部一层（品牌）+ 底部厚一层（数字与标题）
  ctx.fillStyle = 'rgba(9, 7, 16, 0.26)'
  ctx.fillRect(0, 0, W, H)

  const topScrim = ctx.createLinearGradient(0, 0, 0, H * 0.3)
  topScrim.addColorStop(0, 'rgba(9, 7, 16, 0.62)')
  topScrim.addColorStop(1, 'rgba(9, 7, 16, 0)')
  ctx.fillStyle = topScrim
  ctx.fillRect(0, 0, W, H * 0.3)

  const bottomScrim = ctx.createLinearGradient(0, H * 0.3, 0, H)
  bottomScrim.addColorStop(0, 'rgba(9, 7, 16, 0)')
  bottomScrim.addColorStop(0.45, 'rgba(9, 7, 16, 0.5)')
  bottomScrim.addColorStop(0.78, 'rgba(9, 7, 16, 0.84)')
  bottomScrim.addColorStop(1, 'rgba(9, 7, 16, 0.96)')
  ctx.fillStyle = bottomScrim
  ctx.fillRect(0, H * 0.3, W, H * 0.7)

  const white = '#ffffff'
  const soft = 'rgba(255, 255, 255, 0.84)'
  const faint = 'rgba(255, 255, 255, 0.6)'

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // 顶栏
  ctx.fillStyle = white
  ctx.font = font(BRAND_SIZE, theme.titleFont, '800')
  tracked(ctx, 'DAYMARK', PAD, TOP + BRAND_SIZE, BRAND_SIZE * 0.26, 'left')
  ctx.font = font(DATE_SIZE, theme.uiFont, '700')
  ctx.fillStyle = soft
  ctx.textAlign = 'right'
  ctx.fillText(model.dateText, W - PAD, TOP + BRAND_SIZE - (BRAND_SIZE - DATE_SIZE) * 0.32)
  ctx.textAlign = 'left'

  // 底部：脚注 → 小字 → 标题 → 数字 → 类型（从下往上排）
  ctx.font = font(FOOT_SIZE, theme.uiFont, '700')
  ctx.fillStyle = faint
  ctx.textAlign = 'center'
  tracked(ctx, model.footer, W / 2, FOOT_BOTTOM, FOOT_SIZE * 0.1, 'center')

  let cursor = FOOT_BOTTOM - FOOT_SIZE - 48

  const subSize = fitFontSize(ctx, model.subtitle, theme.uiFont, '600', 'normal', LINE_SIZE, W - PAD * 2, 24)
  const subBaseline = cursor
  ctx.font = font(subSize, theme.uiFont, '600')
  ctx.fillStyle = soft
  ctx.fillText(model.subtitle, W / 2, subBaseline)
  cursor = subBaseline - subSize * 0.78 - 34

  ctx.font = font(TITLE_SIZE, theme.titleFont, '800')
  ctx.fillStyle = white
  const titleLines = wrapLines(ctx, model.title, W - PAD * 2, 2)
  const titleStep = TITLE_SIZE * TITLE_LINE
  const lastTitleBaseline = cursor
  const firstTitleBaseline = lastTitleBaseline - (titleLines.length - 1) * titleStep
  titleLines.forEach((line, index) => {
    ctx.fillText(line, W / 2, firstTitleBaseline + index * titleStep)
  })
  const titleInkTop = firstTitleBaseline - TITLE_SIZE * 0.78
  cursor = titleInkTop - 56

  // 白字在照片上没有底色托着，给数字一点黑影
  const numBaseline = cursor - P_NUM_SIZE * 0.08
  const numSize = paintNumber(ctx, model, theme, {
    size: P_NUM_SIZE,
    phraseSize: PHRASE_SIZE,
    unitSize: 56,
    baseline: numBaseline,
    ink: white,
    sub: soft,
    shadow: { x: 0, y: 6, blur: 26, color: 'rgba(0, 0, 0, 0.5)' },
    maxWidth: W - PAD * 2 - 40,
  })
  // 数字带 26px 投影，留 72 才不会被看成压在类型标签上
  cursor = numBaseline - numSize * 0.78 - 72

  // 类型：小小的白字，压在数字上面
  ctx.font = font(TAG_SIZE, theme.uiFont, '700')
  ctx.fillStyle = faint
  tracked(ctx, model.kindLabel, W / 2, cursor, TAG_SIZE * 0.16, 'center')
}

/* ------------------------------------------------------------ 模板分发 */

/** 导出结果：除了 PNG，还要告诉调用方「你到底拿到的是哪套模板」 */
export type ShareRender = {
  blob: Blob
  /** 实际画出来的模板 */
  template: ShareTemplate
  /** 调用方请求的模板 */
  requested: ShareTemplate
  /** 请求了相片但没有相片，已退回贴纸 */
  fellBack: boolean
}

export type ShareRenderOptions = {
  /** 「入场券 / ADMIT ONE」这类票面小字用哪种语言，默认当前语言 */
  locale?: Locale
}

/** 相片 id → 解码好的图片；库里没有 / 解码失败都返回 null，不抛异常 */
async function loadPhoto(photoId: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!photoId) return null
  try {
    const url = await getPhotoUrl(photoId)
    if (!url) return null
    return await loadImage(url)
  } catch {
    return null
  }
}

/**
 * 把分享卡画成 1080×1920 的 PNG。
 * theme 从 themeFromElement() 拿；这里不读 document 上的任何尺寸，跟 DPR 无关。
 *
 * template：
 * - 'sticker' 贴纸（默认，原来的样子）
 * - 'ticket'  票根（打孔线 + 缺口 + ADMIT ONE + 序列号）
 * - 'photo'   相片铺满 + 压暗 + 白字；没有相片时自动退回贴纸，并在返回值里标 fellBack
 */
export async function renderSharePng(
  model: ShareModel,
  theme: ShareTheme,
  template: ShareTemplate = 'sticker',
  options: ShareRenderOptions = {},
): Promise<ShareRender> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* 字体没加载完也照画，走系统回退 */
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  const scratchCanvas = document.createElement('canvas')
  scratchCanvas.width = 1
  scratchCanvas.height = 1
  const scratch = scratchCanvas.getContext('2d', { willReadFrequently: true })
  if (!scratch) throw new Error('canvas 2d context unavailable')

  const photo = template === 'photo' ? await loadPhoto(model.photoId) : null
  const used: ShareTemplate = template === 'photo' && !photo ? 'sticker' : template

  if (used === 'ticket') {
    drawTicket(ctx, scratch, model, theme, options.locale ?? getLocale())
  } else if (used === 'photo' && photo) {
    drawPhoto(ctx, model, theme, photo)
  } else {
    await drawSticker(ctx, scratch, model, theme)
  }

  const blob = await toBlob(canvas)
  return { blob, template: used, requested: template, fellBack: used !== template }
}

/* ------------------------------------------------------------------ 落地 */

/** 存成文件：iOS Safari 会走下载面板 / 相册，桌面浏览器直接落到下载目录 */
export function downloadPng(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Safari 里立刻 revoke 会让下载断掉，留几秒
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

type ShareNavigator = Navigator & {
  canShare?: (data?: ShareData) => boolean
  share?: (data?: ShareData) => Promise<void>
}

/** 这个浏览器能不能直接把图片塞进系统分享面板 */
export function canShareImage(file: File): boolean {
  const nav = navigator as ShareNavigator
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false
  try {
    return nav.canShare({ files: [file] })
  } catch {
    return false
  }
}

export type ShareOutcome = 'shared' | 'dismissed' | 'downloaded' | 'failed'

/**
 * 先试系统分享（Web Share Level 2，带文件），不行就退回下载。
 * 调用方拿到 'downloaded' 且没有 share 能力时，给一句「长按预览或点保存」的提示。
 */
export async function shareCardPng(
  blob: Blob,
  fileName: string,
  caption: string,
): Promise<ShareOutcome> {
  const file = new File([blob], fileName, { type: 'image/png' })
  const nav = navigator as ShareNavigator

  if (canShareImage(file) && nav.share) {
    try {
      await nav.share({ files: [file], title: 'Daymark', text: caption })
      return 'shared'
    } catch (error) {
      const name = (error as { name?: string } | null)?.name
      // 用户主动取消不算失败，也不要再弹下载
      if (name === 'AbortError') return 'dismissed'
      if (name === 'NotAllowedError') return 'dismissed'
      // 其它错误（例如系统面板不支持）退回下载
    }
  }

  try {
    downloadPng(blob, fileName)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}
