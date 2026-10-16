/**
 * 氛围音效：全部用 Web Audio 实时合成。
 *
 * 不加音频文件、不联网，所以离线可用、零体积、没有版权问题。
 * 每个声音都是分层的（瞬态 + 主体 + 混响尾），并且每次播放都有轻微随机，
 * 同一个音效连按两次不会一模一样——这是"不像电子音"的关键。
 *
 * 三条纪律：
 * 1. AudioContext 必须等用户手势才能出声（iOS 尤其），所以只在这里惰性创建。
 * 2. 音效永远不许把应用弄崩：所有播放都包在 try 里。
 * 3. 认不出来的 id 直接静默——长尾节日本来就不配音效。
 */

export type SfxId =
  | 'firecracker' // 春节 · 整串挂鞭
  | 'drum' // 端午 · 龙舟鼓
  | 'bell' // 元旦 · 钟声
  | 'ghost' // 万圣夜 · 鬼叫
  | 'jingle' // 圣诞节 · 铃铛
  | 'gulp' // 喝水 · 吨吨吨
  | 'steps' // 跑步 · 脚步

const SOUND_KEY = 'daymark.sound.v1'

let context: AudioContext | null = null
let impulseBuffer: AudioBuffer | null = null
let muted = readMuted()

function readMuted(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === 'off'
  } catch {
    return false
  }
}

export function isSoundOn(): boolean {
  return !muted
}

export function setSoundOn(on: boolean): void {
  muted = !on
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    /* 私密模式写不进去也不影响本次会话 */
  }
}

/** 切换并返回切换后的状态 */
export function toggleSound(): boolean {
  setSoundOn(muted)
  return !muted
}

/** 惰性创建；被挂起时唤醒（iOS 上第一次必须由点击触发） */
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      context = new Ctor()
    } catch {
      return null
    }
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

/** 一段白噪声 */
function noise(ac: AudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ac.sampleRate * seconds))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

const rnd = (min: number, max: number): number => min + Math.random() * (max - min)

/** 自建脉冲响应：噪声 × 指数衰减 + 几个早期反射。建一次缓存起来 */
function impulse(ac: AudioContext): AudioBuffer {
  if (impulseBuffer && impulseBuffer.sampleRate === ac.sampleRate) return impulseBuffer
  const len = Math.floor(ac.sampleRate * 2.4)
  const buf = ac.createBuffer(2, len, ac.sampleRate)
  const taps = [0.011, 0.019, 0.031, 0.047]
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4)
    }
    taps.forEach((tap, k) => {
      const idx = Math.floor(tap * ac.sampleRate) + ch * 37
      if (idx < len) data[idx] += (k % 2 ? -0.55 : 0.7) * (1 - k * 0.15)
    })
  }
  impulseBuffer = buf
  return buf
}

/** 干声 + 混响送出，返回两个入口 */
type Bus = { dry: GainNode; send: GainNode }

function reverb(ac: AudioContext, wet: number): Bus {
  const dry = ac.createGain()
  dry.connect(ac.destination)
  const send = ac.createGain()
  send.gain.value = wet
  const conv = ac.createConvolver()
  conv.buffer = impulse(ac)
  send.connect(conv)
  conv.connect(ac.destination)
  return { dry, send }
}

/** 把某个节点同时接进干声和混响 */
function both(node: AudioNode, bus: { dry: GainNode; send: GainNode }): void {
  node.connect(bus.dry)
  node.connect(bus.send)
}

/** 一次性收尾：到点自动断开，避免节点堆积 */
function stopAt(node: AudioScheduledSourceNode, at: number): void {
  node.stop(at)
}

/* ------------------------------------------------------------------ *
 * 春节 · 整串挂鞭：引信 → 疏密不均的一串小爆 → 收一颗重的
 * ------------------------------------------------------------------ */

function firecracker(ac: AudioContext, bus: Bus, t0: number): void {
  const start = t0 + 0.24
  const duration = 2.35

  // 引信
  const fuse = ac.createBufferSource()
  fuse.buffer = noise(ac, 0.3)
  const fuseHp = ac.createBiquadFilter()
  fuseHp.type = 'highpass'
  fuseHp.frequency.value = 4200
  const fuseGain = ac.createGain()
  fuseGain.gain.setValueAtTime(0.0001, t0)
  fuseGain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.14)
  fuseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24)
  fuse.connect(fuseHp)
  fuseHp.connect(fuseGain)
  both(fuseGain, bus)
  fuse.start(t0)

  const pop = (at: number, amp: number, bright: number): void => {
    const src = ac.createBufferSource()
    src.buffer = noise(ac, 0.14)
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(bright, at)
    lp.frequency.exponentialRampToValueAtTime(bright * 0.15, at + 0.07)
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = rnd(160, 420)
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(amp, at + 0.0012)
    gain.gain.exponentialRampToValueAtTime(0.0004, at + rnd(0.03, 0.075))
    src.connect(lp)
    lp.connect(hp)
    hp.connect(gain)
    both(gain, bus)
    src.start(at)
  }

  const boom = (at: number, amp: number): void => {
    pop(at, amp, 12000)
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, at)
    osc.frequency.exponentialRampToValueAtTime(52, at + 0.26)
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(amp * 0.75, at + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0004, at + 0.36)
    osc.connect(gain)
    both(gain, bus)
    osc.start(at)
    stopAt(osc, at + 0.4)
  }

  // 节奏做成"疏—密—疏"，中段最密，听感才是噼里啪啦而不是机关枪
  let at = start
  while (at < start + duration) {
    const progress = (at - start) / duration
    const density = 0.055 + 0.075 * Math.abs(progress - 0.45) * 2
    if (Math.random() < 0.13) boom(at, rnd(0.5, 0.75))
    else pop(at, rnd(0.16, 0.42), rnd(6500, 13000))
    if (Math.random() < 0.45) pop(at + rnd(0.008, 0.03), rnd(0.1, 0.3), rnd(7000, 14000))
    if (Math.random() < 0.25) pop(at + rnd(0.03, 0.055), rnd(0.08, 0.22), rnd(7000, 14000))
    at += rnd(density * 0.45, density * 1.35)
  }
  boom(start + duration + 0.04, 0.8)
  for (let k = 0; k < 5; k++) {
    pop(start + duration + 0.1 + rnd(0.02, 0.5), rnd(0.05, 0.16), rnd(6000, 11000))
  }
}

/* ------------------------------------------------------------------ *
 * 端午 · 龙舟鼓：咚 · 咚 · 咚咚
 * ------------------------------------------------------------------ */

function drum(ac: AudioContext, bus: Bus, t0: number): void {
  // 时刻统一抬到 t0 之后，否则第二次播放时这些点都在"过去"，包络会被跳过
  const hits = [
    { at: 0, freq: 78, amp: 1, big: true },
    { at: 0.42, freq: 78, amp: 0.85, big: true },
    { at: 0.78, freq: 92, amp: 0.6, big: false },
    { at: 0.94, freq: 86, amp: 0.7, big: true },
    { at: 1.24, freq: 78, amp: 0.95, big: true },
  ].map((hit) => ({ ...hit, at: t0 + hit.at }))
  for (const hit of hits) {
    const life = hit.big ? 0.5 : 0.26
    const skin = ac.createOscillator()
    skin.type = 'sine'
    skin.frequency.setValueAtTime(hit.freq * 1.9, hit.at)
    skin.frequency.exponentialRampToValueAtTime(hit.freq * 0.82, hit.at + (hit.big ? 0.28 : 0.16))
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0001, hit.at)
    gain.gain.exponentialRampToValueAtTime(hit.amp * 0.95, hit.at + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0004, hit.at + life)
    skin.connect(gain)
    both(gain, bus)
    skin.start(hit.at)
    stopAt(skin, hit.at + life + 0.05)

    // 鼓皮泛音是非谐的，才有"皮"的听感
    for (const partial of [
      { ratio: 1.86, amp: 0.22 },
      { ratio: 2.94, amp: 0.12 },
    ]) {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(hit.freq * partial.ratio, hit.at)
      osc.frequency.exponentialRampToValueAtTime(hit.freq * partial.ratio * 0.92, hit.at + 0.2)
      const pg = ac.createGain()
      pg.gain.setValueAtTime(0.0001, hit.at)
      pg.gain.exponentialRampToValueAtTime(hit.amp * partial.amp, hit.at + 0.003)
      pg.gain.exponentialRampToValueAtTime(0.0003, hit.at + 0.22)
      osc.connect(pg)
      both(pg, bus)
      osc.start(hit.at)
      stopAt(osc, hit.at + 0.27)
    }

    // 槌击瞬态
    const hitSrc = ac.createBufferSource()
    hitSrc.buffer = noise(ac, 0.05)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = rnd(2200, 3400)
    bp.Q.value = 1.2
    const hg = ac.createGain()
    hg.gain.setValueAtTime(0.0001, hit.at)
    hg.gain.exponentialRampToValueAtTime(hit.amp * 0.3, hit.at + 0.002)
    hg.gain.exponentialRampToValueAtTime(0.0002, hit.at + 0.035)
    hitSrc.connect(bp)
    bp.connect(hg)
    both(hg, bus)
    hitSrc.start(hit.at)
  }
}

/* ------------------------------------------------------------------ *
 * 元旦 · 钟声：撞三下，非谐分音各自衰减
 * ------------------------------------------------------------------ */

function bell(ac: AudioContext, bus: Bus, t0: number): void {
  const partials = [
    { ratio: 0.5, amp: 0.5, decay: 3.2 },
    { ratio: 1, amp: 0.42, decay: 2.9 },
    { ratio: 1.19, amp: 0.3, decay: 2.4 },
    { ratio: 1.56, amp: 0.22, decay: 2 },
    { ratio: 2, amp: 0.16, decay: 1.5 },
    { ratio: 2.51, amp: 0.12, decay: 1.1 },
    { ratio: 3.01, amp: 0.08, decay: 0.8 },
    { ratio: 4.17, amp: 0.05, decay: 0.6 },
  ]
  ;[0, 1.35, 2.6].forEach((offset, index) => {
    const at = t0 + offset
    partials.forEach((partial, k) => {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 262 * partial.ratio * rnd(0.999, 1.001)
      const gain = ac.createGain()
      const amp = partial.amp * (index === 2 ? 1 : 0.8) * 0.72
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(amp, at + 0.004 + k * 0.0015)
      gain.gain.exponentialRampToValueAtTime(0.0002, at + partial.decay)
      osc.connect(gain)
      both(gain, bus)
      osc.start(at)
      stopAt(osc, at + partial.decay + 0.05)
    })
    const strike = ac.createBufferSource()
    strike.buffer = noise(ac, 0.09)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2600
    bp.Q.value = 1.6
    const sg = ac.createGain()
    sg.gain.setValueAtTime(0.0001, at)
    sg.gain.exponentialRampToValueAtTime(0.2, at + 0.002)
    sg.gain.exponentialRampToValueAtTime(0.0002, at + 0.09)
    strike.connect(bp)
    bp.connect(sg)
    both(sg, bus)
    strike.start(at)
  })
}

/* ------------------------------------------------------------------ *
 * 万圣夜 · 鬼叫：双层失谐 + 共振峰移动 + 气声
 * ------------------------------------------------------------------ */

function ghost(ac: AudioContext, bus: Bus, t0: number): void {
  // 这个渲染器所有时刻都由 start 推出来，抬一次就够
  const start = t0
  const stop = t0 + 1.9

  const voice = ac.createGain()
  voice.gain.setValueAtTime(0.0001, start)
  voice.gain.linearRampToValueAtTime(0.5, start + 0.3)
  voice.gain.linearRampToValueAtTime(0.42, start + 1.2)
  voice.gain.exponentialRampToValueAtTime(0.0004, start + 1.85)

  for (const detune of [0, 7]) {
    const osc = ac.createOscillator()
    osc.type = 'sawtooth'
    osc.detune.value = detune
    osc.frequency.setValueAtTime(285, start)
    osc.frequency.linearRampToValueAtTime(470, start + 0.55)
    osc.frequency.linearRampToValueAtTime(215, start + 1.45)
    const vibrato = ac.createOscillator()
    vibrato.frequency.value = rnd(5.4, 6.6)
    const vibratoGain = ac.createGain()
    vibratoGain.gain.value = 22
    vibrato.connect(vibratoGain)
    vibratoGain.connect(osc.frequency)
    osc.connect(voice)
    osc.start(start)
    stopAt(osc, stop)
    vibrato.start(start)
    stopAt(vibrato, stop)
  }

  // 共振峰移动 = "呜"到"哦"的听感
  const formant1 = ac.createBiquadFilter()
  formant1.type = 'bandpass'
  formant1.Q.value = 5.5
  formant1.frequency.setValueAtTime(520, start)
  formant1.frequency.linearRampToValueAtTime(1150, start + 0.6)
  formant1.frequency.linearRampToValueAtTime(430, start + 1.5)
  const formant2 = ac.createBiquadFilter()
  formant2.type = 'peaking'
  formant2.Q.value = 3
  formant2.gain.value = 7
  formant2.frequency.setValueAtTime(1500, start)
  formant2.frequency.linearRampToValueAtTime(2100, start + 0.7)
  formant2.frequency.linearRampToValueAtTime(1100, start + 1.5)
  voice.connect(formant1)
  formant1.connect(formant2)
  both(formant2, bus)

  // 气声层，让声音有"呼吸"
  const breath = ac.createBufferSource()
  breath.buffer = noise(ac, 1.9)
  const breathHp = ac.createBiquadFilter()
  breathHp.type = 'bandpass'
  breathHp.frequency.value = 1900
  breathHp.Q.value = 0.8
  const breathGain = ac.createGain()
  breathGain.gain.setValueAtTime(0.0001, start)
  breathGain.gain.linearRampToValueAtTime(0.045, start + 0.4)
  breathGain.gain.linearRampToValueAtTime(0.02, start + 1.3)
  breathGain.gain.exponentialRampToValueAtTime(0.0002, start + 1.85)
  breath.connect(breathHp)
  breathHp.connect(breathGain)
  both(breathGain, bus)
  breath.start(start)
}

/* ------------------------------------------------------------------ *
 * 圣诞节 · 铃铛：模态合成 + 敲击瞬态
 * ------------------------------------------------------------------ */

function jingle(ac: AudioContext, bus: Bus, t0: number): void {
  const partials = [
    { ratio: 1, amp: 0.5, decay: 0.5 },
    { ratio: 2.76, amp: 0.28, decay: 0.32 },
    { ratio: 5.4, amp: 0.16, decay: 0.2 },
    { ratio: 8.93, amp: 0.09, decay: 0.14 },
  ]
  ;[1568, 2093, 1568, 2637].forEach((freq, index) => {
    const at = t0 + index * 0.115
    partials.forEach((partial, k) => {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq * partial.ratio * rnd(0.998, 1.002)
      const gain = ac.createGain()
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(partial.amp, at + 0.003 + k * 0.001)
      gain.gain.exponentialRampToValueAtTime(0.0002, at + partial.decay)
      osc.connect(gain)
      both(gain, bus)
      osc.start(at)
      stopAt(osc, at + partial.decay + 0.05)
    })
    const hit = ac.createBufferSource()
    hit.buffer = noise(ac, 0.03)
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 5200
    const hg = ac.createGain()
    hg.gain.setValueAtTime(0.0001, at)
    hg.gain.exponentialRampToValueAtTime(0.14, at + 0.001)
    hg.gain.exponentialRampToValueAtTime(0.0001, at + 0.02)
    hit.connect(hp)
    hp.connect(hg)
    both(hg, bus)
    hit.start(at)
  })
}

/* ------------------------------------------------------------------ *
 * 喝水 · 吨吨吨：三下吞咽 + 一串随机气泡（音高上滑，真实气泡就是这样）
 * ------------------------------------------------------------------ */

function gulp(ac: AudioContext, bus: Bus, t0: number): void {
  for (let i = 0; i < 3; i++) {
    const at = t0 + 0.03 + i * rnd(0.2, 0.26)
    const osc = ac.createOscillator()
    osc.type = 'sine'
    const base = rnd(175, 205) - i * 12
    osc.frequency.setValueAtTime(base, at)
    osc.frequency.exponentialRampToValueAtTime(base * 0.62, at + 0.12)
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1100
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.5, at + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0005, at + 0.14)
    osc.connect(lp)
    lp.connect(gain)
    both(gain, bus)
    osc.start(at)
    stopAt(osc, at + 0.16)

    const air = ac.createBufferSource()
    air.buffer = noise(ac, 0.1)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 900
    bp.Q.value = 1.1
    const ag = ac.createGain()
    ag.gain.setValueAtTime(0.0001, at)
    ag.gain.exponentialRampToValueAtTime(0.1, at + 0.01)
    ag.gain.exponentialRampToValueAtTime(0.0004, at + 0.1)
    air.connect(bp)
    bp.connect(ag)
    both(ag, bus)
    air.start(at)
  }

  for (let i = 0; i < 14; i++) {
    const at = t0 + rnd(0.02, 0.62)
    const f0 = rnd(420, 1150)
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f0, at)
    osc.frequency.exponentialRampToValueAtTime(f0 * rnd(1.6, 2.4), at + rnd(0.02, 0.05))
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(rnd(0.05, 0.17), at + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0002, at + rnd(0.025, 0.07))
    osc.connect(gain)
    both(gain, bus)
    osc.start(at)
    stopAt(osc, at + 0.09)
  }
}

/* ------------------------------------------------------------------ *
 * 跑步 · 脚步：落地撞击 + 摩擦 + 呼吸
 * ------------------------------------------------------------------ */

function steps(ac: AudioContext, bus: Bus, t0: number): void {
  for (let i = 0; i < 6; i++) {
    const at = t0 + 0.05 + i * 0.29 + rnd(-0.012, 0.012)
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(rnd(95, 120), at)
    osc.frequency.exponentialRampToValueAtTime(48, at + 0.09)
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(rnd(0.35, 0.55), at + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0004, at + 0.14)
    osc.connect(gain)
    both(gain, bus)
    osc.start(at)
    stopAt(osc, at + 0.16)

    const scuff = ac.createBufferSource()
    scuff.buffer = noise(ac, 0.1)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = rnd(1400, 2600)
    bp.Q.value = 0.9
    const sg = ac.createGain()
    sg.gain.setValueAtTime(0.0001, at)
    sg.gain.exponentialRampToValueAtTime(rnd(0.1, 0.22), at + 0.006)
    sg.gain.exponentialRampToValueAtTime(0.0002, at + 0.08)
    scuff.connect(bp)
    bp.connect(sg)
    both(sg, bus)
    scuff.start(at)
  }

  for (let i = 0; i < 2; i++) {
    const at = t0 + 0.12 + i * 0.85
    const breath = ac.createBufferSource()
    breath.buffer = noise(ac, 0.5)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(700, at)
    bp.frequency.linearRampToValueAtTime(1100, at + 0.25)
    bp.Q.value = 1.1
    const bg = ac.createGain()
    bg.gain.setValueAtTime(0.0001, at)
    bg.gain.linearRampToValueAtTime(0.055, at + 0.16)
    bg.gain.linearRampToValueAtTime(0.0002, at + 0.44)
    breath.connect(bp)
    bp.connect(bg)
    both(bg, bus)
    breath.start(at)
  }
}

/* ------------------------------------------------------------------ *
 * 播放
 * ------------------------------------------------------------------ */

const RENDERERS: Record<SfxId, (ac: AudioContext, bus: Bus, t0: number) => void> = {
  firecracker,
  drum,
  bell,
  ghost,
  jingle,
  gulp,
  steps,
}

/** 每个音效的干湿度：室内小声音少送一点，室外大响动多送一点 */
const WET: Record<SfxId, number> = {
  firecracker: 0.42,
  drum: 0.5,
  bell: 0.9,
  ghost: 0.85,
  jingle: 0.42,
  gulp: 0.28,
  steps: 0.22,
}

export function hasSfx(id: string | undefined): id is SfxId {
  return !!id && id in RENDERERS
}

/** 放一个音效。静音、不支持、或者出任何岔子都安静地什么都不做 */
export function playSfx(id: string | undefined): void {
  if (muted || !hasSfx(id)) return
  const ac = audio()
  if (!ac) return
  try {
    // 关键：所有时刻都从 currentTime 起算。写死从 0 开始的话，
    // 第二次播放时那些自动化点全在过去，包络会被直接跳到终值，声音就没了。
    const t0 = ac.currentTime + 0.02
    RENDERERS[id](ac, reverb(ac, WET[id]), t0)
  } catch {
    /* 音效是锦上添花，绝不因为它弄崩应用 */
  }
}

/** 只有这几个关键节日配音效，长尾节日保持安静 */
export const FESTIVAL_SFX: Record<string, SfxId> = {
  'spring-festival': 'firecracker', // 春节 · 整串挂鞭
  'dragon-boat': 'drum', // 端午 · 龙舟鼓
  'new-year': 'bell', // 元旦 · 钟声
  halloween: 'ghost', // 万圣夜 · 鬼叫
  'christmas-eve': 'jingle', // 平安夜 · 铃铛
  christmas: 'jingle', // 圣诞节 · 铃铛
}

export function festivalSfx(festivalId: string | undefined): SfxId | undefined {
  return festivalId ? FESTIVAL_SFX[festivalId] : undefined
}
