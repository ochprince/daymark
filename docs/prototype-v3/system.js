/*
 * K · 系统触点：桌面小组件 / 灵动岛 + 实时活动 / 锁屏 / 闹钟（AlarmKit）。
 * 只通过 window.DM 挂东西：DM.OV.{widgets,island,lock,alarm,alarmAuth,sysHub}、DM.ACT.*、DM.FLOWS、DM.NOTES、DM.sceneHooks、DM.sys。
 * 所有数据都来自 DM.S（焦点事项、天数、倒数、物种），不另存业务状态。
 */
;(function () {
  'use strict'
  const DM = window.DM
  const S = DM.S
  const { esc, ICON } = DM
  const WD = '日一二三四五六'
  const MINE = ['widgets', 'island', 'lock', 'alarm', 'alarmAuth', 'sysHub']

  const $ = (s, r = document) => r.querySelector(s)
  const top = () => S.ovs[S.ovs.length - 1]
  const layerOf = (o) => document.querySelector(`#ov .layer[data-i="${S.ovs.indexOf(o)}"]`)
  const X = `<button class="x" data-act="close" aria-label="关闭">${ICON.close}</button>`
  const PRO = '<em class="sx-pro">Pro</em>'
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

  // ================================================================ 实时钟（演示用：一秒走 40 秒）

  let t0 = performance.now()
  let seenKey = ''
  const vsec = () => (34860 + ((performance.now() - t0) / 1000) * 40) % 86400 // 从 9:41 开始
  const dayPct = () => vsec() / 864
  const pctTxt = () => dayPct().toFixed(1) + '%'
  const TM = { total: 25 * 60, left: 24 * 60 + 12, run: true }
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  // ================================================================ 数据取用

  const KINDS = {
    keep: { name: '坚持', pool: () => S.items.filter((i) => i.type !== 'countdown') },
    habit: { name: '习惯', pool: () => S.items.filter((i) => i.type === 'habit') },
    wait: { name: '等待', pool: () => S.items.filter((i) => i.type === 'countdown') },
  }
  const PRO_SIZES = { l: 1, lock: 1 }

  /** 某个小组件当前显示的那一件事（默认跟着焦点，其次取第一件） */
  function selItem(o, kind) {
    o.sel = o.sel || {}
    const pool = KINDS[kind].pool()
    let it = DM.it$(o.sel[kind])
    if (!it || !pool.includes(it)) {
      const f = DM.focused()
      it = f && pool.includes(f) ? f : pool[0] || null
      o.sel[kind] = it && it.id
    }
    return it
  }
  const dayNum = (it) => (it.type === 'since' ? DM.sinceDays(it) : it.type === 'habit' ? it.growth : Math.max(0, DM.left(it)))
  const creatureOf = (it, size, mood) => DM.crOf(it, size, mood)
  const hueOf = (it) => DM.hueStyle(it.hue)

  function habProg(it) {
    if (it.cadence === 'weekly') return clamp(it.weekCount / it.target, 0, 1)
    return clamp(it.todayCount / it.target, 0, 1)
  }
  function habLabel(it) {
    if (it.cadence === 'weekly') return `本周 ${it.weekCount}/${it.target} ${it.unit}`
    if (it.target > 1) return `今天 ${it.todayCount}/${it.target} ${it.unit}`
    return it.todayCount >= 1 ? '今天记过了' : '今天还没记'
  }
  const habDone = (it) => (it.cadence === 'weekly' ? it.weekCount >= it.target : it.todayCount >= it.target)
  const travelPct = (it) => clamp((1 - DM.left(it) / 30) * 100, 4, 88)
  const waitWord = (it) => {
    const l = DM.left(it)
    return l <= 0 ? '就是今天' : l === 1 ? '明天' : `还有 ${l} 天`
  }
  const keepSub = (it) => (it.type === 'since' ? `已走过 ${DM.ymdStr(it.start, S.simDay)}` : it.streak > 0 ? `连续 ${it.streak} 天` : '慢慢来，随时回来')
  const timeOf = (it, dflt) => {
    const m = it && it.remind && /(\d{1,2}):(\d{2})/.exec(it.remind)
    return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}` : dflt
  }

  /** 演示用的静默记录：和 App 里一样，但不触发进化过场（小组件里点一下不会把你拽进 App） */
  function logQuiet(it) {
    const snap = JSON.parse(JSON.stringify(it))
    it.todayCount++
    if (it.cadence === 'weekly') it.weekCount++
    if (it.todayCount === 1) {
      it.growth++
      it.log.push(S.simDay)
      it.streak = it.lastDay === S.simDay - 1 ? it.streak + 1 : 1
      it.lastDay = S.simDay
    }
    DM.sfx('ding')
    DM.buzz(16)
    DM.toast(`${esc(it.title)} · 记下了`, {
      label: '撤销',
      run: () => {
        Object.assign(it, snap)
        repaint()
      },
    })
  }
  function repaint() {
    const t = top()
    if (t && MINE.includes(t.type)) DM.updateOv({})
  }

  // ================================================================ 小件

  /** 环形进度；from → pct 的动画由 OV_AFTER 在下一帧补上 */
  function ring(size, r, w, pct, from) {
    const C = 2 * Math.PI * r
    const c = size / 2
    return `<svg class="sx-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="sx-trk" cx="${c}" cy="${c}" r="${r}" stroke-width="${w}"/>
      <circle class="sx-arc" cx="${c}" cy="${c}" r="${r}" stroke-width="${w}" transform="rotate(-90 ${c} ${c})" data-c="${C.toFixed(2)}" style="stroke-dasharray:${C.toFixed(2)};stroke-dashoffset:${(C * (1 - (from === undefined ? pct : from))).toFixed(2)}" data-to="${(C * (1 - pct)).toFixed(2)}"/>
    </svg>`
  }
  const liveRing = (size, r, w) => {
    const C = 2 * Math.PI * r
    const c = size / 2
    return `<svg class="sx-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="sx-trk" cx="${c}" cy="${c}" r="${r}" stroke-width="${w}"/>
      <circle class="sx-arc live" cx="${c}" cy="${c}" r="${r}" stroke-width="${w}" transform="rotate(-90 ${c} ${c})" data-live="pctring" data-c="${C.toFixed(2)}" style="stroke-dasharray:${C.toFixed(2)};stroke-dashoffset:${(C * (1 - dayPct() / 100)).toFixed(2)}"/>
    </svg>`
  }
  const dayBar = () => `<div class="sx-day"><div class="sx-day-t"><span>今天 已走</span><b data-live="pct">${pctTxt()}</b></div><div class="sx-day-b"><i data-live="pctw" style="width:${dayPct().toFixed(2)}%"></i></div></div>`
  const num = (n, cls = '') => `<b class="sx-num ${cls}" data-count="${n}">${n}</b>`
  const weekDots = (it, from = -6) => {
    let h = ''
    for (let d = from; d <= 0; d++) {
      const off = S.simDay + d
      const on = it.log.includes(off)
      h += `<span class="${on ? 'on' : ''} ${d === 0 ? 'now' : ''}"><i></i><u>${WD[DM.dateOf(off).getDay()]}</u></span>`
    }
    return `<div class="sx-week">${h}</div>`
  }
  const tapHint = '<span class="sx-tapfx" aria-hidden="true"><i></i><i></i></span>'

  // ================================================================ 三种小组件 × 三个尺寸

  function emptyW(kind, sz) {
    return `<div class="sx-w sx-${sz} sx-empty" data-act="add"><div class="sx-emp-cr">${DM.creature({ species: 'moon', stage: 'egg', size: sz === 's' ? 56 : 84 })}</div><b>还没有${KINDS[kind].name}的事</b><small>点一下，去领一团面团</small></div>`
  }

  function keepW(o, it, sz) {
    const st = `style="${hueOf(it)}"`
    const head = `<div class="sx-w-top"><span class="sx-w-k">${esc(it.title)}</span><i class="sx-live"><b></b>自动累计</i></div>`
    if (sz === 's')
      return `<div class="sx-w sx-s sx-keep" ${st} data-act="wgOpen" data-id="${it.id}">
        <div class="sx-w-top"><span class="sx-w-k">${esc(it.title)}</span><i class="sx-live dot"><b></b></i></div>
        <div class="sx-keep-n">${num(dayNum(it))}<small>天</small></div>
        <div class="sx-w-cr">${creatureOf(it, 66)}</div>
        ${dayBar()}
      </div>`
    if (sz === 'm')
      return `<div class="sx-w sx-m sx-keep" ${st} data-act="wgOpen" data-id="${it.id}">
        <div class="sx-m-cr"><span class="sx-halo"></span>${creatureOf(it, 104)}</div>
        <div class="sx-m-main">
          ${head}
          <div class="sx-keep-n big">${num(dayNum(it))}<small>天</small></div>
          <div class="sx-sub">${esc(keepSub(it))}</div>
          ${dayBar()}
        </div>
      </div>`
    const sp = DM.SPECIES[it.species]
    const stg = DM.stageOf(DM.growthOf(it))
    const pc = DM.pctOf(it)
    return `<div class="sx-w sx-l sx-keep" ${st} data-act="wgOpen" data-id="${it.id}">
      ${head}
      <div class="sx-l-cr"><span class="sx-halo"></span>${creatureOf(it, 118)}<i class="sx-ground"></i></div>
      <div class="sx-keep-n huge">${num(dayNum(it))}<small>天</small></div>
      <div class="sx-sub c">${esc(keepSub(it))}</div>
      <div class="sx-stage"><span>${sp.name} · ${sp.stages[stg]}</span><div class="sx-day-b"><i style="width:${pc}%"></i></div><span>${stg >= sp.stages.length - 1 && pc >= 100 ? '满级' : pc + '%'}</span></div>
      ${dayBar()}
    </div>`
  }

  function habitW(o, it, sz) {
    const st = `style="${hueOf(it)}"`
    const done = habDone(it)
    const pulse = o.pulse === it.id
    const from = pulse ? o.pulseFrom : undefined
    const p = habProg(it)
    const can = DM.canLog(it)
    const act = can ? `data-act="wgLog" data-id="${it.id}"` : `data-act="wgLog" data-id="${it.id}" data-done="1"`
    const open = `data-act="wgOpen" data-id="${it.id}"`
    const bump = pulse ? `<span class="sx-plus">+1</span>` : ''
    const badge = done ? `<span class="sx-chk">${ICON.check}</span>` : ''
    const ringBtn = (size, r, w, crs) => `<span class="sx-ringbtn ${can ? 'can' : 'done'}" ${act}>${ring(size, r, w, p, from)}<span class="sx-ring-in">${creatureOf(it, crs)}</span>${can ? tapHint : badge}${bump}</span>`
    if (sz === 's')
      return `<div class="sx-w sx-s sx-hab" ${st} ${open}>
        <div class="sx-w-top"><span class="sx-w-k">${esc(it.title)}</span><i class="sx-live dot hab"><b></b></i></div>
        <div class="sx-hab-ring">${ringBtn(94, 41, 8, 50)}</div>
        <div class="sx-hab-t"><b>${esc(habLabel(it))}</b></div>
      </div>`
    const btn = can ? `<button class="sx-wbtn" ${act}>＋ 记一下</button>` : `<span class="sx-wbtn off" data-act="wgLog" data-id="${it.id}" data-done="1">${ICON.check} ${it.cadence === 'weekly' ? '本周达成' : '今天记过了'}</span>`
    if (sz === 'm')
      return `<div class="sx-w sx-m sx-hab" ${st} ${open}>
        <div class="sx-m-ring">${ringBtn(112, 50, 10, 62)}</div>
        <div class="sx-m-main">
          <div class="sx-w-top"><span class="sx-w-k">${esc(it.title)}</span></div>
          <div class="sx-hab-n">${num(it.growth)}<small>天</small></div>
          <div class="sx-sub">${esc(habLabel(it))}${it.streak > 1 ? ` · 连续 ${it.streak} 天` : ''}</div>
          ${weekDots(it)}
          ${btn}
        </div>
      </div>`
    return `<div class="sx-w sx-l sx-hab" ${st} ${open}>
      <div class="sx-w-top"><span class="sx-w-k">${esc(it.title)}</span><i class="sx-live hab"><b></b>轻点即记</i></div>
      <div class="sx-l-ring">${ringBtn(150, 68, 12, 84)}</div>
      <div class="sx-hab-n c">${num(it.growth)}<small>天</small></div>
      <div class="sx-sub c">${esc(habLabel(it))}${it.streak > 1 ? ` · 连续 ${it.streak} 天` : ''}</div>
      ${weekDots(it)}
      ${btn}
    </div>`
  }

  function waitW(o, it, sz) {
    const st = `style="${hueOf(it)}"`
    const l = DM.left(it)
    const open = `data-act="wgOpen" data-id="${it.id}"`
    const cd = l <= 0 ? `<span class="sx-wait-n today">今天</span>` : `<div class="sx-wait-n">${num(l)}<small>天</small></div>`
    const track = `<div class="sx-trackw"><i class="sx-road"></i><span class="sx-walker" style="left:${travelPct(it).toFixed(1)}%">${creatureOf(it, 58)}</span><span class="sx-goal"><b>${DM.dateOf(it.date).getDate()}</b><small>${DM.dateOf(it.date).getMonth() + 1}月</small></span></div>`
    if (sz === 's')
      return `<div class="sx-w sx-s sx-wait" ${st} ${open}>
        <div class="sx-w-top"><span class="sx-w-k">${esc(it.title)}</span></div>
        <div class="sx-sub up">${l <= 0 ? '信信敲门啦' : '还有'}</div>
        ${cd}
        <div class="sx-w-cr">${creatureOf(it, 70)}</div>
        <div class="sx-sub low">${DM.fmt(it.date, 'md')} · ${esc(it.repeat)}</div>
      </div>`
    if (sz === 'm')
      return `<div class="sx-w sx-m sx-wait" ${st} ${open}>
        <div class="sx-w-top"><span class="sx-w-k">${esc(it.title)}</span><i class="sx-live wait"><b></b>${l <= 0 ? '就是今天' : '信信在路上'}</i></div>
        <div class="sx-wait-row">${cd}<div class="sx-sub">${DM.fmt(it.date, 'mdw')}<br>${esc(it.remind || '')}</div></div>
        ${track}
      </div>`
    const todo = (it.todo || []).slice(0, 3)
    const list = todo.length
      ? todo.map((t) => `<li class="${t.done ? 'on' : ''}"><i>${t.done ? ICON.check : ''}</i>${esc(t.t)}</li>`).join('')
      : `<li class="none">还没有准备事项，到时候信信会提醒你</li>`
    return `<div class="sx-w sx-l sx-wait" ${st} ${open}>
      <div class="sx-w-top"><span class="sx-w-k">${esc(it.title)}</span><i class="sx-live wait"><b></b>${l <= 0 ? '就是今天' : '信信在路上'}</i></div>
      <div class="sx-wait-row">${cd}<div class="sx-sub">${DM.fmt(it.date, 'mdw')}<br>${esc(it.repeat)}</div></div>
      ${track}
      <ul class="sx-todo">${list}</ul>
      ${it.memo ? `<p class="sx-memo">“${esc(it.memo)}”</p>` : ''}
    </div>`
  }

  const widget = (o, kind, sz) => {
    const it = selItem(o, kind)
    if (!it) return emptyW(kind, sz)
    return { keep: keepW, habit: habitW, wait: waitW }[kind](o, it, sz)
  }

  // ================================================================ 主屏 / 锁屏壳子

  const APPS = [
    ['信息', '💬', 'mint'], ['相机', '📷', 'sky'], ['照片', '🌸', 'coral'], ['地图', '🧭', 'lemon'],
    ['天气', '⛅', 'sky'], ['时钟', '⏰', 'grape'], ['备忘录', '📝', 'lemon'], ['音乐', '🎵', 'coral'],
    ['日历', '📅', 'mint'], ['设置', '⚙️', 'grape'],
  ]
  const ico = (a, i) => {
    if (a === 'dm') return `<span class="sx-app dm" style="--i:${i}"><span class="sx-ico sx-ico-dm">${DM.creature({ species: 'moon', stage: 'egg', size: 46 })}</span><small>刻度</small></span>`
    return `<span class="sx-app" style="--i:${i}"><span class="sx-ico" style="--a:var(--h-${a[2]});--b:var(--h-${a[2]}-2)">${a[1]}</span><small>${a[0]}</small></span>`
  }
  const iconRow = (from, n = 4, dm = false) => `<div class="sx-irow">${Array.from({ length: n }, (_, k) => (dm && k === n - 1 ? ico('dm', k) : ico(APPS[(from + k) % APPS.length], k))).join('')}</div>`
  const icons22 = (from) => `<div class="sx-i22">${[0, 1, 2, 3].map((k) => ico(APPS[(from + k) % APPS.length], k)).join('')}</div>`

  const lockTime = '9:41'
  const dateLine = () => `${DM.fmt(S.simDay, 'md')}  周${WD[DM.dateOf(S.simDay).getDay()]}`
  const wall = '<div class="sx-wall"><i></i><i></i><i></i></div>'
  const lockHead = (o) => {
    const it = o ? selItem(o, 'keep') : DM.focused()
    const inline = it ? `<span class="sx-inline">${it.type === 'countdown' ? `${esc(it.title)} · ${waitWord(it)}` : `${esc(it.title)} · 第 ${dayNum(it)} 天`}</span>` : ''
    return `<div class="sx-lk-date">${dateLine()}${inline}</div><div class="sx-lk-clock">${lockTime}</div>`
  }

  // 锁屏附件（圆形 / 矩形 / 行内）：纯数字与线条，系统会把它们染成单色
  function accCircle(o, kind) {
    const it = selItem(o, kind)
    if (!it) return `<div class="sx-acc c off"></div>`
    if (kind === 'keep') return `<div class="sx-acc c" data-act="wgOpen" data-id="${it.id}">${liveRing(72, 31, 5)}<span class="sx-acc-in">${num(dayNum(it), 'sm')}<small>天</small></span></div>`
    if (kind === 'habit') {
      const can = DM.canLog(it)
      const pulse = o.pulse === it.id
      return `<div class="sx-acc c hab ${can ? 'can' : ''}" data-act="wgLog" data-id="${it.id}" ${can ? '' : 'data-done="1"'}>${ring(72, 31, 5, habProg(it), pulse ? o.pulseFrom : undefined)}<span class="sx-acc-in">${can ? '<b class="sx-plus1">＋</b>' : ICON.check}<small>${it.target > 1 ? it.todayCount + '/' + it.target : it.cadence === 'weekly' ? it.weekCount + '/' + it.target : '记'}</small></span></div>`
    }
    return `<div class="sx-acc c" data-act="wgOpen" data-id="${it.id}">${ring(72, 31, 5, travelPct(it) / 100)}<span class="sx-acc-in">${num(Math.max(0, DM.left(it)), 'sm')}<small>天</small></span></div>`
  }
  function accRect(o, kind) {
    const it = selItem(o, kind)
    if (!it) return `<div class="sx-acc r off"></div>`
    let t1, t2, bar
    if (kind === 'wait') {
      t1 = esc(it.title)
      t2 = waitWord(it)
      bar = `<div class="sx-day-b"><i style="width:${travelPct(it).toFixed(0)}%"></i></div>`
    } else if (kind === 'habit') {
      t1 = esc(it.title)
      t2 = habLabel(it)
      bar = `<div class="sx-day-b"><i style="width:${(habProg(it) * 100).toFixed(0)}%"></i></div>`
    } else {
      t1 = esc(it.title)
      t2 = `第 ${dayNum(it)} 天`
      bar = `<div class="sx-day-b"><i data-live="pctw" style="width:${dayPct().toFixed(2)}%"></i></div>`
    }
    return `<div class="sx-acc r" data-act="wgOpen" data-id="${it.id}"><span class="sx-acc-cr">${creatureOf(it, 40)}</span><span class="sx-acc-tx"><small>${t1}</small><b>${t2}</b>${bar}</span></div>`
  }

  function lockGallery(o) {
    const k = o.kind
    return `<div class="sx-lkg">${wall}
      <div class="sx-lk-date">${dateLine()}<span class="sx-inline">${(() => {
        const it = selItem(o, k)
        return it ? (k === 'wait' ? `${esc(it.title)} · ${waitWord(it)}` : `${esc(it.title)} · 第 ${dayNum(it)} 天`) : ''
      })()}</span></div>
      <div class="sx-lk-clock">${lockTime}</div>
      <div class="sx-lkrow"><label>圆形</label><div class="sx-accs">${accCircle(o, 'keep')}${accCircle(o, 'habit')}${accCircle(o, 'wait')}</div></div>
      <div class="sx-lkrow"><label>矩形</label><div class="sx-accs one">${accRect(o, k)}</div></div>
      <div class="sx-lkrow"><label>行内</label><div class="sx-hint">日期旁边的一小行字，戒烟 · 第 ${(() => { const it = selItem(o, 'keep'); return it ? dayNum(it) : 0 })()} 天</div></div>
      <div class="sx-lk-tip">锁屏小组件是单色的，系统会自动染成白色；<br>数字依然会自己往前走。</div>
    </div>`
  }

  function homeScreen(o) {
    const sz = o.size
    let body
    if (sz === 's')
      body = `<div class="sx-grid s">
        <div class="sx-slot ${o.kind === 'keep' ? 'is-sel' : ''}">${widget(o, 'keep', 's')}</div>
        <div class="sx-slot ${o.kind === 'habit' ? 'is-sel' : ''}">${widget(o, 'habit', 's')}</div>
        <div class="sx-slot ${o.kind === 'wait' ? 'is-sel' : ''}">${widget(o, 'wait', 's')}</div>
        ${icons22(0)}
      </div>${iconRow(4, 4, true)}${iconRow(8, 4)}`
    else if (sz === 'm') body = `<div class="sx-slot is-sel">${widget(o, o.kind, 'm')}</div>${iconRow(0)}${iconRow(4, 4, true)}${iconRow(8)}`
    else body = `<div class="sx-slot is-sel">${widget(o, o.kind, 'l')}</div>${iconRow(0)}${iconRow(4, 4, true)}`
    return `${wall}<div class="sx-home ${sz}">${body}<div class="sx-pg"><i class="on"></i><i></i><i></i></div></div>
      <div class="sx-jbar"><button class="sx-jplus" aria-label="添加" data-act="wgTip">＋</button><button class="sx-jdone" data-act="wgDone">完成</button></div>`
  }

  // ================================================================ 覆盖层：桌面小组件

  const SIZES = [
    ['s', '小 2×2'],
    ['m', '中 4×2'],
    ['l', '大 4×4'],
    ['lock', '锁屏'],
  ]
  const SIZE_TIP = {
    s: '小号 · 基础款免费：数字自己走，不用打开 App',
    m: '中号 · 基础款免费：多一行“已走过几个月几天”',
    l: '大号 · Pro：形态进度、一周足迹、备忘全在桌面',
    lock: '锁屏附件 · Pro：圆形 / 矩形 / 行内，抬手就能看到',
  }

  DM.OV.widgets = (o) => {
    o.size = o.size || 's'
    o.kind = o.kind || 'keep'
    const it = selItem(o, o.kind)
    const seg = SIZES.map(([k, l]) => `<button class="${o.size === k ? 'is-on' : ''}" data-act="wgSize" data-v="${k}">${l}${PRO_SIZES[k] ? '<i></i>' : ''}</button>`).join('')
    const chips = Object.keys(KINDS)
      .map((k) => `<button class="chip ${o.kind === k ? 'is-on' : ''}" data-act="wgKind" data-k="${k}">${KINDS[k].name}</button>`)
      .join('')
    const pool = KINDS[o.kind].pool()
    const cyc = it
      ? `<div class="sx-cyc" style="${hueOf(it)}"><button class="icon-btn" data-act="wgCycle" data-d="-1" aria-label="上一件">${ICON.back}</button><span class="sx-cyc-av">${creatureOf(it, 38)}</span><span class="sx-cyc-t"><b>${esc(it.title)}</b><small>${pool.indexOf(it) + 1} / ${pool.length}</small></span><button class="icon-btn r" data-act="wgCycle" data-d="1" aria-label="下一件">${ICON.back}</button></div>`
      : '<div class="sx-cyc"><span class="sx-cyc-t"><b>还没有这类事</b></span></div>'
    return `<div class="sx-wg ${o.jig ? 'is-jig' : ''}" data-size="${o.size}">
      <div class="sx-stage-s">${o.size === 'lock' ? lockGallery(o) : homeScreen(o)}</div>
      <div class="sx-panel">
        <div class="grab"></div>
        <div class="sx-p-h"><div><h4>桌面小组件</h4><p>${SIZE_TIP[o.size]}</p></div>${X}</div>
        <div class="seg sx-seg">${seg}</div>
        <div class="sx-kinds">${chips}</div>
        <div class="sx-p-row">${cyc}<button class="btn sx-addbtn" data-act="wgAdd"><span>＋</span> 添加到桌面</button></div>
      </div>
    </div>`
  }

  // 共用：环形进度补帧、数字滚动
  function tweenCounts(root) {
    root.querySelectorAll('[data-count]').forEach((el) => {
      const n = +el.dataset.count
      if (n < 2) return
      const t = performance.now()
      const d = Math.min(1100, 450 + n * 3)
      ;(function f(now) {
        if (!el.isConnected) return
        const p = Math.min(1, (now - t) / d)
        el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3)))
        if (p < 1) requestAnimationFrame(f)
      })(t)
    })
  }
  function after(layer, o) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        layer.querySelectorAll('.sx-arc[data-to]').forEach((c) => (c.style.strokeDashoffset = c.dataset.to))
      })
    )
    if (layer.dataset.enter === '1' || o.tw) {
      o.tw = false
      tweenCounts(layer)
    }
    o.pulse = null
  }
  DM.OV_AFTER.widgets = after

  Object.assign(DM.ACT, {
    wgSize: (el) => DM.updateOv({ size: el.dataset.v, jig: false, tw: true }),
    wgKind: (el) => DM.updateOv({ kind: el.dataset.k, tw: true }),
    wgCycle(el) {
      const o = top()
      const pool = KINDS[o.kind].pool()
      if (!pool.length) return
      const cur = selItem(o, o.kind)
      const nx = pool[(pool.indexOf(cur) + +el.dataset.d + pool.length) % pool.length]
      o.sel[o.kind] = nx.id
      DM.sfx('pop')
      DM.updateOv({ tw: true })
    },
    wgLog(el) {
      const o = top()
      const it = DM.it$(el.dataset.id)
      if (!it || (o && o.jig)) return
      if (!DM.canLog(it) || habDone(it)) {
        DM.toast('今天已经记过啦 · 明天见')
        return
      }
      const from = habProg(it)
      logQuiet(it)
      DM.updateOv({ pulse: it.id, pulseFrom: from })
    },
    wgOpen(el) {
      const o = top()
      if (o && o.jig) return
      const it = DM.it$(el.dataset.id)
      if (!it) return
      S.ovs = []
      S.tab = 'today'
      DM.renderOv()
      DM.setFocus(it.id)
      DM.toast(`从小组件打开 · ${esc(it.title)}`)
    },
    wgTip: () => DM.toast('长按主屏幕 → 左上角“＋”选择刻度小组件'),
    wgAdd() {
      const o = top()
      const layer = layerOf(o)
      const root = layer && $('.sx-wg', layer)
      if (!root) return
      o.jig = true
      root.classList.add('is-jig')
      root.classList.remove('sx-dropped')
      DM.sfx('pop')
      clearTimeout(o._jt)
      o._jt = setTimeout(() => {
        if (!root.isConnected) return
        root.classList.add('sx-dropped')
        DM.sfx('ding')
        DM.toast('已添加 · 它会自己数天数，不用再管')
      }, 1100)
    },
    wgDone() {
      const o = top()
      const layer = layerOf(o)
      const root = layer && $('.sx-wg', layer)
      o.jig = false
      if (root) root.classList.remove('is-jig', 'sx-dropped')
    },
  })

  // ================================================================ 灵动岛 + 锁屏实时活动

  const ISCENES = ['keep', 'wait', 'remind', 'timer']
  const IS_NAMES = { keep: '坚持 · 自己走', wait: '倒数 · 信信在路上', remind: '习惯提醒', timer: '专注计时' }
  const IS_STATES = {
    min: { name: 'Minimal · 一条细线' },
    cpt: { name: 'Compact · 左右两边' },
    exp: { name: 'Expanded · 卡片大小' },
    press: { name: 'Long-press · 按住看更多' },
  }

  DM.OV.island = (o) => {
    o.scene = o.scene || 'keep'
    o.state = o.state || 'cpt'
    const it = o.scene === 'remind' ? DM.it$(S.items.find((i) => i.type === 'habit' && i.remind).id) : DM.focused()
    const seg = ISCENES.map((k) => `<button class="${o.scene === k ? 'is-on' : ''}" data-act="islScene" data-v="${k}">${IS_NAMES[k]}</button>`).join('')
    const segS = Object.keys(IS_STATES).map((k) => `<button class="${o.state === k ? 'is-on' : ''}" data-act="islState" data-v="${k}">${IS_STATES[k].name}</button>`).join('')
    return `<div class="sx-isl-box">${wall}${islContent(o, it)}
      <div class="sx-panel"><div class="grab"></div><div class="sx-p-h"><div><h4>灵动岛 · 实时活动</h4><p>${IS_STATES[o.state].name}</p></div>${X}</div>
      <div class="sx-row-label">情景 · 一共做了 4 个</div><div class="sx-seg seg">${seg}</div>
      <div class="sx-row-label">展开状态</div><div class="sx-seg seg">${segS}</div>
      <div class="sx-islnote">灵动岛是 iOS 系统界面，刻度通过 Live Activity 把数字送进去。它自己还能做动画，比如信信在路上时会一摇一晃。</div></div>
    </div>`
  }

  function islContent(o, it) {
    const st = o.state
    const s = o.scene
    if (s === 'keep') {
      const n = dayNum(it)
      if (st === 'min') return `<div class="sx-isl-min"></div>`
      if (st === 'cpt')
        return `<div class="sx-isl-cpt" style="${hueOf(it)}"><span class="isl-l">${creatureOf(it, 34)}</span><span class="isl-r">${num(n, 'sm')}<small>天</small></span></div>`
      if (st === 'exp')
        return `<div class="sx-isl-exp" style="${hueOf(it)}"><div class="isl-top"><b>${esc(it.title)}</b><span>${keepSub(it)}</span></div><div class="isl-mid"><span class="isl-cr">${creatureOf(it, 88)}</span><div class="isl-n">${num(n)}<small>天</small></div></div>${dayBar()}</div>`
      return `<div class="sx-isl-press" style="${hueOf(it)}"><div class="isl-top"><b>${esc(it.title)}</b><span class="isl-row-sp"><span>第 ${n} 天</span><button class="isl-x" aria-label="关闭">收起</button></span></div><div class="isl-cr">${creatureOf(it, 96)}</div><div class="isl-n big">${num(n)}<small>天</small></div><div class="isl-sub">${esc(keepSub(it))}</div><div class="isl-stage"><span>在长大 · ${DM.pctOf(it)}%</span><div class="sx-day-b"><i style="width:${DM.pctOf(it)}%"></i></div></div>${dayBar()}<div class="isl-btns"><button class="isl-btn" data-act="closeAll">打开刻度</button><button class="isl-btn ghost">关闭</button></div></div>`
    }
    if (s === 'wait') {
      const l = DM.left(it)
      if (st === 'min') return `<div class="sx-isl-min"><i class="isl-dot"></i></div>`
      if (st === 'cpt')
        return `<div class="sx-isl-cpt" style="${hueOf(it)}"><span class="isl-l walk">${creatureOf(it, 38)}</span><span class="isl-r">${l > 0 ? num(l, 'sm') + '<small>天</small>' : '<b class="today">今天</b>'}</span></div>`
      if (st === 'exp')
        return `<div class="sx-isl-exp" style="${hueOf(it)}"><div class="isl-top"><b>${esc(it.title)}</b><span>${l > 0 ? waitWord(it) : '信信到啦 · 今天就是'}</span></div><div class="isl-mid"><span class="isl-cr walk">${creatureOf(it, 88)}</span><div class="isl-n">${l > 0 ? num(l) + '<small>天</small>' : '<b class="today">今天</b>'}</div></div><div class="sx-trackw"><i class="sx-road"></i><span class="sx-walker" style="left:${travelPct(it).toFixed(1)}%">${creatureOf(it, 52)}</span><span class="sx-goal"><b>${DM.dateOf(it.date).getDate()}</b><small>${DM.dateOf(it.date).getMonth() + 1}月</small></span></div></div>`
      return `<div class="sx-isl-press" style="${hueOf(it)}"><div class="isl-top"><b>${esc(it.title)}</b><span class="isl-row-sp"><span>${l > 0 ? waitWord(it) : '今天'}</span><button class="isl-x" aria-label="关闭">收起</button></span></div><div class="isl-cr walk">${creatureOf(it, 96)}</div><div class="isl-n big">${l > 0 ? num(l) + '<small>天</small>' : '<b class="today">今天</b>'}</div><div class="isl-sub">${DM.fmt(it.date, 'mdw')}</div><div class="sx-trackw"><i class="sx-road"></i><span class="sx-walker" style="left:${travelPct(it).toFixed(1)}%">${creatureOf(it, 52)}</span><span class="sx-goal"><b>${DM.dateOf(it.date).getDate()}</b><small>${DM.dateOf(it.date).getMonth() + 1}月</small></span></div><div class="isl-btns"><button class="isl-btn" data-act="closeAll">打开刻度</button><button class="isl-btn ghost">关闭</button></div></div>`
    }
    if (s === 'remind') {
      const tm = timeOf(it, '22:30')
      if (st === 'min') return `<div class="sx-isl-min"><i class="isl-dot blink"></i></div>`
      if (st === 'cpt')
        return `<div class="sx-isl-cpt" style="${hueOf(it)}"><span class="isl-l">${creatureOf(it, 34)}</span><span class="isl-r tm">${tm}</span></div>`
      if (st === 'exp')
        return `<div class="sx-isl-exp" style="${hueOf(it)}"><div class="isl-top"><b>${esc(it.title)}</b><span>提醒 · ${tm}</span></div><div class="isl-mid"><span class="isl-cr">${creatureOf(it, 88)}</span><div class="isl-n"><b class="isl-rec">记一下</b></div></div></div>`
      return `<div class="sx-isl-press" style="${hueOf(it)}"><div class="isl-top"><b>${esc(it.title)}</b><span class="isl-row-sp"><span>${tm} 提醒</span><button class="isl-x" aria-label="关闭">收起</button></span></div><div class="isl-cr">${creatureOf(it, 96)}</div><div class="isl-n big"><b class="isl-rec big">记一下</b></div><div class="isl-sub">${habLabel(it)}${it.streak > 1 ? ` · 连续 ${it.streak} 天` : ''}</div><div class="isl-btns"><button class="isl-btn" data-act="closeAll">记下了</button><button class="isl-btn ghost">稍后提醒</button></div></div>`
    }
    // timer
    if (st === 'min') return `<div class="sx-isl-min prog"><i data-live="pctw" style="width:${(100 - (TM.left / TM.total) * 100).toFixed(1)}%"></i></div>`
    if (st === 'cpt') return `<div class="sx-isl-cpt tmr"><span class="isl-l tm big" data-live="mm">${mmss(TM.left)}</span><span class="isl-r icon">${TM.run ? '⏸' : '▶'}</span></div>`
    if (st === 'exp')
      return `<div class="sx-isl-exp tmr"><div class="isl-top"><b>专注</b><span>${mmss(TM.total)}</span></div><div class="isl-mid"><span class="isl-time" data-live="mm">${mmss(TM.left)}</span><button class="isl-pause">${TM.run ? '⏸' : '▶'}</button></div><div class="isl-prog"><i data-live="pctw" style="width:${(100 - (TM.left / TM.total) * 100).toFixed(1)}%"></i></div></div>`
    return `<div class="sx-isl-press tmr"><div class="isl-top"><b>专注</b><span class="isl-row-sp"><span>剩余 ${mmss(TM.left)}</span><button class="isl-x" aria-label="关闭">收起</button></span></div><div class="isl-time big" data-live="mm">${mmss(TM.left)}</div><div class="isl-prog"><i data-live="pctw" style="width:${(100 - (TM.left / TM.total) * 100).toFixed(1)}%"></i></div><div class="isl-btns full"><button class="isl-btn">${TM.run ? '暂停' : '继续'}</button><button class="isl-btn ghost">放弃</button></div></div>`
  }

  DM.OV_AFTER.island = (layer, o) => {
    after(layer, o)
    clearInterval(o._itv)
    o._itv = setInterval(() => {
      if (!layer.isConnected) return clearInterval(o._itv)
      layer.querySelectorAll('[data-live]').forEach((el) => {
        if (el.dataset.live === 'pct') el.textContent = pctTxt()
        else if (el.dataset.live === 'pctw') el.style.width = dayPct().toFixed(2) + '%'
        else if (el.dataset.live === 'mm') el.textContent = mmss(Math.max(0, TM.left - ((performance.now() - t0) / 1000) * (TM.run ? 1 : 0)))
      })
    }, 250)
  }

  Object.assign(DM.ACT, {
    islScene: (el) => DM.updateOv({ scene: el.dataset.v }),
    islState: (el) => DM.updateOv({ state: el.dataset.v }),
  })

  // ================================================================ 锁屏实时活动（完整的锁屏界面 + 一个活动卡片）

  DM.OV.lock = (o) => {
    o.scene = o.scene || 'keep'
    const it = DM.focused()
    const s = o.scene
    const seg = ISCENES.map((k) => `<button class="${s === k ? 'is-on' : ''}" data-act="lkScene" data-v="${k}">${IS_NAMES[k]}</button>`).join('')
    return `<div class="sx-lk">${wall}
      ${lockHead(null)}
      <div class="sx-lk-la">${laBanner(s, it)}</div>
      <div class="sx-lk-notifs"><div class="sx-notif"><div class="sx-notif-h"><b>信息</b><span>38 分钟前</span></div><p>我到家啦</p></div><div class="sx-notif"><div class="sx-notif-h"><b>日历</b><span>1 小时前</span></div><p>明天 15:00 · 周会</p></div></div>
      <div class="sx-lk-btns"><button class="sx-lk-ico" aria-label="手电筒">🔦</button><button class="sx-lk-ico" aria-label="相机">📷</button></div>
      <div class="sx-panel"><div class="grab"></div><div class="sx-p-h"><div><h4>锁屏实时活动</h4><p>长条卡片，在通知上方</p></div>${X}</div>
      <div class="sx-row-label">情景</div><div class="sx-seg seg">${seg}</div>
      <div class="sx-islnote">实时活动是 iOS 系统的锁屏卡片，Pro 功能，比小组件更显眼。可以放倒数日"信信在路上"、习惯提醒"轻点即记"、专注计时等。</div></div>
    </div>`
  }

  function laBanner(s, it) {
    if (s === 'keep') {
      const n = dayNum(it)
      return `<div class="sx-la" style="${hueOf(it)}"><span class="la-l">${creatureOf(it, 60)}</span><div class="la-c"><b>${esc(it.title)}</b><span>自动累计中 · 第 ${n} 天</span><div class="sx-day"><div class="sx-day-t"><span>今天 已走</span><b data-live="pct">${pctTxt()}</b></div><div class="sx-day-b"><i data-live="pctw" style="width:${dayPct().toFixed(2)}%"></i></div></div></div><span class="la-r"><b>${num(n, 'sm')}</b><small>天</small></span></div>`
    }
    if (s === 'wait') {
      const l = DM.left(it)
      return `<div class="sx-la" style="${hueOf(it)}"><span class="la-l walk">${creatureOf(it, 60)}</span><div class="la-c"><b>${esc(it.title)}</b><span>${l > 0 ? waitWord(it) : '今天就是'} · ${DM.fmt(it.date, 'md')}</span><div class="sx-trackw"><i class="sx-road"></i><span class="sx-walker" style="left:${travelPct(it).toFixed(1)}%">${creatureOf(it, 44)}</span><span class="sx-goal"><b>${DM.dateOf(it.date).getDate()}</b><small>${DM.dateOf(it.date).getMonth() + 1}月</small></span></div></div><span class="la-r">${l > 0 ? '<b>' + num(l, 'sm') + '</b><small>天</small>' : '<b class="today">今天</b>'}</span></div>`
    }
    if (s === 'remind') {
      const tm = timeOf(it, '22:30')
      return `<div class="sx-la" style="${hueOf(it)}"><span class="la-l">${creatureOf(it, 60)}</span><div class="la-c"><b>${esc(it.title)}</b><span>提醒 · ${tm}</span></div><button class="la-rbtn">记下了</button></div>`
    }
    // timer
    return `<div class="sx-la tmr"><span class="la-l icon big">⏱</span><div class="la-c"><b>专注</b><span>剩余 · <span data-live="mm">${mmss(TM.left)}</span></span><div class="isl-prog"><i data-live="pctw" style="width:${(100 - (TM.left / TM.total) * 100).toFixed(1)}%"></i></div></div><button class="la-rbtn icon">${TM.run ? '⏸' : '▶'}</button></div>`
  }

  DM.OV_AFTER.lock = (layer, o) => {
    after(layer, o)
    clearInterval(o._itv)
    o._itv = setInterval(() => {
      if (!layer.isConnected) return clearInterval(o._itv)
      layer.querySelectorAll('[data-live]').forEach((el) => {
        if (el.dataset.live === 'pct') el.textContent = pctTxt()
        else if (el.dataset.live === 'pctw') el.style.width = dayPct().toFixed(2) + '%'
        else if (el.dataset.live === 'mm') el.textContent = mmss(Math.max(0, TM.left - ((performance.now() - t0) / 1000) * (TM.run ? 1 : 0)))
      })
    }, 250)
  }

  Object.assign(DM.ACT, {
    lkScene: (el) => DM.updateOv({ scene: el.dataset.v }),
  })

  // ================================================================ AlarmKit 全屏闹钟 + 权限请求

  DM.OV.alarm = (o) => {
    o.scene = o.scene || 'wait'
    const it = DM.focused()
    const seg = ['wait', 'remind'].map((k) => `<button class="${o.scene === k ? 'is-on' : ''}" data-act="alScene" data-v="${k}">${k === 'wait' ? '倒数日到了' : '习惯提醒'}</button>`).join('')
    return `<div class="sx-al">${wall}${alContent(o, it)}
      <div class="sx-panel"><div class="grab"></div><div class="sx-p-h"><div><h4>AlarmKit 全屏闹钟</h4><p>穿透静音 / 专注模式，iOS 26 新 API</p></div>${X}</div>
      <div class="sx-row-label">情景</div><div class="sx-seg seg">${seg}</div>
      <div class="sx-islnote">倒数日到点、习惯提醒到点时，全屏闹钟（Pro 功能）。会穿透静音/专注，震一下，需要用户下滑或点"停止"才能关。iOS 26 的 AlarmKit。</div></div>
    </div>`
  }

  function alContent(o, it) {
    if (o.scene === 'wait') {
      const tm = timeOf(it, '09:00')
      return `<div class="sx-al-c" style="${hueOf(it)}"><div class="al-cr bounce">${creatureOf(it, 140)}</div><div class="al-t">今天是</div><h3 class="al-title">${esc(it.title)}</h3><div class="al-sub">${DM.fmt(it.date, 'mdw')} · ${tm}${it.memo ? ' · "' + esc(it.memo) + '"' : ''}</div><div class="al-slider"><button class="al-snooze">稍后提醒</button><div class="al-track"><span class="al-handle" aria-label="向右滑动停止">›››</span></div></div><button class="al-stop">停止</button></div>`
    }
    // remind
    const tm = timeOf(it, '22:30')
    return `<div class="sx-al-c" style="${hueOf(it)}"><div class="al-cr bounce">${creatureOf(it, 140)}</div><div class="al-t">提醒 · ${tm}</div><h3 class="al-title">${esc(it.title)}</h3><div class="al-sub">${habLabel(it)}${it.streak > 1 ? ` · 连续 ${it.streak} 天` : ''}</div><div class="al-slider"><button class="al-snooze">稍后提醒</button><div class="al-track"><span class="al-handle" aria-label="向右滑动停止">›››</span></div></div><button class="al-stop">停止</button></div>`
  }

  DM.OV.alarmAuth = () =>
    `<div class="sx-perm">${wall}<div class="sx-perm-c"><div class="sx-perm-ico">${DM.creature({ species: 'moon', stage: 'egg', size: 80 })}</div><h4>"刻度"想要<br>发送全屏闹钟</h4><p>倒数日到点、习惯提醒到点时，会全屏弹出，穿透静音。需要你批准才能开启。</p><button class="btn block" data-act="close">好</button><button class="btn block ghost" data-act="close">不允许</button></div></div>`

  Object.assign(DM.ACT, {
    alScene: (el) => DM.updateOv({ scene: el.dataset.v }),
  })

  // ================================================================ 入口汇总：系统触点

  DM.OV.sysHub = () =>
    `<div class="dim" data-act="close"></div><div class="sheet sx-hub">
      <div class="grab"></div><div class="sheet-h"><h3>系统触点</h3>${X}</div>
      <p class="sheet-sub">iOS 系统层的交互点，让你不用打开 App 也能看到数字在走。</p>
      ${hubCard('widgets', '桌面小组件', '主屏 + 锁屏', '数字自己走，不用再管', '小号免费，大号 Pro')}
      ${hubCard('island', '灵动岛', '一个深紫色胶囊', '坚持 / 等待 / 提醒 / 计时', 'Pro 功能')}
      ${hubCard('lock', '锁屏实时活动', '通知上方的长条', '抬手就能看到进度', 'Pro 功能')}
      ${hubCard('alarm', 'AlarmKit 闹钟', '全屏弹出，穿透静音', '倒数日 / 习惯提醒到点', 'Pro 功能')}
    </div>`

  function hubCard(kind, title, tag, desc, pro) {
    const ico = {
      widgets: `<span class="sx-hub-w">${DM.creature({ species: 'moon', stage: 0, size: 36 })}<i></i><i></i><i></i></span>`,
      island: '<span class="sx-hub-isl"><span></span></span>',
      lock: `<span class="sx-hub-la">${DM.creature({ species: 'post', mood: 'idle', size: 40, extra: { hold: 'letter' } })}<i></i></span>`,
      alarm: `<span class="sx-hub-al">${DM.creature({ species: 'drop', stage: 0, size: 64 })}</span>`,
    }
    return `<button class="sx-hub-card" data-act="sysOpen" data-k="${kind}">
      <span class="sx-hub-ico">${ico[kind]}</span>
      <div class="sx-hub-main"><div class="sx-hub-h"><b>${title}</b><span>${tag}</span></div><p>${desc}</p></div>
      <span class="sx-hub-rite">${pro}<svg width="9" height="14" viewBox="0 0 9 14"><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </button>`
  }

  Object.assign(DM.ACT, {
    openSysHub: () => DM.openOv({ type: 'sysHub' }),
    sysOpen(el) {
      const k = el.dataset.k
      S.ovs = []
      DM.renderOv()
      setTimeout(() => DM.sys.open(k), 10)
    },
  })

  // ================================================================ 公共接口与演示数据流程

  Object.assign(DM, {
    sys: {
      open(kind) {
        DM.demo.ensureSeed()
        DM.demo.today(DM.focused() ? DM.focused().id : 'sleep')
        if (kind === 'widgets') DM.openOv({ type: 'widgets', size: 's', kind: 'keep', sel: {} })
        else if (kind === 'island') DM.openOv({ type: 'island', scene: 'keep', state: 'cpt' })
        else if (kind === 'lock') DM.openOv({ type: 'lock', scene: 'keep' })
        else if (kind === 'alarm') {
          const w = S.items.find((i) => i.type === 'countdown' && i.id !== 'halloween')
          if (w) {
            DM.setFocus(w.id)
            DM.openOv({ type: 'alarm', scene: 'wait' })
          } else DM.openOv({ type: 'alarm', scene: 'remind' })
        } else if (kind === 'hub') DM.openOv({ type: 'sysHub' })
      },
    },
  })

  DM.FLOWS.push({
    key: 'K',
    title: '系统触点',
    steps: [
      { id: 'K1', label: '小组件 · 主屏', run: () => { DM.demo.ensureSeed(); DM.demo.today('sleep'); S.ovs = [{ type: 'widgets', size: 's', kind: 'keep', sel: {} }] } },
      { id: 'K2', label: '小组件 · 锁屏', run: () => { DM.demo.ensureSeed(); DM.demo.today('smoke'); S.ovs = [{ type: 'widgets', size: 'lock', kind: 'keep', sel: {} }] } },
      { id: 'K3', label: '灵动岛', run: () => { DM.demo.ensureSeed(); DM.demo.today('smoke'); S.ovs = [{ type: 'island', scene: 'keep', state: 'cpt' }] } },
      { id: 'K4', label: '锁屏实时活动', run: () => { DM.demo.ensureSeed(); DM.demo.today('mom'); S.ovs = [{ type: 'lock', scene: 'wait' }] } },
      { id: 'K5', label: '闹钟 AlarmKit', run: () => { DM.demo.ensureSeed(); DM.demo.today('mom'); S.ovs = [{ type: 'alarm', scene: 'wait' }] } },
    ],
  })

  DM.sceneHooks.push(() => {
    const t = S.ovs[S.ovs.length - 1]
    return t && MINE.includes(t.type) ? t.type : null
  })

  Object.assign(DM.NOTES, {
    widgets: {
      k: 'K · 系统触点',
      t: '小组件：不用打开 App 也能看见它在走',
      d: [1, 4],
      p: [
        '<b>数字自己往前走</b>。小组件里的天数、百分比每一秒都在涨，和锁屏时钟一样是"活的"。用户不用打开 App、不用记、不用点刷新，抬手就能看到今天走了多远。',
        '小号 2×2 免费；中号 4×2 免费，多一行"已走过 X 年 Y 个月 Z 天"；<b>大号 4×4 · Pro</b>，一周足迹、形态进度、备忘全在桌面，最丰富。<b>锁屏附件 · Pro</b>：圆形 / 矩形 / 行内（日期旁边的小字），抬手就看到。',
        '习惯养成类小组件是<b>可交互的</b>（iOS 17 Interactive Widget），轻点环形按钮就能记一次，不用进 App。',
        '三类事"坚持 / 习惯 / 等待"可以各放一个小组件，也可以循环切换同一个。演示里做了滚动计数动画、环形进度过渡、添加时的抖动 + 掉落。',
      ],
      try: '切换尺寸、切换类别、试试习惯的"记一下"按钮、点"添加到桌面"看抖动动画。',
    },
    island: {
      k: 'K · 系统触点',
      t: '灵动岛：一个深紫色胶囊里的小伙伴',
      d: [1, 4],
      p: [
        'iPhone 14 Pro 起的灵动岛（Dynamic Island）通过 <b>Live Activity</b> 接收刻度的数据，显示 Compact（左边小伙伴，右边数字）→ Expanded（卡片）→ Long-press（按住展开更多按钮）。',
        '演示做了 4 个情景：① 坚持"今天也在自动累计"，② 倒数日"还有 3 天 · 信信在路上"（信信会摇晃），③ 习惯提醒到点（带"记一下"按钮），④ 专注计时（倒计时 + 进度条）。',
        '灵动岛是 <b>Pro 功能</b>，比小组件更显眼；小伙伴在系统层也能做简单动画（摇晃、弹跳）。',
        '点灵动岛会跳回 App 对应的页面；长按能看到更多信息和快捷按钮。',
      ],
      try: '切换情景和状态，看 Compact / Expanded / Long-press 四种样子。',
    },
    lock: {
      k: 'K · 系统触点',
      t: '锁屏实时活动：通知上方的长条卡片',
      d: [1, 4],
      p: [
        '<b>锁屏实时活动</b>（Live Activity on Lock Screen）是 iOS 16.1 起的系统界面，在通知栏上方，比小组件更显眼。<b>Pro 功能</b>。',
        '可以放"自动累计中 · 第 X 天"（带今天已走进度条）、"信信在路上 · 还有 3 天"（带旅途动画）、习惯提醒"轻点即记"、专注计时等。',
        '实时活动的数字和进度条也是自己在走的，不用打开 App。',
        '锁屏附件（圆形 / 矩形 / 行内）在 K2 小组件·锁屏里演示，这里只做长条卡片（Banner）。',
      ],
      try: '切换情景，看不同类型事项在锁屏上的样子。',
    },
    alarm: {
      k: 'K · 系统触点',
      t: 'AlarmKit 全屏闹钟：穿透静音，必须处理',
      d: [1, 4],
      p: [
        '<b>iOS 26 AlarmKit</b> 可以让第三方 App 发送和系统闹钟一样的全屏提醒，<b>穿透静音模式和专注模式</b>，震动 + 声音，用户必须下滑或点"停止"才能关闭。<b>Pro 功能</b>。',
        '适合倒数日到了（"今天是妈妈生日"）、习惯提醒到点（"提醒 22:30 · 早睡"）这类真的需要被打断的场景。',
        '需要用户主动授权"允许刻度发送全屏闹钟"（alarmAuth 覆盖层），授权后才能用。',
        '演示里小伙伴在弹跳（bounce），底部是"稍后提醒 / 向右滑停止"的 iOS 系统交互。',
      ],
      try: '切换情景（倒数日 / 习惯提醒）。',
    },
    alarmAuth: {
      k: 'K · 系统触点',
      t: 'AlarmKit 权限请求：一次性弹窗',
      d: [4],
      p: [
        '首次想用全屏闹钟时，系统会弹出权限请求："刻度"想要发送全屏闹钟。',
        '文案解释：<b>倒数日到点、习惯提醒到点时，会全屏弹出，穿透静音</b>。需要你批准才能开启。',
        '用户点"好"后才能用 AlarmKit。点"不允许"则回退到普通通知。',
      ],
      try: '这是演示，点哪个按钮都会关闭，真机上点"好"才会授权。',
    },
    sysHub: {
      k: 'K · 系统触点',
      t: '系统触点汇总：四张卡片',
      d: [4],
      p: [
        '把小组件 / 灵动岛 / 锁屏实时活动 / AlarmKit 闹钟做成一个入口列表，方便用户了解"刻度能出现在哪些系统界面"。',
        '每张卡片有小插图、标题、一行说明、Pro 标识。点进去跳到对应的演示或设置页。',
        '这个入口可以放在「装扮」或「设置」里，也可以作为 Pro 订阅页的功能预览。',
      ],
      try: '点任意一张卡片，跳到对应的系统触点演示。',
    },
  })
})()
