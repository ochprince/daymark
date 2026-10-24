/*
 * 原型核心：状态、派生数据、文案、渲染管线、今天（焦点舞台）、手势。
 *
 * 其他模块（overlays.js / tabs.js / demo.js）只通过 window.DM 挂东西：
 *   DM.VIEWS[name]   = () => html                 底层页面（today / museum / dress / welcome）
 *   DM.VIEW_AFTER[name] = (el) => void            页面渲染后的钩子（绑定滚动等）
 *   DM.OV[type]      = (o) => html                覆盖层（每层一个 div.layer）
 *   DM.OV_AFTER[type] = (layerEl, o) => void      覆盖层渲染后的钩子
 *   DM.ACT[name]     = (el, event) => void        data-act="name" 的点击处理
 *   DM.onRender.push(fn)                          每次渲染后调用（演示台更新说明）
 */
;(function () {
  'use strict'
  const { creature, badge } = window.Creatures
  const DAY = 864e5
  /** 演示里的「今天」：2026-10-24 周六 */
  const BASE = new Date(2026, 9, 24)
  const WD = '日一二三四五六'

  const SPECIES = {
    sprout: { name: '芽芽', stages: ['壳宝宝', '冒芽', '双叶', '开花', '花冠'], intro: '安安静静地长，适合戒掉或坚持一件事' },
    moon: { name: '眠眠', stages: ['壳宝宝', '月牙', '睡帽', '星星帽', '星夜'], intro: '喜欢夜晚，适合早睡、冥想这类事' },
    drop: { name: '咕噜', stages: ['壳宝宝', '小水珠', '浪花', '泡泡', '彩虹'], intro: '一喝水就开心，适合一天要做好几次的事' },
    star: { name: '跑跑', stages: ['壳宝宝', '星芽', '星耳', '汗带', '金冠'], intro: '精力旺盛，适合运动和每周几次的事' },
    post: { name: '信信', stages: ['信使'], intro: '替你记着要等的日子，到点来敲门' },
  }
  /** 形态门槛：累计成长天数（断了不清零，只是暂停） */
  const THRESH = [0, 3, 7, 30, 100]
  const stageOf = (g) => (g >= 100 ? 4 : g >= 30 ? 3 : g >= 7 ? 2 : g >= 3 ? 1 : 0)
  const HUES = ['mint', 'sky', 'grape', 'lemon', 'coral']

  const THEMES = [
    { id: 'jelly', name: '软糖', tag: '默认 · 可爱卡通', desc: '粗描边、贴纸投影、圆胖数字' },
    { id: 'paper', name: '纸本', tag: '安静 · 极简', desc: '细线条、衬线数字、大留白' },
    { id: 'night', name: '夜航', tag: '深色 · 微光', desc: '深蓝夜空，会发光的小伙伴' },
    { id: 'pixel', name: '像素', tag: '复古 · 游戏机', desc: '像素字、硬阴影、方角' },
  ]

  const BADGES = [
    { id: 'first', kind: 'foot', name: '第一步', desc: '记下第一件事' },
    { id: 'd7', kind: 'num', label: '7', name: '一整周', desc: '任意一件成长 7 天' },
    { id: 'd30', kind: 'num', label: '30', name: '三十天', desc: '任意一件成长 30 天' },
    { id: 'd100', kind: 'num', label: '100', name: '一百天', desc: '任意一件成长 100 天' },
    { id: 'd365', kind: 'num', label: '365', name: '一年', desc: '任意一件成长 365 天' },
    { id: 'back', kind: 'back', name: '回来了', desc: '休息之后，又回来记了一次' },
    { id: 'night', kind: 'moon', name: '夜猫子', desc: '在 0 点以后记过一次' },
    { id: 'early', kind: 'sun', name: '早起鸟', desc: '在 6 点以前记过一次' },
    { id: 'chapter', kind: 'book', name: '翻篇', desc: '写完第一个章节' },
    { id: 'bday', kind: 'gift', name: '生日快乐', desc: '陪一个倒数日走到那一天' },
    { id: 'share', kind: 'share', name: '晒一晒', desc: '分享第一张卡片' },
    { id: 'pumpkin', kind: 'pumpkin', name: '南瓜帽', desc: '万圣节当天打开刻度', hidden: true },
  ]

  const NOTE_POOL = [
    '今天也可以什么都不做。',
    '慢慢来，比较快。',
    '你不用每天都很厉害，来看看我就好。',
    '下雨天也算数的。',
    '把手机放下，去喝口水吧。',
    '记不住也没关系，我替你记着。',
  ]

  // ---------------------------------------------------------------- 状态

  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

  function seedItems() {
    return [
      { id: 'sleep', type: 'habit', title: '早睡', species: 'moon', hue: 'grape', cadence: 'daily', target: 1, unit: '晚', lead: '早睡了', growth: 6, streak: 6, todayCount: 0, weekCount: 0, lastDay: -1, log: range(-6, -1), startDay: -6, chapter: 1, remind: '每天 23:00', sub: '23:30 前上床', idle: '今晚早点睡吧，眠眠已经在打哈欠了。' },
      { id: 'water', type: 'habit', title: '喝水', species: 'drop', hue: 'sky', cadence: 'daily', target: 8, unit: '杯', growth: 34, streak: 12, todayCount: 3, weekCount: 0, lastDay: 0, log: [...range(-40, -30), ...range(-27, -15), ...range(-11, 0)], startDay: -40, chapter: 1, remind: '10:00 起每 2 小时' },
      { id: 'smoke', type: 'since', title: '戒烟', species: 'sprout', hue: 'mint', start: -128, prev: 23, chapter: 2, remind: null },
      { id: 'love', type: 'since', title: '在一起', species: 'star', hue: 'coral', start: -800, prev: 0, chapter: 1, photo: true, idle: '第 800 天。谢谢每一个普通的日子。' },
      { id: 'run', type: 'habit', title: '跑步', species: 'star', hue: 'lemon', cadence: 'weekly', target: 3, unit: '次', growth: 15, streak: 0, todayCount: 0, weekCount: 0, lastDay: -5, log: [-60, -57, -55, -50, -48, -45, -41, -38, -36, -30, -27, -20, -14, -9, -5], startDay: -60, chapter: 1, remind: '周二 / 四 / 六 19:00' },
      { id: 'mom', type: 'countdown', title: '妈妈生日', species: 'post', hue: 'coral', date: 12, repeat: '每年', remind: '提前 3 天 · 09:00', memo: '她说想要一条浅色的围巾', todo: [{ t: '挑围巾', done: true }, { t: '订蛋糕', done: false }, { t: '写张卡片', done: false }] },
      { id: 'halloween', type: 'countdown', title: '万圣节', species: 'post', hue: 'lemon', date: 7, repeat: '每年', festival: true, remind: '当天 · 09:00', memo: '', todo: [] },
    ]
  }

  function seedChapters() {
    return [
      { id: 'c1', itemId: 'smoke', title: '戒烟', no: 1, days: 23, start: -175, end: -152, line: '下次会更久。', species: 'sprout', hue: 'mint', stage: 1 },
      { id: 'c2', itemId: 'read', title: '读书', no: 1, days: 61, start: -260, end: -199, line: '看完了 9 本书，够了。', species: 'star', hue: 'sky', stage: 3, gone: true },
      { id: 'c3', itemId: 'gym', title: '健身', no: 1, days: 12, start: -150, end: -138, line: '先歇一歇，膝盖要紧。', species: 'drop', hue: 'coral', stage: 2, gone: true },
      { id: 'c4', itemId: 'mom', title: '妈妈生日 · 2025', no: 1, days: 0, start: -353, end: -353, line: '她很喜欢那束花。', species: 'post', hue: 'coral', stage: 0, countdown: true },
      { id: 'c5', itemId: 'run', title: '夏天的跑步', no: 0, days: 40, start: -120, end: -80, line: '夏天跑得最多。', species: 'star', hue: 'lemon', stage: 2 },
      { id: 'c6', itemId: 'jp', title: '背日语', no: 1, days: 33, start: -400, end: -367, line: 'N3 过了！', species: 'moon', hue: 'mint', stage: 3, gone: true },
    ]
  }

  function seed() {
    return {
      kind: 'seed',
      theme: 'jelly',
      num: 'auto',
      texture: 'auto',
      accent: 'auto',
      sound: true,
      haptic: true,
      reduce: false,
      onboarded: true,
      tab: 'today',
      museumTab: 'chapters',
      focusId: 'sleep',
      ovs: [],
      simDay: 0,
      halloween: false,
      taps: 0,
      guide: null,
      bubble: null,
      fx: null,
      enter: null,
      step: null,
      items: seedItems(),
      chapters: seedChapters(),
      badges: { first: true, d7: true, d30: true, d100: true, night: true, chapter: true },
      dex: ['sprout:0', 'sprout:1', 'sprout:2', 'sprout:3', 'sprout:4', 'moon:0', 'moon:1', 'drop:0', 'drop:1', 'drop:2', 'drop:3', 'star:0', 'star:1', 'star:2', 'star:3', 'star:4', 'post:0'],
      dexNew: null,
      badgeNew: null,
      notes: [
        { t: '下雨天也算数的。', from: '咕噜', day: -3 },
        { t: '你比自己以为的更能坚持。', from: '芽芽', day: -9 },
        { t: '把手机放下，去喝口水吧。', from: '咕噜', day: -16 },
        { t: '今天跑不动，就走一走。', from: '跑跑', day: -22 },
        { t: '记不住也没关系，我替你记着。', from: '信信', day: -31 },
      ],
      noteIdx: 0,
    }
  }

  /** 首次打开：什么都没有 */
  function fresh() {
    const s = seed()
    return Object.assign(s, { kind: 'fresh', onboarded: false, items: [], chapters: [], badges: {}, dex: [], notes: [], focusId: null })
  }

  const S = seed()

  // ---------------------------------------------------------------- 派生

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const pick = (a) => a[Math.floor(Math.random() * a.length)]
  const it$ = (id) => S.items.find((i) => i.id === id)
  const focused = () => it$(S.focusId) || S.items[0] || null
  const sinceDays = (it) => S.simDay - it.start
  const growthOf = (it) => (it.type === 'since' ? it.prev + sinceDays(it) : it.type === 'habit' ? it.growth : 0)
  const left = (it) => it.date - S.simDay
  const gap = (it) => S.simDay - it.lastDay
  const sleeping = (it) => it.type === 'habit' && it.todayCount === 0 && gap(it) >= (it.cadence === 'weekly' ? 5 : 3)
  const doneToday = (it) => it.type === 'habit' && it.cadence === 'daily' && it.target === 1 && it.todayCount >= 1
  const canLog = (it) => it.type === 'habit' && !doneToday(it)
  const hueStyle = (h) => `--c:var(--h-${h});--c2:var(--h-${h}-2)`

  function moodOf(it) {
    if (sleeping(it)) return 'sleep'
    if (it.type === 'habit' && it.todayCount >= it.target) return 'happy'
    return 'idle'
  }

  /** 某件事当前的小伙伴 */
  function crOf(it, size, mood) {
    if (it.type === 'countdown') {
      const l = left(it)
      return creature({ species: 'post', size, mood: l === 0 ? 'happy' : mood || 'idle', extra: { hold: l === 0 ? 'party' : l <= 7 ? 'gift' : 'letter', pumpkin: S.halloween && l !== 0 } })
    }
    return creature({ species: it.species, stage: stageOf(growthOf(it)), mood: mood || moodOf(it), size, extra: { pumpkin: S.halloween } })
  }

  function dateOf(off) {
    return new Date(BASE.getTime() + off * DAY)
  }
  function fmt(off, style = 'md') {
    const d = dateOf(off)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const dd = d.getDate()
    if (style === 'dot') return `${y}.${String(m).padStart(2, '0')}.${String(dd).padStart(2, '0')}`
    if (style === 'mdw') return `${m}月${dd}日 · 周${WD[d.getDay()]}`
    if (style === 'ymd') return `${y}年${m}月${dd}日`
    return `${m}月${dd}日`
  }
  /** 「X 年 Y 个月 Z 天」，按自然月 */
  function ymdStr(fromOff, toOff) {
    const a = dateOf(fromOff)
    const b = dateOf(toOff)
    let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
    if (b.getDate() < a.getDate()) months--
    const anchor = new Date(a.getFullYear(), a.getMonth() + months, a.getDate())
    const days = Math.round((b - anchor) / DAY)
    const y = Math.floor(months / 12)
    const m = months % 12
    return [y ? `${y} 年` : '', m ? `${m} 个月` : '', days || (!y && !m) ? `${days} 天` : ''].filter(Boolean).join(' ')
  }

  function greet() {
    const h = new Date().getHours()
    if (h < 5) return '夜深了，早点睡'
    if (h < 11) return '早上好，慢慢来'
    if (h < 14) return '中午好，吃饭没'
    if (h < 18) return '下午好，喝口水'
    if (h < 23) return '晚上好，辛苦啦'
    return '夜深了，早点睡'
  }

  // ---------------------------------------------------------------- 文案

  /** 小伙伴此刻想说的话：具体、非功能性，不催促 */
  function lineFor(it) {
    if (S.halloween) return '不给糖就捣蛋！……开玩笑的，今天也辛苦啦。'
    if (it.type === 'countdown') {
      const d = left(it)
      if (d === 0) return it.id === 'mom' ? '就是今天！记得说一声生日快乐。' : '就是今天！'
      if (d <= 3) return `只剩 ${d} 天了，东西都准备好了吗？`
      if (d <= 7) return it.festival ? '还有一周，南瓜灯可以开始挑了。' : '还有一周，刚好来得及慢慢准备。'
      return `还有 ${d} 天。现在开始想礼物，刚刚好。`
    }
    if (it.type === 'since') {
      const d = sinceDays(it)
      if (it.idle && d === 800) return it.idle
      if (d === 7) return '一整周了。你比自己以为的更能坚持。'
      if (d === 30) return '三十天，足够让一件事变成你的一部分。'
      if (d === 100) return '一百天。谢谢你，没有放下它。'
      if (d >= 365) return '一年多了。谢谢你一直把它放在心上。'
      if (d >= 100) return `第 ${d} 天。这已经不是坚持，是你本来的样子。`
      if (d >= 30) return '一个多月了，它已经习惯有你陪着。'
      if (d >= 7) return '过了一周，叶子长得比上周精神。'
      if (d >= 1) return '开始了。不用急，它也才刚醒。'
      return '从这一刻开始算。今天也可以什么都不做。'
    }
    if (sleeping(it)) return '它睡着了，等你回来。不急。'
    if (it.todayCount > 0) return afterLogLine(it)
    if (it.idle) return it.idle
    if (it.cadence === 'weekly') return `这周还没跑。慢慢跑，跑跑陪你。`
    return '今天还没来找它。按住它，记一下就好。'
  }

  function afterLogLine(it) {
    const n = it.todayCount
    if (it.cadence === 'weekly') return it.weekCount >= it.target ? '这周的目标完成啦！剩下的随意。' : `本周第 ${it.weekCount} 次，跑得真好。`
    if (it.target > 1) {
      if (n < it.target) return `第 ${n} ${it.unit}，咕嘟咕嘟。还差 ${it.target - n} ${it.unit}也没关系。`
      if (n === it.target) return '今天喝够啦！咕噜圆滚滚的。'
      return '比计划还多，厉害。'
    }
    return '记下了。今天剩下的时间，都是你的。'
  }

  const TAP_LINES = ['今天也可以什么都不做。', '被你摸了一下，开心。', '嘿嘿，痒。', '我在这儿呢。', '慢慢来，比较快。', '喝口水再走吧。', '你今天看起来不错。']

  function typeTag(it) {
    if (it.type === 'since') return `坚持 · 第 ${it.chapter} 章`
    if (it.type === 'countdown') return it.festival ? '节日' : `倒数 · ${it.repeat}`
    return it.cadence === 'weekly' ? `每周 ${it.target} 次` : it.target > 1 ? `每天 ${it.target} ${it.unit}` : '每天'
  }

  // ---------------------------------------------------------------- 素材

  let photoSeed = 0
  /** 占位相片：海边日落（真实产品里是用户上传的照片） */
  function photoSVG() {
    const n = ++photoSeed
    return `<svg viewBox="0 0 400 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
      <linearGradient id="pk${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#36407e"/><stop offset=".38" stop-color="#b9708a"/><stop offset=".55" stop-color="#f3a77f"/><stop offset=".62" stop-color="#ffd59a"/></linearGradient>
      <linearGradient id="ps${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2b083"/><stop offset=".35" stop-color="#a86f86"/><stop offset="1" stop-color="#2c3264"/></linearGradient>
      <radialGradient id="pg${n}"><stop offset="0" stop-color="#fff4d6"/><stop offset=".3" stop-color="#ffe0a8" stop-opacity=".8"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>
      <filter id="pb${n}"><feGaussianBlur stdDeviation="8"/></filter></defs>
      <rect width="400" height="640" fill="url(#pk${n})"/>
      <g filter="url(#pb${n})" opacity=".55"><ellipse cx="90" cy="150" rx="120" ry="18" fill="#f7c6c0"/><ellipse cx="300" cy="210" rx="140" ry="14" fill="#ffd2b0"/><ellipse cx="200" cy="90" rx="160" ry="12" fill="#c890b0"/></g>
      <circle cx="262" cy="372" r="150" fill="url(#pg${n})"/>
      <circle cx="262" cy="372" r="30" fill="#fff1cf"/>
      <rect y="380" width="400" height="260" fill="url(#ps${n})"/>
      <g stroke="#ffe3b8" stroke-linecap="round" opacity=".7"><path d="M230 396 H296" stroke-width="3"/><path d="M214 414 H312" stroke-width="2.5"/><path d="M240 432 H286" stroke-width="2"/><path d="M196 452 H330" stroke-width="2" opacity=".6"/></g>
      <path d="M0 540 C80 520 150 530 220 548 C300 568 350 556 400 540 V640 H0 Z" fill="#1f1d3a"/>
      <g fill="#1f1d3a"><circle cx="116" cy="482" r="7"/><path d="M108 490 h16 l4 40 h-24 z"/><circle cx="138" cy="478" r="7.5"/><path d="M130 486 h17 l3 44 h-23 z"/><path d="M122 500 L132 504" stroke="#1f1d3a" stroke-width="4"/></g>
    </svg>`
  }

  const ICON = {
    plus: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3v14M3 10h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    down: '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back: '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M13.5 4.5 7 11l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    share: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 13V3M6 6.5 10 2.5l4 4M4 10v5.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bell: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2a4 4 0 0 0-4 4v2.5L2.8 11h10.4L12 8.5V6a4 4 0 0 0-4-4ZM6.5 13a1.6 1.6 0 0 0 3 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    today: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3.5C14 3.5 16.5 6.6 16.5 10.2 16.5 14 13.6 16.5 10 16.5S3.5 14 3.5 10.2C3.5 6.6 6 3.5 10 3.5Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7.8" cy="10" r="1.2" fill="currentColor"/><circle cx="12.2" cy="10" r="1.2" fill="currentColor"/></svg>',
    museum: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M3.5 4h3v12h-3zM8.5 4h3v12h-3zM13.6 4.6l2.8-.8 2.6 11.6-2.8.8z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
    dress: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3a7 7 0 1 0 0 14c1.2 0 1.6-.8 1.2-1.7-.5-1 .1-2.3 1.4-2.3H15a2.5 2.5 0 0 0 2-3.6A7 7 0 0 0 10 3Z" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="6.8" cy="9" r="1.2" fill="currentColor"/><circle cx="10" cy="6.5" r="1.2" fill="currentColor"/><circle cx="13.2" cy="8.6" r="1.2" fill="currentColor"/></svg>',
    camera: '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h2.2L8 4h6l1.3 2h2.2A1.5 1.5 0 0 1 19 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 16.5Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="11" cy="11.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    spark: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 0 Q7 7 14 7 Q7 7 7 14 Q7 7 0 7 Q7 7 7 0Z" fill="currentColor"/></svg>',
  }

  // ---------------------------------------------------------------- 声音 & 触感

  let actx = null
  const SFX = {
    ding: [[880, 0.1], [1320, 0.2]],
    evolve: [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.34]],
    pop: [[620, 0.07, 'triangle']],
    soft: [[440, 0.18, 'sine', 0.05]],
    crack: [[300, 0.06, 'square', 0.03]],
    hatch: [[660, 0.1], [880, 0.1], [1175, 0.26]],
    close: [[523, 0.2], [392, 0.34]],
  }
  function sfx(name) {
    if (!S.sound) return
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)()
      let t = actx.currentTime
      for (const [f, d, type = 'sine', v = 0.07] of SFX[name] || []) {
        const o = actx.createOscillator()
        const g = actx.createGain()
        o.type = type
        o.frequency.value = f
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(v, t + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, t + d)
        o.connect(g).connect(actx.destination)
        o.start(t)
        o.stop(t + d + 0.02)
        t += d * 0.62
      }
    } catch {
      /* 没有音频也无所谓 */
    }
  }
  const buzz = (p) => S.haptic && navigator.vibrate && navigator.vibrate(p)

  // ---------------------------------------------------------------- 渲染管线

  const DM = (window.DM = {
    S,
    VIEWS: {},
    VIEW_AFTER: {},
    OV: {},
    OV_AFTER: {},
    ACT: {},
    onRender: [],
  })
  const $ = (s, r = document) => r.querySelector(s)
  let lastKeys = []

  function applyTheme() {
    const phone = $('#phone')
    phone.dataset.theme = S.theme
    phone.dataset.num = S.num
    phone.dataset.texture = S.texture
    phone.dataset.accent = S.accent
  }

  function renderView() {
    const view = $('#view')
    const name = !S.onboarded ? 'welcome' : S.tab
    const fn = DM.VIEWS[name]
    view.className = 'view' + (name === 'welcome' ? ' no-tab' : '')
    view.innerHTML = fn ? fn() : ''
    DM.VIEW_AFTER[name] && DM.VIEW_AFTER[name](view)
    // 成长条：先停在旧进度，下一帧再走到新进度
    requestAnimationFrame(() => view.querySelectorAll('[data-w]').forEach((el) => (el.style.width = el.dataset.w + '%')))
  }

  function renderTabbar() {
    const bar = $('#tabbar')
    bar.style.display = S.onboarded ? '' : 'none'
    const tabs = [
      ['today', '今天', ICON.today],
      ['museum', '藏馆', ICON.museum],
      ['dress', '装扮', ICON.dress],
    ]
    bar.innerHTML = tabs.map(([k, label, icon]) => `<button data-act="tab" data-tab="${k}" class="${S.tab === k ? 'is-on' : ''}">${icon}<span>${label}</span></button>`).join('')
  }

  const keyOf = (o) => `${o.type}:${o.id || ''}`

  function renderOv() {
    const root = $('#ov')
    const keys = S.ovs.map(keyOf)
    root.innerHTML = S.ovs
      .map((o, i) => {
        const fn = DM.OV[o.type]
        const enter = lastKeys[i] === keys[i] ? '0' : '1'
        return `<div class="layer" style="position:absolute;inset:0" data-enter="${enter}" data-i="${i}">${fn ? fn(o) : ''}</div>`
      })
      .join('')
    lastKeys = keys
    S.ovs.forEach((o, i) => {
      const fn = DM.OV_AFTER[o.type]
      if (fn) fn(root.children[i], o)
    })
  }

  function render() {
    applyTheme()
    renderView()
    renderTabbar()
    renderOv()
    DM.onRender.forEach((fn) => fn())
  }

  /** 只重画覆盖层的最上一层之外的部分时也用 render()；局部刷新用这几个 */
  function refresh() {
    renderView()
    renderOv()
    DM.onRender.forEach((fn) => fn())
  }

  function openOv(o, { push = false } = {}) {
    if (push) S.ovs.push(o)
    else S.ovs = [o]
    renderOv()
    DM.onRender.forEach((fn) => fn())
  }
  /** 改最上一层的状态后重画（不重播进场动画） */
  function updateOv(patch) {
    const top = S.ovs[S.ovs.length - 1]
    if (top) Object.assign(top, patch)
    renderOv()
    DM.onRender.forEach((fn) => fn())
  }
  function closeOv() {
    S.ovs.pop()
    renderOv()
    renderView()
    DM.onRender.forEach((fn) => fn())
  }
  function closeAll() {
    S.ovs = []
    renderOv()
  }

  // ---------------------------------------------------------------- 吐司

  let toastTimer = 0
  function toast(msg, action) {
    const host = $('#toastL')
    clearTimeout(toastTimer)
    host.innerHTML = `<div class="toast ${action ? '' : 'only'}"><span>${msg}</span>${action ? `<button data-toast>${action.label}</button>` : ''}</div>`
    const el = host.firstChild
    if (action) el.querySelector('[data-toast]').onclick = () => {
      action.run()
      host.innerHTML = ''
    }
    toastTimer = setTimeout(() => {
      el.classList.add('out')
      setTimeout(() => el.parentNode && (host.innerHTML = ''), 260)
    }, action ? 3600 : 2400)
  }

  // ---------------------------------------------------------------- 今天 · 焦点舞台

  function pctOf(it) {
    const g = growthOf(it)
    const st = stageOf(g)
    const nx = THRESH[st + 1]
    if (nx === undefined) return 100
    return Math.round(((g - THRESH[st]) / (nx - THRESH[st])) * 100)
  }

  function growthBar(it, fx) {
    const g = growthOf(it)
    const st = stageOf(g)
    const nx = THRESH[st + 1]
    const pct = pctOf(it)
    const from = fx && fx.prevPct !== undefined ? fx.prevPct : pct
    const bar = (cls) => `<div class="g-track ${cls}"><i style="width:${from}%" data-w="${pct}"></i></div>`
    if (sleeping(it)) return `<div class="growth"><div class="g-row"><span>暂停生长 · 等你回来</span><span>成长 <b>${g}</b> 天</span></div>${bar('paused')}</div>`
    if (nx === undefined) return `<div class="growth"><div class="g-row"><span>成长 <b>${g}</b> 天</span><span>已经是最好的样子啦</span></div>${bar('')}</div>`
    return `<div class="growth"><div class="g-row"><span>成长 <b>${g}</b> 天</span><span>再 ${nx - g} 天 → ${SPECIES[it.species].stages[st + 1]}</span></div>${bar('')}</div>`
  }

  function numBlock(it, fx) {
    const flip = fx ? 'flip' : ''
    let lead = ''
    let num = ''
    let unit = ''
    let sub = ''
    if (it.type === 'since') {
      lead = '第'
      num = sinceDays(it)
      unit = '天'
      sub = `从 ${fmt(it.start, 'dot')} 起 · ${ymdStr(it.start, S.simDay)}`
    } else if (it.type === 'countdown') {
      const l = left(it)
      if (l === 0) return `<div class="sc-num"><span class="num word ${flip}">就是今天</span></div><div class="sc-sub">${fmt(it.date, 'mdw')} · ${it.repeat}</div>`
      lead = '还有'
      num = l
      unit = '天'
      sub = `${fmt(it.date, 'mdw')} · ${it.repeat}`
    } else if (it.cadence === 'weekly') {
      lead = '本周'
      num = it.weekCount
      unit = `/ ${it.target} 次`
      sub = `${it.remind} · 上次是 ${gap(it) === 0 ? '今天' : gap(it) + ' 天前'}`
    } else if (it.target > 1) {
      lead = '今天'
      num = it.todayCount
      unit = `/ ${it.target} ${it.unit}`
      sub = `已经陪你喝了 ${it.growth} 天 · ${it.remind}`
    } else {
      lead = it.lead || '一共记了'
      num = it.growth
      unit = it.unit || '天'
      sub = `${it.sub || ''} · ${it.remind}`
    }
    return `<div class="sc-num"><span class="lead">${lead}</span><span class="num ${flip}" data-num>${num}</span><span class="unit">${unit}</span></div><div class="sc-sub">${sub}</div>`
  }

  function extraBlock(it, fx) {
    if (it.type === 'countdown') {
      const todo = it.todo.length
        ? `<div class="todo">${it.todo.map((t, i) => `<button data-act="todo" data-id="${it.id}" data-i="${i}" class="${t.done ? 'done' : ''}">${t.done ? ICON.check : '○'} ${esc(t.t)}</button>`).join('')}</div>`
        : ''
      const memo = it.memo || todo ? `<div class="memo"><div class="memo-h"><span>备忘</span><span>${it.todo.filter((t) => t.done).length}/${it.todo.length}</span></div>${it.memo ? `<p>${esc(it.memo)}</p>` : ''}${todo}</div>` : ''
      return `<div class="center"><span class="remind-chip">${ICON.bell} ${it.remind}</span></div>${memo}`
    }
    let cups = ''
    if (it.type === 'habit' && it.target > 1 && it.cadence === 'daily') {
      cups = `<div class="cups">${Array.from({ length: it.target }, (_, i) => `<span class="cup ${i < it.todayCount ? 'on' : ''} ${fx && i === it.todayCount - 1 ? 'new' : ''}"></span>`).join('')}</div>`
    }
    return cups + growthBar(it, fx)
  }

  function actionBlock(it) {
    if (it.type === 'habit') {
      const sl = sleeping(it)
      const done = doneToday(it)
      const label = done ? `${ICON.check} 今天已记 · 明天见` : sl ? '按住 · 叫醒它' : it.target > 1 ? `按住 · 喝了一${it.unit}` : it.cadence === 'weekly' ? '按住 · 跑完一次' : '按住 · 记下今天'
      const hint = S.guide === 'hold' && !done ? '<span class="hint-finger">👆</span>' : ''
      return `<div class="sc-actions"><button class="hold ${done ? 'done' : ''}" data-hold><span class="hold-fill"></span><span class="hold-label">${label}</span>${hint}</button></div>`
    }
    if (it.type === 'since') {
      return `<div class="sc-actions"><button class="btn ghost" data-act="pet">摸摸它</button><button class="btn" data-act="share" data-id="${it.id}">${ICON.share} 分享这一天</button></div>`
    }
    if (left(it) === 0) return `<div class="sc-actions"><button class="btn block" data-act="dayDone" data-id="${it.id}">说过了，明年见</button></div>`
    return `<div class="sc-actions"><button class="btn ghost" data-act="detail" data-id="${it.id}">${ICON.bell} 提醒与备忘</button><button class="btn" data-act="share" data-id="${it.id}">${ICON.share} 分享</button></div>`
  }

  function particles(n = 14) {
    const kinds = ['', 's', 'h', 's', '']
    let s = ''
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4
      const r = 70 + Math.random() * 70
      s += `<i class="p ${kinds[i % kinds.length]}" style="--dx:${(Math.cos(a) * r).toFixed(0)}px;--dy:${(Math.sin(a) * r - 20).toFixed(0)}px;--r:${Math.round(Math.random() * 360)}deg"></i>`
    }
    return s
  }
  function confetti(n = 26) {
    const colors = ['var(--h-coral)', 'var(--h-lemon)', 'var(--h-mint)', 'var(--h-sky)', 'var(--h-grape)']
    let s = '<div class="confetti">'
    for (let i = 0; i < n; i++) s += `<i style="left:${Math.random() * 100}%;background:${colors[i % 5]};animation-delay:${(Math.random() * 3).toFixed(2)}s;animation-duration:${(2.6 + Math.random() * 1.6).toFixed(2)}s"></i>`
    return s + '</div>'
  }

  function stageCard(it, mini = false) {
    const fx = !mini && S.fx && S.fx.id === it.id ? S.fx : null
    const enter = !mini && S.enter ? `enter-${S.enter}` : ''
    const sl = sleeping(it)
    const bub = !mini && S.bubble && S.bubble.id === it.id ? S.bubble.text : lineFor(it)
    const bg = it.photo ? `<div class="photo">${photoSVG()}</div><div class="photo-blur"></div>` : '<div class="deco"></div>'
    const fxl = fx
      ? `<div class="fx">${particles(fx.milestone ? 22 : 14)}${fx.plus ? `<span class="plus1">${fx.plus}</span>` : ''}${fx.milestone ? '<span class="flash"></span>' : ''}</div>`
      : ''
    const party = it.type === 'countdown' && left(it) === 0 ? confetti() : ''
    return `<section class="stage-card ${it.photo ? 'has-photo' : ''} ${enter}" style="${hueStyle(it.hue)}" data-card="${it.id}">
      ${bg}
      <div class="sc-top"><span class="tag">${typeTag(it)}</span><h2 class="sc-title">${esc(it.title)}</h2><button class="sc-more" data-act="detail" data-id="${it.id}">档案 ›</button></div>
      <div class="sc-hero">
        <div class="bubble ${fx ? 'pop' : ''}" data-bubble>${bub}</div>
        <div class="cr-wrap ${sl ? 'sleep' : ''} ${fx ? 'jump' : ''}" data-cr>
          <svg class="charge-ring" viewBox="0 0 200 200"><circle class="track" cx="100" cy="100" r="92.6"/><circle class="bar" cx="100" cy="100" r="92.6"/></svg>
          ${fx && fx.milestone ? creature({ species: it.species, stage: fx.from, mood: 'happy', size: 158, extra: { pumpkin: S.halloween } }) : crOf(it, 158, fx ? 'happy' : undefined)}
          <div class="ground"></div>
          ${sl ? '<div class="zzz"><span>z</span><span>z</span><span>Z</span></div>' : ''}
        </div>
      </div>
      ${numBlock(it, fx)}
      ${extraBlock(it, fx)}
      ${actionBlock(it)}
      ${fxl}${party}
    </section>`
  }

  function todayView() {
    if (!S.items.length) return DM.VIEWS.empty ? DM.VIEWS.empty() : ''
    const it = focused()
    const others = S.items.filter((x) => x.id !== it.id).slice(0, 2)
    return `<div class="today ${S.halloween ? 'halloween' : ''}">
      <header class="t-head">
        <div><div class="t-date">${fmt(S.simDay, 'mdw')}</div><div class="t-greet">${S.halloween ? '万圣节快乐 🎃' : greet()}</div></div>
        <div class="t-actions">
          <button class="pill-switch" data-act="switcher" aria-label="切换注意力"><span class="stack">${others.map((o) => `<span class="av" style="${hueStyle(o.hue)}">${crOf(o, 30)}</span>`).join('')}</span>${S.items.length} 件 ${ICON.down}</button>
          <button class="icon-btn" data-act="add" aria-label="新的一件事">${ICON.plus}</button>
        </div>
      </header>
      ${stageCard(it)}
      <div class="focus-dots">${S.items.map((x) => `<button data-act="focus" data-id="${x.id}" class="${x.id === it.id ? 'is-on' : ''}" aria-label="${esc(x.title)}"></button>`).join('')}</div>
      <div class="swipe-hint ${S.guide === 'swipe' ? 'anim' : ''}">${S.guide === 'swipe' ? '← 在卡片上左右滑，换一件事看 →' : '一次只看一件 · 左右滑或点右上角切换'}</div>
    </div>`
  }
  DM.VIEWS.today = todayView

  // ---------------------------------------------------------------- 动作：记一次 / 摸摸它 / 切换

  function setFocus(id, dir) {
    if (!it$(id)) return
    const items = S.items
    if (!dir) {
      const a = items.findIndex((x) => x.id === S.focusId)
      const b = items.findIndex((x) => x.id === id)
      dir = b >= a ? 'r' : 'l'
    }
    S.enter = id === S.focusId ? null : dir
    S.focusId = id
    S.bubble = null
    S.tab = 'today'
    renderView()
    renderTabbar()
    S.enter = null
    sfx('pop')
    DM.onRender.forEach((fn) => fn())
  }

  function shiftFocus(d) {
    const items = S.items
    const i = items.findIndex((x) => x.id === S.focusId)
    const next = items[(i + d + items.length) % items.length]
    if (S.guide === 'swipe') S.guide = null
    setFocus(next.id, d > 0 ? 'r' : 'l')
  }

  function completeLog(it) {
    const snap = JSON.parse(JSON.stringify(it))
    const before = stageOf(growthOf(it))
    const wasSleeping = sleeping(it)
    const prevPct = pctOf(it)
    it.todayCount++
    if (it.cadence === 'weekly') it.weekCount++
    if (it.todayCount === 1) {
      it.growth++
      it.log.push(S.simDay)
      it.streak = it.lastDay === S.simDay - 1 ? it.streak + 1 : 1
      it.lastDay = S.simDay
    }
    const after = stageOf(growthOf(it))
    S.fx = { id: it.id, from: before, prevPct: after > before ? 0 : prevPct, plus: it.target > 1 && it.cadence === 'daily' ? `+1 ${it.unit}` : '+1', milestone: after > before }
    S.bubble = { id: it.id, text: wasSleeping ? '你回来啦！它没有变小，只是睡了一会儿。' : afterLogLine(it) }
    S.guide = null
    sfx(after > before ? 'evolve' : 'ding')
    buzz(after > before ? [12, 40, 22] : 16)
    renderView()
    S.fx = null
    DM.onRender.forEach((fn) => fn())
    toast(`${esc(it.title)} · 记下了`, {
      label: '撤销',
      run: () => {
        Object.assign(it, snap)
        S.bubble = null
        renderView()
      },
    })
    if (after > before) setTimeout(() => openOv({ type: 'evolve', id: it.id, from: before, to: after }), 1000)
    else if (wasSleeping && !S.badges.back) setTimeout(() => unlockBadge('back'), 1100)
  }

  function unlockBadge(id) {
    if (S.badges[id]) return false
    S.badges[id] = true
    S.badgeNew = id
    openOv({ type: 'badge', id }, { push: S.ovs.length > 0 })
    sfx('hatch')
    return true
  }

  function pet(it) {
    it = it || focused()
    const card = document.querySelector(`#view [data-card="${it.id}"]`)
    if (!card) return
    const wrap = card.querySelector('[data-cr]')
    const bub = card.querySelector('[data-bubble]')
    S.taps++
    const text = S.taps % 7 === 0 ? '今天第 7 次摸我了……有点害羞。' : sleeping(it) ? '呼……（它翻了个身，又睡着了）' : pick(TAP_LINES.filter((t) => t !== bub.textContent))
    S.bubble = { id: it.id, text }
    bub.textContent = text
    for (const [el, cls] of [[bub, 'pop'], [wrap, 'jump']]) {
      el.classList.remove(cls)
      void el.offsetWidth
      el.classList.add(cls)
    }
    const fx = document.createElement('div')
    fx.className = 'fx'
    fx.innerHTML = `<i class="p h" style="--dx:-40px;--dy:-80px;--r:-20deg"></i><i class="p h" style="--dx:30px;--dy:-100px;--r:15deg"></i><i class="p h" style="--dx:60px;--dy:-60px;--r:30deg"></i>`
    card.appendChild(fx)
    setTimeout(() => fx.remove(), 900)
    sfx('pop')
    buzz(8)
  }

  // ---------------------------------------------------------------- 数据动作（覆盖层模块也调用）

  /** 合上一章：归档进藏馆；小伙伴不变小，下一章从今天重新数 */
  function endChapter(it, line) {
    const days = it.type === 'since' ? sinceDays(it) : S.simDay - it.startDay
    const ch = { id: 'c' + Date.now(), itemId: it.id, title: it.title, no: it.chapter, days, start: it.type === 'since' ? it.start : it.startDay, end: S.simDay, line: line || '这一章写完了。', species: it.species, hue: it.hue, stage: stageOf(growthOf(it)), fresh: true }
    S.chapters.unshift(ch)
    if (it.type === 'since') {
      it.prev += days
      it.start = S.simDay
    } else {
      it.startDay = S.simDay
    }
    it.chapter++
    return ch
  }

  /** 去旅行（删除）：藏馆里留着最后一章，可撤销 */
  function sendTravel(it) {
    const snapItems = S.items.slice()
    const snapChapters = S.chapters.slice()
    const snapFocus = S.focusId
    const days = it.type === 'since' ? sinceDays(it) : it.type === 'habit' ? S.simDay - it.startDay : 0
    S.chapters.unshift({ id: 'c' + Date.now(), itemId: it.id, title: it.title, no: it.chapter || 1, days, start: it.start ?? it.startDay ?? S.simDay, end: S.simDay, line: '它去旅行了。', species: it.species, hue: it.hue, stage: it.type === 'countdown' ? 0 : stageOf(growthOf(it)), gone: true, fresh: true })
    const i = S.items.indexOf(it)
    S.items.splice(i, 1)
    if (S.focusId === it.id) S.focusId = (S.items[i] || S.items[i - 1] || {}).id || null
    return () => {
      S.items = snapItems
      S.chapters = snapChapters
      S.focusId = snapFocus
    }
  }

  /** 从新建草稿生成一件事，并把焦点切过去 */
  function createFromDraft(d) {
    const id = 'n' + Date.now()
    const base = { id, title: d.title || '新的一件事', species: d.species, hue: d.hue, chapter: 1 }
    let it
    if (d.type === 'habit') {
      const multi = d.target > 1 && d.cadence === 'daily'
      it = Object.assign(base, { type: 'habit', cadence: d.cadence, target: d.target, unit: multi ? '次' : d.cadence === 'weekly' ? '次' : '天', lead: '一共记了', growth: 0, streak: 0, todayCount: 0, weekCount: 0, lastDay: S.simDay, log: [], startDay: S.simDay, remind: (d.remind || '不提醒').replace(/^每天/, d.cadence === 'weekly' ? '每周一' : '每天'), sub: d.cadence === 'weekly' ? `每周 ${d.target} 次` : '每天一次' })
    } else if (d.type === 'since') {
      it = Object.assign(base, { type: 'since', start: d.startMode === 'past' ? S.simDay - 30 : S.simDay, prev: 0, remind: null })
    } else {
      it = Object.assign(base, { type: 'countdown', species: 'post', date: S.simDay + (d.date || 30), repeat: d.repeat || '不重复', remind: d.remind || '提前 1 天 · 09:00', memo: '', todo: [] })
    }
    if (d.photo) it.photo = true
    S.items.push(it)
    S.focusId = id
    const dk = `${it.species}:0`
    if (!S.dex.includes(dk)) S.dex.push(dk)
    if (!S.badges.first) S.badges.first = true
    return it
  }

  /** 演示：快进一天 */
  function simNextDay() {
    const beforeStages = S.items.filter((x) => x.type === 'since').map((x) => [x, stageOf(growthOf(x))])
    S.simDay++
    S.bubble = null
    for (const it of S.items) if (it.type === 'habit') it.todayCount = 0
    if ((S.simDay % 7 + 7) % 7 === 2) for (const it of S.items) if (it.cadence === 'weekly') it.weekCount = 0
    render()
    toast(`快进到 ${fmt(S.simDay, 'mdw')}`)
    // 回头看的理由：自动生长的事跨过门槛，打开 App 时补一段过场
    const grown = beforeStages.find(([it, st]) => stageOf(growthOf(it)) > st)
    if (grown) setTimeout(() => openOv({ type: 'evolve', id: grown[0].id, from: grown[1], to: stageOf(growthOf(grown[0])) }), 700)
  }

  function replaceState(next) {
    for (const k of Object.keys(S)) delete S[k]
    Object.assign(S, next)
    lastKeys = []
  }

  Object.assign(DM.ACT, {
    tab(el) {
      S.tab = el.dataset.tab
      S.ovs = []
      $('#view').scrollTop = 0
      render()
    },
    switcher: () => openOv({ type: 'switcher' }),
    add: () => openOv({ type: 'add', step: 1, draft: {} }),
    focus: (el) => setFocus(el.dataset.id),
    pickFocus(el) {
      S.ovs = []
      renderOv()
      setFocus(el.dataset.id)
    },
    detail: (el) => openOv({ type: 'detail', id: el.dataset.id || S.focusId }),
    share: (el) => {
      const it = it$(el.dataset.id || S.focusId)
      openOv({ type: 'share', id: it.id, tpl: it.photo ? 'photo' : 'sticker', li: 0 }, { push: S.ovs.length > 0 })
    },
    pet: () => pet(),
    close: () => closeOv(),
    closeAll: () => {
      S.ovs = []
      refresh()
    },
    todo(el) {
      const it = it$(el.dataset.id)
      const t = it.todo[+el.dataset.i]
      t.done = !t.done
      sfx('pop')
      refresh()
    },
    dayDone(el) {
      const it = it$(el.dataset.id)
      S.chapters.unshift({ id: 'c' + Date.now(), itemId: it.id, title: `${it.title} · ${dateOf(it.date).getFullYear()}`, no: 1, days: 0, start: it.date, end: it.date, line: '说过生日快乐了。', species: 'post', hue: it.hue, stage: 0, countdown: true, fresh: true })
      it.date = S.simDay + 365
      S.bubble = null
      renderView()
      toast('收进藏馆了 · 明年见')
      setTimeout(() => unlockBadge('bday'), 500)
    },
  })

  // ---------------------------------------------------------------- 手势：按住记一次 / 横滑换焦点 / 轻点摸摸

  let P = null
  function onDown(e) {
    const card = e.target.closest('#view .stage-card')
    if (!card || S.ovs.length) return
    if (e.target.closest('button:not([data-hold])')) return
    const it = it$(card.dataset.card)
    if (!it) return
    P = { x: e.clientX, y: e.clientY, t: performance.now(), card, it, onHold: !!e.target.closest('[data-hold]'), onCr: !!e.target.closest('[data-cr]'), mode: 'pending', charging: false, done: false }
    if ((P.onHold || P.onCr) && canLog(it)) startCharge()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }
  function startCharge() {
    P.charging = true
    P.card.classList.add('charging')
    sfx('soft')
    const g = P
    g.timer = setTimeout(() => {
      g.done = true
      g.charging = false
      g.card.classList.remove('charging')
      completeLog(g.it)
    }, 600)
  }
  function cancelCharge() {
    if (P && P.charging) {
      clearTimeout(P.timer)
      P.charging = false
      P.card.classList.remove('charging')
    }
  }
  function onMove(e) {
    if (!P || P.done) return
    const dx = e.clientX - P.x
    const dy = e.clientY - P.y
    if (P.mode === 'pending' && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      cancelCharge()
      P.mode = Math.abs(dx) > Math.abs(dy) && !P.onHold && S.items.length > 1 ? 'swipe' : 'none'
      if (P.mode === 'swipe') P.card.classList.add('dragging')
    }
    if (P.mode === 'swipe') P.card.style.transform = `translateX(${dx}px) rotate(${dx * 0.02}deg)`
  }
  function onUp(e) {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    if (!P) return
    const g = P
    P = null
    const dx = e.clientX - g.x
    if (g.mode === 'swipe') {
      g.card.classList.remove('dragging')
      if (Math.abs(dx) > 70) shiftFocus(dx < 0 ? 1 : -1)
      else g.card.style.transform = ''
      return
    }
    if (g.done) return
    const quick = performance.now() - g.t < 250
    const wasCharging = g.charging
    P = g
    cancelCharge()
    P = null
    if (g.mode !== 'pending') return
    if (g.onCr && quick) pet(g.it)
    else if (g.onHold && !canLog(g.it)) toast('今天已经记过啦，明天见')
    else if (g.onHold && wasCharging) toast('再按久一点点，蓄满才算一次')
  }

  // ---------------------------------------------------------------- 启动

  function boot() {
    const screen = $('#screen')
    screen.addEventListener('pointerdown', onDown)
    screen.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]')
      if (!a || !screen.contains(a)) return
      const fn = DM.ACT[a.dataset.act]
      if (fn) fn(a, e)
    })
    render()
  }

  Object.assign(DM, {
    // 常量
    BASE, DAY, SPECIES, THRESH, HUES, THEMES, BADGES, NOTE_POOL, TAP_LINES, ICON,
    // 状态
    seed, fresh, replaceState,
    // 派生
    esc, pick, it$, focused, sinceDays, growthOf, left, gap, sleeping, doneToday, canLog, stageOf, moodOf, crOf, hueStyle, dateOf, fmt, ymdStr, greet, lineFor, afterLogLine, typeTag, pctOf,
    // 素材
    creature, badge, photoSVG, stageCard, confetti, particles,
    // 渲染
    render, refresh, renderView, renderTabbar, renderOv, applyTheme, openOv, updateOv, closeOv, closeAll, toast, sfx, buzz,
    // 动作
    setFocus, shiftFocus, completeLog, pet, unlockBadge, endChapter, sendTravel, createFromDraft, simNextDay,
    boot,
  })
})()
