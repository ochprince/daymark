/**
 * 小伙伴与徽章的 SVG 生成器（页面里用的类型安全外壳）。
 * 具体画法在 creature-art.js —— 从 docs/prototype-v2/creatures.js 原样移植，
 * 颜色全部走 CSS 变量，换风格包不用重画。
 */

export type CreatureSpecies = 'sprout' | 'moon' | 'drop' | 'star' | 'post'
/**
 * 表情 / 状态。前四个是页面里沿用的旧名（happy / wow 会在渲染时对到 cheer / fall），
 * 后八个是物理层（pets/art.ts 的 PET_STATES）用的状态名——卡片里那只现在也走
 * 同一套状态，所以这里必须都收进来，否则内外只能用两套。
 */
export type CreatureMood =
  | 'idle'
  | 'happy'
  | 'sleep'
  | 'wow'
  | 'stand'
  | 'walk'
  | 'sit'
  | 'fall'
  | 'climb'
  | 'drag'
  | 'cheer'
export type CreatureHold = 'letter' | 'gift' | 'party'

export type CreatureOptions = {
  species?: CreatureSpecies
  /** 0–4 是形态，'egg' 是还没孵出来的蛋 */
  stage?: 0 | 1 | 2 | 3 | 4 | 'egg'
  mood?: CreatureMood
  size?: number
  extra?: {
    pumpkin?: boolean
    /** 蛋壳裂纹 0–3 */
    crack?: number
    hold?: CreatureHold
    silhouette?: boolean
  }
}

export function creature(opts?: CreatureOptions): string
export function badge(kind: string, label: string, size?: number, locked?: boolean): string
export function star(cx: number, cy: number, r: number, inner?: number, rot?: number): string
