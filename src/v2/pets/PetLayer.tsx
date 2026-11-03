import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { t } from '../../lib/i18n'
import type { MessageKey } from '../../lib/i18n'
import { Pet } from './Pet'
import type { PetSpecies, PetStage, PetState } from './art'
import { landingPlatform, placeBubble, throwVelocity, type Platform } from './geometry'
import '../pets.css'

/** 重力（px/s²） */
export const PET_GRAVITY = 2200
/** 可站立的东西：页面里真实的卡片、按钮、底栏 */
export const PET_PLATFORM_SELECTORS = [
  '.pet-plat',
  '.stage-card',
  '.tabbar',
  '.btn',
  '.card',
  // 不把 .growth 当平台：它上面就是「2026年 · 1个月10天」那行小字，
  // 宠物站上去正好把字压住（真机截图量过）。
  '[data-pet-platform]',
] as const

export type PetLayerProps = {
  species: PetSpecies
  stage: PetStage
  /** 配色索引 0–7 */
  hue?: number
  /** 宠物高度（px），脚底落在 93% 处 */
  size?: number
  /** 初始脚底位置（层内 px）；不给就从上方掉下来 */
  spawn?: { x: number; y: number }
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
const reduced = () =>
  document.documentElement.classList.contains('reduce-motion') ||
  (typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches)

/**
 * 宠物层：盖满宿主容器的一层，只有精灵自己接收指针。
 * 平台、重力、落地、random walk、拖拽抛出、点一下撒娇都在这里。
 */
export function PetLayer({ species, stage, hue = 4, size = 92, spawn }: PetLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null)
  const spriteRef = useRef<HTMLDivElement | null>(null)
  const sayRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const bubbleSeq = useRef(0)
  const [view, setView] = useState<PetState>('fall')
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

    const scan = () => {
      rect = layer.getBoundingClientRect()
      const out: Platform[] = []
      const seen = new Set<Element>()
      for (const sel of PET_PLATFORM_SELECTORS) {
        host.querySelectorAll<HTMLElement>(sel).forEach((el, index) => {
          if (seen.has(el) || layer.contains(el)) return
          seen.add(el)
          const b = el.getBoundingClientRect()
          if (b.width < 36 || b.height < 6) return
          const l = b.left - rect.left
          const r = b.right - rect.left
          const top = b.top - rect.top
          if (r < 8 || l > rect.width - 8) return
          // 状态栏下面才算平台；太靠底也别算（底栏本身除外）
          if (top < 44 || top > rect.height - 30) return
          out.push({ key: `${sel}#${index}`, l, r, t: top })
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

    const land = (p: Platform) => {
      const hard = s.vy > 760
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
    }

    const jumpTo = (q: Platform) => {
      const lo = Math.max(q.l + 14, s.x - 190)
      const hi = Math.min(q.r - 14, s.x + 190)
      if (hi <= lo) return false
      const tx = rand(lo, hi)
      const ty = q.t + 3
      const T = 0.52 + Math.abs(tx - s.x) * 0.0007 + Math.max(0, s.y - ty) * 0.0009
      const vx = (tx - s.x) / T
      const vy = (ty - s.y) / T - 0.5 * PET_GRAVITY * T
      if (Math.abs(vy) > 1500) return false
      s.vx = vx
      s.vy = vy
      s.face = vx >= 0 ? 1 : -1
      s.plat = null
      setMode('fall')
      return true
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
      add(4, () => {
        s.tx = rand(p.l + 14, Math.max(p.l + 15, p.r - 14))
        s.face = s.tx >= s.x ? 1 : -1
        setMode('walk')
      })
      add(2, () => setMode('sit', rand(2.2, 4.2)))
      add(0.7, () => {
        setMode('sleep', rand(4, 8))
        say('pet.say.sleep', 2000)
      })
      add(1.6, () => {
        const cands = platforms.filter(
          (q) => q.key !== p.key && q.r - q.l > 70 && Math.abs(q.t - s.y) < 340,
        )
        if (!cands.length) {
          setMode('stand', 1)
          return
        }
        if (!jumpTo(pick(cands))) setMode('stand', 1)
      })
      add(p.l <= 24 || p.r >= rect.width - 24 ? 1 : 0, () => {
        s.wall = p.l <= 24 && (p.r < rect.width - 24 || Math.random() < 0.5) ? -1 : 1
        s.tx = s.wall < 0 ? (size / 2) * 0.75 : rect.width - (size / 2) * 0.75
        s.face = s.tx >= s.x ? 1 : -1
        s.toWall = true
        setMode('walk')
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

      if (s.mode === 'drag') return

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
        if (s.mode === 'fall' && s.vy > 0) {
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
    return () => cancelAnimationFrame(raf)
  }, [positionBubble, say, setMode, size, spawn])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const layer = layerRef.current
    if (!layer) return
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
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    dragRef.current = null
    const s = sim.current
    if (d.moved) {
      const v = throwVelocity(d.samples)
      s.vx = v.vx
      s.vy = v.vy
      s.face = v.vx >= 0 ? 1 : -1
      s.plat = null
      setMode('fall')
      if (Math.hypot(v.vx, v.vy) > 700) say('pet.say.throw', 1400)
    } else if (performance.now() - d.t < 450) {
      setMode('cheer', 0.9)
      say(pick(['pet.say.poke', 'pet.say.hello', 'pet.say.cheer'] as const), 2200)
    }
  }

  return (
    <div className="pet-layer" ref={layerRef}>
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
