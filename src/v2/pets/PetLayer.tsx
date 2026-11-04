import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { t } from '../../lib/i18n'
import type { MessageKey } from '../../lib/i18n'
import { Pet } from './Pet'
import type { PetStage, PetState } from './art'
import type { PetArtSpecies } from './petArt'
import {
  landingPlatform,
  placeBubble,
  planJump,
  planJumpDown,
  simulateJump,
  throwVelocity,
  type Platform,
} from './geometry'
export type { PetStage } from './art'
import '../pets.css'

/** 重力（px/s²） */
export const PET_GRAVITY = 2200
/** 可站立的东西：页面里真实的卡片、按钮、底栏 */
/**
 * 宠物能站的平台 —— 跟原型对齐的一张清单。
 *
 * 只放底栏太单调：它应该能站到按住计时的按钮、成长条、卡片顶边、切换开关、
 * 图标按钮上。判定沿用原型的几条过滤（见 scan）：太窄（<36）、太靠上（压状态栏）、
 * 太靠底（钻到底栏后面）都不算平台。
 */
export const PET_PLATFORM_SELECTORS = [
  '.pet-plat',
  '.hold',
  '.growth',
  '.sc-actions .btn',
  '.stage-card',
  // 备忘与待办整块也能踩：踩在它上沿，顺带抖一下
  '.c-memo',
  // 装扮页那张大预览卡（软糖 / 纸本）：站上去，别站进里面那张缩小的卡
  '.g-item',
  '.tabbar',
  '.pill-switch',
  '.icon-btn',
  '.card',
  '[data-pet-platform]',
] as const

/** 卡片类平台被踩到时不抖：它本身就是承重的大块，抖起来像画面在晃 */
const NO_BUMP = /stage-card|\bcard\b/

/* ================================================================ 回家：拖回卡片原位 */

/** 回家区：卡片里那块空位，横向各收 18% */
export const HOME_INSET_X = 0.18
/** 纵向各收 16%：防擦边误触 */
export const HOME_INSET_Y = 0.16
/** 回家动画时长 */
export const HOME_MS = 420
/** 脚底落在空位高度的 78% 处 */
export const HOME_FEET = 0.78
/** 收尾渐隐：走到终点时只剩 15% 不透明，像钻回卡片 */
export const HOME_FADE = 0.85

/** 卡片原位在层坐标系里的矩形 */
export type HomeZone = {
  l: number
  r: number
  t: number
  b: number
  cx: number
  cy: number
  feetY: number
}

/** 脚底坐标是否落在「往里收过一圈」的回家区里 */
export function insideHome(zone: HomeZone, x: number, y: number): boolean {
  const mx = (zone.r - zone.l) * HOME_INSET_X
  const my = (zone.b - zone.t) * HOME_INSET_Y
  return x >= zone.l + mx && x <= zone.r - mx && y >= zone.t + my && y <= zone.b - my
}

/** 回家插值：1-(1-u)³ 缓出 */
export function homeEase(u: number): number {
  return 1 - Math.pow(1 - u, 3)
}

/** 回家途中的透明度：越靠近卡片越淡 */
export function homeFade(u: number): number {
  return 1 - u * HOME_FADE
}

/* ================================================================ 出场：走进去 → 台阶 → 跳下 → 交接 */

/** 走向卡片深处：边走近边变小 */
export const DEBUT_WALK_MS = 1680
/** 在台阶上顿一下 */
export const DEBUT_STEP_MS = 320
/** 台阶在卡片顶部往下多少 */
export const DEBUT_STEP_DY = 56
/** 起跳高度 */
export const DEBUT_JUMP_H = 96

/** 克隆走出卡片后不再继承色板，这几个自定义属性要原样拷过去，否则整只变黑 */
const HUE_VARS = [
  '--c',
  '--c2',
  '--cr-line',
  '--cr-lw',
  '--leaf',
  '--gold',
  '--band',
  '--foam',
  '--bubble',
  '--rb1',
  '--rb2',
  '--rb3',
  '--shell',
  '--petal',
  '--pistil',
  '--spark',
  '--mouth',
  '--blush',
  '--paper',
  '--gift',
] as const

export type PetLayerProps = {
  /** 'post' 是倒数日那只（拿信/礼物），素材在 petArt 里，同样能出门 */
  species: PetArtSpecies
  stage: PetStage
  /** 配色索引 0–7 */
  hue?: number
  /** 宠物高度（px），脚底落在 93% 处 */
  size?: number
  /** 每记一次 +1：撒爱心、跳一下、说一句 */
  logSeq?: number
  /** 成长里程碑（形态升级）+1：撒更多爱心、跳更高 */
  milestoneSeq?: number
  /** 切了焦点事项 +1：轻轻跳一下 */
  focusSeq?: number
  /** 长按一下它（按住不动 0.65 秒）＝ 记一次 */
  onHoldLog?: () => void
  /** 正在别家串门（这张卡不是它家）：落到卡片上会打个招呼 */
  visiting?: boolean
  /** 被戳 +1：冒两颗心 */
  pokeSeq?: number
  /** 初始脚底位置（层内 px）；不给就从上方掉下来 */
  spawn?: { x: number; y: number }
  /**
   * 桌宠在外面（true）还是回了卡片里（false）。
   * 不给就当作一直在外面（宠物实验室用）。
   */
  out?: boolean
  /** 交接上桌 / 回家时的状态回调：外界的 petOut 跟着它走 */
  onOut?: (out: boolean) => void
  /** 每次 +1 就播一遍出场（连戳三下走这条路） */
  debutSeq?: number
  /** 串门时连戳三下：让两只一起玩（不送主人出门） */
  playSeq?: number
  /** 回家收尾：卡片那边跳一下、把气泡换成「我回来了。」、播一声 */
  onHomed?: () => void
  /** 拖着它悬停在卡片原位上：卡片里那块空位亮起来 */
  onHomeHot?: (hot: boolean) => void
  /** 点醒一只正在睡觉的它（徽章「回来了」靠这个） */
  onWake?: () => void
}

type DragState = {
  id: number
  /** 指针 → 脚底的偏移 */
  dx: number
  dy: number
  sx: number
  sy: number
  t: number
  moved: boolean
  samples: [number, number, number][]
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]
const waitMs = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))
const reduced = () =>
  document.documentElement.classList.contains('reduce-motion') ||
  (typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches)

/**
 * 宠物层：盖满宿主容器的一层，只有精灵自己接收指针。
 * 平台、重力、落地、random walk、拖拽抛出、点一下撒娇都在这里；
 * 出去（四段接力）与回家（拖回卡片原位）也在这里。
 */
export function PetLayer({
  species,
  stage,
  hue = 4,
  size = 92,
  spawn,
  out,
  onOut,
  debutSeq = 0,
  playSeq = 0,
  logSeq = 0,
  milestoneSeq = 0,
  focusSeq = 0,
  pokeSeq = 0,
  onHoldLog,
  visiting = false,
  onHomed,
  onHomeHot,
  onWake,
}: PetLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null)
  const spriteRef = useRef<HTMLDivElement | null>(null)
  const sayRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const bubbleSeq = useRef(0)
  /** 桌宠是否在外面：卡片里那只与这只互斥 */
  const outRef = useRef<boolean>(out ?? true)
  const visitingRef = useRef<boolean>(visiting)
  visitingRef.current = visiting
  const callbacks = useRef({ onOut, onHomed, onHomeHot })
  callbacks.current = { onOut, onHomed, onHomeHot }
  const apiRef = useRef<{
    debut: () => void
    /** 串门时两只一起玩 */
    play: () => void
    retire: () => void
    hot: () => boolean
    goHome: () => void
    react: (kind: 'log' | 'focus' | 'poke' | 'milestone') => void
  } | null>(null)
  const [view, setView] = useState<PetState>('fall')
  /**
   * 刚被叫醒的冷却期。
   * 不设这个的话，醒来后下一次 think 可能立刻又挑到「睡」——
   * 权重是随机的，踩中的时候看起来就是「醒了马上又睡」，很怪。
   */
  const noSleepUntil = useRef(0)
  const [bubble, setBubble] = useState<{ id: number; text: string } | null>(null)

  const sim = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    face: 1,
    mode: 'fall' as PetState,
    timer: 0,
    plat: null as string | null,
    tx: 0,
    toWall: false,
    wall: 1,
    sayUntil: 0,
    sw: 0,
    sh: 0,
    ready: false,
  })

  const setMode = useCallback((mode: PetState, dur = 0) => {
    const s = sim.current
    s.timer = dur
    if (s.mode === mode) return
    s.mode = mode
    setView(mode)
  }, [])

  const say = useCallback((key: MessageKey, ms = 2200) => {
    bubbleSeq.current += 1
    const s = sim.current
    s.sayUntil = performance.now() + ms
    s.sw = 0
    s.sh = 0
    setBubble({ id: bubbleSeq.current, text: t(key) })
  }, [])

  /** 气泡摆位只算一次几何：方向 + 箭头位置 + 夹进安全区 */
  const positionBubble = useCallback(() => {
    const el = sayRef.current
    const layer = layerRef.current
    const s = sim.current
    if (!el || !layer) return
    const rect = layer.getBoundingClientRect()
    const bw = s.sw || el.offsetWidth
    const bh = s.sh || el.offsetHeight
    s.sw = bw
    s.sh = bh
    const res = placeBubble({
      x: s.x,
      y: s.y,
      h: size,
      hw: size / 2,
      bw,
      bh,
      W: rect.width,
      H: rect.height,
      safeTop: 44,
      safeBottom: 24,
      edge: 12,
      gap: 11,
    })
    el.dataset.dir = res.dir
    el.style.setProperty('--tail', `${Math.round(res.tail)}px`)
    el.style.transform = `translate3d(${res.x.toFixed(1)}px, ${res.y.toFixed(1)}px, 0)`
  }, [size])

  // 气泡挂上去先量一次真实尺寸，再摆位；否则第一帧会跳
  useLayoutEffect(() => {
    if (!bubble) return
    positionBubble()
  }, [bubble, positionBubble])

  useEffect(() => {
    const layer = layerRef.current
    const sprite = spriteRef.current
    if (!layer || !sprite) return

    const s = sim.current
    // 平台是宿主容器里的真实元素（卡片 / 按钮 / 底栏），不在层内部
    const host = layer.parentElement ?? layer
    let raf = 0
    let last = 0
    let lastScan = -1e9
    let platforms: Platform[] = []
    let rect = layer.getBoundingClientRect()
    let alive = true
    // 出场令牌：用户关掉桌宠 / 重播时 +1，旧动画的每一步都先比这个再往下走
    let debutTok = 0
    let debuting = false
    /** 两只在一起玩：期间不让它自己乱跑 */
    let playing = false
    let playTok = 0
    let homing = false
    /** 上一次的「悬停在家上」：只在变化时通知 React，省掉每帧一次 setState */
    let hotOn = false
    let debutEl: HTMLDivElement | null = null
    let stepEl: HTMLElement | null = null
    /** 出场时那张卡片：它被换掉/卸载了，这一段接力就该作废 */
    let debutWrap: HTMLElement | null = null

    const cardWrap = () =>
      Array.from(host.querySelectorAll<HTMLElement>('.stage-card .cr-wrap')).find(
        (el) => !el.closest('.mini'),
      ) ?? null

    const scan = () => {
      rect = layer.getBoundingClientRect()
      const out: Platform[] = []
      const seen = new Set<Element>()
      for (const sel of PET_PLATFORM_SELECTORS) {
        host.querySelectorAll<HTMLElement>(sel).forEach((el, index) => {
          if (seen.has(el) || layer.contains(el)) return
          // 装扮页的预览是「缩小的真实卡片」，它自己不该被桌宠踩，也不该抢它的手势
          if (el.closest('.mini')) return
          seen.add(el)
          const b = el.getBoundingClientRect()
          if (b.width < 36 || b.height < 6) return
          const l = b.left - rect.left
          const r = b.right - rect.left
          const top = b.top - rect.top
          if (r < 8 || l > rect.width - 8) return
          // 状态栏下面才算平台；太靠底也别算（底栏本身除外）
          // 只挡状态栏这一段：卡片顶边（y≈91）本来就是允许的平台，
          // 真机上看着正常，别再按身高去过滤
          if (top < 44) return
          if (top > rect.height - 30 && !el.closest('.tabbar')) return
          out.push({ key: `${sel}#${index}`, l, r, t: top, el, sel })
        })
      }
      out.push({ key: 'floor', l: 0, r: rect.width, t: rect.height - 14, floor: true })
      platforms = out
    }

    const platOf = () => platforms.find((p) => p.key === s.plat) ?? null

    const paint = () => {
      sprite.style.transform =
        `translate3d(${(s.x - size / 2).toFixed(1)}px, ${(s.y - size * 0.93).toFixed(1)}px, 0) ` +
        `scaleX(${s.face})`
      sprite.dataset.petX = s.x.toFixed(1)
      sprite.dataset.petY = s.y.toFixed(1)
      sprite.dataset.petMode = s.mode
      sprite.dataset.petPlat = s.plat ?? ''
      if (s.sayUntil > 0) positionBubble()
    }

    /* ---------------------------------------------------------- 回家 */

    /** 卡片原位换算到层坐标；空位没渲染出来就没有回家区 */
    const zoneOf = (): HomeZone | null => {
      const wrap = cardWrap()
      if (!wrap) return null
      rect = layer.getBoundingClientRect()
      const b = wrap.getBoundingClientRect()
      const l = b.left - rect.left
      const r = b.right - rect.left
      const top = b.top - rect.top
      const bottom = b.bottom - rect.top
      return {
        l,
        r,
        t: top,
        b: bottom,
        cx: (l + r) / 2,
        cy: (top + bottom) / 2,
        feetY: top + (bottom - top) * HOME_FEET,
      }
    }

    const setHot = (on: boolean) => {
      const wrap = cardWrap()
      // 同一帧先亮起来，React 那边的状态随后跟上（重渲染也不会把它擦掉）
      if (wrap) wrap.classList.toggle('pet-home-hot', on)
      if (on === hotOn) return
      hotOn = on
      callbacks.current.onHomeHot?.(on)
    }

    /** 拖着它悬停到原位上方：家亮一下，松手就是回去 */
    const hot = () => {
      if (!outRef.current || homing) return false
      // 在别人家串门：那块空位不是它的家，拖过去不该回家
      if (visitingRef.current) {
        setHot(false)
        return false
      }
      const zone = zoneOf()
      if (!zone) return false
      const inside = insideHome(zone, s.x, s.y)
      setHot(inside)
      return inside
    }

    /**
     * 踩上去的元素抖一下。
     *
     * 原型里这是「它有重量」的唯一证据：落到按钮/开关上会把它压得一颤，
     * 落到卡片和 stage-card 上不抖（那两块是自己的承重面，抖起来像整屏在晃）。
     * 底栏特殊：抖的是被踩的那个 tab，不是整条底栏。
     */
    const bump = (p: Platform) => {
      if (!p.el || p.floor) return
      if (NO_BUMP.test(p.sel ?? '')) return
      let el = p.el
      if (p.sel === '.tabbar') {
        for (const child of Array.from(el.children) as HTMLElement[]) {
          const b = child.getBoundingClientRect()
          const l = b.left - rect.left
          if (s.x >= l && s.x <= l + b.width) el = child
        }
      }
      el.classList.remove('pet-bump')
      void el.offsetWidth
      el.classList.add('pet-bump')
      window.setTimeout(() => el.classList.remove('pet-bump'), 380)
    }

    /** 原地跳一下：只给初速，剩下的交给重力和平台判定 */
    const hop = (power: number) => {
      if (s.mode === 'drag') return
      s.vy = -Math.max(120, power * 2.4)
      s.plat = null
      setMode('fall', 0.5)
    }

    const hearts = (n: number) => {
      for (let i = 0; i < n; i += 1) {
        const heart = document.createElement('i')
        heart.className = 'pet-heart'
        heart.textContent = '♥'
        heart.style.left = `${(s.x + rand(-24, 24)).toFixed(0)}px`
        // 从头顶冒出来：s.y 是精灵盒顶，素材四周有留白，再往上 0.72 个身高就飞出屏幕了
        // （站卡片顶边时 s.y≈-4，心会冒到 -67，整颗看不见）。这里贴着上半身起，并钳在层内。
        // 靠近屏幕顶时改用身体中部当起点：爱心是向上飘的，贴着头发射会整段飘出屏幕
        const y0 = s.y < 56 ? Math.max(44, s.y + size * 0.3) : s.y - 6
        heart.style.top = `${y0.toFixed(0)}px`
        heart.style.setProperty('--dx', `${rand(-26, 26).toFixed(0)}px`)
        heart.style.animationDelay = `${i * 80}ms`
        layer.appendChild(heart)
        window.setTimeout(() => heart.remove(), 1400 + i * 80)
      }
    }

    const finishHome = () => {
      hearts(4)
      homing = false
      s.sayUntil = 0
      setBubble(null)
      sprite.style.opacity = ''
      setMode('stand')
      outRef.current = false
      layer.dataset.petOut = '0'
      setHot(false)
      // 人回来了：空位重新亮起来（卡片那只重新出现）
      cardWrap()?.classList.remove('pet-away')
      // 卡片那侧再播一次 jump / 气泡 / 音效
      callbacks.current.onOut?.(false)
      callbacks.current.onHomed?.()
    }

    /** 松手在卡片中央：420ms 缓出插值过去，同时渐隐 */
    const goHome = () => {
      if (!outRef.current || homing) return
      setHot(false)
      const zone = zoneOf()
      const tx = zone ? zone.cx : s.x
      const ty = zone ? zone.feetY : s.y
      const fromX = s.x
      const fromY = s.y
      homing = true
      s.plat = null
      s.vx = 0
      s.vy = 0
      setMode('stand')
      say('pet.say.home', 1400)
      const t0 = performance.now()
      const tick = (now: number) => {
        if (!alive) return
        const u = Math.min(1, (now - t0) / HOME_MS)
        const e = homeEase(u)
        s.x = fromX + (tx - fromX) * e
        s.y = fromY + (ty - fromY) * e
        sprite.style.opacity = String(homeFade(u))
        paint()
        if (u < 1) {
          window.requestAnimationFrame(tick)
          return
        }
        finishHome()
      }
      window.requestAnimationFrame(tick)
    }

    /* ---------------------------------------------------------- 出场 */

    const clearDebutDom = () => {
      debutEl?.remove()
      debutEl = null
      stepEl?.remove()
      stepEl = null
    }

    /** 克隆带不走卡片的色板：把自定义属性原样抄一份 */
    const paintHue = (el: HTMLElement) => {
      const src = cardWrap()?.closest('.stage-card') ?? cardWrap()
      if (!src) return
      const cs = getComputedStyle(src)
      for (const key of HUE_VARS) {
        const value = cs.getPropertyValue(key).trim()
        if (value) el.style.setProperty(key, value)
      }
    }

    const restoreCardPet = () => {
      host.querySelectorAll<HTMLElement>('.stage-card .cr-wrap.pet-away').forEach((el) => {
        el.classList.remove('pet-away')
      })
    }

    /** 作废：关掉桌宠、换焦点、重播时旧动画立刻停，卡片里那只马上回来 */
    const abort = () => {
      debutTok += 1
      debuting = false
      debutWrap = null
      clearDebutDom()
      if (!outRef.current) restoreCardPet()
    }

    /** 第四段：交给物理层——从这一刻起桌面上那只才是真的 */
    const handoff = (x: number, y: number, vx: number, vy: number) => {
      clearDebutDom()
      debutWrap = null
      s.x = x
      s.y = y
      s.vx = vx
      s.vy = vy
      s.face = vx >= 0 ? 1 : -1
      s.plat = null
      s.ready = true
      debuting = false
      outRef.current = true
      layer.dataset.petOut = '1'
      setMode('fall')
      paint()
      callbacks.current.onOut?.(true)
    }

    /** 减少动效：不做「走过去 → 台阶 → 跳下」，直接切到「已经在外」 */
    const skipDebut = () => {
      restoreCardPet()
      cardWrap()?.classList.add('pet-away')
      const floor = platforms.find((p) => p.key === 'floor')
      handoff(rect.width * 0.5, Math.max(120, (floor ? floor.t : 160) - 80), rand(-40, 40), 0)
      say('pet.say.out', 2200)
    }

    const debut = async () => {
      if (!alive || debuting || outRef.current) return
      if (reduced()) {
        skipDebut()
        return
      }
      const tok = ++debutTok
      debuting = true
      clearDebutDom()
      // 卡片可能还在换焦点的那一帧里，等它把 .cr 挂出来
      let wrap: HTMLElement | null = null
      for (let i = 0; i < 24; i += 1) {
        if (tok !== debutTok || !alive) return
        wrap = cardWrap()
        if (wrap && wrap.querySelector('.cr')) break
        wrap = null
        await waitMs(80)
      }
      if (tok !== debutTok || !alive) return
      if (!wrap) {
        skipDebut()
        return
      }
      const cr = wrap.querySelector<HTMLElement>('.cr')
      const card = wrap.closest<HTMLElement>('.stage-card')
      if (!cr || !card) {
        skipDebut()
        return
      }

      rect = layer.getBoundingClientRect()
      const br = cr.getBoundingClientRect()
      const cb = card.getBoundingClientRect()
      const startX = br.left + br.width / 2 - rect.left
      const startY = br.bottom - rect.top - 6
      const midX = cb.left + cb.width / 2 - rect.left
      const stepY = cb.top - rect.top + DEBUT_STEP_DY
      const startS = Math.max(0.72, Math.min(1.05, br.width / 158))

      // 卡片里那只先让位，走出去的是它的克隆——任何时刻只看得到一只
      wrap.classList.add('pet-away')
      debutWrap = wrap

      debutEl = document.createElement('div')
      debutEl.className = 'pet-debut'
      debutEl.innerHTML = `<div class="pet-debut-spin">${cr.outerHTML}</div>`
      paintHue(debutEl)
      const cloneCr = debutEl.querySelector<HTMLElement>('.cr')
      if (cloneCr) {
        cloneCr.style.width = `${br.width}px`
        cloneCr.style.height = `${br.height}px`
      }
      layer.appendChild(debutEl)

      stepEl = document.createElement('i')
      stepEl.className = 'pet-debut-step'
      stepEl.style.left = `${midX.toFixed(1)}px`
      stepEl.style.top = `${stepY.toFixed(1)}px`
      layer.appendChild(stepEl)
      const stepNode = stepEl

      const put = (x: number, y: number, sc: number) => {
        if (debutEl) {
          debutEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${sc.toFixed(3)})`
        }
      }
      put(startX, startY, startS)

      await waitMs(160)
      if (tok !== debutTok) return

      // 1) 走向卡片深处，越走越小
      debutEl.classList.add('walk')
      const walk = debutEl.animate(
        [
          { transform: `translate3d(${startX}px, ${startY}px, 0) scale(${startS})` },
          {
            transform: `translate3d(${(startX + midX) / 2}px, ${(startY + stepY) / 2 - 6}px, 0) scale(${startS * 0.72})`,
            offset: 0.55,
          },
          { transform: `translate3d(${midX}px, ${stepY}px, 0) scale(${startS * 0.42})` },
        ],
        { duration: DEBUT_WALK_MS, easing: 'cubic-bezier(0.35, 0.1, 0.25, 1)', fill: 'forwards' },
      )
      window.setTimeout(() => {
        if (tok === debutTok) stepNode.classList.add('on')
      }, 1100)
      await walk.finished.catch(() => {})
      if (tok !== debutTok) return
      if (walk.commitStyles) walk.commitStyles()
      walk.cancel()
      put(midX, stepY, startS * 0.42)

      // 2) 在台阶上顿一下
      debutEl.classList.remove('walk')
      debutEl.classList.add('squash')
      await waitMs(DEBUT_STEP_MS)
      if (tok !== debutTok) return
      debutEl.classList.remove('squash')

      // 3) 从卡片中间跳下，半空换成桌宠精灵
      const jvy = -Math.sqrt(2 * PET_GRAVITY * DEBUT_JUMP_H)
      const peakT = Math.abs(jvy) / PET_GRAVITY
      const peakY = stepY + jvy * peakT + 0.5 * PET_GRAVITY * peakT * peakT
      debutEl.animate(
        [
          { transform: `translate3d(${midX}px, ${stepY}px, 0) scale(${startS * 0.42})`, opacity: 1 },
          {
            transform: `translate3d(${midX}px, ${peakY}px, 0) scale(${startS * 0.5})`,
            opacity: 1,
            offset: 0.4,
          },
          {
            transform: `translate3d(${midX}px, ${peakY + 20}px, 0) scale(${startS * 0.56})`,
            opacity: 0,
          },
        ],
        { duration: 420, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
      )
      stepNode.classList.add('gone')
      await waitMs(250)
      if (tok !== debutTok) return

      handoff(midX, peakY + 8, rand(-40, 40), 120)
      hearts(5)
      say('pet.say.out', 2600)
    }

    /** 关掉桌宠：不是凭空消失，直接回卡片原位 */
    const retire = () => {
      abort()
      playTok += 1
      playing = false
      const cardCr = cardWrap()?.querySelector<HTMLElement>('.cr')
      cardCr?.classList.remove('playing', 'nuzzle')
      homing = false
      clearDebutDom()
      s.sayUntil = 0
      setBubble(null)
      setHot(false)
      sprite.style.opacity = ''
      restoreCardPet()
      layer.dataset.petOut = '0'
    }

    /**
     * 串门的两只一起玩：客人走到主人旁边，两只对跳两下、互蹭一下、冒爱心，
     * 客人坐下。全程 ~3 秒，期间不让它自己乱走。
     */
    const play = async () => {
      if (!outRef.current || !visitingRef.current || playing) return
      const wrap = cardWrap()
      const cr = wrap?.querySelector<HTMLElement>('.cr')
      if (!wrap || !cr) return
      const tok = ++playTok
      playing = true
      const layerRect = layer.getBoundingClientRect()
      const br = cr.getBoundingClientRect()
      const hostMid = br.left + br.width / 2 - layerRect.left
      const targetX = Math.max(size / 2, Math.min(rect.width - size / 2, hostMid + br.width * 0.3))

      s.tx = targetX
      s.toWall = false
      s.face = targetX >= s.x ? 1 : -1
      setMode('walk')
      say('pet.say.play', 1800)

      for (let i = 0; i < 40; i += 1) {
        await waitMs(60)
        if (tok !== playTok || !alive) return
        if (Math.abs(s.x - targetX) < 6) break
      }
      if (tok !== playTok || !alive) return

      s.face = hostMid >= s.x ? 1 : -1
      setMode('stand')
      cr.classList.add('playing')
      hop(0.9)
      await waitMs(430)
      if (tok !== playTok || !alive) return
      hop(0.7)
      await waitMs(450)
      if (tok !== playTok || !alive) return
      cr.classList.add('nuzzle')
      setMode('cheer', 0.7)
      hearts(3)
      await waitMs(900)
      if (tok !== playTok || !alive) return
      cr.classList.remove('playing', 'nuzzle')
      setMode('sit', 4)
      playing = false
    }

    apiRef.current = {
      debut: () => {
        void debut()
      },
      play: () => {
        void play()
      },
      retire,
      hot,
      goHome,
      /** 外部动作的反应：记一次、切焦点、被戳 */
      react: (kind: 'log' | 'focus' | 'poke' | 'milestone') => {
        // 它在家（卡片里那只就是它）时不在这儿反应：
        // 否则会在隐藏的精灵位置冒出一个没主人的气泡
        if (!outRef.current) return
        if (kind === 'log') {
          hearts(4)
          hop(90)
          say('pet.say.logged', 2400)
        } else if (kind === 'milestone') {
          hearts(8)
          hop(140)
          say('pet.say.milestone', 2400)
        } else if (kind === 'focus') {
          hop(30)
        } else {
          hearts(2)
          hop(40)
        }
      },
    }

    const land = (p: Platform) => {
      const hard = s.vy > 760
      bump(p)
      if (visitingRef.current && p.sel === '.stage-card') say('pet.say.visit', 2200)
      s.plat = p.key
      s.y = p.t + 3
      s.vx = 0
      s.vy = 0
      if (hard) {
        setMode('cheer', 0.65)
        say('pet.say.land', 1400)
      } else {
        setMode('stand', rand(0.7, 1.8))
      }
      // 踩到备忘与待办上：它低头看一眼，顺口念一句
      if (p.sel === '.c-memo') say('pet.say.memo', 2000)
    }

    /**
     * 有目标的跳：上下都行、允许跨几级台阶。
     * 先按目标平台倒算初速度，再用同一套抛物线仿真验一遍——
     * 中间要是被别的平台半路接住，就换一个落点重算，仍然不行就放弃这一跳。
     */
    const jumpToPlatform = (q: Platform, from: Platform) => {
      const down = q.t > s.y + 8
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const plan = down
          ? planJumpDown({ x: s.x, y: s.y }, from, q, { gravity: PET_GRAVITY, maxVx: 420 })
          : planJump({ x: s.x, y: s.y }, q, { gravity: PET_GRAVITY, maxVx: 420 })
        if (!plan) continue
        const hit = simulateJump(
          { x: s.x, y: s.y },
          plan.vx,
          plan.vy,
          platforms,
          { gravity: PET_GRAVITY, bounds: { left: size * 0.35, right: rect.width - size * 0.35 } },
        )
        if (!hit || hit.key !== q.key) continue
        s.vx = plan.vx
        s.vy = plan.vy
        s.tx = plan.tx
        s.face = plan.vx >= 0 ? 1 : -1
        s.plat = null
        setMode('fall')
        return true
      }
      return false
    }

    const think = () => {
      const p = platOf()
      if (!p) {
        setMode('fall')
        return
      }
      if (reduced()) {
        setMode('stand', 5)
        return
      }
      const options: { w: number; run: () => void }[] = []
      const add = (w: number, run: () => void) => {
        if (w > 0) options.push({ w, run })
      }
      add(3, () => setMode('stand', rand(1.8, 3.6)))
      // 随机往下跳：挑一个更低的平台跳过去；没有更低的就朝最近的一侧跳下边缘。
      // 之前只有向上跳（hop 给负速度），看久了像是在原地弹。
      // 有目标的跳：上下都算，隔几级台阶也能跳过去（先倒算速度，再仿真确认）
      add(4.5, () => {
        const reach = rect.height * 0.9
        const cands = platforms.filter(
          (q) => q.key !== p.key && q.r - q.l > 60 && Math.abs(q.t - s.y) < reach,
        )
        if (!cands.length) {
          setMode('stand', rand(0.6, 1.2))
          return
        }
        // 挑个方向：一半向上、一半向下，剩下的随机
        const up = cands.filter((q) => q.t < s.y - 10)
        const down = cands.filter((q) => q.t > s.y + 10)
        const roll = Math.random()
        const pool = roll < 0.45 && up.length ? up : roll < 0.85 && down.length ? down : cands
        for (let i = 0; i < 4; i += 1) {
          const target = pick(pool)
          if (jumpToPlatform(target, p)) return
        }
        setMode('stand', rand(0.5, 1))
      })
      // 目标就在自己脚下（跳不过去）：走到边上直接掉下去，落到下面那一层
      add(1.6, () => {
        const dir = s.x - p.l <= p.r - s.x ? -1 : 1
        s.x = dir < 0 ? p.l + 5 : p.r - 5
        s.vx = dir * rand(26, 64)
        s.vy = rand(30, 70)
        s.plat = null
        s.face = dir
        setMode('fall')
      })
      add(4, () => {
        s.tx = rand(p.l + 14, Math.max(p.l + 15, p.r - 14))
        s.face = s.tx >= s.x ? 1 : -1
        setMode('walk')
      })
      add(2, () => setMode('sit', rand(2.2, 4.2)))
      // 睡觉：加了各种跳跃之后，这个权重被稀释得只剩 2.7%，看一天也遇不上一次。
      // 现在 2.4 / 总数 ≈ 9%，大约十次决定里有一次趴下睡，出门在外也能碰到。
      // 刚被叫醒的四五十秒里不睡：醒了立刻又趴下，看着像没醒。
      add(performance.now() < noSleepUntil.current ? 0 : 2.4, () => {
        setMode('sleep', rand(5, 10))
        say('pet.say.sleep', 2000)
      })
      add(p.l <= 24 || p.r >= rect.width - 24 ? 1 : 0, () => {
        s.wall = p.l <= 24 && (p.r < rect.width - 24 || Math.random() < 0.5) ? -1 : 1
        s.tx = s.wall < 0 ? (size / 2) * 0.75 : rect.width - (size / 2) * 0.75
        s.face = s.tx >= s.x ? 1 : -1
        s.toWall = true
        setMode('walk')
      })

      // 没目标的小跳：就是原地蹦跶，高度随机的「小」高度，不负责跨平台
      const hop = (maxH: number, vx = 0) => {
        const k = rand(0, 1) ** 1.6
        const h = 14 + k * (maxH - 14)
        s.plat = null
        s.vy = -Math.sqrt(2 * PET_GRAVITY * h)
        s.vx = vx
        setMode('fall')
      }
      add(4, () => hop(52))
      add(1.4, () => hop(66, rand(-26, 26)))
      // 连着蹦两下，像自己玩得开心
      add(1.2, () => {
        hop(40)
        window.setTimeout(() => {
          if (!outRef.current || s.mode === 'drag') return
          hop(52)
        }, 420)
      })
      add(1.2, () => setMode('cheer', rand(0.6, 1.1)))
      add(0.9, () => {
        s.face = -s.face
        setMode('stand', rand(0.5, 1))
      })

      const total = options.reduce((sum, o) => sum + o.w, 0)
      let r = rand(0, total)
      for (const o of options) {
        r -= o.w
        if (r <= 0) {
          o.run()
          return
        }
      }
      options[0].run()
    }

    const step = (dt: number) => {
      const W = rect.width
      const H = rect.height
      const hw = size / 2

      if (s.mode === 'drag' || homing || debuting || playing) return

      if (s.mode === 'fall') {
        const prevY = s.y
        s.vy += PET_GRAVITY * dt
        s.x += s.vx * dt
        s.y += s.vy * dt

        if (s.x < hw * 0.7) {
          s.x = hw * 0.7
          if (Math.abs(s.vx) > 260 && Math.random() < 0.5 && s.y > 150) {
            s.wall = -1
            s.vx = 0
            s.vy = 0
            setMode('climb', rand(1.6, 3.2))
            return
          }
          s.vx = -s.vx * 0.5
        }
        if (s.x > W - hw * 0.7) {
          s.x = W - hw * 0.7
          if (Math.abs(s.vx) > 260 && Math.random() < 0.5 && s.y > 150) {
            s.wall = 1
            s.vx = 0
            s.vy = 0
            setMode('climb', rand(1.6, 3.2))
            return
          }
          s.vx = -s.vx * 0.5
        }

        if (s.vy > 0) {
          const hit = landingPlatform(platforms, prevY, s.y, s.x)
          if (hit) {
            land(hit)
            return
          }
        }
        if (s.y > H + 80) {
          s.y = 100
          s.vy = 0
          s.x = W * 0.5
        }
        return
      }

      if (s.mode === 'climb') {
        s.x = s.wall < 0 ? hw * 0.75 : W - hw * 0.75
        s.face = s.wall
        s.timer -= dt
        if (s.timer > 0.6) s.y -= 34 * dt
        if (s.timer <= 0 || s.y < 120) {
          s.vx = -s.wall * rand(180, 320)
          s.vy = -120
          s.plat = null
          setMode('fall')
        }
        return
      }

      const p = platOf()
      if (!p) {
        s.vx = 0
        s.vy = 0
        setMode('fall')
        return
      }
      s.y = p.t + 3
      s.x = Math.max(p.l + 6, Math.min(p.r - 6, s.x))

      if (s.mode === 'walk') {
        const dir = s.tx >= s.x ? 1 : -1
        s.face = dir
        s.x += dir * 44 * dt
        if ((dir > 0 && s.x >= s.tx) || (dir < 0 && s.x <= s.tx)) {
          s.x = s.tx
          if (s.toWall) {
            s.toWall = false
            s.wall = dir
            setMode('climb', rand(2, 3.4))
            return
          }
          setMode('stand', rand(0.6, 2))
        } else if (s.x <= p.l + 8 || s.x >= p.r - 8) {
          setMode('stand', 0.6)
        }
        return
      }

      if (s.timer > 0) {
        s.timer -= dt
        if (s.timer <= 0) think()
      } else {
        think()
      }
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
      last = now

      // 接力途中卡片被换掉 / 卸载（换焦点、切页）：这一段立刻作废
      if (debuting && (!debutWrap || !debutWrap.isConnected)) abort()

      // 它还在卡片里（或者正在走出卡片）：这一层什么都不用画
      if (!outRef.current && !debuting) return

      layer.dataset.petOut = outRef.current ? '1' : '0'

      if (!s.ready) {
        rect = layer.getBoundingClientRect()
        s.x = spawn ? spawn.x : rect.width * 0.62
        s.y = spawn ? spawn.y : 104
        s.vx = 0
        s.vy = 0
        s.plat = null
        s.ready = true
        sprite.dataset.petReady = '1'
      }

      if (now - lastScan > 240) {
        scan()
        lastScan = now
      }

      if (s.sayUntil > 0 && now > s.sayUntil) {
        s.sayUntil = 0
        setBubble(null)
      }

      if (reduced()) {
        // 减动效：只做落地，不主动走跳
        if (s.mode === 'fall' && s.vy > 0 && !homing && !debuting) {
          const prevY = s.y
          s.y += Math.max(4, s.vy * dt)
          const hit = landingPlatform(platforms, prevY, s.y, s.x)
          if (hit) land(hit)
        }
      } else {
        step(dt)
      }

      paint()
    }

    raf = requestAnimationFrame(frame)
    return () => {
      alive = false
      debutTok += 1
      cancelAnimationFrame(raf)
      clearDebutDom()
      if (hotOn) callbacks.current.onHomeHot?.(false)
      apiRef.current = null
    }
  }, [positionBubble, say, setMode, size, spawn])

  // 外部动作的反馈：记一次 / 形态升级 / 切焦点 / 被戳
  useEffect(() => {
    if (logSeq > 0) apiRef.current?.react('log')
  }, [logSeq])
  useEffect(() => {
    if (milestoneSeq > 0) apiRef.current?.react('milestone')
  }, [milestoneSeq])
  useEffect(() => {
    if (focusSeq > 0) apiRef.current?.react('focus')
  }, [focusSeq])
  useEffect(() => {
    if (pokeSeq > 0) apiRef.current?.react('poke')
  }, [pokeSeq])

  // 外面让它「出去」：连戳三下 / 演示时 +1，就播一遍四段接力
  useEffect(() => {
    if (debutSeq <= 0) return
    apiRef.current?.debut()
  }, [debutSeq])

  // 串门时连戳三下：两只凑到一起玩，主人不出门
  useEffect(() => {
    if (playSeq <= 0) return
    apiRef.current?.play()
  }, [playSeq])

  // 关掉桌宠（或换焦点、离开今天页）：它回卡片原位，不是凭空消失
  useEffect(() => {
    const next = out ?? true
    const was = outRef.current
    outRef.current = next
    if (!next && was) apiRef.current?.retire()
  }, [out])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const layer = layerRef.current
    if (!layer || !outRef.current) return
    const rect = layer.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const s = sim.current
    dragRef.current = {
      id: e.pointerId,
      dx: s.x - px,
      dy: s.y - py,
      sx: e.clientX,
      sy: e.clientY,
      t: performance.now(),
      moved: false,
      samples: [],
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    const layer = layerRef.current
    if (!d || d.id !== e.pointerId || !layer) return
    const s = sim.current
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) {
      d.moved = true
      s.plat = null
      s.vx = 0
      s.vy = 0
      setMode('drag')
      say('pet.say.drag', 1200)
    }
    if (!d.moved) return
    const rect = layer.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    s.x = Math.max(size * 0.35, Math.min(rect.width - size * 0.35, px + d.dx))
    s.y = Math.max(size * 0.5, Math.min(rect.height - 4, py + d.dy))
    d.samples.push([performance.now(), px, py])
    if (d.samples.length > 6) d.samples.shift()
    // 拖到卡片原位上方：家亮起来，告诉用户可以放回去了
    apiRef.current?.hot()
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    dragRef.current = null
    const s = sim.current
    if (d.moved) {
      // 松手时还在原位里 → 回家，而不是抛出去
      if (apiRef.current?.hot()) {
        apiRef.current.goHome()
        return
      }
      const v = throwVelocity(d.samples)
      s.vx = v.vx
      s.vy = v.vy
      s.face = v.vx >= 0 ? 1 : -1
      s.plat = null
      setMode('fall')
      if (Math.hypot(v.vx, v.vy) > 700) say('pet.say.throw', 1400)
    } else if (performance.now() - d.t >= 650) {
      // 按住不动：等于按住卡片下方那颗按钮，记一次
      apiRef.current?.react('log')
      onHoldLog?.()
      say('pet.say.logged', 2000)
    } else if (performance.now() - d.t < 450) {
      // 睡着的时候点它 = 叫醒：先迷糊一下，再蹦起来
      if (s.mode === 'sleep') {
        setMode('cheer', 1.1)
        say('pet.say.wake', 2200)
        // 醒来之后至少 45 秒内不再睡
        noSleepUntil.current = performance.now() + rand(45000, 75000)
        onWake?.()
      } else {
        setMode('cheer', 0.9)
        say(pick(['pet.say.poke', 'pet.say.hello', 'pet.say.cheer'] as const), 2200)
      }
    }
  }

  return (
    <div
      className="pet-layer"
      ref={layerRef}
      data-pet-out={(out ?? true) ? '1' : '0'}
      /* 调试用：现在在干嘛（sleep / walk / sit / cheer …） */
      data-mode={view}
    >
      <div
        className="pet-sprite"
        ref={spriteRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Pet species={species} stage={stage} state={view} size={size} hue={hue} />
      </div>
      {bubble ? (
        <div className="pet-say on" ref={sayRef} key={bubble.id} data-dir="t">
          {bubble.text}
        </div>
      ) : null}
    </div>
  )
}
