/**
 * v3 色相系统。
 *
 * 五个色相（mint / sky / grape / lemon / coral），每个色相两级颜色：--c 与 --c2。
 * 宠物 SVG 的填充全靠这两个变量，外层元素不注入就会渲染成黑色（prototype-v3 README 118-122 行）。
 *
 * 数值逐字来自 docs/prototype-v3/proto.css 的四套皮肤令牌（[data-theme='jelly'|'paper'|'night'|'pixel']），
 * 不要在这里调色：要改配色先改原型，再把数值搬过来。
 * 静态样式用 src/skins/hue.css（同一份数值），运行时要算颜色（分享卡、canvas）用 hueVars()。
 */
import type { SkinPack } from './skin'

export const HUE_NAMES = ['mint', 'sky', 'grape', 'lemon', 'coral'] as const

export type Hue = (typeof HUE_NAMES)[number]

/** 新事项的默认色相（与原型示例一致） */
export const DEFAULT_HUE: Hue = 'mint'

/** 一个色相的两级颜色：浅的一级做大面积填充，深的一级做描边 / 文字 */
export type HuePair = { c: string; c2: string }

/** 注入到元素上的两个自定义属性 */
export type HueVars = { '--c': string; '--c2': string }

/** 皮肤顺序与 skin.ts 的 SKIN_PACKS 一致；这里只做取值表，不引运行时依赖 */
const SKIN_NAMES: readonly SkinPack[] = ['jelly', 'paper', 'night', 'pixel']

const DEFAULT_SKIN: SkinPack = 'jelly'

/**
 * 四套皮肤 × 五个色相。
 * 夜航取的是原型里专为深色底重新调亮的一组（--c 在 #1c2050 上对比度均 ≥ 5.9），
 * 不是把浅色皮肤的值直接搬过来，所以深色下不会糊。
 */
export const HUE_COLORS: Record<SkinPack, Record<Hue, HuePair>> = {
  jelly: {
    mint: { c: '#8fe3c0', c2: '#2fa77a' },
    sky: { c: '#a8d8ff', c2: '#3d8fe0' },
    grape: { c: '#cdb9ff', c2: '#7a5ae0' },
    lemon: { c: '#ffe07a', c2: '#e0a020' },
    coral: { c: '#ffb4a2', c2: '#e5664b' },
  },
  paper: {
    mint: { c: '#dbe9dc', c2: '#4f7d5c' },
    sky: { c: '#dbe5ee', c2: '#49698a' },
    grape: { c: '#e4dfec', c2: '#66588a' },
    lemon: { c: '#efe5c6', c2: '#94782b' },
    coral: { c: '#f0ddd3', c2: '#a35b46' },
  },
  night: {
    mint: { c: '#5ee6b5', c2: '#19a374' },
    sky: { c: '#72c6ff', c2: '#2a78d0' },
    grape: { c: '#ad90ff', c2: '#6a46e0' },
    lemon: { c: '#ffd862', c2: '#d19316' },
    coral: { c: '#ff9481', c2: '#d44f37' },
  },
  pixel: {
    mint: { c: '#86d38f', c2: '#2e8b57' },
    sky: { c: '#86bfe8', c2: '#2f6ea8' },
    grape: { c: '#b89ae4', c2: '#6b44a8' },
    lemon: { c: '#f5d04a', c2: '#b88a10' },
    coral: { c: '#f49a7c', c2: '#b04a2c' },
  },
}

/**
 * 旧 color 索引（0–7，PALETTE 顺序：琥珀/珊瑚/紫罗兰/靛蓝/青瓷/青柠/玫红/石墨）
 * → 最接近的色相。与 tokens.css 里 --h-0 … --h-7 的别名表一一对应：
 * 0 琥珀→lemon，1 珊瑚→coral，2 紫罗兰→grape，3 靛蓝→sky，4 青瓷→mint，
 * 5 青柠→lemon，6 玫红→coral，7 石墨→grape。
 */
const LEGACY_HUES: readonly Hue[] = ['lemon', 'coral', 'grape', 'sky', 'mint', 'lemon', 'coral', 'grape']

export function isHue(value: unknown): value is Hue {
  return typeof value === 'string' && (HUE_NAMES as readonly string[]).includes(value)
}

export function isSkinPack(value: unknown): value is SkinPack {
  return typeof value === 'string' && (SKIN_NAMES as readonly string[]).includes(value)
}

/** 把任意读到/传进来的值收成一个合法色相；认不出来就回落（默认 mint） */
export function normalizeHue(value: unknown, fallback: Hue = DEFAULT_HUE): Hue {
  if (isHue(value)) return value
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase()
    if (isHue(lowered)) return lowered
  }
  return fallback
}

/** 旧数据只有 color: number，按索引落到色相；任何数字都收得住（循环取模） */
export function hueFromLegacyColor(n: number): Hue {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_HUE
  const total = LEGACY_HUES.length
  const index = ((Math.trunc(n) % total) + total) % total
  return LEGACY_HUES[index]
}

/** 取一对颜色；色相 / 皮肤认不出来时分别回落到 mint / jelly，永远不返回空值 */
export function huePair(hue: unknown, skin: unknown = DEFAULT_SKIN): HuePair {
  const safeHue = normalizeHue(hue)
  const safeSkin = isSkinPack(skin) ? skin : DEFAULT_SKIN
  return HUE_COLORS[safeSkin][safeHue]
}

/** 运行时注入用：{ '--c': …, '--c2': … }，直接摊进 style */
export function hueVars(hue: unknown, skin: unknown = DEFAULT_SKIN): HueVars {
  const pair = huePair(hue, skin)
  return { '--c': pair.c, '--c2': pair.c2 }
}

/** 拼成 style 字符串（非 React 场景：分享卡、导出的 HTML、测试） */
export function hueStyleText(hue: unknown, skin: unknown = DEFAULT_SKIN): string {
  const pair = huePair(hue, skin)
  return `--c:${pair.c};--c2:${pair.c2}`
}
