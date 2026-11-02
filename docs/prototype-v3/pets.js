/*
 * 桌面宠物引擎（自研，不含任何 Shimeji 代码）。
 *
 * - 宠物生活在手机屏幕之上的一层里，把页面里的 DOM 元素当「平台」：站在卡片、按钮、底部导航上，
 *   会走、坐、睡、跳到别的元素上、爬屏幕边缘、被拎起来扔出去（重力 + 弹跳）。
 * - 与功能组件联动：长按「记一下」按钮时它跑过去加油；记下后跳起来庆祝；
 *   焦点那件事睡着了它也跟着打盹；坚持类的页面里它在「日子轨道」上自己往前走。
 * - 素材是「宠物包」：{ states:{ stand/walk/sit/... : [{src,dur,anchor}] } }。
 *   内置一套原创的「麻糬」矢量包；也能导入 Shimeji 格式的本地包（shimeN.png + actions.xml），
 *   只在本机浏览器里读取，不会进仓库、不会上传。真实 Shimeji 素材多为同人创作，见 docs/prototype-v3/README.md 的版权说明。
 *
 * 出场：舞台卡上的成长萌宠往上走进去、变小、踏上小台阶，再从中间跳下，交接给桌宠引擎。
 * 对外：DM.pets = { setEnabled, setPack, pickLocal, importFiles, say, summon, hop, debut, state }
 */
;(function () {
  'use strict'
  const DM = window.DM
  const S = DM.S
  const G = 2200 // px/s²
  const TICK = 40 // Shimeji 的一个 tick = 40ms

  // ================================================================ 内置宠物包：麻糬

  const INK = '#2b2638'
  const EYES = {
    open: `<circle cx="31" cy="48" r="3.4" fill="${INK}"/><circle cx="49" cy="48" r="3.4" fill="${INK}"/><circle cx="32.2" cy="46.8" r="1.1" fill="#fff"/><circle cx="50.2" cy="46.8" r="1.1" fill="#fff"/>`,
    wide: `<circle cx="31" cy="47" r="4.4" fill="${INK}"/><circle cx="49" cy="47" r="4.4" fill="${INK}"/><circle cx="32.4" cy="45.4" r="1.5" fill="#fff"/><circle cx="50.4" cy="45.4" r="1.5" fill="#fff"/>`,
    closed: `<path d="M27 49 q4 3.2 8 0 M45 49 q4 3.2 8 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    happy: `<path d="M27 51 q4 -6 8 0 M45 51 q4 -6 8 0" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`,
    squeeze: `<path d="M27 45 l7 3.5 l-7 3.5 M53 45 l-7 3.5 l7 3.5" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  }
  const MOUTH = {
    smile: `<path d="M36 55.5 q4 4 8 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    open: `<path d="M34.5 54 q5.5 9 11 0 z" fill="#e5664b" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
    o: `<ellipse cx="40" cy="57" rx="2.8" ry="3.8" fill="#e5664b" stroke="${INK}" stroke-width="2"/>`,
    flat: `<path d="M37 56.5 h6" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
    wavy: `<path d="M34 57 q2 -3 4 0 t4 0 t4 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  }
  const ZZ = {
    z1: `<text x="56" y="24" font-size="14" font-weight="800" fill="#7a5ae0" font-family="Arial,sans-serif">z</text>`,
    z2: `<text x="54" y="26" font-size="11" font-weight="800" fill="#7a5ae0" font-family="Arial,sans-serif">z</text><text x="62" y="15" font-size="15" font-weight="800" fill="#7a5ae0" font-family="Arial,sans-serif">Z</text>`,
  }

  function mochiSvg(o) {
    const { sx = 1, sy = 1, tilt = 0, eyes = 'open', mouth = 'smile', lf = 0, rf = 0, la = 0, ra = 0, dx = 0, dy = 0, lx = 0, extra = '', blush = 1 } = o
    const arm = (cx, ang) => `<ellipse cx="${cx}" cy="52" rx="5" ry="8.5" transform="rotate(${ang} ${cx} 46)" fill="#fffaf0" stroke="${INK}" stroke-width="2.6"/>`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffe7d4"/></linearGradient></defs>
<ellipse cx="40" cy="75.5" rx="22" ry="3" fill="#2b2638" opacity=".12"/>
<g transform="translate(${dx} ${dy}) translate(40 75) rotate(${tilt}) scale(${sx} ${sy}) translate(-40 -75)">
<ellipse cx="30" cy="${72 - lf}" rx="7" ry="4.2" fill="#fffaf0" stroke="${INK}" stroke-width="2.6"/>
<ellipse cx="50" cy="${72 - rf}" rx="7" ry="4.2" fill="#fffaf0" stroke="${INK}" stroke-width="2.6"/>
${arm(16, 12 + la)}${arm(64, -12 + ra)}
<path d="M14 58 C14 30 26 21 40 21 C54 21 66 30 66 58 C66 68.5 56 73 40 73 C24 73 14 68.5 14 58 Z" fill="url(#g)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<path d="M22 36 q3 -6 9 -9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/>
<path d="M40 21 C40 14 37 10.5 32 9 C32 14.5 35 18.5 40 21 Z" fill="#7bd389" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M40 21 C41 14 45 11 50 11.5 C49 17 45 20.5 40 21 Z" fill="#9be3a4" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
<g transform="translate(${lx} 0)">${EYES[eyes]}${MOUTH[mouth]}
${blush ? '<ellipse cx="23.5" cy="56.5" rx="4.2" ry="2.6" fill="#ff9c9c" opacity=".65"/><ellipse cx="56.5" cy="56.5" rx="4.2" ry="2.6" fill="#ff9c9c" opacity=".65"/>' : ''}</g>
</g>${ZZ[extra] || ''}
</svg>`
  }
  const uri = (o) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(mochiSvg(o))
  const fr = (list) => list.map(([o, d]) => ({ src: uri(o), dur: d, anchor: [40, 75], w: 80, h: 80 }))

  const cheer = [
    [{ sy: 0.9, sx: 1.07, eyes: 'happy', mouth: 'open', la: -55, ra: 55 }, 170],
    [{ sy: 1.1, sx: 0.94, eyes: 'happy', mouth: 'open', la: -85, ra: 85, dy: -3 }, 170],
  ]
  const MOCHI = {
    id: 'mochi',
    name: '麻糬',
    face: 'right',
    scale: 0.92,
    states: {
      stand: fr([[{}, 1800], [{ eyes: 'closed' }, 140], [{}, 1300], [{ sy: 0.97, sx: 1.02 }, 520]]),
      look: fr([[{ lx: -3 }, 900], [{ lx: 3 }, 900], [{}, 400]]),
      walk: fr([[{ lf: 5, tilt: -3, dy: -1 }, 130], [{ dy: -3 }, 110], [{ rf: 5, tilt: 3, dy: -1 }, 130], [{ dy: -3 }, 110]]),
      run: fr([[{ lf: 7, tilt: -7, dy: -2, eyes: 'wide' }, 80], [{ dy: -5, eyes: 'wide' }, 70], [{ rf: 7, tilt: 7, dy: -2, eyes: 'wide' }, 80], [{ dy: -5, eyes: 'wide' }, 70]]),
      sit: fr([[{ sy: 0.88, sx: 1.07, lf: -2, rf: -2 }, 2000], [{ sy: 0.88, sx: 1.07, eyes: 'closed' }, 140], [{ sy: 0.88, sx: 1.07 }, 900]]),
      sleep: fr([[{ sy: 0.86, sx: 1.09, eyes: 'closed', tilt: 5, mouth: 'flat', extra: 'z1' }, 1000], [{ sy: 0.83, sx: 1.11, eyes: 'closed', tilt: 5, mouth: 'flat', extra: 'z2' }, 1000]]),
      fall: fr([[{ sy: 1.1, sx: 0.93, eyes: 'wide', mouth: 'o', la: -75, ra: 75, lf: -2, rf: -2 }, 200]]),
      jump: fr([[{ sy: 1.1, sx: 0.94, eyes: 'happy', mouth: 'open', la: -55, ra: 55 }, 200]]),
      drag: fr([[{ sy: 1.14, sx: 0.9, eyes: 'squeeze', mouth: 'wavy', lf: -6, rf: -6, tilt: -5 }, 160], [{ sy: 1.14, sx: 0.9, eyes: 'squeeze', mouth: 'wavy', lf: -7, rf: -5, tilt: 5 }, 160]]),
      climb: fr([[{ la: -90, ra: -10, lf: 3, eyes: 'wide', tilt: -10 }, 220], [{ la: -10, ra: -90, rf: 3, eyes: 'wide', tilt: 10 }, 220]]),
      cling: fr([[{ la: -90, ra: -90, eyes: 'wide', mouth: 'o' }, 400]]),
      bounce: fr(cheer),
      happy: fr(cheer),
    },
  }

  // ================================================================ Shimeji 格式宠物包（本地导入）

  const DEFAULT_FRAMES = {
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
  }
  const ACTION_MAP = {
    stand: ['Stand'],
    walk: ['Walk'],
    run: ['Run', 'Dash'],
    sit: ['Sit'],
    look: ['SitAndLookUp'],
    sleep: ['Sprawl', 'LieDown'],
    fall: ['Falling', 'Fall'],
    jump: ['Jumping'],
    drag: ['Resisting', 'Pinched', 'Dragged'],
    climb: ['ClimbWall'],
    cling: ['GrabWall', 'HoldOntoWall'],
    bounce: ['Bouncing'],
  }
  const baseName = (p) => String(p || '').replace(/\\/g, '/').split('/').pop().toLowerCase()

  /** resolve(name) → 图片 URL 或 null；xmlText 可为空（用 Shimeji 默认编号） */
  async function buildShimejiPack({ id, name, xmlText, resolve }) {
    const spec = {}
    if (xmlText) {
      const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
      const acts = {}
      for (const a of doc.getElementsByTagNameNS('*', 'Action')) if (a.getAttribute('Name')) acts[a.getAttribute('Name')] = a
      const posesOf = (n, depth) => {
        const a = acts[n]
        if (!a || depth > 3) return []
        let out = []
        for (const c of a.children) {
          if (c.localName === 'Animation') for (const p of c.children) p.localName === 'Pose' && out.push(p)
          else if (c.localName === 'ActionReference') out = out.concat(posesOf(c.getAttribute('Name'), depth + 1))
        }
        return out
      }
      for (const [st, names] of Object.entries(ACTION_MAP)) {
        for (const n of names) {
          const ps = posesOf(n, 0)
          if (!ps.length) continue
          spec[st] = ps.map((p) => ({ img: baseName(p.getAttribute('Image')), dur: +(p.getAttribute('Duration') || 6), anchor: (p.getAttribute('ImageAnchor') || '').split(',').map(Number) }))
          break
        }
      }
    }
    for (const [st, list] of Object.entries(DEFAULT_FRAMES)) if (!spec[st]) spec[st] = list.map(([n, d]) => ({ img: `shime${n}.png`, dur: d }))

    const sizes = {}
    const load = (img) =>
      sizes[img] ||
      (sizes[img] = new Promise((res) => {
        const url = resolve(img)
        if (!url) return res(null)
        const im = new Image()
        im.onload = () => res({ url, w: im.naturalWidth, h: im.naturalHeight })
        im.onerror = () => res(null)
        im.src = url
      }))
    const states = {}
    for (const [st, list] of Object.entries(spec)) {
      const frames = []
      for (const f of list) {
        const info = await load(f.img)
        if (!info) continue
        const a = f.anchor && f.anchor.length === 2 && !f.anchor.some(isNaN) ? f.anchor : [info.w / 2, info.h]
        frames.push({ src: info.url, dur: Math.max(60, f.dur * TICK), anchor: a, w: info.w, h: info.h })
      }
      if (frames.length) states[st] = frames
    }
    if (!states.stand) return null
    const h = states.stand[0].h
    return { id, name, face: 'left', scale: Math.min(1, 66 / h), states, local: true }
  }

  async function importFiles(list) {
    const files = Array.from(list || [])
    const rel = (f) => (f.webkitRelativePath || f.name).replace(/\\/g, '/')
    const dirOf = (f) => rel(f).split('/').slice(0, -1).join('/')
    const shimes = files.filter((f) => /^shime\d+\.png$/i.test(f.name))
    if (!shimes.length) return DM.toast('没找到 shime1.png 这类图片，请选宠物所在的文件夹')
    const count = {}
    shimes.forEach((f) => (count[dirOf(f)] = (count[dirOf(f)] || 0) + 1))
    const imgDir = Object.keys(count).sort((a, b) => count[b] - count[a])[0]
    const urls = {}
    shimes.filter((f) => dirOf(f) === imgDir).forEach((f) => (urls[f.name.toLowerCase()] = URL.createObjectURL(f)))
    const xmls = files.filter((f) => /^actions\.xml$/i.test(f.name))
    const near = xmls.find((f) => rel(f).startsWith(imgDir + '/')) || xmls.find((f) => rel(f).startsWith(imgDir.split('/').slice(0, -1).join('/'))) || xmls[0]
    const xmlText = near ? await near.text() : ''
    const pack = await buildShimejiPack({ id: 'local', name: imgDir.split('/').pop() || '本地宠物', xmlText, resolve: (n) => urls[n] || null })
    if (!pack) return DM.toast('没能读出动作，请确认文件夹里有 shime1.png')
    PACKS.local = pack
    setPack('local')
    DM.toast(`已导入「${pack.name}」· ${near ? '按 actions.xml 读取动作' : '按 Shimeji 默认编号读取'}`)
  }

  function pickLocal() {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.multiple = true
    inp.setAttribute('webkitdirectory', '')
    inp.onchange = () => importFiles(inp.files)
    inp.click()
  }

  /** 从 ./pets-local/ 自动读取（需要用 http 服务打开原型；该目录已加入 .gitignore） */
  async function autoLocal() {
    try {
      const r = await fetch('pets-local/actions.xml')
      if (!r.ok) return
      const pack = await buildShimejiPack({ id: 'local', name: '本地宠物', xmlText: await r.text(), resolve: (n) => 'pets-local/' + n })
      if (pack) PACKS.local = pack
    } catch (e) {
      /* file:// 或目录不存在，忽略 */
    }
  }

  // ================================================================ 引擎

  const PACKS = { mochi: MOCHI }
  const cfg = { on: true, pack: 'mochi' }
  let layer, spr, sayEl
  let last = 0
  const st = { x: 260, y: 120, vx: 0, vy: 0, f: 1, mode: 'fall', fi: 0, ft: 0, timer: 0, plat: null, tx: null, wall: 0, say: 0, taps: [], cheering: false, debuted: false, debuting: false }
  let debutEl = null
  let debutStepEl = null
  let debutTok = 0

  const PLAT_SEL = ['#view .hold', '#view .growth', '#view .sc-actions .btn', '#view .stage-card', '#tabbar', '#view .pill-switch', '#view .icon-btn', '#view .card', '#view [data-pet-plat]']
  const NO_BUMP = /stage-card|card\b/
  const pk = () => PACKS[cfg.pack] || MOCHI
  const rand = (a, b) => a + Math.random() * (b - a)
  const pick = (a) => a[Math.floor(Math.random() * a.length)]
  const isSleepy = () => {
    const it = DM.focused()
    return !!it && it.type === 'habit' && DM.sleeping(it)
  }

  function geom() {
    const sc = document.getElementById('screen')
    const r = sc.getBoundingClientRect()
    return { sc, r, k: r.width / sc.offsetWidth, W: sc.offsetWidth, H: sc.offsetHeight }
  }

  function platforms(g) {
    const out = []
    PLAT_SEL.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el, idx) => {
        const b = el.getBoundingClientRect()
        const l = (b.left - g.r.left) / g.k
        const rr = (b.right - g.r.left) / g.k
        const t = (b.top - g.r.top) / g.k
        if (rr - l < 36 || t < 92 || t > g.H - 70 || b.height === 0) return
        out.push({ key: sel + '#' + idx, sel, el, l, r: rr, t })
      })
    })
    out.push({ key: 'floor', sel: 'floor', floor: true, l: 0, r: g.W, t: g.H - 14 })
    return out
  }

  // ---- 外观
  function frameNow() {
    const p = pk()
    const map = { run: 'run', cheer: 'bounce', happy: 'happy', climb: st.climbing === false ? 'cling' : 'climb' }
    const key = st.mode === 'cheer' ? 'bounce' : map[st.mode] || st.mode
    const alt = { run: 'walk', cling: 'climb', bounce: 'happy', happy: 'bounce', look: 'sit', sleep: 'sit', jump: 'fall', drag: 'fall', climb: 'stand', fall: 'stand', sit: 'stand', walk: 'stand' }
    let list = p.states[key] || p.states[alt[key]] || p.states.stand
    if (!list) list = MOCHI.states.stand
    return list
  }

  function paint() {
    const p = pk()
    const list = frameNow()
    if (st.fi >= list.length) st.fi = 0
    const f = list[st.fi]
    const sc = p.scale
    if (spr.dataset.src !== f.src) {
      spr.src = f.src
      spr.dataset.src = f.src
    }
    spr.style.width = f.w * sc + 'px'
    spr.style.height = f.h * sc + 'px'
    const ax = f.anchor[0] * sc
    const ay = f.anchor[1] * sc
    const flip = st.f === (p.face === 'left' ? 1 : -1)
    spr.style.transformOrigin = `${ax}px 0`
    spr.style.transform = `translate3d(${(st.x - ax).toFixed(1)}px, ${(st.y - ay).toFixed(1)}px, 0) scaleX(${flip ? -1 : 1})`
    st.h = f.h * sc
    st.hw = f.w * sc * 0.5
    if (st.say > 0) {
      const bx = Math.max(10, Math.min(st.W - 10, st.x))
      sayEl.style.transform = `translate3d(${bx.toFixed(0)}px, ${(st.y - st.h - 8).toFixed(0)}px, 0)`
    }
  }

  function setMode(m, dur) {
    if (st.mode !== m) {
      st.mode = m
      st.fi = 0
      st.ft = 0
    }
    st.timer = dur == null ? 0 : dur
  }

  function say(text, ms = 2600) {
    if (!sayEl) return
    sayEl.textContent = text
    sayEl.classList.remove('on')
    void sayEl.offsetWidth
    sayEl.classList.add('on')
    st.say = ms / 1000
  }

  function hearts(n = 4, kind = 'h') {
    for (let i = 0; i < n; i++) {
      const h = document.createElement('i')
      h.className = 'pet-fx ' + kind
      h.style.left = st.x + rand(-18, 18) + 'px'
      h.style.top = st.y - st.h * 0.8 + 'px'
      h.style.setProperty('--dx', rand(-40, 40).toFixed(0) + 'px')
      h.style.animationDelay = i * 90 + 'ms'
      layer.appendChild(h)
      setTimeout(() => h.remove(), 1300 + i * 90)
    }
  }

  function bump(p, x) {
    if (!p || !p.el || p.floor || NO_BUMP.test(p.sel)) return
    let el = p.el
    if (p.sel === '#tabbar') {
      const g = geom()
      for (const b of el.children) {
        const r = b.getBoundingClientRect()
        const l = (r.left - g.r.left) / g.k
        if (x >= l && x <= l + r.width / g.k) el = b
      }
    }
    el.classList.remove('pet-bump')
    void el.offsetWidth
    el.classList.add('pet-bump')
    setTimeout(() => el.classList.remove('pet-bump'), 380)
  }

  // ---- 行为
  function platOf(P) {
    return P.find((p) => p.key === st.plat)
  }

  function land(p) {
    st.plat = p.key
    st.y = p.t + 3
    const hard = st.vy > 760
    st.vy = 0
    st.vx = 0
    bump(p, st.x)
    if (st.cheering) setMode('cheer', 1e9)
    else if (hard) {
      setMode('happy', 0.55)
      say(pick(['哎呀！', '咚！', '没事没事']), 1400)
    } else setMode('stand', rand(0.4, 1.4))
  }

  function hop(h = 90, vx = 0) {
    st.vy = -Math.sqrt(2 * G * h)
    st.vx = vx
    st.plat = null
    setMode('jump')
  }

  function jumpTo(q) {
    const g = { x: st.x, y: st.y }
    const lo = Math.max(q.l + 14, g.x - 190)
    const hi = Math.min(q.r - 14, g.x + 190)
    if (hi <= lo) return false
    const tx = rand(lo, hi)
    const ty = q.t + 3
    const T = 0.52 + Math.abs(tx - g.x) * 0.0007 + Math.max(0, g.y - ty) * 0.0009
    st.vx = (tx - g.x) / T
    st.vy = (ty - g.y) / T - 0.5 * G * T
    if (Math.abs(st.vy) > 1500) return false
    st.f = st.vx >= 0 ? 1 : -1
    st.plat = null
    setMode('jump')
    return true
  }

  function think(P, g) {
    const p = platOf(P)
    if (!p) return
    if (S.reduce) return setMode('stand', 3)
    const sleepy = isSleepy()
    const opts = []
    const add = (w, run) => w > 0 && opts.push({ w, run })
    add(3, () => setMode('stand', rand(1.6, 3.6)))
    add(4, () => {
      st.tx = rand(p.l + 14, p.r - 14)
      st.f = st.tx >= st.x ? 1 : -1
      setMode('walk')
    })
    add(2, () => setMode('sit', rand(2.2, 4.5)))
    add(1.2, () => setMode('look', rand(1.6, 2.8)))
    add(sleepy ? 4 : 0.35, () => {
      setMode('sleep', rand(4, 8))
      if (sleepy && Math.random() < 0.5) say('陪它一起睡一会儿……', 2200)
    })
    add(1.8, () => {
      const cands = P.filter((q) => q.key !== p.key && !q.floor === true && Math.abs(q.t - st.y) < 340)
      if (!cands.length) return setMode('stand', 1)
      if (!jumpTo(pick(cands))) setMode('stand', 1)
    })
    add(p.l <= 24 || p.r >= g.W - 24 ? 0.9 : 0, () => {
      st.wall = p.l <= 24 && (p.r < g.W - 24 || Math.random() < 0.5) ? -1 : 1
      st.tx = st.wall < 0 ? st.hw * 0.75 : g.W - st.hw * 0.75
      st.f = st.tx >= st.x ? 1 : -1
      st.toWall = true
      setMode('walk')
    })
    add(p.floor ? 0.4 : 0, () => {
      st.tx = rand(30, g.W - 30)
      st.f = st.tx >= st.x ? 1 : -1
      setMode('run')
    })
    let r = rand(0, opts.reduce((s, o) => s + o.w, 0))
    for (const o of opts) {
      r -= o.w
      if (r <= 0) return o.run()
    }
    opts[0].run()
  }

  function idleChatter() {
    if (st.say > 0 || Math.random() > 0.22) return
    const it = DM.focused()
    const pool = ['咕？', '我在这儿。', '今天也可以什么都不做。']
    if (it && it.type === 'since') pool.push('你什么都没做，今天也 +1 天。', '它自己在走，我看着呢。', '没打卡，也算数。')
    if (it && it.type === 'habit') pool.push('按住它记一下，我给你加油。')
    if (it && it.type === 'countdown') pool.push('信快到了，不急。')
    say(pick(pool), 2400)
  }

  function step(dt) {
    const g = geom()
    st.W = g.W
    const P = platforms(g)
    const hw = st.hw || 30

    if (st.say > 0) {
      st.say -= dt
      if (st.say <= 0) sayEl.classList.remove('on')
    }

    const m = st.mode
    if (m === 'drag' || m === 'debut' || m === 'home' || m === 'homing') return
    if (m === 'fall' || m === 'jump') {
      const py = st.y
      st.vy += G * dt
      st.x += st.vx * dt
      st.y += st.vy * dt
      if (st.x < hw * 0.7) {
        st.x = hw * 0.7
        if (Math.abs(st.vx) > 260 && Math.random() < 0.5 && st.y > 150) {
          st.wall = -1
          st.vx = 0
          st.vy = 0
          st.climbing = true
          return setMode('climb', rand(3, 6))
        }
        st.vx = -st.vx * 0.5
      }
      if (st.x > g.W - hw * 0.7) {
        st.x = g.W - hw * 0.7
        if (Math.abs(st.vx) > 260 && Math.random() < 0.5 && st.y > 150) {
          st.wall = 1
          st.vx = 0
          st.vy = 0
          st.climbing = true
          return setMode('climb', rand(3, 6))
        }
        st.vx = -st.vx * 0.5
      }
      if (st.vy > 0) {
        const hit = P.filter((p) => p.t + 3 >= py - 1 && p.t + 3 <= st.y && st.x >= p.l + 6 && st.x <= p.r - 6).sort((a, b) => a.t - b.t)[0]
        if (hit) land(hit)
      }
      if (st.y > g.H + 80) {
        st.y = 120
        st.vy = 0
      }
      return
    }

    if (m === 'climb') {
      st.x = st.wall < 0 ? hw * 0.75 : g.W - hw * 0.75
      st.f = st.wall
      st.timer -= dt
      const moving = st.timer > 0.6
      st.climbing = moving
      if (moving) st.y -= 34 * dt
      if (st.timer <= 0 || st.y < 150) {
        if (Math.random() < 0.6) {
          st.vx = -st.wall * rand(180, 320)
          st.vy = -380
          st.f = -st.wall
        } else {
          st.vx = 0
          st.vy = 0
        }
        st.climbing = true
        setMode('fall')
      }
      return
    }

    // 站在平台上的各种状态
    const p = platOf(P)
    if (!p) {
      st.vy = 0
      st.vx = 0
      return setMode('fall')
    }
    st.y = p.t + 3
    if (st.x < p.l + 6) st.x = p.l + 6
    if (st.x > p.r - 6) st.x = p.r - 6

    if (m === 'walk' || m === 'run') {
      const sp = m === 'run' ? 120 : 44
      const dir = st.tx >= st.x ? 1 : -1
      st.f = dir
      st.x += dir * sp * dt
      if ((dir > 0 && st.x >= st.tx) || (dir < 0 && st.x <= st.tx)) {
        st.x = st.tx
        if (st.toWall) {
          st.toWall = false
          st.climbing = true
          return setMode('climb', rand(3.5, 6.5))
        }
        return setMode('stand', rand(0.6, 2))
      }
      if (st.x <= p.l + 8 || st.x >= p.r - 8) setMode('stand', 0.6)
      return
    }

    if (st.timer > 0 && m !== 'cheer') {
      st.timer -= dt
      if (st.timer <= 0) {
        idleChatter()
        think(P, g)
      }
    } else if (st.timer <= 0 && m === 'stand') {
      idleChatter()
      think(P, g)
    }
  }

  function tick(now) {
    requestAnimationFrame(tick)
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
    last = now
    if (!layer) return
    const deskActive = S.petOut || st.debuting || st.mode === 'homing'
    const hidden = !cfg.on || !deskActive || S.ovs.length > 0 || S.onboarded === false
    layer.classList.toggle('off', hidden)
    if (hidden) return
    step(dt)
    // 帧动画
    const list = frameNow()
    st.ft += dt * 1000
    if (list.length > 1 && st.ft >= list[st.fi % list.length].dur) {
      st.ft = 0
      st.fi = (st.fi + 1) % list.length
    }
    paint()
  }

  // ---- 回家：拖到舞台卡中央（原位）松手
  function homeZone(g) {
    const wrap = document.querySelector('#view .stage-card .cr-wrap')
    if (!wrap) return null
    const b = wrap.getBoundingClientRect()
    const l = (b.left - g.r.left) / g.k
    const r = (b.right - g.r.left) / g.k
    const t = (b.top - g.r.top) / g.k
    const bot = (b.bottom - g.r.top) / g.k
    return { l, r, t, b: bot, cx: (l + r) / 2, cy: (t + bot) / 2, feetY: t + (bot - t) * 0.78 }
  }

  function overHome(g) {
    if (!S.petOut) return false
    const h = homeZone(g)
    if (!h) return false
    // 中央区域：原位盒子往里缩一圈，避免擦边误触
    const mx = (h.r - h.l) * 0.18
    const my = (h.b - h.t) * 0.16
    return st.x >= h.l + mx && st.x <= h.r - mx && st.y >= h.t + my && st.y <= h.b - my
  }

  function setHomeHot(on) {
    document.querySelectorAll('#view .stage-card .cr-wrap').forEach((el) => el.classList.toggle('pet-home-hot', !!on))
  }

  function goHome() {
    if (!S.petOut || st.mode === 'homing') return
    setHomeHot(false)
    setMode('homing')
    st.vx = 0
    st.vy = 0
    st.plat = null
    const g = geom()
    const h = homeZone(g)
    const tx = h ? h.cx : st.x
    const ty = h ? h.feetY : st.y
    say('回家——', 1400)
    const fromX = st.x
    const fromY = st.y
    const t0 = performance.now()
    const dur = 420
    const tickHome = (now) => {
      const u = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - u, 3)
      st.x = fromX + (tx - fromX) * e
      st.y = fromY + (ty - fromY) * e
      // 落回原位时略缩小，像钻回卡片
      if (spr) spr.style.opacity = String(1 - u * 0.85)
      paint()
      if (u < 1) return requestAnimationFrame(tickHome)
      finishHome()
    }
    requestAnimationFrame(tickHome)
  }

  function finishHome() {
    hearts(4)
    S.petOut = false
    st.debuted = false
    if (spr) {
      spr.style.visibility = 'hidden'
      spr.style.opacity = ''
    }
    setMode('home')
    DM.renderView && DM.renderView()
    const wrap = document.querySelector('#view .stage-card .cr-wrap')
    if (wrap) {
      wrap.classList.remove('pet-out', 'pet-home-hot')
      wrap.classList.remove('jump')
      void wrap.offsetWidth
      wrap.classList.add('jump')
      setTimeout(() => wrap.classList.remove('jump'), 600)
    }
    const bub = document.querySelector('#view .stage-card [data-bubble]')
    if (bub) {
      bub.textContent = '我回来了。'
      bub.classList.remove('is-away', 'pop')
      void bub.offsetWidth
      bub.classList.add('pop')
    }
    DM.sfx && DM.sfx('pop')
  }

  // ---- 交互：点它 / 拎起来 / 扔出去；拖到卡片中央 = 放回原位
  function bindPointer() {
    let pd = null
    spr.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      spr.setPointerCapture(e.pointerId)
      pd = { x: e.clientX, y: e.clientY, t: performance.now(), drag: false, samples: [] }
    })
    spr.addEventListener('pointermove', (e) => {
      if (!pd) return
      const g = geom()
      const px = (e.clientX - g.r.left) / g.k
      const py = (e.clientY - g.r.top) / g.k
      if (!pd.drag && Math.hypot(e.clientX - pd.x, e.clientY - pd.y) > 6) {
        pd.drag = true
        st.plat = null
        st.cheering = false
        setMode('drag')
        say('呀——', 1000)
      }
      if (pd.drag) {
        st.x = px
        st.y = py + st.h * 0.42
        pd.samples.push([performance.now(), px, py])
        if (pd.samples.length > 6) pd.samples.shift()
        setHomeHot(overHome(g))
      }
    })
    const up = () => {
      if (!pd) return
      const d = pd
      pd = null
      if (d.drag) {
        const g = geom()
        const home = overHome(g)
        setHomeHot(false)
        if (home) {
          goHome()
          return
        }
        const s = d.samples
        let vx = 0
        let vy = 0
        if (s.length > 1) {
          const a = s[0]
          const b = s[s.length - 1]
          const dtm = Math.max(16, b[0] - a[0]) / 1000
          vx = Math.max(-1300, Math.min(1300, (b[1] - a[1]) / dtm))
          vy = Math.max(-1300, Math.min(1300, (b[2] - a[2]) / dtm))
        }
        st.vx = vx
        st.vy = vy
        st.f = vx >= 0 ? 1 : -1
        setMode('fall')
        if (Math.hypot(vx, vy) > 700) say('哇啊啊——', 1400)
      } else if (performance.now() - d.t < 400) react()
    }
    spr.addEventListener('pointerup', up)
    spr.addEventListener('pointercancel', up)
  }

  function react() {
    const now = performance.now()
    st.taps = st.taps.filter((t) => now - t < 4000).concat(now)
    DM.sfx && DM.sfx('pop')
    if (st.mode === 'sleep') {
      setMode('look', 1.4)
      return say('呜……再睡五分钟。', 1800)
    }
    if (st.taps.length >= 5) {
      st.taps = []
      hearts(6)
      hop(70)
      return say('好啦好啦，有点害羞了。', 2200)
    }
    hearts(2)
    if (st.plat) hop(46)
    say(pick(isSleepy() ? ['嘘……它还在睡。', '轻一点，别吵醒它。'] : ['咕？', '在呢~', '嘿嘿。', '摸摸，再来一下。', '我也在慢慢长大。']), 2000)
  }

  function summon() {
    const g = geom()
    const P = platforms(g)
    const q = P.find((p) => p.sel === '#view .hold') || P.find((p) => p.sel === '#view .stage-card')
    if (q && jumpTo(q)) say('来啦！', 1400)
  }

  // ---- 与功能组件联动
  function wire() {
    DM.bus.on('charge', ({ on }) => {
      if (!cfg.on) return
      if (on) {
        const g = geom()
        const P = platforms(g)
        const q = P.find((p) => p.sel === '#view .hold')
        if (!q) return
        st.cheering = true
        const here = platOf(P)
        if (here && here.key === q.key) setMode('cheer', 1e9)
        else if (!jumpTo(q)) setMode('stand', 1)
        say('加油——按住！', 1600)
      } else if (st.cheering) {
        st.cheering = false
        if (st.mode === 'cheer') setMode('stand', 0.6)
      }
    })
    DM.bus.on('log', ({ it, milestone, wasSleeping }) => {
      if (!cfg.on) return
      st.cheering = false
      hearts(milestone ? 8 : 4, milestone ? 's' : 'h')
      if (st.plat) hop(milestone ? 140 : 90)
      else setMode('happy', 1)
      say(wasSleeping ? '欢迎回来！它没有变小。' : milestone ? '长大啦！' : pick(['记下啦！', '漂亮！', '又多了一天。']), 2400)
    })
    DM.bus.on('pet', () => {
      if (!cfg.on) return
      hearts(2)
      if (st.plat) hop(40)
    })
    DM.bus.on('focus', () => {
      if (!cfg.on) return
      if (st.plat && st.mode !== 'cheer') hop(30)
    })
  }

  // ---- 对外
  function setPack(id) {
    if (id === 'local' && !PACKS.local) return pickLocal()
    if (!PACKS[id]) return DM.toast('这个宠物包还没准备好')
    cfg.pack = id
    S.pet = id
    st.fi = 0
    spr.dataset.src = ''
    hearts(3, 's')
    say(PACKS[id].name + ' 来啦！', 1800)
  }
  function setEnabled(b) {
    const was = cfg.on
    cfg.on = !!b
    S.petOn = cfg.on
    layer && layer.classList.toggle('off', !cfg.on)
    if (!cfg.on) {
      if (st.debuting) abortDebut()
      // 桌宠收起：小伙伴回到卡片原位
      S.petOut = false
      st.debuted = false
      DM.renderView && DM.renderView()
      return
    }
    if (!was || !st.debuted) setTimeout(() => debut(), 240)
  }

  // ================================================================ 出场：往上走进去 → 台阶 → 跳下变成桌宠

  const waitMs = (ms) => new Promise((r) => setTimeout(r, ms))

  function clearDebutDom() {
    if (debutEl) {
      debutEl.remove()
      debutEl = null
    }
    if (debutStepEl) {
      debutStepEl.remove()
      debutStepEl = null
    }
  }

  function restoreCardPet() {
    document.querySelectorAll('#view .cr-wrap.pet-away').forEach((el) => el.classList.remove('pet-away'))
  }

  function abortDebut() {
    debutTok++
    st.debuting = false
    clearDebutDom()
    if (!S.petOut) restoreCardPet()
    if (spr) spr.style.visibility = ''
  }

  function handoffFall(x, y, vx, vy) {
    // 跳出来了就别再站回卡片上
    S.petOut = true
    clearDebutDom()
    st.x = x
    st.y = y
    st.vx = vx
    st.vy = vy
    st.f = vx >= 0 ? 1 : -1
    st.plat = null
    st.debuting = false
    st.debuted = true
    if (spr) spr.style.visibility = ''
    setMode('fall')
    paint()
    DM.renderView && DM.renderView()
  }

  function skipDebut() {
    const g = geom()
    const P = platforms(g)
    const q = P.find((p) => p.sel === '#view .stage-card') || P.find((p) => p.sel === 'floor')
    document.querySelectorAll('#view .stage-card .cr-wrap').forEach((el) => el.classList.add('pet-away'))
    handoffFall(g.W * 0.5, (q ? q.t : 160) - 80, rand(-40, 40), 0)
    say(pk().name + ' 来啦！', 2200)
  }

  /** force=true 可重播（演示台用） */
  async function debut(force) {
    if (!layer || !cfg.on) return
    if (st.debuting && !force) return
    if (st.debuted && !force) return
    if (force && st.debuting) abortDebut()
    if (S.onboarded === false) return
    if (S.reduce || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      skipDebut()
      return
    }

    // 重播时先让卡片上的小伙伴回来，才能再走出去
    if (force || S.petOut) {
      S.petOut = false
      st.debuted = false
      DM.renderView && DM.renderView()
      await waitMs(40)
    }

    const tok = ++debutTok
    st.debuting = true
    st.debuted = false
    setMode('debut')
    if (spr) spr.style.visibility = 'hidden'
    clearDebutDom()

    let wrap = null
    for (let i = 0; i < 24; i++) {
      if (tok !== debutTok) return
      if (!S.ovs.length) wrap = document.querySelector('#view .stage-card .cr-wrap')
      if (wrap && wrap.querySelector('.cr')) break
      wrap = null
      await waitMs(80)
    }
    if (tok !== debutTok) return
    if (!wrap) {
      skipDebut()
      return
    }

    const cr = wrap.querySelector('.cr')
    const g = geom()
    const br = cr.getBoundingClientRect()
    const card = wrap.closest('.stage-card')
    const cb = card.getBoundingClientRect()
    const startX = (br.left + br.width / 2 - g.r.left) / g.k
    const startY = (br.bottom - g.r.top) / g.k - 6
    const midX = (cb.left + cb.width / 2 - g.r.left) / g.k
    const stepY = (cb.top - g.r.top) / g.k + 56
    const startS = Math.max(0.72, Math.min(1.05, br.width / g.k / 158))

    wrap.classList.add('pet-away')

    // 克隆离开舞台卡后不再继承 --c 等色板，不拷会整只变黑
    const hueSrc = card || wrap
    const hueCs = getComputedStyle(hueSrc)
    const paintHue = (el) => {
      ;[
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
      ].forEach((k) => {
        const v = hueCs.getPropertyValue(k).trim()
        if (v) el.style.setProperty(k, v)
      })
    }

    debutEl = document.createElement('div')
    debutEl.className = 'pet-debut'
    debutEl.innerHTML = `<div class="pet-debut-spin">${cr.outerHTML}</div>`
    paintHue(debutEl)
    const cloneCr = debutEl.querySelector('.cr')
    cloneCr.style.width = br.width / g.k + 'px'
    cloneCr.style.height = br.height / g.k + 'px'
    cloneCr.removeAttribute('width')
    cloneCr.removeAttribute('height')
    layer.appendChild(debutEl)

    debutStepEl = document.createElement('i')
    debutStepEl.className = 'pet-debut-step'
    paintHue(debutStepEl)
    layer.appendChild(debutStepEl)

    const put = (x, y, s) => {
      debutEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s})`
    }
    put(startX, startY, startS)
    debutStepEl.style.left = midX.toFixed(1) + 'px'
    debutStepEl.style.top = stepY.toFixed(1) + 'px'

    await waitMs(160)
    if (tok !== debutTok) return

    // 直接往上走进去，越来越小；台阶在终点亮起
    debutEl.classList.add('walk')
    const walk = debutEl.animate(
      [
        { transform: `translate3d(${startX}px, ${startY}px, 0) scale(${startS})` },
        { transform: `translate3d(${(startX + midX) / 2}px, ${(startY + stepY) / 2 - 6}px, 0) scale(${startS * 0.72})`, offset: 0.55 },
        { transform: `translate3d(${midX}px, ${stepY}px, 0) scale(${startS * 0.42})` },
      ],
      { duration: 1680, easing: 'cubic-bezier(0.35, 0.1, 0.25, 1)', fill: 'forwards' },
    )
    setTimeout(() => {
      if (tok === debutTok && debutStepEl) debutStepEl.classList.add('on')
    }, 1100)
    await walk.finished.catch(() => {})
    if (tok !== debutTok) return
    if (walk.commitStyles) walk.commitStyles()
    walk.cancel()
    put(midX, stepY, startS * 0.42)

    // 3) 在台阶上顿一下
    debutEl.classList.remove('walk')
    debutEl.classList.add('squash')
    await waitMs(320)
    if (tok !== debutTok) return
    debutEl.classList.remove('squash')

    // 4) 从中间跳下；半空换成桌宠精灵，交给物理引擎
    const P = platforms(g)
    const jumpH = 96
    const jvy = -Math.sqrt(2 * G * jumpH)
    const peakT = Math.abs(jvy) / G
    const peakY = stepY + jvy * peakT + 0.5 * G * peakT * peakT
    const leap = debutEl.animate(
      [
        { transform: `translate3d(${midX}px, ${stepY}px, 0) scale(${startS * 0.42})`, opacity: 1 },
        { transform: `translate3d(${midX}px, ${peakY}px, 0) scale(${startS * 0.5})`, opacity: 1, offset: 0.4 },
        { transform: `translate3d(${midX}px, ${peakY + 20}px, 0) scale(${startS * 0.56})`, opacity: 0 },
      ],
      { duration: 420, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    )
    if (debutStepEl) debutStepEl.classList.add('gone')
    await waitMs(250)
    if (tok !== debutTok) return

    // 落点偏向卡片中线，稍带一点水平速度
    const land = P.find((p) => p.sel === '#view .hold') || P.find((p) => p.sel === '#view .growth') || P.find((p) => p.sel === '#view .stage-card')
    const aimX = land ? Math.min(land.r - 20, Math.max(land.l + 20, midX)) : midX
    handoffFall(midX, peakY + 8, (aimX - midX) * 1.4, 120)
    hearts(5, 's')
    say('我从卡片里出来啦！', 2600)
    leap.finished.catch(() => {})
  }

  function init() {
    const screen = document.getElementById('screen')
    if (!screen || document.getElementById('petLayer')) return
    layer = document.createElement('div')
    layer.id = 'petLayer'
    layer.innerHTML = '<img class="pet-sprite" alt="" draggable="false"/><div class="pet-say"></div>'
    screen.appendChild(layer)
    spr = layer.querySelector('.pet-sprite')
    sayEl = layer.querySelector('.pet-say')
    const g = geom()
    st.W = g.W
    st.x = g.W * 0.72
    st.y = 150
    spr.style.visibility = 'hidden'
    setMode('debut')
    bindPointer()
    wire()
    autoLocal()
    requestAnimationFrame(tick)
    setTimeout(() => debut(), 720)
  }

  DM.pets = { setEnabled, setPack, pickLocal, importFiles, say, summon, hop, debut, goHome, packs: PACKS, state: st, cfg }
  Object.defineProperty(DM.pets, 'enabled', { get: () => cfg.on })

  // ================================================================ 演示台：宠物实验室

  DM.FLOWS.push({
    key: 'N',
    title: '宠物与互动',
    steps: [
      { id: 'N0', label: '出场 · 往上走进去再跳下来', run: () => { DM.demo.ensureSeed(); DM.demo.today('smoke'); setEnabled(true); setTimeout(() => debut(true), 380) } },
      { id: 'N1', label: '自由活动 · 它会走、跳、爬墙', run: () => { DM.demo.ensureSeed(); DM.demo.today('smoke'); setEnabled(true) } },
      { id: 'N2', label: '长按记一下 · 它来加油', run: () => { DM.demo.reseed(); DM.demo.today('sleep', { guide: 'hold' }); setEnabled(true); setTimeout(summon, 400) } },
      { id: 'N3', label: '焦点睡着了 · 它陪着打盹', run: () => { DM.demo.reseed(); const it = DM.demo.item('sleep'); it.lastDay = -4; it.todayCount = 0; DM.demo.today('sleep'); setEnabled(true) } },
      { id: 'N4', label: '拎起来、扔出去', run: () => { DM.demo.ensureSeed(); DM.demo.today('water'); setEnabled(true); setTimeout(() => say('拎起我试试？', 2600), 500) } },
      { id: 'N5', label: '导入本地宠物包（Shimeji 格式）', run: () => { DM.demo.ensureSeed(); DM.demo.today('smoke'); pickLocal() } },
    ],
  })
  DM.sceneHooks.push(() => (!S.ovs.length && /^N\d/.test(S.step || '') ? 'pets-' + S.step : null))
  const kk = 'N · 宠物与互动'
  Object.assign(DM.NOTES, {
    'pets-N0': { k: kk, t: '卡片里的小伙伴，自己走进桌面', d: [2, 1], p: ['舞台上的成长萌宠会朝卡片深处走去，越走越小。', '走到一截小台阶上顿一下，再从画面中间跳下来——落地的瞬间换成会走会爬的桌宠。', '这是「养成角色」和「桌面生命」之间的桥：同一个陪伴，换了一种在场的方式。'], try: '看完出场后，点它或拖它。' },
    'pets-N1': { k: kk, t: '宠物不再是一张贴图：它住在页面里', d: [2, 1], p: ['宠物把页面里的卡片、按钮、底部导航当作「平台」：会站、走、坐、睡，跳到别的元素上，甚至爬屏幕边缘。', '落在按钮上，按钮会轻轻被压一下；这些小反馈比一段文案更能让人觉得它「真的在这儿」。', '动作由一张状态图驱动，参数是 Shimeji 同款的概念：Stand / Walk / Sit / Fall / ClimbWall / Dragged……所以可以直接换成真实桌宠素材。', '内置的「麻糬」是原创矢量角色，仅作占位与演示；可在设置里的「宠物包」导入本地 Shimeji 包。'], try: '等它走一走，或点它、拖它。' },
    'pets-N2': { k: kk, t: '你在记一件事，它在旁边加油', d: [1, 2], p: ['长按「记一下」时，宠物会跳到按钮上方跳跃加油；蓄满的一刻它为你欢呼。', '没有进度条之外的额外压力：它只是在场，不催促。'], try: '长按下面的圆角按钮。' },
    'pets-N3': { k: kk, t: '事情睡着了，它就陪着一起睡', d: [2], p: ['习惯断了不是「失败」：小伙伴只是睡着了，宠物也会靠在旁边打盹。', '你回来记一下，它第一句话是「欢迎回来，它没有变小」。'], try: '长按记一下，把它叫醒。' },
    'pets-N4': { k: kk, t: '拎起来、扔出去：有重量的陪伴', d: [2], p: ['拖动时它会挂着乱蹬腿；松手按手势的速度抛出去，有重力、会弹墙、会落到别的元素上。', '碰到屏幕边缘有时会顺势抓住墙往上爬。'], try: '把它甩向屏幕边缘。' },
    'pets-N5': { k: kk, t: '导入你自己的 Shimeji 宠物包（仅本机）', d: [2, 3], p: ['选择含 shime1.png…（以及可选的 conf/actions.xml）的文件夹，页面会按动作表读取站、走、坐、爬、被拎起等动画。', '图片只在这个浏览器标签里读取，不上传、不进仓库；本地目录 pets-local/ 已被 .gitignore 忽略。', '上架前须换成有授权或原创的素材：热门桌宠多是同人创作，版权不在我们手里。'], try: '在弹出的文件选择框里选一个宠物文件夹。' },
  })
  DM.onRender.push(() => {
    if (!layer) init()
  })
})()
