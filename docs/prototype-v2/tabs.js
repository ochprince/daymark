/*
 * 底层页面：欢迎（首次打开）、空态、藏馆、装扮。
 * 只通过 DM.VIEWS / DM.VIEW_AFTER / DM.ACT 挂到核心上。
 */
;(function () {
  'use strict'
  const DM = window.DM
  const S = DM.S
  const { creature, badge, esc, hueStyle, SPECIES, THRESH, BADGES, THEMES, ICON } = DM

  const DEX_HUE = { sprout: 'mint', moon: 'grape', drop: 'sky', star: 'lemon', post: 'coral' }
  const DEX_TOTAL = 23

  // ---------------------------------------------------------------- 欢迎

  DM.VIEWS.welcome = () => {
    const orbit = [
      { sp: 'sprout', st: 3, x: '8%', y: '14%', d: 0 },
      { sp: 'moon', st: 2, x: '72%', y: '6%', d: 0.8 },
      { sp: 'drop', st: 3, x: '2%', y: '62%', d: 1.6 },
      { sp: 'star', st: 2, x: '74%', y: '58%', d: 2.4 },
    ]
    return `<div class="welcome">
      <div class="w-brand">DAYMARK · 刻度</div>
      <h1>刻度</h1>
      <p>陪你记住每一个日子。<br/>坚持的事、要等的日子、想养成的习惯——<br/>一次只看一件，慢慢来。</p>
      <div class="w-hero">
        ${orbit
          .map(
            (o) =>
              `<span class="orbit" style="left:${o.x};top:${o.y};animation-delay:${o.d}s;${hueStyle(DEX_HUE[o.sp])}">${creature({ species: o.sp, stage: o.st, size: 78, mood: o.sp === 'moon' ? 'sleep' : 'happy' })}</span>`,
          )
          .join('')}
        <span class="w-egg" style="${hueStyle('lemon')}">${creature({ species: 'sprout', stage: 'egg', size: 190 })}<i class="w-egg-shadow"></i></span>
      </div>
      <button class="btn" data-act="welcomeStart">带一颗蛋回家</button>
      <button class="w-skip" data-act="welcomeSkip">我先随便看看</button>
    </div>`
  }

  DM.VIEWS.empty = () => `<div class="empty card">
      <div style="${hueStyle('coral')}" class="empty-egg">${creature({ species: 'sprout', stage: 'egg', size: 120 })}</div>
      <h3>这里还空着</h3>
      <p>要不要带一颗蛋回家？</p>
      <button class="btn" data-act="welcomeStart">${ICON.plus} 新的一件事</button>
    </div>`

  Object.assign(DM.ACT, {
    welcomeStart: () => DM.openOv({ type: 'add', step: 1, draft: {} }),
    welcomeSkip() {
      DM.replaceState(DM.seed())
      DM.render()
    },
  })

  // ---------------------------------------------------------------- 藏馆

  const dexCount = () => {
    let n = S.dex.filter((k) => !k.startsWith('post')).length + 1 // 信信默认在
    if (S.badges.pumpkin) n++
    return Math.min(n, DEX_TOTAL)
  }

  function chaptersPane() {
    const rows = []
    for (let i = 0; i < S.chapters.length; i += 5) rows.push(S.chapters.slice(i, i + 5).map((c, j) => [c, i + j]))
    const shelves = rows
      .map(
        (row) =>
          `<div class="shelf-row">${row
            .map(([c, idx], j) => {
              const h = Math.round(142 + Math.min(36, Math.log2(c.days + 1) * 5.5))
              const title = c.title.replace(/ · \d{4}$/, '').slice(0, 5)
              const lean = j === row.length - 1 && row.length < 5 && row.length > 1 ? 'lean' : ''
              return `<button class="spine ${c.gone ? 'gone' : ''} ${lean}" style="height:${h}px;${hueStyle(c.hue)}" data-act="openChapter" data-idx="${idx}" aria-label="${esc(c.title)} ${c.days} 天">
                <span class="sp-band"></span>
                ${c.fresh ? '<span class="sp-new">新</span>' : ''}
                <span class="sp-t">${esc(title)}</span>
                <span class="sp-n">${c.countdown ? '★' : c.days}<small>${c.countdown ? '那天' : '天'}</small></span>
              </button>`
            })
            .join('')}</div>`,
      )
      .join('')
    return `<div class="card recap">
        <span class="recap-art">${ICON.spark}</span>
        <div><b>2026 年度回顾</b><p>12 月 31 日开启，会把这一年装成一本小书</p></div>
        <span class="lock">还有 68 天</span>
      </div>
      ${shelves || '<p class="shelf-cap">还没有写完的章节。<br/>一件事结束时，它会变成一本书放在这里。</p>'}
      ${shelves ? '<p class="shelf-cap">每一段坚持都是一本书 · 轻点翻开</p>' : ''}`
  }

  function dexPane() {
    let html = ''
    for (const sp of ['sprout', 'moon', 'drop', 'star']) {
      const info = SPECIES[sp]
      const got = [0, 1, 2, 3, 4].filter((st) => S.dex.includes(`${sp}:${st}`)).length
      html += `<div class="dex-name"><span>${info.name} <small>· ${info.intro.split('，')[0]}</small></span><small>${got}/5</small></div>`
      html += [0, 1, 2, 3, 4]
        .map((st) => {
          const key = `${sp}:${st}`
          const on = S.dex.includes(key)
          return `<div class="dex-cell ${on ? 'on' : 'off'} ${S.dexNew === key ? 'new' : ''}" style="${hueStyle(DEX_HUE[sp])}">
            ${creature({ species: sp, stage: st, size: 54, extra: { silhouette: !on } })}
            <span>${on ? info.stages[st] : `${THRESH[st]} 天`}</span>
          </div>`
        })
        .join('')
    }
    const pumpkinOn = !!S.badges.pumpkin
    html += `<div class="dex-name"><span>特别篇 <small>· 藏在某些日子里</small></span><small>${1 + (pumpkinOn ? 1 : 0)}/3</small></div>`
    html += `<div class="dex-cell on" style="${hueStyle('coral')}">${creature({ species: 'post', size: 54 })}<span>信信</span></div>`
    html += `<div class="dex-cell ${pumpkinOn ? 'on' : 'off'}" style="${hueStyle('lemon')}">${creature({ species: 'sprout', stage: 2, size: 54, extra: { pumpkin: true, silhouette: !pumpkinOn } })}<span>${pumpkinOn ? '南瓜帽' : '某个节日'}</span></div>`
    html += `<div class="dex-cell off" style="${hueStyle('sky')}">${creature({ species: 'drop', stage: 1, size: 54, extra: { silhouette: true } })}<span>冬天</span></div>`
    return `<div class="dex">${html}</div>
      <p class="shelf-cap">形态只会变多，不会变少 · 断了也不会倒退</p>`
  }

  function badgesPane() {
    return `<div class="badges">${BADGES.map((b) => {
      const got = !!S.badges[b.id]
      const secret = b.hidden && !got
      return `<div class="card bdg ${got ? '' : 'off'} ${S.badgeNew === b.id ? 'new' : ''}">
        ${badge(b.kind, b.label, 72, secret)}
        <b>${secret ? '???' : b.name}</b>
        <small>${secret ? '隐藏徽章' : b.desc}</small>
      </div>`
    }).join('')}</div>
    <p class="shelf-cap">没有排行榜，也不会因为断了而收回</p>`
  }

  function notesPane() {
    const n = S.notes.length
    return `<div class="slips">
        ${S.notes.map((x) => `<div class="slip">${esc(x.t)}<small>—— ${esc(x.from)} · ${DM.fmt(x.day)}</small></div>`).join('')}
        <div class="slip locked">还有 ${Math.max(0, 45 - n)} 张在路上<br/>它们会在某个普通的日子出现</div>
      </div>`
  }

  DM.VIEWS.museum = () => {
    const gotBadges = BADGES.filter((b) => S.badges[b.id]).length
    const tabs = [
      ['chapters', '章节'],
      ['dex', '图鉴'],
      ['badges', '徽章'],
      ['notes', '纸条'],
    ]
    const pane = { chapters: chaptersPane, dex: dexPane, badges: badgesPane, notes: notesPane }[S.museumTab] || chaptersPane
    return `<div class="museum">
      <header class="m-head"><h2>藏馆</h2><p>你走过的每一段，都在这里</p></header>
      <div class="m-stats">
        <div class="card m-stat"><b>${S.chapters.length}</b><span>章节</span></div>
        <div class="card m-stat"><b>${dexCount()}<small>/${DEX_TOTAL}</small></b><span>图鉴</span></div>
        <div class="card m-stat"><b>${gotBadges}</b><span>徽章</span></div>
        <div class="card m-stat"><b>${S.notes.length}</b><span>纸条</span></div>
      </div>
      <div class="seg m-tabs">${tabs.map(([k, l]) => `<button data-act="mtab" data-v="${k}" class="${S.museumTab === k ? 'is-on' : ''}">${l}</button>`).join('')}</div>
      ${pane()}
    </div>`
  }

  Object.assign(DM.ACT, {
    mtab(el) {
      S.museumTab = el.dataset.v
      document.querySelector('#view').scrollTop = 0
      DM.renderView()
      DM.onRender.forEach((fn) => fn())
    },
    openChapter: (el) => DM.openOv({ type: 'chapter', idx: +el.dataset.idx }),
  })

  // ---------------------------------------------------------------- 装扮

  const ACCENTS = ['auto', 'coral', 'lemon', 'mint', 'sky', 'grape']
  const NUMS = [
    ['auto', '跟随', 'var(--font-num)', 'var(--num-w)', 'var(--num-style)'],
    ['round', '圆胖', "'Baloo 2', ui-rounded, sans-serif", 800, 'normal'],
    ['serif', '衬线', "'Instrument Serif', serif", 400, 'italic'],
    ['pixel', '像素', "'Silkscreen', monospace", 700, 'normal'],
    ['hand', '手写', "'Caveat', cursive", 700, 'normal'],
  ]
  const TEXTURES = [
    ['auto', '跟随'],
    ['plain', '纯色'],
    ['dots', '点点'],
    ['grid', '格子'],
    ['lines', '横线'],
  ]

  function miniPhone(themeId) {
    const it = DM.focused()
    const inner = it
      ? `<header class="t-head"><div><div class="t-date">${DM.fmt(S.simDay, 'mdw')}</div><div class="t-greet">${DM.greet()}</div></div></header>${DM.stageCard(it, true)}`
      : `<div class="empty card"><h3>这里还空着</h3></div>`
    return `<div class="mini" data-theme="${themeId}"><div class="mini-inner">${inner}</div></div>`
  }

  function optAccent() {
    return `<div class="card opt" data-opt="accent"><div class="opt-h"><span>主色</span><small>按钮与选中态</small></div>
      <div class="swatches">${ACCENTS.map((a) => `<button class="sw ${a === 'auto' ? 'auto' : ''} ${S.accent === a ? 'is-on' : ''}" data-act="optAccent" data-v="${a}" style="${a === 'auto' ? '' : `background:var(--h-${a})`}" aria-label="${a}"></button>`).join('')}</div></div>`
  }
  function optNum() {
    return `<div class="card opt" data-opt="num"><div class="opt-h"><span>数字样式</span><small>大数字的仪式感，每套皮肤单独设计</small></div>
      <div class="numopts">${NUMS.map(([k, l, f, w, st]) => `<button class="numopt ${S.num === k ? 'is-on' : ''}" data-act="optNum" data-v="${k}"><b style="font-family:${f};font-weight:${w};font-style:${st}">128</b><small>${l}</small></button>`).join('')}</div></div>`
  }
  function optTex() {
    const tex = {
      auto: 'var(--texture)',
      plain: 'none',
      dots: 'radial-gradient(var(--hair) 1.3px, transparent 1.6px) 0 0 / 10px 10px',
      grid: 'linear-gradient(var(--hair) 1px, transparent 1px) 0 0 / 9px 9px, linear-gradient(90deg, var(--hair) 1px, transparent 1px) 0 0 / 9px 9px',
      lines: 'repeating-linear-gradient(0deg, transparent 0 9px, var(--hair) 9px 10px)',
    }
    return `<div class="card opt" data-opt="texture"><div class="opt-h"><span>背景纹理</span><small>卡片材质与底纹</small></div>
      <div class="texopts">${TEXTURES.map(([k, l]) => `<button class="texopt ${S.texture === k ? 'is-on' : ''}" data-act="optTex" data-v="${k}" style="background:${tex[k]};background-color:var(--bg)">${l}</button>`).join('')}</div></div>`
  }
  function toggleRow(key, label, sub) {
    return `<div class="li"><span class="grow">${label}${sub ? `<small class="li-sub">${sub}</small>` : ''}</span><button class="toggle ${S[key] ? 'on' : ''}" data-act="optToggle" data-k="${key}" aria-label="${label}"></button></div>`
  }

  DM.VIEWS.dress = () => {
    const idx = Math.max(0, THEMES.findIndex((t) => t.id === S.theme))
    return `<div class="dress">
      <header class="dress-h"><h2>装扮</h2><p>换一套风格，信息一点都不会变</p></header>
      <div class="gallery" data-gallery>
        ${THEMES.map(
          (t) => `<div class="g-item ${t.id === S.theme ? 'is-on' : ''}" role="button" tabindex="0" data-act="themePick" data-v="${t.id}">
            ${miniPhone(t.id)}
            <b>${t.name}</b><small>${t.tag}</small><span class="applied">使用中</span>
          </div>`,
        ).join('')}
        <div class="coming"><span class="coming-plus">${ICON.plus}</span><span>更多风格包</span><small>水彩 / 手账 / 极简黑<br/>敬请期待</small></div>
      </div>
      <div class="g-dots">${THEMES.map((t, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</div>
      <p class="g-hint">左右滑动预览 · 松手就换上</p>
      <div class="sec-title">自定义 <small>只改这一套的细节</small></div>
      ${optAccent()}
      ${optNum()}
      ${optTex()}
      <div class="sec-title">其他</div>
      <div class="card list">
        ${toggleRow('sound', '音效', '打卡、进化时的小声音')}
        ${toggleRow('haptic', '震动', '蓄满时轻轻一下')}
        ${toggleRow('reduce', '减弱动效', '过场与彩带都会变安静')}
        <div class="li"><span class="grow">数据只在这台设备上<small class="li-sub">不联网 · 无账号 · 无埋点</small></span></div>
        <button class="li" data-act="exportData"><span class="grow">导出备份</span><small>›</small></button>
      </div>
    </div>`
  }

  let settleTimer = 0
  function centeredIndex(gal) {
    const mid = gal.scrollLeft + gal.clientWidth / 2
    let best = 0
    let bestD = Infinity
    gal.querySelectorAll('.g-item').forEach((el, i) => {
      const c = el.offsetLeft + el.offsetWidth / 2
      const d = Math.abs(c - mid)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    return best
  }
  function markGallery(gal, idx) {
    gal.querySelectorAll('.g-item').forEach((el, i) => el.classList.toggle('is-on', i === idx))
    const dots = gal.parentNode.querySelectorAll('.g-dots i')
    dots.forEach((el, i) => el.classList.toggle('on', i === idx))
  }
  function settle(gal) {
    const idx = centeredIndex(gal)
    const t = THEMES[idx]
    if (!t) return
    markGallery(gal, idx)
    if (t.id === S.theme) return
    S.theme = t.id
    DM.applyTheme()
    DM.toast(`已换上「${t.name}」`)
    DM.sfx('pop')
    DM.onRender.forEach((fn) => fn())
  }
  function scrollToIndex(gal, idx, smooth) {
    const el = gal.querySelectorAll('.g-item')[idx]
    if (!el) return
    const left = el.offsetLeft + el.offsetWidth / 2 - gal.clientWidth / 2
    gal.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' })
  }

  DM.VIEW_AFTER.dress = (view) => {
    const gal = view.querySelector('[data-gallery]')
    if (!gal) return
    const idx = Math.max(0, THEMES.findIndex((t) => t.id === S.theme))
    // 先关掉吸附再定位，否则首次定位会被 snap 动画带偏
    gal.style.scrollSnapType = 'none'
    scrollToIndex(gal, idx, false)
    requestAnimationFrame(() => (gal.style.scrollSnapType = ''))
    const onSettle = () => {
      clearTimeout(settleTimer)
      settleTimer = setTimeout(() => settle(gal), 140)
    }
    gal.addEventListener('scroll', () => {
      markGallery(gal, centeredIndex(gal))
      onSettle()
    })
    if ('onscrollend' in window) gal.addEventListener('scrollend', () => settle(gal))
  }

  /** 选项变化：只换这张选项卡片，不重画整页（画廊滚动位置不动） */
  function swapOpt(name, html) {
    const old = document.querySelector(`#view [data-opt="${name}"]`)
    if (!old) return
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    old.replaceWith(tmp.firstElementChild)
  }

  Object.assign(DM.ACT, {
    themePick(el) {
      const gal = el.closest('[data-gallery]')
      const idx = THEMES.findIndex((t) => t.id === el.dataset.v)
      scrollToIndex(gal, idx, true)
      // 已居中时不会触发滚动，直接应用
      setTimeout(() => settle(gal), 420)
    },
    optAccent(el) {
      S.accent = el.dataset.v
      DM.applyTheme()
      swapOpt('accent', optAccent())
      DM.sfx('pop')
    },
    optNum(el) {
      S.num = el.dataset.v
      DM.applyTheme()
      swapOpt('num', optNum())
      DM.sfx('pop')
    },
    optTex(el) {
      S.texture = el.dataset.v
      DM.applyTheme()
      swapOpt('texture', optTex())
      DM.sfx('pop')
    },
    optToggle(el) {
      const k = el.dataset.k
      S[k] = !S[k]
      el.classList.toggle('on', S[k])
      document.querySelector('#phone').classList.toggle('reduce-motion', !!S.reduce)
      if (k === 'sound' && S.sound) DM.sfx('ding')
      if (k === 'haptic' && S.haptic) DM.buzz(16)
    },
    exportData: () => DM.toast('已导出到「文件」（演示）'),
  })
})()
