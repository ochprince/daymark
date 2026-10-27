/**
 * 风格包（皮肤令牌）。一套皮肤 = 一份令牌文件（src/skins/*.css），
 * 根节点挂 data-skin / data-accent / data-num / data-texture，组件里不允许出现
 * `if (skin === …)`——所有差异都要能用令牌或包内补丁表达。
 *
 * 落地节奏（docs/plan-v2.md 10.2、D10）：首发软糖 + 纸本，夜航与像素随后。
 */
import { clampInt, createJsonStore } from './jsonStore'

const STORAGE_KEY = 'daymark.skin.v1'

export type SkinPack = 'jelly' | 'paper' | 'night' | 'pixel'
export type NumStyle = 'auto' | 'round' | 'serif' | 'pixel' | 'hand'
export type TextureStyle = 'auto' | 'plain' | 'dots' | 'grid' | 'lines'

export type SkinState = {
  pack: SkinPack
  /** 强调色索引 0–7；'auto' 跟包走 */
  accent: number | 'auto'
  num: NumStyle
  texture: TextureStyle
  /** 跟随系统深色：深色自动用夜航，浅色用所选包 */
  followSystem: boolean
}

export const SKIN_PACKS: readonly SkinPack[] = ['jelly', 'paper', 'night', 'pixel']

export const DEFAULT_SKIN: SkinState = {
  pack: 'jelly',
  accent: 'auto',
  num: 'auto',
  texture: 'auto',
  followSystem: false,
}

const NUM_STYLES: readonly NumStyle[] = ['auto', 'round', 'serif', 'pixel', 'hand']
const TEXTURES: readonly TextureStyle[] = ['auto', 'plain', 'dots', 'grid', 'lines']

/** 解析后的值：auto 已经落到某一种具体字形 / 纹理上 */
export type ResolvedNum = Exclude<NumStyle, 'auto'>
export type ResolvedTexture = Exclude<TextureStyle, 'auto'>

/**
 * num:'auto' 的显式映射——「跟包走」到底走成哪一种。
 *
 * 取值依据 docs/prototype-v2/proto.css 里四套皮肤自己的 --font-num：
 *   软糖 / 夜航  'Baloo 2', ui-rounded  → round
 *   纸本        'Instrument Serif'       → serif
 *   像素        'Silkscreen'             → pixel
 * hand 是玩家自己挑的手写体，没有哪套皮肤默认用它。
 */
export const NUM_AUTO: Record<SkinPack, ResolvedNum> = {
  jelly: 'round',
  paper: 'serif',
  night: 'round',
  pixel: 'pixel',
}

/**
 * texture:'auto' 的显式映射，同样对着 proto.css 的 --texture：
 *   软糖  16px 圆点网格（radial-gradient 点）  → dots
 *   纸本  27/28px 横线（repeating-linear）    → lines
 *   夜航  星点（radial-gradient 点，240×220）  → dots
 *   像素  12px 双向线性渐变                    → grid
 */
export const TEXTURE_AUTO: Record<SkinPack, ResolvedTexture> = {
  jelly: 'dots',
  paper: 'lines',
  night: 'dots',
  pixel: 'grid',
}

/**
 * auto → 这一套皮肤的具体字形。显式选过的一律原样返回，不被包覆盖。
 *
 * 以前 auto 全靠 CSS 兜底（根节点写 data-num="auto"，没有规则命中，落回皮肤自带的
 * --font-num），预览、导出这些要「读到具体值」的地方就只能猜。现在有一张表。
 */
export function resolveNum(pack: SkinPack, num: NumStyle): ResolvedNum {
  return num === 'auto' ? NUM_AUTO[pack] : num
}

/** auto → 这一套皮肤的具体纹理；显式值不被覆盖 */
export function resolveTexture(pack: SkinPack, texture: TextureStyle): ResolvedTexture {
  return texture === 'auto' ? TEXTURE_AUTO[pack] : texture
}

/** 旧的主题开关（daymark.theme.v2）：system / light / dark */
export type LegacyThemeMode = 'system' | 'light' | 'dark' | null

/** 迁移：旧主题 → 新皮肤状态（夜航未上线前，深色沿用现有深色变量作过渡） */
export function migrateSkin(theme: LegacyThemeMode): SkinState {
  if (theme === 'dark') return { ...DEFAULT_SKIN, pack: 'night', followSystem: false }
  if (theme === 'system' || theme === null) return { ...DEFAULT_SKIN, followSystem: true }
  return { ...DEFAULT_SKIN, followSystem: false }
}

export function normalizeSkin(input: unknown): SkinState {
  if (typeof input !== 'object' || input === null) return { ...DEFAULT_SKIN }
  const value = input as Partial<SkinState>
  const pack = SKIN_PACKS.includes(value.pack as SkinPack) ? (value.pack as SkinPack) : DEFAULT_SKIN.pack
  const accent =
    value.accent === 'auto' || value.accent === undefined
      ? DEFAULT_SKIN.accent
      : clampInt(Number(value.accent), 0, 7)
  const num = NUM_STYLES.includes(value.num as NumStyle) ? (value.num as NumStyle) : DEFAULT_SKIN.num
  const texture = TEXTURES.includes(value.texture as TextureStyle)
    ? (value.texture as TextureStyle)
    : DEFAULT_SKIN.texture
  return {
    pack,
    accent,
    num,
    texture,
    followSystem: typeof value.followSystem === 'boolean' ? value.followSystem : DEFAULT_SKIN.followSystem,
  }
}

export const skinStore = createJsonStore<SkinState>({ key: STORAGE_KEY, normalize: normalizeSkin })

export const subscribe = skinStore.subscribe
export const getSkin = skinStore.get
export const setSkin = skinStore.set

/** 只改几项（换包、换主色），其余保持不变 */
export function patchSkin(patch: Partial<SkinState>): void {
  skinStore.patch(patch)
}
