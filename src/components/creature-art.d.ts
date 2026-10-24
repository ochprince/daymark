/**
 * 小伙伴与徽章的 SVG 生成器（页面里用的类型安全外壳）。
 * 具体画法在 creature-art.js —— 从 docs/prototype-v2/creatures.js 原样移植，
 * 颜色全部走 CSS 变量，换风格包不用重画。
 */

export type CreatureSpecies = 'sprout' | 'moon' | 'drop' | 'star' | 'post'
export type CreatureMood = 'idle' | 'happy' | 'sleep' | 'wow'
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
