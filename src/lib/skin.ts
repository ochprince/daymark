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
