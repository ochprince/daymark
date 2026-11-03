/**
 * 活的萌宠 · SVG 造型生成器。
 *
 * 四系物种（芽芽 sprout / 眠眠 moon / 咕噜 drop / 跑跑 star）× 阶段 0–4，
 * 加上按状态切换的表情与姿态零件（站 / 走 / 坐 / 睡 / 掉落 / 攀爬 / 拖拽 / 撒娇）。
 *
 * 纯函数、不碰 DOM、不引外部图片：出来的是一段静态 SVG 字符串，
 * 颜色全部走 CSS 变量（--c / --c2 / --cr-line …），换皮肤只换令牌。
 */

export const PET_SPECIES = ['sprout', 'moon', 'drop', 'star'] as const
export type PetSpecies = (typeof PET_SPECIES)[number]

export const PET_STAGES = [0, 1, 2, 3, 4] as const
export type PetStage = (typeof PET_STAGES)[number]

export const PET_STATES = ['stand', 'walk', 'sit', 'sleep', 'fall', 'climb', 'drag', 'cheer'] as const
export type PetState = (typeof PET_STATES)[number]

const LINE = 'var(--cr-line, #2b2638)'
const LW = 'var(--cr-lw, 4.5)'
const C2 = 'var(--c2)'
const LEAF = 'var(--leaf, #7bd389)'
const GOLD = 'var(--gold, #ffd45c)'
const BAND = 'var(--band, #ffffff)'
const SKY = 'var(--h-sky, #a8d8ff)'

const stroke = (w: string | number = LW) =>
  `stroke="${LINE}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`

const BODY = {
  round: 'M100 64 C142 64 166 96 166 130 C166 162 138 182 100 182 C62 182 34 162 34 130 C34 96 58 64 100 64 Z',
  drop: 'M100 44 C114 70 166 98 166 132 C166 162 138 182 100 182 C62 182 34 162 34 132 C34 98 86 70 100 44 Z',
  egg: 'M100 50 C138 50 158 100 158 136 C158 166 133 186 100 186 C67 186 42 166 42 136 C42 100 62 50 100 50 Z',
} as const

/** 阶段越大越接近成体：整体缩放 */
const SCALE = [0.74, 0.82, 0.88, 0.94, 1]

function starPath(cx: number, cy: number, r: number, inner = 0.5, rot = 0): string {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5 + rot
    const rr = i % 2 ? r * inner : r
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1)
  }
  return d + 'Z'
}

function flower(cx: number, cy: number, r: number): string {
  let s = ''
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    s += `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${(r * 0.82).toFixed(1)}" fill="var(--petal, #ffffff)" ${stroke(3)}/>`
  }
  return s + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.7).toFixed(1)}" fill="var(--pistil, #ffd45c)" ${stroke(3)}/>`
}

function sparkle(cx: number, cy: number, r: number): string {
  return `<path class="pet-spark" d="M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z" fill="var(--spark, #ffc93c)"/>`
}

function droplet(x: number, y: number, s: number, fill = 'var(--c)'): string {
  return `<path d="M${x} ${y - 12 * s} C${x + 4 * s} ${y - 4 * s} ${x + 8 * s} ${y} ${x + 8 * s} ${y + 5 * s} C${x + 8 * s} ${y + 10 * s} ${x + 4 * s} ${y + 13 * s} ${x} ${y + 13 * s} C${x - 4 * s} ${y + 13 * s} ${x - 8 * s} ${y + 10 * s} ${x - 8 * s} ${y + 5 * s} C${x - 8 * s} ${y} ${x - 4 * s} ${y - 4 * s} ${x} ${y - 12 * s} Z" fill="${fill}" ${stroke(3)}/>`
}

/** 阶段 0 的蛋壳帽：四系各带一枚小记号，不然二十种造型会有一排长一样 */
function shellCap(species: PetSpecies): string {
  const cap = `<path d="M62 86 L70 72 L79 82 L88 68 L98 80 L108 67 L117 80 L127 69 L136 84 C132 52 66 52 62 86 Z" fill="var(--shell, #fffdf6)" ${stroke(3.5)}/>`
  let mark = ''
  if (species === 'sprout') mark = `<path d="M100 54 C104 44 116 42 120 47 C115 56 105 58 100 54 Z" fill="${LEAF}" ${stroke(3)}/>`
  if (species === 'moon') mark = `<path d="M108 42 A11 11 0 1 0 108 62 A15 15 0 0 1 108 42 Z" fill="${GOLD}" ${stroke(3)}/>`
  if (species === 'drop') mark = droplet(100, 58, 0.62)
  if (species === 'star') mark = `<path d="${starPath(100, 52, 11)}" fill="${GOLD}" ${stroke(3)}/>`
  return cap + mark
}

/** 头饰：back 在身体后面画（耳朵、彩虹），front 在前面画 */
function headpiece(species: PetSpecies, stage: PetStage): { back: string; front: string } {
  let back = ''
  let front = ''
  if (stage === 0) return { back, front: shellCap(species) }

  if (species === 'sprout') {
    const top = [0, 46, 40, 34, 32][stage]
    front += `<path d="M100 68 C100 60 99 ${top + 8} 100 ${top}" fill="none" ${stroke(4)}/>`
    if (stage === 1) {
      front += `<path d="M100 54 C104 40 120 36 128 41 C124 52 110 58 100 54 Z" fill="${LEAF}" ${stroke(3.5)}/>`
    } else {
      front += `<path d="M100 52 C92 38 74 36 68 42 C74 54 90 58 100 52 Z" fill="${LEAF}" ${stroke(3.5)}/>`
      front += `<path d="M100 47 C108 32 128 30 134 37 C128 50 110 54 100 47 Z" fill="${LEAF}" ${stroke(3.5)}/>`
    }
    if (stage >= 3) front += flower(100, 26, 9)
    if (stage === 4) {
      front += flower(64, 84, 6) + flower(136, 84, 6)
      front += sparkle(40, 60, 9) + sparkle(162, 50, 7)
    }
  }

  if (species === 'moon') {
    if (stage === 1) {
      front += `<path d="M100 66 L100 50" ${stroke(4)}/>`
      front += `<path d="M108 26 A15 15 0 1 0 108 56 A20 20 0 0 1 108 26 Z" fill="${GOLD}" ${stroke(3.5)}/>`
    } else {
      // 睡帽：盖住头顶，帽尖往右垂
      front += `<path d="M60 92 C58 62 82 44 108 44 C134 44 152 62 162 92 C166 104 168 110 160 112 C150 96 140 84 124 80 C104 76 80 82 60 92 Z" fill="${C2}" ${stroke(3.5)}/>`
      front += `<path d="M58 92 C84 78 122 74 150 88" fill="none" stroke="${BAND}" stroke-width="9" stroke-linecap="round"/>`
      front += `<circle cx="160" cy="114" r="10" fill="${BAND}" ${stroke(3.5)}/>`
      if (stage >= 3) front += `<path d="${starPath(104, 60, 10)}" fill="${GOLD}" ${stroke(3)}/>`
      if (stage === 4) {
        front += `<path d="${starPath(46, 58, 8)}" fill="${GOLD}" ${stroke(3)}/>`
        front += `<path d="${starPath(30, 92, 5)}" fill="${GOLD}" ${stroke(2.5)}/>`
        front += sparkle(170, 56, 8) + sparkle(150, 30, 5)
      }
    }
  }

  if (species === 'drop') {
    if (stage >= 1) front += droplet(138, 46, 1)
    if (stage >= 2) {
      front += droplet(58, 40, 0.75)
      front += `<path d="M72 90 C80 80 90 88 100 78 C110 88 120 80 128 90" fill="none" stroke="var(--foam, #ffffff)" stroke-width="6" stroke-linecap="round"/>`
    }
    if (stage >= 3) {
      front += `<circle cx="40" cy="84" r="8" fill="var(--bubble, #d9ecff)" ${stroke(3)}/><circle cx="30" cy="108" r="5" fill="var(--bubble, #d9ecff)" ${stroke(2.5)}/>`
      front += `<circle cx="164" cy="80" r="6" fill="var(--bubble, #d9ecff)" ${stroke(2.5)}/>`
    }
    if (stage === 4) {
      back += `<path d="M22 140 A78 78 0 0 1 178 140" fill="none" stroke="var(--rb1, #ff9c8a)" stroke-width="9"/>`
      back += `<path d="M31 140 A69 69 0 0 1 169 140" fill="none" stroke="var(--rb2, #ffe07a)" stroke-width="9"/>`
      back += `<path d="M40 140 A60 60 0 0 1 160 140" fill="none" stroke="var(--rb3, #8fe3c0)" stroke-width="9"/>`
    }
  }

  if (species === 'star') {
    if (stage === 1) {
      front += `<path d="M100 66 L100 50" ${stroke(4)}/>`
      front += `<path d="${starPath(100, 40, 13)}" fill="${GOLD}" ${stroke(3.5)}/>`
    } else {
      back += `<path d="${starPath(62, 78, 22, 0.52, -0.25)}" fill="var(--c)" ${stroke()}/>`
      back += `<path d="${starPath(138, 78, 22, 0.52, 0.25)}" fill="var(--c)" ${stroke()}/>`
    }
    if (stage >= 3) {
      front += `<path d="M38 112 C70 98 130 98 162 112" fill="none" stroke="${BAND}" stroke-width="12" stroke-linecap="round"/>`
      front += `<path d="M92 103 L100 112 L108 103" fill="none" stroke="${C2}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
    }
    if (stage === 4) {
      front += `<path d="M76 74 L78 48 L90 62 L100 42 L110 62 L122 48 L124 74 Z" fill="${GOLD}" ${stroke(3.5)}/>`
      front += `<circle cx="100" cy="62" r="4" fill="${C2}"/>`
      front += sparkle(30, 70, 8) + sparkle(172, 64, 9)
    }
  }

  return { back, front }
}

/** 状态 → 眼与嘴。表情和姿态一起变，才像「活着」而不是换贴图 */
function face(state: PetState, cy: number, sx = 20, small = false): string {
  const k = small ? 0.82 : 1
  const xL = 100 - sx
  const xR = 100 + sx
  const eyes: 'open' | 'wide' | 'happy' | 'closed' | 'squeeze' =
    state === 'sleep' ? 'closed'
      : state === 'sit' || state === 'cheer' ? 'happy'
        : state === 'fall' || state === 'climb' ? 'wide'
          : state === 'drag' ? 'squeeze'
            : 'open'
  const mouth: 'smile' | 'open' | 'o' | 'flat' | 'wavy' =
    state === 'fall' ? 'o'
      : state === 'drag' ? 'wavy'
        : state === 'sleep' ? 'flat'
          : state === 'walk' || state === 'cheer' ? 'open'
            : 'smile'

  let s = '<g class="pet-face">'

  if (eyes === 'happy') {
    const eye = (x: number) =>
      `<path d="M${x - 7.5 * k} ${cy + 3} C${x - 5 * k} ${cy - 5.5 * k} ${x + 5 * k} ${cy - 5.5 * k} ${x + 7.5 * k} ${cy + 3} C${x + 5 * k} ${cy - 1.5 * k} ${x - 5 * k} ${cy - 1.5 * k} ${x - 7.5 * k} ${cy + 3} Z" fill="${LINE}" ${stroke(2)}/>`
    s += eye(xL) + eye(xR)
  } else if (eyes === 'closed') {
    s += `<path d="M${xL - 7 * k} ${cy} Q${xL} ${cy + 6 * k} ${xL + 7 * k} ${cy}" fill="none" ${stroke(4)}/>`
    s += `<path d="M${xR - 7 * k} ${cy} Q${xR} ${cy + 6 * k} ${xR + 7 * k} ${cy}" fill="none" ${stroke(4)}/>`
  } else if (eyes === 'squeeze') {
    s += `<path d="M${xL - 8 * k} ${cy - 4 * k} L${xL + 1 * k} ${cy} L${xL - 8 * k} ${cy + 4 * k}" fill="none" ${stroke(3.6)}/>`
    s += `<path d="M${xR + 8 * k} ${cy - 4 * k} L${xR - 1 * k} ${cy} L${xR + 8 * k} ${cy + 4 * k}" fill="none" ${stroke(3.6)}/>`
  } else {
    const wide = eyes === 'wide'
    const rx = (wide ? 7.4 : 5.8) * k
    const ry = (wide ? 8.6 : 7.5) * k
    s += `<g class="pet-eyes"><ellipse cx="${xL}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${LINE}"/><ellipse cx="${xR}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${LINE}"/>`
    s += `<circle cx="${xL + 2}" cy="${cy - 3}" r="${2.3 * k}" fill="#fff"/><circle cx="${xR + 2}" cy="${cy - 3}" r="${2.3 * k}" fill="#fff"/></g>`
  }

  if (mouth === 'open') {
    const d = `M89 ${cy + 11} Q100 ${cy + 15} 111 ${cy + 11} C110 ${cy + 20} 106 ${cy + 25} 100 ${cy + 25} C94 ${cy + 25} 90 ${cy + 20} 89 ${cy + 11} Z`
    s += `<path d="${d}" fill="var(--mouth, #e5664b)"/>`
    s += `<path d="M93 ${cy + 21} C95 ${cy + 18} 105 ${cy + 18} 107 ${cy + 21} C105 ${cy + 24} 95 ${cy + 24} 93 ${cy + 21} Z" fill="var(--blush, #ff9c9c)"/>`
    s += `<path d="${d}" fill="none" ${stroke(3)}/>`
  } else if (mouth === 'o') {
    s += `<ellipse cx="100" cy="${cy + 15}" rx="5" ry="6" fill="var(--mouth, #e5664b)" ${stroke(3)}/>`
  } else if (mouth === 'flat') {
    s += `<path d="M95 ${cy + 14} H105" fill="none" ${stroke(3.2)}/>`
  } else if (mouth === 'wavy') {
    s += `<path d="M92 ${cy + 14} q3 -4 6 0 t6 0" fill="none" ${stroke(2.8)}/>`
  } else {
    s += `<path d="M93 ${cy + 12} Q100 ${cy + 19} 107 ${cy + 12}" fill="none" ${stroke(3.5)}/>`
  }

  s += `<ellipse cx="${xL - 13}" cy="${cy + 13}" rx="8" ry="4.6" fill="var(--blush, #ff9c9c)" class="pet-blush"/>`
  s += `<ellipse cx="${xR + 13}" cy="${cy + 13}" rx="8" ry="4.6" fill="var(--blush, #ff9c9c)" class="pet-blush"/>`
  return s + '</g>'
}

function zzz(): string {
  return (
    '<g class="pet-zzz" aria-hidden="true">' +
    `<text x="146" y="66" font-size="24" font-weight="800" fill="${SKY}" font-family="Arial, sans-serif">z</text>` +
    `<text x="164" y="42" font-size="32" font-weight="800" fill="${SKY}" font-family="Arial, sans-serif">Z</text>` +
    '</g>'
  )
}

export type PetArtOptions = {
  species: PetSpecies
  stage: PetStage
  state: PetState
  size: number
  /** clipPath 唯一后缀，避免同页多只互相裁切 */
  uid?: string
}

/** 一只宠物的完整 SVG 字符串（静态、无用户输入） */
export function petSvg({ species, stage, state, size, uid = 'p' }: PetArtOptions): string {
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '')
  const egg = stage === 0
  const shape = egg ? 'egg' : species === 'drop' ? 'drop' : 'round'
  const body = BODY[shape]
  const scale = SCALE[stage]
  const faceY = egg ? 138 : shape === 'drop' ? 126 : 122
  const hp = headpiece(species, stage)
  const clip = `pc-${safeUid}`

  let inner = egg
    ? `<path d="${body}" fill="var(--c)" ${stroke()}/>`
    : hp.back

  if (!egg && stage >= 2) {
    inner += `<ellipse class="pet-foot pet-foot-l" cx="78" cy="181" rx="14" ry="8" fill="var(--c)" ${stroke()}/>`
    inner += `<ellipse class="pet-foot pet-foot-r" cx="122" cy="181" rx="14" ry="8" fill="var(--c)" ${stroke()}/>`
  }

  if (!egg) inner += `<path d="${body}" fill="var(--c)" ${stroke()}/>`

  if (egg) {
    inner += `<g clip-path="url(#${clip})"><circle cx="70" cy="104" r="12" fill="#fff" opacity=".4"/><circle cx="128" cy="92" r="8" fill="#fff" opacity=".4"/><circle cx="132" cy="150" r="14" fill="#fff" opacity=".3"/><circle cx="62" cy="160" r="9" fill="#fff" opacity=".3"/><ellipse cx="128" cy="186" rx="70" ry="30" fill="${C2}" opacity=".25" class="pet-shade"/></g>`
    inner += `<ellipse cx="76" cy="84" rx="10" ry="6" fill="#fff" opacity=".8" transform="rotate(-36 76 84)"/>`
  } else {
    inner += `<g clip-path="url(#${clip})"><ellipse cx="136" cy="184" rx="76" ry="34" fill="${C2}" opacity=".28" class="pet-shade"/>${
      stage >= 2 ? '<ellipse cx="100" cy="166" rx="34" ry="18" fill="#fff" opacity=".32" class="pet-belly"/>' : ''
    }</g>`
    inner += `<ellipse cx="70" cy="${shape === 'drop' ? 100 : 94}" rx="11" ry="6.5" fill="#fff" opacity=".78" transform="rotate(-32 70 ${shape === 'drop' ? 100 : 94})"/>`
  }

  inner += face(state, faceY, egg ? 17 : 20, egg)

  if (!egg && stage >= 3) {
    inner += `<g class="pet-arm pet-arm-l"><ellipse cx="38" cy="140" rx="10" ry="15" transform="rotate(28 38 140)" fill="var(--c)" ${stroke()}/></g>`
    inner += `<g class="pet-arm pet-arm-r"><ellipse cx="162" cy="140" rx="10" ry="15" transform="rotate(-28 162 140)" fill="var(--c)" ${stroke()}/></g>`
  }

  inner += hp.front

  const lines =
    state === 'fall'
      ? '<g class="pet-lines" aria-hidden="true"><path d="M34 120 L34 86" stroke="var(--cr-line, #2b2638)" stroke-width="3" stroke-linecap="round" opacity=".28"/><path d="M166 132 L166 98" stroke="var(--cr-line, #2b2638)" stroke-width="3" stroke-linecap="round" opacity=".28"/></g>'
      : ''

  return (
    `<svg class="pet-art pet-art--${species} pet-art--s${stage}" data-state="${state}" data-species="${species}" data-stage="${stage}" viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true" focusable="false">` +
    `<defs><clipPath id="${clip}"><path d="${body}"/></clipPath></defs>` +
    `<g class="pet-frame" transform="translate(100 186) scale(${scale}) translate(-100 -186)"><g class="pet-shape">${inner}</g></g>` +
    lines +
    (state === 'sleep' ? zzz() : '') +
    '</svg>'
  )
}
