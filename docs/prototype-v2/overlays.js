/*
 * 覆盖层：切换注意力、新建 → 孵化、档案、告别仪式、进化过场、分享、小纸条、翻开一章、徽章。
 * 每一层的状态就是 S.ovs 里的那个对象；改状态后 DM.updateOv() 重画（不重播进场）。
 */
;(function () {
  'use strict'
  const DM = window.DM
  const S = DM.S
  const { esc, ICON, SPECIES, THRESH, HUES } = DM
  const star = window.Creatures.star

  const top = () => S.ovs[S.ovs.length - 1]
  const layerOf = (o) => document.querySelector(`#ov .layer[data-i="${S.ovs.indexOf(o)}"]`)
  const X = `<button class="x" data-act="close" aria-label="关闭">${ICON.close}</button>`

  // ================================================================ 切换注意力

  function switchRow(it) {
    let meta = ''
    let val = ''
    if (it.type === 'since') {
      meta = `${SPECIES[it.species].name} · ${SPECIES[it.species].stages[DM.stageOf(DM.growthOf(it))]}`
      val = `${DM.sinceDays(it)}<small>天</small>`
    } else if (it.type === 'countdown') {
      const l = DM.left(it)
      meta = `${DM.fmt(it.date, 'mdw')} · ${it.repeat}`
      val = l === 0 ? '今天' : `${l}<small>天</small>`
    } else {
      if (DM.sleeping(it)) meta = '<span class="soft-dot"></span>在休息，等你回来'
      else if (it.cadence === 'weekly') meta = `本周 ${it.weekCount}/${it.target} 次`
      else if (it.target > 1) meta = `今天 ${it.todayCount}/${it.target} ${it.unit}`
      else if (DM.doneToday(it)) meta = `今天记过了 ${ICON.check}`
      else meta = '<span class="soft-dot"></span>今天还没记'
      val = `${it.growth}<small>天</small>`
    }
    const on = it.id === S.focusId
    return `<button class="sw-row ${on ? 'is-on' : ''}" style="${DM.hueStyle(it.hue)}" data-act="pickFocus" data-id="${it.id}">
      <span class="sw-av">${DM.crOf(it, 50)}</span>
      <span class="sw-main"><span class="sw-title">${esc(it.title)}${on ? '<span class="now-tag">正在看</span>' : ''}</span><span class="sw-meta">${meta}</span></span>
      <span class="sw-val">${val}</span>
    </button>`
  }

  DM.OV.switcher = () => {
    const groups = [
      ['since', '坚持着的'],
      ['habit', '在养成的习惯'],
      ['countdown', '等待的日子'],
    ]
    const body = groups
      .map(([type, label]) => {
        const list = S.items.filter((x) => x.type === type)
        return list.length ? `<div class="sw-group">${label} · ${list.length}</div>${list.map(switchRow).join('')}` : ''
      })
      .join('')
    return `<div class="dim" data-act="close"></div>
      <div class="sheet">
        <div class="grab"></div>
        <div class="sheet-h"><h3>现在想看哪一件？</h3>${X}</div>
        <p class="sheet-sub">一次只看一件，其他的会安静等着。</p>
        ${body}
        <button class="btn block ghost sw-add" data-act="add">${ICON.plus} 新的一件事</button>
      </div>`
  }

  // ================================================================ 新建：类型 → 名字 → 选蛋

  const PRESETS = {
    habit: ['早睡', '喝水', '跑步', '读书', '冥想', '背单词'],
    since: ['戒烟', '戒糖', '不熬夜', '在一起', '来到这座城市'],
    countdown: ['生日', '纪念日', '考试', '旅行出发', '发工资'],
  }
  const FESTIVALS = [
    ['圣诞节', 62],
    ['元旦', 69],
    ['春节', 105],
  ]
  const EGGS = [
    ['sprout', 'mint'],
    ['moon', 'grape'],
    ['drop', 'sky'],
    ['star', 'lemon'],
    ['star', 'coral'],
  ]

  function eggsFor(d) {
    return d.type === 'countdown' ? HUES.map((h) => ['post', h]) : EGGS
  }
  function recommendEgg(d) {
    if (d.type === 'countdown') return 4
    if (d.type === 'since') return 0
    if (d.cadence === 'weekly') return 3
    if (d.target > 1) return 2
    return 1
  }

  function draftFor(type, extra = {}) {
    if (type === 'habit') return Object.assign({ type, title: '', cadence: 'daily', target: 1, remind: '每天 22:30' }, extra)
    if (type === 'since') return Object.assign({ type, title: '', startMode: 'today' }, extra)
    return Object.assign({ type: 'countdown', title: '', date: 7, repeat: '不重复', remind: '提前 1 天' }, extra)
  }

  function addTop(o, title, sub) {
    const dots = [1, 2, 3].map((n) => `<i class="${n === o.step ? 'on' : ''}"></i>`).join('')
    return `<div class="grab"></div>
      <div class="add-top">${o.step > 1 ? `<button class="add-back" data-act="addBack">${ICON.back}上一步</button>` : '<span></span>'}<div class="steps-dots">${dots}</div>${X}</div>
      <div class="sheet-h"><h3>${title}</h3></div>
      <p class="sheet-sub">${sub}</p>`
  }

  function step1(o) {
    const card = (type, sp, hue, h, p) => `<button class="type-card" style="${DM.hueStyle(hue)}" data-act="addType" data-v="${type}">
      <span class="tc-art">${DM.creature({ species: sp, stage: 'egg', size: 62 })}</span>
      <span><h4>${h}</h4><p>${p}</p></span></button>`
    return (
      addTop(o, '想记点什么？', '先挑一种。之后它会住进一颗蛋里，陪你一起长大。') +
      card('since', 'sprout', 'mint', '坚持一件事', '戒烟、在一起…… 自动数着走过的天数') +
      card('habit', 'moon', 'grape', '养成一个习惯', '早睡、喝水、跑步…… 按住半秒记一次') +
      card('countdown', 'post', 'coral', '等一个日子', '生日、考试、出发…… 倒数，到点提醒你') +
      `<button class="link-row" data-act="addFestival">🎃 或者，从节日里挑一个 ›</button>`
    )
  }

  function chipRow(o, key, opts) {
    return `<div class="chips">${opts.map(([v, label]) => `<button class="chip ${String(o.draft[key]) === String(v) ? 'is-on' : ''}" data-act="addSet" data-k="${key}" data-v="${esc(v)}">${label}</button>`).join('')}</div>`
  }

  function step2(o) {
    const d = o.draft
    const presets = d.festival
      ? FESTIVALS.map(([name, off]) => `<button class="chip ${d.title === name ? 'is-on' : ''}" data-act="addFest" data-v="${name}" data-d="${off}">${name}</button>`).join('')
      : PRESETS[d.type].map((t) => `<button class="chip ${d.title === t ? 'is-on' : ''}" data-act="addPreset" data-v="${t}">${t}</button>`).join('')
    let fields = ''
    if (d.type === 'habit') {
      fields = `<div class="field"><label>多久一轮</label><div class="seg">
          <button class="${d.cadence === 'daily' ? 'is-on' : ''}" data-act="addSet" data-k="cadence" data-v="daily">每天</button>
          <button class="${d.cadence === 'weekly' ? 'is-on' : ''}" data-act="addSet" data-k="cadence" data-v="weekly">每周</button></div></div>
        <div class="field row-between"><label style="margin:0">${d.cadence === 'weekly' ? '每周几次' : '每天几次'}<small class="muted" style="display:block;font-weight:500">${d.target > 1 ? '一天记好几次也行，不强求' : '记一次就算'}</small></label>
          <div class="stepper"><button class="icon-btn" data-act="addStep" data-d="-1">−</button><b>${d.target}</b><button class="icon-btn" data-act="addStep" data-d="1">${ICON.plus}</button></div></div>
        <div class="field"><label>要不要提醒</label>${chipRow(o, 'remind', [['不提醒', '不提醒'], ['每天 09:00', '早上 9:00'], ['每天 22:30', '晚上 22:30']])}</div>`
    } else if (d.type === 'since') {
      fields = `<div class="field"><label>从哪天开始算</label>${chipRow(o, 'startMode', [['today', '就从现在'], ['past', '选一个过去的日子']])}
        <p class="add-note">${d.startMode === 'past' ? `从 ${DM.fmt(S.simDay - 30, 'ymd')} 起（演示），已经走过 30 天` : '从这一刻开始数，满 24 小时才算一天'}</p></div>`
    } else {
      fields = `${d.festival ? '' : `<div class="field"><label>哪一天</label>${chipRow(o, 'date', [[7, '一周后'], [30, '一个月后'], [90, '三个月后']])}</div>`}
        <p class="add-note" style="margin-top:-8px">${DM.fmt(S.simDay + d.date, 'ymd')} · 周${'日一二三四五六'[DM.dateOf(S.simDay + d.date).getDay()]} · 还有 ${d.date} 天</p>
        <div class="field"><label>重复</label><div class="seg">
          <button class="${d.repeat === '不重复' ? 'is-on' : ''}" data-act="addSet" data-k="repeat" data-v="不重复">只这一次</button>
          <button class="${d.repeat === '每年' ? 'is-on' : ''}" data-act="addSet" data-k="repeat" data-v="每年">每年</button></div></div>
        <div class="field"><label>什么时候提醒你</label>${chipRow(o, 'remind', [['当天', '当天'], ['提前 1 天', '提前 1 天'], ['提前 3 天', '提前 3 天'], ['提前一周', '提前一周']])}</div>`
    }
    const photo = `<button class="photo-pick ${d.photo ? 'on' : ''}" data-act="addPhoto">
        <span class="thumb">${d.photo ? DM.photoSVG() : ICON.camera}</span>
        <span>${d.photo ? '已选一张相片（演示）' : '加一张相片当背景（可选）'}<small>${d.photo ? '文字那一块会自动模糊，不怕看不清' : '让这一件更像你的，比如你们的合照'}</small></span>
      </button>`
    return (
      addTop(o, d.festival ? '挑一个节日' : '给它起个名字', d.festival ? '节日会每年自动回来，农历的也算得准。' : '短一点就好，之后随时能改。') +
      `<div class="field"><input class="input" data-title maxlength="12" placeholder="${d.festival ? '比如：圣诞节' : '比如：' + PRESETS[d.type][0]}" value="${esc(d.title || '')}"/></div>
      <div class="field"><div class="chips">${presets}</div></div>
      ${fields}
      <div class="field">${photo}</div>
      <button class="btn block" data-act="addNext">下一步 · 选一颗蛋</button>`
    )
  }

  function step3(o) {
    const d = o.draft
    const eggs = eggsFor(d)
    const rec = recommendEgg(d)
    const i = d.egg ?? rec
    const [sp, hue] = eggs[i]
    const info = SPECIES[sp]
    return (
      addTop(o, '选一颗蛋', `「${esc(d.title)}」会住在这颗蛋里。`) +
      `<div class="eggs">${eggs
        .map(([s, h], k) => `<button class="egg-btn ${k === i ? 'is-on' : ''}" style="${DM.hueStyle(h)}" data-act="eggPick" data-i="${k}" aria-label="${SPECIES[s].name}">${k === rec ? '<span class="egg-rec">推荐</span>' : ''}${DM.creature({ species: s, stage: 'egg', size: 66 })}</button>`)
        .join('')}</div>
      <div class="egg-info" style="${DM.hueStyle(hue)}"><h4>${info.name}</h4><p>${info.intro}</p>
        <p class="egg-grow">${sp === 'post' ? '到了那一天，它会戴上派对帽来敲门' : `会长成：${info.stages.slice(1).join(' → ')}`}</p></div>
      <button class="btn block" data-act="addHatch">就它了</button>`
    )
  }

  DM.OV.add = (o) => {
    const body = o.step === 1 ? step1(o) : o.step === 2 ? step2(o) : step3(o)
    return `<div class="dim" data-act="close"></div><div class="sheet add-sheet">${body}</div>`
  }

  DM.OV_AFTER.add = (layer, o) => {
    const input = layer.querySelector('[data-title]')
    if (input) input.addEventListener('input', () => (o.draft.title = input.value))
  }

  Object.assign(DM.ACT, {
    addType(el) {
      const o = top()
      o.draft = draftFor(el.dataset.v)
      DM.updateOv({ step: 2 })
    },
    addFestival() {
      const o = top()
      o.draft = draftFor('countdown', { festival: true, title: '圣诞节', date: 62, repeat: '每年', remind: '当天' })
      DM.updateOv({ step: 2 })
    },
    addPreset(el) {
      top().draft.title = el.dataset.v
      DM.updateOv({})
    },
    addFest(el) {
      Object.assign(top().draft, { title: el.dataset.v, date: +el.dataset.d })
      DM.updateOv({})
    },
    addSet(el) {
      const d = top().draft
      const k = el.dataset.k
      d[k] = k === 'date' ? +el.dataset.v : el.dataset.v
      if (k === 'cadence') d.target = el.dataset.v === 'weekly' ? 3 : 1
      DM.updateOv({})
    },
    addStep(el) {
      const d = top().draft
      d.target = Math.max(1, Math.min(d.cadence === 'weekly' ? 7 : 12, d.target + +el.dataset.d))
      DM.updateOv({})
    },
    addPhoto() {
      const d = top().draft
      d.photo = !d.photo
      DM.updateOv({})
    },
    addBack() {
      const o = top()
      DM.updateOv({ step: Math.max(1, o.step - 1) })
    },
    addNext() {
      const o = top()
      if (!String(o.draft.title || '').trim()) {
        DM.toast('先给它起个名字吧')
        const input = document.querySelector('#ov [data-title]')
        if (input) {
          input.classList.remove('shake')
          void input.offsetWidth
          input.classList.add('shake')
          input.focus()
        }
        return
      }
      o.draft.title = o.draft.title.trim()
      DM.updateOv({ step: 3 })
    },
    eggPick(el) {
      top().draft.egg = +el.dataset.i
      DM.sfx('pop')
      DM.updateOv({})
    },
    addHatch() {
      const d = top().draft
      const [sp, hue] = eggsFor(d)[d.egg ?? recommendEgg(d)]
      d.species = sp
      d.hue = hue
      DM.openOv({ type: 'hatch', draft: d, taps: 0, born: false })
    },
  })

  // ================================================================ 孵化

  DM.OV.hatch = (o) => {
    const d = o.draft
    const name = SPECIES[d.species].name
    const art = o.born ? DM.creature({ species: d.species, stage: 0, mood: 'happy', size: 210 }) : DM.creature({ species: d.species, stage: 'egg', size: 210, extra: { crack: o.taps } })
    const taps = [0, 1, 2].map((i) => `<i class="${i < o.taps ? 'on' : ''}"></i>`).join('')
    return `<div class="hatch" style="${DM.hueStyle(d.hue)}">
      ${o.born ? DM.confetti(30) : ''}
      <h3>${o.born ? `${name}出生啦` : '轻点三下，帮它出来'}</h3>
      <p>${o.born ? `以后，它会陪着「${esc(d.title)}」一起长大` : '别急，它也在里面使劲呢'}</p>
      <div class="hatch-mid">
        ${o.born ? `<div class="bubble">你好呀，我是${name}！</div>` : ''}
        <button class="hatch-egg ${o.born ? 'born' : ''}" data-act="hatchTap" aria-label="轻点蛋">${art}</button>
      </div>
      ${o.born ? `<button class="btn block" data-act="hatchGo">开始吧</button>` : `<div class="taps">${taps}</div>`}
    </div>`
  }

  Object.assign(DM.ACT, {
    hatchTap() {
      const o = top()
      if (!o || o.type !== 'hatch' || o.born || o.taps >= 3) return
      o.taps++
      const layer = layerOf(o)
      const egg = layer.querySelector('.hatch-egg')
      egg.innerHTML = DM.creature({ species: o.draft.species, stage: 'egg', size: 210, extra: { crack: o.taps } })
      egg.classList.remove('shake')
      void egg.offsetWidth
      egg.classList.add('shake')
      layer.querySelectorAll('.taps i').forEach((el, i) => el.classList.toggle('on', i < o.taps))
      DM.sfx('crack')
      DM.buzz(10)
      if (o.taps >= 3) {
        setTimeout(() => {
          if (top() !== o) return
          DM.sfx('hatch')
          DM.buzz([12, 40, 22])
          DM.updateOv({ born: true })
        }, 450)
      }
    },
    hatchGo() {
      const d = Object.assign({}, top().draft)
      if (d.type === 'countdown') d.remind = `${d.remind} · 09:00`
      const it = DM.createFromDraft(d)
      S.onboarded = true
      S.tab = 'today'
      S.ovs = []
      S.guide = it.type === 'habit' ? 'hold' : null
      DM.render()
      DM.toast(`「${esc(it.title)}」开始了，${SPECIES[it.species].name}会陪着你`)
    },
  })

  // ================================================================ 档案

  function pathCard(it) {
    const sp = SPECIES[it.species]
    const g = DM.growthOf(it)
    const cur = DM.stageOf(g)
    const nodes = [0, 1, 2, 3, 4]
      .map((i) => {
        const open = g >= THRESH[i]
        return `<div class="path-node ${i === cur ? 'cur' : ''} ${open ? '' : 'off'}">
          <span class="pn-art">${DM.creature({ species: it.species, stage: i, size: 50, mood: i === cur ? 'happy' : 'idle', extra: { silhouette: !open } })}</span>
          <b>${open ? sp.stages[i] : '？？'}</b><small>${i === 0 ? '出生' : THRESH[i] + ' 天'}</small></div>`
      })
      .join('')
    return `<div class="sec-title">成长之路 <small>成长 ${g} 天</small></div>
      <div class="card path">${nodes}</div>
      <p class="path-note">${DM.sleeping(it) ? '它在休息，成长暂停。' : ''}断了不会倒退，只是暂停生长。</p>`
  }

  function calendarCard(it) {
    const d0 = DM.dateOf(S.simDay)
    const y = d0.getFullYear()
    const m = d0.getMonth()
    const first = new Date(y, m, 1)
    const n = new Date(y, m + 1, 0).getDate()
    const offOf = (day) => Math.round((new Date(y, m, day) - DM.BASE) / DM.DAY)
    const logged = new Set(it.log)
    let cells = '日一二三四五六'.split('').map((w) => `<span class="wd">${w}</span>`).join('')
    for (let i = 0; i < first.getDay(); i++) cells += '<span></span>'
    let count = 0
    for (let day = 1; day <= n; day++) {
      const off = offOf(day)
      const on = logged.has(off)
      if (on) count++
      const stamp = on ? `<svg width="34" height="34" viewBox="0 0 40 40"><path d="${star(20, 21, 17, 0.62)}" fill="var(--c)" stroke="var(--cr-line)" stroke-width="2.2" stroke-linejoin="round"/></svg>` : ''
      cells += `<span class="d ${on ? 'on' : ''} ${off === S.simDay ? 'today' : ''}">${stamp}<span>${day}</span></span>`
    }
    return `<div class="sec-title">这个月 <small>${it.cadence === 'weekly' ? '每周 ' + it.target + ' 次' : '每一颗星都是一次'}</small></div>
      <div class="card cal"><div class="cal-h"><span>${y} 年 ${m + 1} 月</span><small>记了 ${count} 天</small></div><div class="cal-g">${cells}</div></div>`
  }

  function timelineCard(it) {
    const days = DM.sinceDays(it)
    const max = Math.max(365, days * 1.1)
    const pos = (v) => (Math.sqrt(v / max) * 100).toFixed(1)
    const marks = [7, 30, 100, 365].map((v) => `<span class="tl-m ${days >= v ? 'on' : ''}" style="left:${pos(v)}%"><span>${v === 365 ? '一年' : v + ' 天'}</span></span>`).join('')
    return `<div class="sec-title">这一章 <small>第 ${it.chapter} 章 · 从 ${DM.fmt(it.start, 'dot')} 起</small></div>
      <div class="card timeline"><div class="tl-bar"><i style="width:${pos(days)}%"></i>${marks}</div>
      <div class="tl-foot"><span>${DM.fmt(it.start, 'md')} 开始</span><span>今天 · 第 ${days} 天</span></div></div>`
  }

  function countdownCard(it) {
    const memo = it.memo || it.todo.length
      ? `<div class="memo detail-memo"><div class="memo-h"><span>备忘</span><span>${it.todo.filter((t) => t.done).length}/${it.todo.length}</span></div>${it.memo ? `<p>${esc(it.memo)}</p>` : ''}<div class="todo">${it.todo.map((t, i) => `<button data-act="todo" data-id="${it.id}" data-i="${i}" class="${t.done ? 'done' : ''}">${t.done ? ICON.check : '○'} ${esc(t.t)}</button>`).join('')}</div></div>`
      : ''
    return `<div class="sec-title">那一天</div>
      <div class="card list">
        <div class="li"><span class="grow">日期</span><small>${DM.fmt(it.date, 'ymd')} · 周${'日一二三四五六'[DM.dateOf(it.date).getDay()]}</small></div>
        <div class="li"><span class="grow">重复</span><small>${it.repeat}${it.festival ? ' · 节日会自动算准' : ''}</small></div>
        <div class="li"><span class="grow">提醒</span><small>${it.remind}</small></div>
      </div>${memo}`
  }

  function chaptersCard(it) {
    const rows = S.chapters
      .map((ch, idx) => [ch, idx])
      .filter(([ch]) => ch.itemId === it.id)
      .map(
        ([ch, idx]) => `<button class="li" data-act="chapterOpen" data-idx="${idx}" style="${DM.hueStyle(ch.hue)}">
          <span class="ch-dot">${ch.countdown ? '✦' : ch.no || '·'}</span>
          <span class="grow">${ch.countdown ? esc(ch.title) : `第 ${ch.no} 章 · ${ch.days} 天`}<small class="ch-line">“${esc(ch.line)}”</small></span>
          <small>${DM.fmt(ch.end, 'dot')}</small></button>`,
      )
    return `<div class="sec-title">过去的章节 <small>都收在藏馆里</small></div>
      <div class="card list">${rows.length ? rows.join('') : `<div class="li"><span class="grow muted">还没有过去的章节。这是第一章，慢慢写。</span></div>`}</div>`
  }

  DM.OV.detail = (o) => {
    const it = DM.it$(o.id)
    if (!it) return ''
    const sp = SPECIES[it.species]
    const isCd = it.type === 'countdown'
    const meta = isCd ? `${sp.name} · 替你记着这一天` : `${sp.name} · ${sp.stages[DM.stageOf(DM.growthOf(it))]} · 第 ${it.chapter} 章`
    const big = it.type === 'since' ? `第 ${DM.sinceDays(it)} 天` : isCd ? (DM.left(it) === 0 ? '就是今天' : `还有 ${DM.left(it)} 天`) : `成长 ${it.growth} 天`
    const settings = `<div class="sec-title">设置</div>
      <div class="card list">
        <div class="li"><span class="grow">名称</span><small>${esc(it.title)}</small></div>
        <div class="li"><span class="grow">小伙伴</span><small>${sp.name} · ${{ mint: '薄荷', sky: '天蓝', grape: '葡萄', lemon: '柠檬', coral: '珊瑚' }[it.hue]}</small></div>
        ${isCd ? '' : `<div class="li"><span class="grow">提醒</span><small>${it.remind || '不提醒'}</small></div>`}
        <div class="li"><span class="grow">相片背景<small class="li-sub">文字区自动模糊，不压字</small></span><button class="toggle ${it.photo ? 'on' : ''}" data-act="photoToggle" data-id="${it.id}" aria-label="相片背景"></button></div>
        <div class="li"><span class="grow">${isCd ? '类型' : '周期'}</span><small>${DM.typeTag(it)}</small></div>
      </div>`
    const actions = isCd
      ? `<div class="d-actions"><button class="btn" data-act="share" data-id="${it.id}">${ICON.share} 分享卡片</button></div>`
      : `<div class="d-actions"><button class="btn ghost" data-act="share" data-id="${it.id}">${ICON.share} 分享卡片</button><button class="btn" data-act="farewell" data-id="${it.id}">结束这一章</button></div>`
    return `<div class="page detail" style="${DM.hueStyle(it.hue)}">
      <div class="page-h"><button class="back" data-act="close">${ICON.back}返回</button><b class="page-t">档案</b><button class="icon-btn" data-act="share" data-id="${it.id}" aria-label="分享">${ICON.share}</button></div>
      <div class="d-hero"><span class="sw-av">${DM.crOf(it, 88)}</span><div><h2>${esc(it.title)}</h2><p>${meta}</p><span class="d-big">${big}</span></div></div>
      ${isCd ? countdownCard(it) : pathCard(it)}
      ${it.type === 'habit' ? calendarCard(it) : it.type === 'since' ? timelineCard(it) : ''}
      ${chaptersCard(it)}
      ${settings}
      ${actions}
      <button class="danger-link" data-act="farewellTravel" data-id="${it.id}">让它去旅行（删除）</button>
    </div>`
  }

  Object.assign(DM.ACT, {
    photoToggle(el) {
      const it = DM.it$(el.dataset.id)
      it.photo = !it.photo
      DM.sfx('pop')
      DM.refresh()
      DM.toast(it.photo ? '换上相片背景了（演示用海边日落）' : '已取下相片背景')
    },
    chapterOpen(el) {
      DM.openOv({ type: 'chapter', idx: +el.dataset.idx }, { push: true })
    },
    farewell(el) {
      DM.openOv({ type: 'farewell', id: el.dataset.id, step: 'ask', mode: 'chapter', line: '' }, { push: true })
    },
    farewellTravel(el) {
      DM.openOv({ type: 'farewell', id: el.dataset.id, step: 'rite', mode: 'travel', line: '' }, { push: true })
    },
  })

  // ================================================================ 告别仪式

  function chapterDays(it) {
    return it.type === 'since' ? DM.sinceDays(it) : S.simDay - it.startDay
  }

  DM.OV.farewell = (o) => {
    const it = DM.it$(o.id)
    if (o.step === 'done') return doneView(o)
    if (!it) return ''
    const sp = SPECIES[it.species]
    const hs = DM.hueStyle(it.hue)
    if (o.step === 'ask') {
      return `<div class="dim" data-act="close"></div>
        <div class="sheet" style="${hs}">
          <div class="grab"></div>
          <div class="ask-art">${DM.crOf(it, 96, 'idle')}</div>
          <div class="sheet-h ask-h"><h3>要结束「${esc(it.title)}」的第 ${it.chapter} 章吗？</h3></div>
          <p class="sheet-sub center">这一章会被好好收进藏馆。<br/>${sp.name}不会变小，下一章从今天重新数。</p>
          <button class="btn block" data-act="farewellGo" data-mode="chapter">结束这一章</button>
          <button class="btn block ghost" style="margin-top:10px" data-act="farewellGo" data-mode="travel">让它去旅行（删除）</button>
          <button class="link-row" data-act="close">再想想</button>
        </div>`
    }
    if (o.mode === 'travel') {
      const days = it.type === 'countdown' ? 0 : DM.growthOf(it)
      return `<div class="rite" style="${hs}">
        <div class="kicker">BON VOYAGE</div>
        <h3>${sp.name}要去旅行了</h3>
        <div class="cr-wrap rite-cr">${DM.crOf(it, 170, 'happy')}<span class="suitcase">🧳</span><div class="ground"></div></div>
        <p class="soft">谢谢你们一起走过的${days ? ` <b>${days}</b> 天` : '这些日子'}。<br/>它会把这些日子装进行李，<br/>藏馆里留着你们的合照。</p>
        <div class="grow"></div>
        <button class="btn block" data-act="travelGo">挥挥手</button>
        <button class="btn block ghost" style="margin-top:10px" data-act="close">再陪陪它</button>
      </div>`
    }
    const days = chapterDays(it)
    const start = it.type === 'since' ? it.start : it.startDay
    const chips = ['每一天都算数', '谢谢那个坚持下来的自己', '下一章见'].map((t) => `<button class="chip" data-act="riteLine" data-v="${t}">${t}</button>`).join('')
    return `<div class="rite" style="${hs}">
      <div class="kicker">CHAPTER ${it.chapter} · 完</div>
      <div class="cr-wrap rite-cr">${DM.crOf(it, 150, 'happy')}<div class="ground"></div></div>
      <h3>${esc(it.title)} · 第 ${it.chapter} 章</h3>
      <div class="big">${days}<small class="big-u">天</small></div>
      <div class="dates">${DM.fmt(start, 'dot')} — ${DM.fmt(S.simDay, 'dot')}</div>
      <input class="line-in" data-line maxlength="20" placeholder="给这一章留一句话（可不写）" value="${esc(o.line || '')}"/>
      <div class="chips">${chips}</div>
      <div class="grow"></div>
      <button class="btn block" data-act="riteClose">合上这一章</button>
      <button class="btn block ghost" style="margin-top:10px" data-act="close">还没写完</button>
    </div>`
  }

  function doneView(o) {
    const ch = o.ch
    return `<div class="rite" style="${DM.hueStyle(ch.hue)}">
      <div class="kicker">收进藏馆</div>
      <div class="book3d fly"><div class="book-cover"><small>第 ${ch.no} 章</small><b>${esc(ch.title)}</b><span>${ch.days}</span><small>天</small></div></div>
      <div class="after-book">
        <h3>已收进藏馆</h3>
        <p class="soft">“${esc(ch.line)}”<br/>${SPECIES[ch.species].name}还是现在的样子，陪你写下一章。</p>
      </div>
      <div class="grow"></div>
      <div class="after-book done-btns">
        <button class="btn block" data-act="riteNext">开始第 ${ch.no + 1} 章</button>
        <button class="btn block ghost" style="margin-top:10px" data-act="riteMuseum">去藏馆看看</button>
      </div>
    </div>`
  }

  DM.OV_AFTER.farewell = (layer, o) => {
    const input = layer.querySelector('[data-line]')
    if (input) input.addEventListener('input', () => (o.line = input.value))
  }

  Object.assign(DM.ACT, {
    farewellGo(el) {
      DM.updateOv({ step: 'rite', mode: el.dataset.mode })
    },
    riteLine(el) {
      const o = top()
      o.line = el.dataset.v
      const input = layerOf(o).querySelector('[data-line]')
      if (input) input.value = o.line
      DM.sfx('pop')
    },
    riteClose() {
      const o = top()
      const it = DM.it$(o.id)
      const ch = DM.endChapter(it, (o.line || '').trim())
      DM.sfx('close')
      DM.buzz([10, 60, 10])
      DM.updateOv({ step: 'done', ch })
    },
    riteNext() {
      const id = top() ? top().id : S.focusId
      S.ovs = []
      S.tab = 'today'
      S.focusId = id
      S.bubble = { id, text: '新的一章，从今天开始。不急。' }
      DM.render()
    },
    riteMuseum() {
      S.ovs = []
      S.tab = 'museum'
      S.museumTab = 'chapters'
      document.querySelector('#view').scrollTop = 0
      DM.render()
    },
    travelGo() {
      const o = top()
      const it = DM.it$(o.id)
      const title = it.title
      const undo = DM.sendTravel(it)
      S.ovs = []
      S.tab = 'today'
      DM.sfx('close')
      DM.render()
      DM.toast(`「${esc(title)}」去旅行了`, {
        label: '撤销',
        run: () => {
          undo()
          DM.render()
        },
      })
    },
  })

  // ================================================================ 进化过场

  const EVO_LINES = {
    1: '三天了，它冒出了一点点新东西。',
    2: '一整周。你和它都长出了新的样子。',
    3: '三十天，足够让一件事变成你的一部分。',
    4: '一百天。谢谢你，没有放下它。',
  }
  const EVO_BADGE = { 2: 'd7', 3: 'd30', 4: 'd100' }

  DM.OV.evolve = (o) => {
    const it = DM.it$(o.id)
    if (!it) return ''
    const sp = SPECIES[it.species]
    const g = DM.growthOf(it)
    const b = EVO_BADGE[o.to]
    const newBadge = b && !S.badges[b] ? DM.BADGES.find((x) => x.id === b) : null
    let sparks = ''
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const r = 110 + (i % 3) * 26
      sparks += `<i class="ev-spark" style="left:${112}px;top:${112}px;--dx:${(Math.cos(a) * r).toFixed(0)}px;--dy:${(Math.sin(a) * r).toFixed(0)}px;animation-delay:${(1.5 + (i % 4) * 0.05).toFixed(2)}s"></i>`
    }
    return `<div class="evolve ${o.seen ? 'skipped' : ''}" style="${DM.hueStyle(it.hue)}">
      <div class="ev-rays"></div>
      <button class="ev-skip" data-act="evSkip">跳过</button>
      <div class="ev-stage">
        <div class="ev-old">${DM.creature({ species: it.species, stage: o.from, size: 200 })}</div>
        <div class="ev-flash"></div>
        <div class="ev-new">${DM.creature({ species: it.species, stage: o.to, mood: 'happy', size: 220 })}</div>
        ${sparks}
      </div>
      <div class="ev-text">
        <span class="ev-kicker">成长第 ${g} 天</span>
        <h3>${sp.name}长大了</h3>
        <span class="ev-chip">${sp.stages[o.from]} → <b>${sp.stages[o.to]}</b></span>
        <p>${EVO_LINES[o.to]}</p>
        <div class="ev-unlock"><span>图鉴 +1 · ${sp.name}·${sp.stages[o.to]}</span>${newBadge ? `<span>解锁徽章「${newBadge.name}」</span>` : ''}</div>
        <div class="ev-btns"><button class="btn ghost" data-act="share" data-id="${it.id}">${ICON.share} 分享这一刻</button><button class="btn" data-act="evKeep">收下</button></div>
      </div>
    </div>`
  }

  DM.OV_AFTER.evolve = (layer, o) => {
    // 过场只播一次：上面再盖一层（分享）后重画时直接停在终点
    o.seen = true
  }

  Object.assign(DM.ACT, {
    evSkip() {
      const o = S.ovs.find((x) => x.type === 'evolve')
      const el = o && layerOf(o).querySelector('.evolve')
      if (el) el.classList.add('skipped')
    },
    evKeep() {
      const o = S.ovs.find((x) => x.type === 'evolve')
      const it = DM.it$(o.id)
      const sp = SPECIES[it.species]
      const key = `${it.species}:${o.to}`
      if (!S.dex.includes(key)) S.dex.push(key)
      S.dexNew = key
      const b = EVO_BADGE[o.to]
      if (b && !S.badges[b]) {
        S.badges[b] = true
        S.badgeNew = b
      }
      S.ovs = S.ovs.filter((x) => x !== o)
      S.bubble = { id: it.id, text: `我变成${sp.stages[o.to]}啦！谢谢你。` }
      DM.refresh()
      DM.toast(`图鉴 +1 · ${sp.name}·${sp.stages[o.to]}`)
    },
  })

  // ================================================================ 分享卡片

  function shareLines(it) {
    return [DM.lineFor(it), '今天也可以什么都不做。', '慢慢来，比较快。', '每一天都算数。']
  }

  function shareNum(it) {
    if (it.type === 'since') return { k: '第', n: DM.sinceDays(it), u: '天' }
    if (it.type === 'countdown') return DM.left(it) === 0 ? { k: '', n: '今天', u: '' } : { k: '还有', n: DM.left(it), u: '天' }
    return { k: '一起', n: it.growth, u: '天' }
  }

  function shareCard(o, it) {
    const lines = shareLines(it)
    const line = esc(lines[o.li % lines.length])
    const { k, n, u } = shareNum(it)
    const date = DM.fmt(S.simDay, 'dot')
    if (o.tpl === 'photo') {
      return `<div class="sc sc-photo"><div class="photo">${DM.photoSVG()}</div>
        <span class="mini-cr">${DM.crOf(it, 66, 'happy')}</span>
        <div class="sc-k">${date}</div>
        <div class="sc-t">${esc(it.title)}</div>
        <div class="sc-n">${k ? `<small class="pre">${k}</small>` : ''}${n}<small>${u}</small></div>
        <div class="sc-l left">${line}</div>
        <div class="sc-f sc-f-photo">刻度 DAYMARK</div></div>`
    }
    if (o.tpl === 'ticket') {
      return `<div class="sc sc-ticket"><div class="tk-top">
          <div class="sc-k">ADMIT ONE · ${esc(it.title)}</div>
          <div class="tk-cr">${DM.crOf(it, 118, 'happy')}</div>
          <div class="sc-n">${k ? `<small class="pre">${k}</small>` : ''}${n}<small>${u}</small></div>
          <div class="sc-l">${line}</div></div>
        <div class="tk-cut"></div>
        <div class="tk-bot"><span>刻度 DAYMARK<br/>NO.${String(it.chapter || 1).padStart(3, '0')}</span><b>${date}</b></div></div>`
    }
    return `<div class="sc sc-sticker">
      <div class="sc-k">${date}</div>
      <div class="sc-t">${esc(it.title)}</div>
      <div class="sc-cr">${DM.crOf(it, 140, 'happy')}</div>
      <div class="sc-n">${k ? `<small class="pre">${k}</small>` : ''}${n}<small>${u}</small></div>
      <div class="sc-l">${line}</div>
      <div class="sc-f">刻度 DAYMARK · 一次只看一件事</div></div>`
  }

  DM.OV.share = (o) => {
    const it = DM.it$(o.id)
    if (!it) return ''
    const tpls = [
      ['sticker', '贴纸'],
      ['photo', '相片'],
      ['ticket', '票根'],
    ]
    return `<div class="share" style="${DM.hueStyle(it.hue)}">
      <div class="share-top"><b>分享卡片</b>${X}</div>
      ${shareCard(o, it)}
      <div class="share-tpls">${tpls.map(([v, l]) => `<button class="chip ${o.tpl === v ? 'is-on' : ''}" data-act="shareTpl" data-v="${v}">${l}</button>`).join('')}<button class="chip" data-act="shareLine">换一句</button></div>
      <p class="share-tip">卡片上只有你愿意给人看的：数字、一句话、小伙伴</p>
      <div class="share-acts"><button class="btn ghost" data-act="shareSave">保存图片</button><button class="btn" data-act="shareSave">${ICON.share} 分享给…</button></div>
    </div>`
  }

  Object.assign(DM.ACT, {
    shareTpl(el) {
      DM.updateOv({ tpl: el.dataset.v })
    },
    shareLine() {
      const o = top()
      DM.updateOv({ li: (o.li || 0) + 1 })
    },
    shareSave() {
      DM.toast('已保存到相册（演示）')
      DM.sfx('ding')
      if (!S.badges.share) setTimeout(() => DM.unlockBadge('share'), 500)
    },
  })

  // ================================================================ 小纸条

  function noteOf() {
    const f = DM.focused()
    const species = f && f.species !== 'post' ? f.species : 'drop'
    const hue = f && f.species !== 'post' ? f.hue : 'sky'
    const t = S.halloween ? '万圣节快乐！今天的小纸条是南瓜味的。' : DM.NOTE_POOL[S.noteIdx % DM.NOTE_POOL.length]
    return { species, hue, t, from: SPECIES[species].name }
  }

  DM.OV.note = () => {
    const n = noteOf()
    return `<div class="dim" data-act="close"></div>
      <div class="modal note-modal" style="${DM.hueStyle(n.hue)}">
        <div class="note-from">${DM.creature({ species: n.species, stage: 2, mood: 'happy', size: 96, extra: { pumpkin: S.halloween } })}</div>
        <div class="note-paper">
          <div class="np-k">小纸条 · ${DM.fmt(S.simDay, 'md')}</div>
          <div class="np-t">${n.t}</div>
          <div class="np-s">—— ${n.from} · 第 ${S.notes.length + 1} 张小纸条</div>
        </div>
        <button class="btn block" data-act="noteKeep">收进藏馆</button>
      </div>`
  }

  DM.ACT.noteKeep = () => {
    const n = noteOf()
    S.notes.unshift({ t: n.t, from: n.from, day: S.simDay })
    S.noteIdx++
    DM.closeOv()
    DM.toast('收进藏馆 · 纸条 +1')
    DM.sfx('pop')
    if (S.halloween) setTimeout(() => DM.unlockBadge('pumpkin'), 400)
  }

  // ================================================================ 翻开一章

  DM.OV.chapter = (o) => {
    const N = S.chapters.length
    const ch = S.chapters[o.idx]
    if (!ch) return ''
    const sp = SPECIES[ch.species]
    const art = ch.countdown
      ? DM.creature({ species: 'post', size: 130, mood: 'happy', extra: { hold: 'party' } })
      : DM.creature({ species: ch.species, stage: ch.stage, size: 130, mood: 'happy' })
    return `<div class="dim" data-act="close"></div>
      <div class="modal chapter-modal">
        <div class="bookpage ${o.flip ? 'flip-' + o.flip : ''}" style="${DM.hueStyle(ch.hue)}">
          <button class="x bp-x" data-act="close" aria-label="合上">${ICON.close}</button>
          <div class="bp-k">${ch.countdown ? 'THAT DAY' : `CHAPTER ${ch.no || '·'}`}${ch.gone ? ' · 已去旅行' : ''}</div>
          <div class="bp-t">${esc(ch.title)}</div>
          <figure class="polaroid"><div class="pa">${art}</div><figcaption>${DM.fmt(ch.end, 'dot')}</figcaption></figure>
          ${ch.countdown ? `<div class="bp-num bp-word">那一天</div>` : `<div class="bp-num">${ch.days}<small>天</small></div>`}
          <div class="bp-dates">${ch.countdown ? DM.fmt(ch.end, 'ymd') : `${DM.fmt(ch.start, 'dot')} — ${DM.fmt(ch.end, 'dot')}`}</div>
          <div class="bp-line">“${esc(ch.line)}”</div>
          <div class="bp-facts"><div><b>${DM.fmt(ch.start, 'md')}</b>开始</div><div><b>${DM.fmt(ch.end, 'md')}</b>合上</div><div><b>${sp.stages[ch.countdown ? 0 : ch.stage]}</b>形态</div></div>
        </div>
        <div class="bp-nav"><button data-act="chapterNav" data-d="-1">‹ 上一本</button><span>${o.idx + 1} / ${N}</span><button data-act="chapterNav" data-d="1">下一本 ›</button></div>
      </div>`
  }

  DM.ACT.chapterNav = (el) => {
    const o = top()
    const d = +el.dataset.d
    const N = S.chapters.length
    DM.updateOv({ idx: (o.idx + d + N) % N, flip: d > 0 ? 'r' : 'l' })
    DM.sfx('pop')
  }

  // ================================================================ 徽章

  const BADGE_MORE = {
    back: '回来本身，就值得一枚徽章。',
    pumpkin: '只在万圣节出现的隐藏徽章。',
    share: '谢谢你把这一刻分享出去。',
    bday: '陪它走到了那一天，明年见。',
  }

  DM.OV.badge = (o) => {
    const b = DM.BADGES.find((x) => x.id === o.id)
    if (!b) return ''
    return `<div class="dim" data-act="close"></div>
      <div class="modal"><div class="badge-pop">
        <div class="k">解锁徽章</div>
        <div class="bp-badge">${DM.badge(b.kind, b.label, 120)}</div>
        <h4>${b.name}</h4>
        <p>${b.desc}${BADGE_MORE[b.id] ? '<br/>' + BADGE_MORE[b.id] : ''}</p>
        <button class="btn block" data-act="close">好的</button>
      </div></div>`
  }
})()
