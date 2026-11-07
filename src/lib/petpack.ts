/**
 * 读 Shimeji 宠物包的动作表。只认格式（英文 / 日文标签），不跑 Shimeji-ee 的行为脚本。
 * 桌宠怎么走、怎么跳，仍是正式版自己的物理层。
 */

export const PACK_STATES = [
  'stand',
  'walk',
  'run',
  'sit',
  'look',
  'sleep',
  'fall',
  'jump',
  'drag',
  'climb',
  'cling',
  'bounce',
  'dangle',
  'spin',
  'dance',
  'hug',
] as const

export type PackState = (typeof PACK_STATES)[number]

export type PackFrame = { img: string; durMs: number }

export type PackFacing = 'left' | 'right'

export type PackSpec = {
  states: Partial<Record<PackState, PackFrame[]>>
  /** 原画朝哪边。Shimeji 默认朝左，不翻转时就该往左走。 */
  facing: PackFacing
  /** 动作表里真正写了的状态。默认编号补出来的不算，避免没写动作也乱播。 */
  authored: PackState[]
}

const TICK_MS = 40

const DEFAULT_FRAMES: Partial<Record<PackState, readonly (readonly [number, number])[]>> = {
  stand: [[1, 250]],
  walk: [[1, 6], [2, 6], [1, 6], [3, 6]],
  run: [[1, 2], [2, 2], [1, 2], [3, 2]],
  sit: [[11, 250]],
  look: [[26, 250]],
  sleep: [[21, 250]],
  fall: [[4, 250]],
  jump: [[22, 250]],
  drag: [[5, 5], [6, 5]],
  climb: [[14, 4], [12, 4], [13, 4]],
  cling: [[13, 250]],
  bounce: [[18, 4], [19, 4]],
  dangle: [[30, 8], [31, 6], [32, 6], [31, 6], [33, 6], [31, 6]],
  spin: [[26, 4], [15, 4], [27, 4], [16, 4], [28, 4], [17, 4], [29, 4], [11, 6]],
}

const ACTION_MAP: Record<PackState, readonly string[]> = {
  stand: ['Stand', '立つ'],
  walk: ['Walk', '歩く'],
  run: ['Run', 'Dash', '走る', '猛ダッシュ'],
  sit: ['Sit', '座る'],
  look: ['SitAndLookUp', '座って見上げる'],
  sleep: ['Sprawl', 'LieDown', '寝そべる'],
  fall: ['Falling', 'Fall', '落ちる', '落下する'],
  jump: ['Jumping', 'ジャンプ'],
  drag: ['Resisting', 'Pinched', 'Dragged', '抵抗する', 'つままれる', 'ドラッグされる'],
  climb: ['ClimbWall', '壁を登る'],
  cling: ['GrabWall', 'HoldOntoWall', '壁に掴まる'],
  bounce: ['Bouncing', '跳ねる'],
  dangle: ['SitWhileDanglingLegs', 'SitAndDangleLegs', '足をぶらぶらさせる', '座って足をぶらぶらさせる'],
  spin: ['SitAndSpinHead', 'SitAndSpinHeadAction', '座って首が回る'],
  dance: ['Dance', 'Dancing', 'AnimationDancing', '踊る', 'ダンス'],
  hug: ['HuggingSolid', 'HuggedSolid', 'Hugging', '抱きしめる', '抱きつく', 'ハグ'],
}

const ACTION_TAGS = new Set(['Action', '動作'])
const ANIMATION_TAGS = new Set(['Animation', 'アニメーション'])
const POSE_TAGS = new Set(['Pose', 'ポーズ'])
const REFERENCE_TAGS = new Set(['ActionReference', '動作参照'])

type XmlNode = { name: string; attrs: Record<string, string>; children: XmlNode[] }

function localName(raw: string): string {
  const cut = raw.lastIndexOf(':')
  return cut >= 0 ? raw.slice(cut + 1) : raw
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    attrs[localName(match[1])] = match[2] ?? match[3] ?? ''
  }
  return attrs
}

/** 够用的动作表解析：元素、属性、自闭合。注释和声明丢掉。 */
function parseXml(xml: string): XmlNode | null {
  const source = xml.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '')
  const root: XmlNode = { name: '#root', attrs: {}, children: [] }
  const stack: XmlNode[] = [root]
  const re = /<\/?([^\s>\/]+)([^>]*?)\/?>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    const full = match[0]
    const name = localName(match[1])
    if (full.startsWith('</')) {
      const top = stack[stack.length - 1]
      if (top && top.name === name && stack.length > 1) stack.pop()
      continue
    }
    const node: XmlNode = { name, attrs: parseAttrs(match[2] || ''), children: [] }
    stack[stack.length - 1].children.push(node)
    if (!full.endsWith('/>')) stack.push(node)
  }
  return root.children[0] ?? null
}

function attr(node: XmlNode | undefined, names: readonly string[]): string | null {
  if (!node) return null
  for (const name of names) {
    const value = node.attrs[name]
    if (value != null && value !== '') return value
  }
  return null
}

function baseName(path: string): string {
  return String(path || '').replace(/\\/g, '/').split('/').pop()?.toLowerCase() || ''
}

function ticksToMs(ticks: number): number {
  return Math.max(60, ticks * TICK_MS)
}

function walk(node: XmlNode, visit: (node: XmlNode) => void) {
  visit(node)
  for (const child of node.children) walk(child, visit)
}

function hasPoses(node: XmlNode): boolean {
  return node.children.some((child) => ANIMATION_TAGS.has(child.name))
}

function posesOf(actions: Map<string, XmlNode>, name: string | null, depth: number): XmlNode[] {
  if (!name || depth > 3) return []
  const action = actions.get(name)
  if (!action) return []
  const out: XmlNode[] = []
  for (const child of action.children) {
    if (ANIMATION_TAGS.has(child.name)) {
      for (const pose of child.children) if (POSE_TAGS.has(pose.name)) out.push(pose)
    } else if (REFERENCE_TAGS.has(child.name)) {
      out.push(...posesOf(actions, attr(child, ['Name', '名前']), depth + 1))
    }
  }
  return out
}

function velocityX(pose: XmlNode): number | null {
  const raw = attr(pose, ['Velocity', '移動速度'])
  if (!raw) return null
  const n = Number(raw.split(',')[0])
  return Number.isFinite(n) ? n : null
}

function fillFromXml(root: XmlNode, spec: PackSpec['states']): { authored: PackState[]; facing: PackFacing } {
  const actions = new Map<string, XmlNode>()
  walk(root, (node) => {
    if (!ACTION_TAGS.has(node.name)) return
    const name = attr(node, ['Name', '名前'])
    if (!name) return
    const prev = actions.get(name)
    if (!prev || (hasPoses(node) && !hasPoses(prev))) actions.set(name, node)
  })
  const authored: PackState[] = []
  for (const state of PACK_STATES) {
    for (const name of ACTION_MAP[state]) {
      const poses = posesOf(actions, name, 0)
      if (!poses.length) continue
      const frames = poses
        .map((pose) => {
          const ticks = parseInt(attr(pose, ['Duration', '長さ']) || '', 10)
          return {
            img: baseName(attr(pose, ['Image', '画像']) || ''),
            durMs: ticksToMs(Number.isFinite(ticks) && ticks > 0 ? ticks : 6),
          }
        })
        .filter((frame) => frame.img)
      if (!frames.length) continue
      spec[state] = frames
      authored.push(state)
      break
    }
  }
  const walkPose = posesOf(actions, 'Walk', 0)[0] || posesOf(actions, '歩く', 0)[0]
  const vx = walkPose ? velocityX(walkPose) : null
  return { authored, facing: vx != null && vx > 0 ? 'right' : 'left' }
}

/**
 * xml 可空：没有动作表时按 Shimeji 默认编号（shime1.png …）编。
 * files 是文件夹里的文件名。站立帧一张都对不上就返回 null。
 */
export function compilePetPack(xml: string | null, files: readonly string[]): PackSpec | null {
  const available = new Set(files.map(baseName).filter(Boolean))
  const states: PackSpec['states'] = {}
  let authored: PackState[] = []
  let facing: PackFacing = 'left'
  if (xml && xml.trim()) {
    const root = parseXml(xml)
    if (root) {
      const filled = fillFromXml(root, states)
      authored = filled.authored
      facing = filled.facing
    }
  }
  for (const state of PACK_STATES) {
    if (states[state]?.length) continue
    const fallback = DEFAULT_FRAMES[state]
    if (!fallback) continue
    states[state] = fallback.map(([index, ticks]) => ({ img: `shime${index}.png`, durMs: ticksToMs(ticks) }))
  }
  for (const state of PACK_STATES) {
    const frames = (states[state] || []).filter((frame) => available.has(frame.img))
    if (frames.length) states[state] = frames
    else delete states[state]
  }
  if (!states.stand?.length) return null
  return { states, facing, authored: authored.filter((state) => states[state]?.length) }
}

export function packImageNames(spec: PackSpec): string[] {
  const names = new Set<string>()
  for (const frames of Object.values(spec.states)) {
    for (const frame of frames || []) names.add(frame.img)
  }
  return [...names]
}
