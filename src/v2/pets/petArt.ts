/**
 * 正式素材（设计师出的 SVG）· 选择与注入。
 *
 * 素材在 src/v2/pets/svg/（43 个，viewBox 0 0 200 200），用 Vite 的
 * `import.meta.glob(..., { query: '?raw' })` 作为**原始文本**打进来 —— 必须是文本，
 * 才能内联进 DOM 吃到外层注入的 CSS 变量（--c / --c2 …），当 <img src> 引就没法换色。
 *
 * 原型的 creature() 做三件事，这里同样要做（见下方 decoratePetSvg）：
 *   1. 把 <g data-face="y,sx,small,mood"> 占位换成真表情 —— 否则蛋/宠物都是无脸；
 *   2. clipPath / 渐变 id 里的 `cb0` 换成全局唯一 —— 同页多只宠物不会互相串 clip；
 *   3. 重写根 <svg>：加 class / viewBox / width / height / aria-hidden，
 *      并且**删掉根 style 里的 --c / --c2**，让颜色从外层（hueVars）继承。
 *
 * 缺素材时回退到 art.ts 的程序生成器，永远不白屏。
 */
import { huePair, hueFromLegacyColor } from '../../lib/hue'
import {
  petSvg as fallbackPetSvg,
  type PetSpecies,
  type PetStage,
  type PetState,
} from './art'

/** 倒数日的三种手持物 */
export type PetHold = 'gift' | 'letter' | 'party'
/** 素材里还有 post 这一系（信信），Pet 组件不用，但键名要支持 */
export type PetArtSpecies = PetSpecies | 'post'
/** 表情档位：状态 + idle */
export type PetMood = PetState | 'idle'

/* ------------------------------------------------------------------ */
/* 素材表：key（文件名去扩展名）→ 原始 SVG 文本                        */
/* ------------------------------------------------------------------ */

/**
 * Vite 在构建期把 import.meta.glob 换成字面量对象；node --test 下没有这个函数，
 * 这里兜底成空表，好让纯逻辑（键名 / 注入）能在 node 里单测。
 */
function loadRaw(): Record<string, string> {
  try {
    return import.meta.glob('./svg/*.svg', {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>
  } catch {
    return {}
  }
}

const ASSETS: Record<string, string> = Object.create(null) as Record<string, string>

for (const [path, text] of Object.entries(loadRaw())) {
  const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/i, '')
  if (typeof text === 'string' && text.startsWith('<svg')) ASSETS[name] = text
}

/** 已入库的素材键（排序后稳定，方便调试 / 测试断言） */
export const PET_SVG_KEYS: readonly string[] = Object.freeze(Object.keys(ASSETS).sort())

/** 某个键有没有素材 */
export function hasPetSvg(key: string): boolean {
  return key in ASSETS
}

/* ------------------------------------------------------------------ */
/* 键名规则                                                             */
/* ------------------------------------------------------------------ */

const clampCrack = (n: number) =>
  Number.isFinite(n) ? Math.min(3, Math.max(0, Math.trunc(n))) : 0

export type PetSvgKeyInput = {
  species: PetArtSpecies
  stage: PetStage
  /** 蛋阶段揉了几下 0–3 */
  crack?: number
  /** 倒数日手持物 */
  hold?: PetHold
}

/**
 * 文件键：
 * - 蛋阶段（我们用 stage 0 表示未孵化）→ dough-<species>-<crack 0..3>
 * - post（信信）→ post-<hold>
 * - 其它 → <species>-<stage>
 */
export function petSvgKey({ species, stage, crack = 0, hold = 'letter' }: PetSvgKeyInput): string {
  if (stage === 0) return `dough-${species}-${clampCrack(crack)}`
  if (species === 'post') return `post-${hold}`
  return `${species}-${stage}`
}

/* ------------------------------------------------------------------ */
/* 表情                                                                 */
/* ------------------------------------------------------------------ */

type FaceMood = 'idle' | 'happy' | 'sleep' | 'wow'

const STATE_FACE: Record<PetMood, FaceMood> = {
  idle: 'idle',
  stand: 'idle',
  walk: 'idle',
  sit: 'idle',
  climb: 'idle',
  sleep: 'sleep',
  cheer: 'happy',
  drag: 'wow',
  fall: 'wow',
}

const asFace = (mood: string): FaceMood =>
  mood === 'happy' || mood === 'sleep' || mood === 'wow' ? mood : 'idle'

/** 状态 → 表情。物理层状态是唯一真源，实时的；底图里的 force 只当作者意图记录 */
export function faceForState(state: PetMood): FaceMood {
  return STATE_FACE[state] ?? asFace(state)
}

const faceStroke = (w: string | number = 'var(--cr-lw, 4.5)') =>
  `stroke="var(--cr-line, #2b2638)" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`

/** 表情零件；坐标与原型 creatures.js 的 face() 逐字对齐（cy 由素材占位给） */
function face(mood: FaceMood, cy: number, sx = 20, small = false): string {
  const xL = 100 - sx
  const xR = 100 + sx
  const k = small ? 0.8 : 1
  let s = ''

  if (mood === 'sleep') {
    s += `<path d="M${xL - 7 * k} ${cy} Q${xL} ${cy + 6 * k} ${xL + 7 * k} ${cy}" fill="none" ${faceStroke(4)}/>`
    s += `<path d="M${xR - 7 * k} ${cy} Q${xR} ${cy + 6 * k} ${xR + 7 * k} ${cy}" fill="none" ${faceStroke(4)}/>`
    s += `<ellipse cx="100" cy="${cy + 15}" rx="3.5" ry="4" fill="var(--cr-line, #2b2638)"/>`
  } else if (mood === 'happy') {
    const eye = (x: number) =>
      `<path d="M${x - 7.5 * k} ${cy + 3} C${x - 5 * k} ${cy - 5.5 * k} ${x + 5 * k} ${cy - 5.5 * k} ${x + 7.5 * k} ${cy + 3} C${x + 5 * k} ${cy - 1.5 * k} ${x - 5 * k} ${cy - 1.5 * k} ${x - 7.5 * k} ${cy + 3} Z" fill="var(--cr-line, #2b2638)" ${faceStroke(2)}/>`
    s += eye(xL) + eye(xR)
    const mouth = `M88 ${cy + 11} Q100 ${cy + 15} 112 ${cy + 11} C111 ${cy + 20} 106 ${cy + 25} 100 ${cy + 25} C94 ${cy + 25} 89 ${cy + 20} 88 ${cy + 11} Z`
    s += `<path d="${mouth}" fill="var(--mouth, #e5664b)"/>`
    s += `<path d="M93 ${cy + 21.5} C95 ${cy + 18.5} 105 ${cy + 18.5} 107 ${cy + 21.5} C105 ${cy + 24.5} 95 ${cy + 24.5} 93 ${cy + 21.5} Z" fill="var(--blush, #ff9c9c)"/>`
    s += `<path d="${mouth}" fill="none" ${faceStroke(3)}/>`
  } else {
    const wide = mood === 'wow'
    const ry = (wide ? 8.5 : 7.5) * k
    const rx = (wide ? 7.5 : 5.8) * k
    s += `<g class="pet-eyes"><ellipse cx="${xL}" cy="${cy}" rx="${rx}" ry="${ry}" fill="var(--cr-line, #2b2638)"/><ellipse cx="${xR}" cy="${cy}" rx="${rx}" ry="${ry}" fill="var(--cr-line, #2b2638)"/>`
    s += `<circle cx="${xL + 2}" cy="${cy - 3}" r="${2.3 * k}" fill="#fff"/><circle cx="${xR + 2}" cy="${cy - 3}" r="${2.3 * k}" fill="#fff"/></g>`
    s += wide
      ? `<ellipse cx="100" cy="${cy + 17}" rx="5" ry="6" fill="var(--mouth, #e5664b)" ${faceStroke(3)}/>`
      : `<path d="M93 ${cy + 13} Q100 ${cy + 19} 107 ${cy + 13}" fill="none" ${faceStroke(3.5)}/>`
  }

  s += `<ellipse cx="${xL - 13}" cy="${cy + 13}" rx="8" ry="4.6" fill="var(--blush, #ff9c9c)" class="pet-blush"/>`
  s += `<ellipse cx="${xR + 13}" cy="${cy + 13}" rx="8" ry="4.6" fill="var(--blush, #ff9c9c)" class="pet-blush"/>`
  return s
}

/* ------------------------------------------------------------------ */
/* 注入：换脸 / 唯一 id / 重写根标签                                    */
/* ------------------------------------------------------------------ */

const FACE_RE = /<g([^>]*?)data-face="(\d+),(\d+),(\d),(\w*)"([^>]*?)(?:\/>|>\s*<\/g>)/g
const CLIP_RE = /cb0\b/g
const ROOT_RE = /^<svg\b[^>]*>/
const STYLE_RE = /\bstyle="([^"]*)"/u
const CLASS_RE = /\bclass="([^"]*)"/u

/** 把 `cb0` / `cb0-sh` / `cb0-bl` / `cb0-mg` 一次性换成带 uid 的全局唯一前缀 */
export function uniqueClipIds(svg: string, uid: string): string {
  const safe = uid.replace(/[^A-Za-z0-9_-]/g, '') || 'p'
  return svg.replace(CLIP_RE, () => `cb${safe}`)
}

/** 根 style 里去掉 --c / --c2（颜色交给外层继承），其余变量原样保留 */
export function stripHueVars(style: string): string {
  return style
    .split(';')
    .map((part) => part.trim())
    .filter((decl) => {
      if (!decl) return false
      const colon = decl.indexOf(':')
      const name = (colon < 0 ? decl : decl.slice(0, colon)).trim()
      return name !== '--c' && name !== '--c2'
    })
    .join(';')
}

export type DecorateOptions = {
  state: PetMood
  size: number
  /** 物种 / 阶段：只为根节点上的 cr--{species} / cr--s{stage} 类名 */
  species: PetArtSpecies
  stage: PetStage
  /** clipPath / 渐变 id 的唯一后缀 */
  uid: string
  /** 只用来打 data-hue-index，方便在 devtools / e2e 里确认这只画的是哪个色相 */
  hue?: number | string
}

/**
 * 把一段原始素材文本变成可以直接 dangerouslySetInnerHTML 的 SVG：
 * 换脸 → 唯一 id → 重写根标签（class / data-state / data-mood / viewBox / 尺寸 / aria-hidden）。
 *
 * 类名：`pet-art pet-art--{mood} pet-art--s{state} cr cr--{species} cr--s{stage}`
 * —— 前两组给我们的样式与动画用，后两组跟原型对齐。
 */
export function decoratePetSvg(raw: string, opts: DecorateOptions): string {
  const state = opts.state
  const mood = faceForState(state)
  const root = raw.match(ROOT_RE)?.[0] ?? ''
  const style = stripHueVars(root.match(STYLE_RE)?.[1] ?? '')

  let svg = raw.replace(FACE_RE, (_, a: string, y: string, sx: string, small: string, _forced: string, b: string) => {
    // 状态优先：底图里的 force 是作者意图，不压实时状态
    return `<g${a}${b}>${face(mood, +y, +sx, small === '1')}</g>`
  })
  svg = uniqueClipIds(svg, opts.uid)

  const cls = [
    'pet-art',
    `pet-art--${mood}`,
    `pet-art--s${state}`,
    'cr',
    `cr--${opts.species}`,
    `cr--s${opts.stage}`,
  ]
  const attrs = [
    `class="${cls.join(' ')}"`,
    `data-state="${state}"`,
    `data-mood="${mood}"`,
    typeof opts.hue === 'number' ? `data-hue-index="${opts.hue}"` : '',
    'viewBox="0 0 200 200"',
    `width="${opts.size}"`,
    `height="${opts.size}"`,
    'aria-hidden="true"',
    'focusable="false"',
    style ? `style="${style}"` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return svg.replace(ROOT_RE, () => `<svg ${attrs}>`)
}

/* ------------------------------------------------------------------ */
/* 对外：渲染一只                                                 */
/* ------------------------------------------------------------------ */

export type RenderPetOptions = {
  species: PetArtSpecies
  stage: PetStage
  /** 视觉高度（px），脚底大约在 93% 处 */
  size?: number
  /** 旧配色索引 0–7；只落 data-hue-index，真正的 --c/--c2 由外层写 */
  hue?: number
  /** 状态；不给当 idle */
  mood?: PetMood
  /** 每个实例唯一（clipPath / 渐变 id 后缀） */
  uid: string
  crack?: number
  hold?: PetHold
}

/**
 * 一只宠物的 SVG 字符串。
 * 找不到素材时回退到 art.ts 的程序生成器（同一套 class / data-state，样式不断）。
 */
export function renderPetSvg({
  species,
  stage,
  size = 88,
  hue,
  mood = 'idle',
  uid,
  crack,
  hold,
}: RenderPetOptions): string {
  const key = petSvgKey({ species, stage, crack, hold })
  const raw = ASSETS[key]
  const state: PetMood = mood

  if (raw) {
    return decoratePetSvg(raw, { state, size, species, stage, uid, hue })
  }

  // 回退：没有素材（或 node 环境）就用程序生成器，绝不白屏
  const fallback = fallbackPetSvg({
    species: species === 'post' ? 'sprout' : species,
    stage,
    state: mood === 'idle' ? 'stand' : mood,
    size,
    uid: uid.slice(0, 24) || 'p',
  })
  return ensureFallbackClasses(fallback, { state, species, stage })
}

/** 程序生成器的根标签已经带 class，这里补 `pet-art--{mood}` / `pet-art--s{state}` 与 cr 类 */
function ensureFallbackClasses(
  svg: string,
  opts: { state: PetMood; species: PetArtSpecies; stage: PetStage },
): string {
  const root = svg.match(ROOT_RE)?.[0] ?? ''
  const classes = (root.match(CLASS_RE)?.[1] ?? 'pet-art').split(/\s+/).filter(Boolean)
  for (const extra of [
    `pet-art--${faceForState(opts.state)}`,
    `pet-art--s${opts.state}`,
    'cr',
    `cr--${opts.species}`,
    `cr--s${opts.stage}`,
  ]) {
    if (!classes.includes(extra)) classes.push(extra)
  }
  return svg.replace(ROOT_RE, (tag) => tag.replace(CLASS_RE, `class="${classes.join(' ')}"`))
}

/** 便于调试 / 测试：某只宠物会用哪个键、有没有真素材 */
export function petArtInfo(input: Omit<RenderPetOptions, 'uid' | 'size' | 'hue' | 'mood'>) {
  const key = petSvgKey(input)
  return { key, real: hasPetSvg(key) }
}

/** 色相 → 可直接摊进 style 的两个变量（Pet.tsx 也走这条，保证数值同源） */
export function petHueVars(index: number): { '--c': string; '--c2': string } {
  const pair = huePair(hueFromLegacyColor(index))
  return { '--c': pair.c, '--c2': pair.c2 }
}
