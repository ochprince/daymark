/*
 * Pro / 设置 / 统计 / 农历 / 提醒 / 首次引导。
 * 挂在 window.DM 上，只通过 DM.OV / DM.ACT / DM.VIEWS 扩展，不改其他文件。
 * 价格为原型示意数字，不是最终定价。
 */
;(function () {
  'use strict'
  const DM = window.DM
  const S = DM.S
  const { esc, ICON } = DM
  const creature = (sp, stage, size, hue, mood) => `<i class="pc" style="${DM.hueStyle(hue)}">${DM.creature({ species: sp, stage, mood: mood || 'happy', size })}</i>`
  const backBtn = (label = '返回') => `<button class="back" data-act="close">${ICON.back}${label}</button>`
  const pageHead = (title, right = '') => `<div class="page-h">${backBtn()}<b class="page-t">${title}</b>${right || '<span style="width:64px"></span>'}</div>`
  const top = () => S.ovs[S.ovs.length - 1]

  // ================================================================ Pro 状态

  DM.pro = {
    isPro: () => !!S.pro,
    /** 需要 Pro 的动作：已开通直接执行，否则弹订阅页（只在「情绪层」上拦，不拦核心记录） */
    gate(source, fn) {
      if (S.pro) return fn && fn()
      DM.openOv({ type: 'paywall', source, plan: 'year' }, { push: true })
    },
  }

  // ================================================================ 1 · 订阅页

  const HEAD = {
    pets: ['更多小伙伴，', '想来你桌面住'],
    widget: ['把它放到', '锁屏、灵动岛和闹钟里'],
    sync: ['换手机，', '它们也会跟着你走'],
    items: ['想记的事多一点，', '也可以'],
    skin: ['给刻度换一身', '新衣服'],
  }
  const HEAD_SUB = {
    pets: '解锁更多宠物包、节日限定款，可以住在你的桌面上。',
    widget: '锁屏实时活动、灵动岛、像闹钟一样响的提醒。',
    sync: 'iCloud 同步：数据仍然属于你，只是多一份安心。',
    items: '免费可以同时养 8 件事，Pro 不限数量。',
    skin: '更多皮肤与自定义配色，让小窝更像你。',
  }

  const FREE_LIST = [
    ['记录、打卡、倒数日、坚持天数', '核心功能，一个都不锁'],
    ['宠物成长、章节与藏馆', '你的回忆永远在'],
    ['通知提醒 + 桌面小组件', ''],
    ['分享卡片、数据导出', '想带走随时带走'],
    ['默认小伙伴与基础皮肤', ''],
    ['没有广告，没有弹窗催你', ''],
  ]
  const PRO_LIST = [
    ['更多宠物包，可住在桌面上', '节日限定与新物种，会陆续加入'],
    ['更多皮肤与自定义配色', ''],
    ['锁屏实时活动 · 灵动岛', ''],
    ['系统闹钟式提醒', '像闹钟一样响，即便静音'],
    ['iCloud 同步，换机不丢', ''],
    ['同时记录不限件数', '免费 8 件'],
  ]
  const li = (arr) => arr.map(([a, b]) => `<li><i>✓</i><span>${a}${b ? `<small>${b}</small>` : ''}</span></li>`).join('')

  DM.OV.paywall = (o) => {
    const h = HEAD[o.source] || ['让陪伴', '再丰富一点点']
    const sub = HEAD_SUB[o.source] || '刻度永远可以免费使用。Pro 只是给喜欢它的人，多一些小心意。'
    if (o.done) {
      return `<div class="page">
        ${pageHead('刻度 Pro')}
        <div class="pw-done">
          <div class="pw-pets" style="height:96px">${creature('sprout', 4, 74, 'mint')}${creature('star', 3, 74, 'lemon')}${creature('moon', 3, 74, 'grape')}</div>
          <h2 style="font-family:var(--font-title);font-size:24px;margin:14px 0 6px">谢谢你 ♡</h2>
          <p class="muted" style="line-height:1.7;margin:0 0 20px">Pro 已开启。小伙伴们很开心。<br>${o.plan === 'life' ? '这是永久版，不会再有任何扣费。' : '试用期内随时可以在系统设置里取消，不会扣费。'}</p>
          <button class="btn block" data-act="close">好的</button>
        </div>
        ${DM.confetti(30)}
      </div>`
    }
    const yr = o.plan !== 'life'
    return `<div class="page">
      ${pageHead('刻度 Pro')}
      <div class="pw-hero">
        <div class="pw-pets">${creature('sprout', 3, 62, 'mint')}${creature('star', 4, 62, 'lemon')}${creature('moon', 3, 62, 'grape')}</div>
        <h2>${h[0]}<br>${h[1]}</h2>
        <p>${sub}</p>
        <div class="pw-badges"><span>永远可以免费用</span><span>没有广告</span><span>随时取消</span></div>
      </div>
      <div class="sec-title">永远免费 <small>记录这件事，不收钱</small></div>
      <div class="pw-cols"><div class="card pw-col free"><ul>${li(FREE_LIST)}</ul></div></div>
      <div class="sec-title">Pro 多给你的 <small>情绪与陪伴</small></div>
      <div class="pw-cols"><div class="card pw-col pro"><ul>${li(PRO_LIST)}</ul></div></div>
      <div class="sec-title">选一个喜欢的方式</div>
      <div class="pw-plans">
        <button class="pw-plan ${yr ? 'is-on' : ''}" data-act="pwPlan" data-plan="year"><span class="ribbon">先试 7 天</span><b>连续包年</b><div class="pr">¥18<small> / 年</small></div><div class="sub">约 ¥1.5 / 月</div></button>
        <button class="pw-plan ${!yr ? 'is-on' : ''}" data-act="pwPlan" data-plan="life"><b>永久买断</b><div class="pr">¥28<small> 一次</small></div><div class="sub">一次付清，不再续费</div></button>
      </div>
      <div class="pw-cta"><button class="btn block" data-act="pwBuy">${yr ? '7 天免费试用' : '永久解锁 ¥28'}</button></div>
      <div class="pw-fine">
        ${yr ? '试用结束后 ¥18 / 年，到期前提醒你，随时可取消。<br>' : ''}
        <button data-act="pwRestore">恢复购买</button>·<button data-act="pwTerms">服务条款</button>·<button data-act="pwTerms">隐私政策</button>
        <br><span class="pw-proto">价格为原型示意数字</span>
      </div>
      <div style="height:16px"></div>
    </div>`
  }

  Object.assign(DM.ACT, {
    openPaywall(el) {
      DM.openOv({ type: 'paywall', source: (el && el.dataset.source) || '', plan: 'year' }, { push: true })
    },
    pwPlan(el) {
      DM.updateOv({ plan: el.dataset.plan })
    },
    pwBuy() {
      S.pro = true
      DM.sfx && DM.sfx('hatch')
      DM.updateOv({ done: true })
      DM.toast('Pro 已开启 · 谢谢你')
    },
    pwRestore() {
      DM.toast(S.pro ? 'Pro 已经在啦' : '没有找到购买记录（演示）')
    },
    pwTerms() {
      DM.toast('演示中')
    },
  })

  // ================================================================ 2 · 设置

  const row = (ic, label, sub, act, data = '', tag = '') =>
    `<button class="li" data-act="${act}" ${data}><span class="ic">${ic}</span><span class="grow">${label}${tag}${sub ? `<small class="li-sub">${sub}</small>` : ''}</span><span class="chev">›</span></button>`
  const tog = (ic, label, sub, act, on, tag = '') =>
    `<div class="li"><span class="ic">${ic}</span><span class="grow">${label}${tag}${sub ? `<small class="li-sub">${sub}</small>` : ''}</span><button class="toggle ${on ? 'on' : ''}" data-act="${act}" aria-label="${label}"></button></div>`
  const PRO = '<span class="pro-tag">PRO</span>'

  DM.OV.settings = () => {
    const f = DM.focused()
    const fid = f ? `data-id="${f.id}"` : ''
    const pro = !!S.pro
    const proCard = `<button class="st-pro ${pro ? 'on' : ''}" data-act="openPaywall" data-source="settings">
      <span class="pets">${creature('sprout', 3, 40, 'mint')}${creature('star', 3, 40, 'lemon')}${creature('moon', 2, 40, 'grape')}</span>
      <span class="tx"><b>${pro ? 'Pro 已开启' : '刻度 Pro'}</b><small>${pro ? '谢谢你。小伙伴们都记得。' : '更多宠物包、皮肤、桌面与同步，7 天免费试用'}</small></span>
      <span class="go">${pro ? '查看' : '了解'}</span>
    </button>`
    return `<div class="page">
      ${pageHead('设置')}
      ${proCard}
      <div class="st-note">核心记录永远免费，没有广告。</div>

      <div class="sec-title">同步与数据</div>
      <div class="card list">
        ${tog('☁', 'iCloud 同步', S.sync && pro ? '已开启 · 在你的所有设备间同步' : '换手机也不丢', 'syncToggle', S.sync && pro, PRO)}
        ${row('⇪', '导出我的数据', '一份 JSON，随时带走', 'exportData')}
      </div>
      <div class="st-note">数据只在本机，永不上传。开启 iCloud 后也只存在你自己的 iCloud 里。</div>

      <div class="sec-title">提醒</div>
      <div class="card list">
        ${row('🔔', '提醒与通知', f ? `${esc(f.title)} · ${esc(f.remind || '未设置')}` : '', 'openReminder', fid)}
      </div>

      <div class="sec-title">桌面与系统</div>
      <div class="card list">
        ${row('▦', '桌面小组件', '把小伙伴放在主屏幕', 'sysOpen', 'data-k="widgets"')}
        ${row('◖', '灵动岛', '', 'sysOpen', 'data-k="island"', PRO)}
        ${row('🔒', '锁屏实时活动', '', 'sysOpen', 'data-k="lock"', PRO)}
        ${row('⏰', '系统闹钟', '像闹钟一样响，即便静音', 'sysOpen', 'data-k="alarm"', PRO)}
      </div>

      <div class="sec-title">外观</div>
      <div class="card list">
        ${row('🎨', '皮肤与配色', '在「装扮」里换', 'gotoDress')}
      </div>

      <div class="sec-title">宠物</div>
      <div class="card list">
        ${tog('🐾', '桌面宠物', '让小伙伴在屏幕上走走', 'petToggle', !!S.petOn)}
        ${row('📦', '宠物包', `当前：${packName(S.petPack || 'mochi')}`, 'openPetPack')}
      </div>

      <div class="sec-title">关于</div>
      <div class="card list">
        ${row('★', '给我们评分', '', 'aboutRate')}
        ${row('♡', '分享给朋友', '', 'aboutShare')}
        ${row('✉', '反馈与建议', '', 'aboutFeedback')}
        <div class="li"><span class="ic">i</span><span class="grow">版本</span><small>刻度 1.0 (原型)</small></div>
      </div>
      <div class="st-ver">Daymark · 刻度 · 做给慢慢来的人</div>
    </div>`
  }

  const PACKS = [
    { id: 'mochi', name: '麻糬 · 默认', sub: '圆圆软软的，自带' },
    { id: 'local', name: '本地宠物包（导入）', sub: '从文件导入你自己的素材' },
  ]
  const LOCKED = [
    { name: '深海小队', sub: '敬请期待 · 水母、海星、小海马', sp: 'drop' },
    { name: '节日限定', sub: '敬请期待 · 春节、中秋、圣诞', sp: 'post' },
    { name: '森林夜话', sub: '敬请期待 · 狐狸、猫头鹰', sp: 'moon' },
  ]
  const packName = (id) => (PACKS.find((p) => p.id === id) || PACKS[0]).name

  DM.OV.petpack = () => {
    const cur = S.petPack || 'mochi'
    const free = PACKS.map(
      (p, i) => `<button class="card pk ${cur === p.id ? 'is-on' : ''}" data-act="packPick" data-id="${p.id}">
        <span class="pv">${i === 0 ? creature('sprout', 2, 52, 'mint') : '📁'}</span>
        <span class="tx"><b>${p.name}<span class="free-tag">免费</span></b><small>${p.sub}</small></span><span class="ck">${ICON.check}</span></button>`
    ).join('')
    const locked = LOCKED.map(
      (p) => `<button class="card pk locked" data-act="packLocked"><span class="pv">${creature(p.sp, 2, 52, 'grape', 'idle')}</span>
        <span class="tx"><b>${p.name}<span class="pro-tag">PRO</span></b><small>${p.sub}</small></span><span class="ck">🔒</span></button>`
    ).join('')
    return `<div class="page">
      ${pageHead('宠物包')}
      <div class="st-note" style="margin-top:6px">选一套住在桌面上的小伙伴。换包不会影响你的任何记录。</div>
      <div class="sec-title">免费</div>
      <div class="pk-grid">${free}</div>
      <div class="sec-title">Pro 宠物包 <small>陆续加入</small></div>
      <div class="pk-grid">${locked}</div>
      <div style="height:16px"></div>
    </div>`
  }

  Object.assign(DM.ACT, {
    openSettings() {
      DM.openOv({ type: 'settings' }, { push: true })
    },
    openStats() {
      DM.openOv({ type: 'stats' }, { push: true })
    },
    openPetPack() {
      DM.openOv({ type: 'petpack' }, { push: true })
    },
    syncToggle() {
      DM.pro.gate('sync', () => {
        S.sync = !S.sync
        DM.updateOv({})
        DM.toast(S.sync ? 'iCloud 同步已开启' : '已关闭 iCloud 同步')
      })
    },
    exportData() {
      DM.toast('已导出 daymark-backup.json（演示）')
    },
    sysOpen(el) {
      const k = el.dataset.k
      if (DM.sys && DM.sys.open) DM.sys.open(k)
      else DM.toast('演示中')
    },
    gotoDress() {
      S.tab = 'dress'
      S.ovs = []
      DM.render()
    },
    petToggle() {
      S.petOn = !S.petOn
      DM.pets && DM.pets.setEnabled && DM.pets.setEnabled(S.petOn)
      DM.updateOv({})
      DM.toast(S.petOn ? '小伙伴来桌面啦' : '桌面宠物已收起')
    },
    packPick(el) {
      S.petPack = el.dataset.id
      DM.pets && DM.pets.setPack && DM.pets.setPack(S.petPack)
      DM.updateOv({})
      DM.toast(`已换成「${packName(S.petPack)}」`)
    },
    packLocked() {
      if (S.pro) DM.toast('敬请期待 · 做好了第一时间告诉你')
      else DM.pro.gate('pets')
    },
    aboutRate() {
      DM.toast('谢谢你！会跳转到 App Store（演示）')
    },
    aboutShare() {
      DM.toast('演示中')
    },
    aboutFeedback() {
      DM.toast('演示中')
    },
  })

  // ================================================================ 3 · 今天页右上角入口

  const origToday = DM.VIEWS.today
  const GEAR = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/></svg>'
  const BARS = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4.5 16V10M10 16V4.5M15.5 16v-8"/></svg>'
  DM.ICON.bars = DM.ICON.bars || BARS
  DM.ICON.gear = DM.ICON.gear || GEAR
  DM.VIEWS.today = function () {
    const html = origToday()
    if (!html || html.includes('data-act="openStats"')) return html
    const inject = `<button class="icon-btn mini" data-act="openStats" aria-label="统计">${BARS}</button><button class="icon-btn mini" data-act="openSettings" aria-label="设置">${GEAR}</button>`
    return html.replace('<div class="t-actions">', '<div class="t-actions">' + inject)
  }

  // ================================================================ 4 · 数据统计

  const WEEKS = 15
  const logOf = (it) => it.log || []
  const hueVar = (h) => `var(--h-${h})`

  function statsData() {
    const end = S.simDay
    const habits = S.items.filter((x) => x.type === 'habit')
    const sinces = S.items.filter((x) => x.type === 'since')
    const checkDays = new Set()
    habits.forEach((h) => logOf(h).forEach((d) => d <= end && checkDays.add(d)))
    const firsts = [...sinces.map((x) => x.start), ...habits.map((x) => (x.startDay != null ? x.startDay : end))]
    const first = firsts.length ? Math.min(...firsts) : end
    const sinceSum = sinces.reduce((a, x) => a + Math.max(0, DM.sinceDays(x)), 0)
    const longest = sinces.reduce((a, x) => Math.max(a, DM.sinceDays(x)), 0)
    // 15 周热力图：列 = 周（周日在上），最后一列包含今天
    const endDow = DM.dateOf(end).getDay()
    const startOff = end - endDow - (WEEKS - 1) * 7
    const cols = []
    for (let w = 0; w < WEEKS; w++) {
      const col = []
      for (let r = 0; r < 7; r++) {
        const off = startOff + w * 7 + r
        const future = off > end
        const s = !future && sinces.some((x) => off >= x.start)
        const h = future ? 0 : habits.filter((x) => logOf(x).includes(off)).length
        col.push({ off, future, s, h })
      }
      cols.push(col)
    }
    const share = S.items
      .filter((x) => x.type !== 'countdown')
      .map((x) => ({ it: x, n: x.type === 'since' ? Math.max(0, DM.sinceDays(x)) : logOf(x).length }))
      .filter((x) => x.n > 0)
    return { total: end - first + 1, active: S.items.length, longest, checkN: checkDays.size, sinceSum, cols, share, startOff }
  }

  DM.OV.stats = () => {
    const d = statsData()
    const mon = (off) => DM.dateOf(off).getMonth() + 1
    let lastM = -1
    const months = d.cols
      .map((c) => {
        const m = mon(c[0].off)
        const t = m !== lastM ? `${m}月` : ''
        lastM = m
        return `<span>${t}</span>`
      })
      .join('')
    const grid = d.cols
      .map((c) => `<div class="hm-col">${c.map((x) => `<i class="${x.future ? 'fu' : ''} ${x.s ? 's' : ''} ${x.h ? 'h' + Math.min(3, x.h) : ''}"></i>`).join('')}</div>`)
      .join('')
    const totalShare = d.share.reduce((a, x) => a + x.n, 0) || 1
    const bar = d.share.map((x) => `<span style="width:${((x.n / totalShare) * 100).toFixed(1)}%;background:${hueVar(x.it.hue)}"></span>`).join('')
    const legend = d.share
      .map((x) => `<span><i style="background:${hueVar(x.it.hue)}"></i>${esc(x.it.title)} <b>${x.n}</b></span>`)
      .join('')
    const big = (n, u, label) => `<div class="card sn"><div class="n">${n}<small>${u}</small></div><div class="l">${label}</div></div>`
    return `<div class="page">
      ${pageHead('数据')}
      <div class="sn-grid">
        ${big(d.total, '天', '一起走了')}
        ${big(d.active, '件', '正在记的事')}
        ${big(d.longest, '天', '最长的自动累计')}
        ${big(d.checkN, '天', '习惯打过卡')}
      </div>
      <div class="sec-title">最近 15 周 <small>${DM.fmt(d.startOff, 'md')} - ${DM.fmt(S.simDay, 'md')}</small></div>
      <div class="card hm">
        <div class="hm-m">${months}</div>
        <div class="hm-grid">${grid}</div>
        <div class="hm-lg"><span><i class="s"></i>坚持类</span><span><i class="h1"></i><i class="h2"></i><i class="h3"></i>习惯类</span></div>
        <div class="hm-note">坚持类自动涂满，习惯类按记录涂</div>
      </div>
      <div class="sec-title">时间都花在哪些事上</div>
      <div class="card sh"><div class="sh-bar">${bar}</div><div class="sh-lg">${legend}</div></div>
      <div class="card insight">
        <span class="pc">${creature('sprout', 3, 54, 'mint', 'happy')}</span>
        <p>自动累计的 <b>${d.sinceSum}</b> 天，你一次都没有打卡。<br><small>有些事不需要每天证明，它们就在那里，静静地长大。</small></p>
      </div>
      <div style="height:16px"></div>
    </div>`
  }

  // ================================================================ 5 · 农历

  // <lunar-core>
  // 1900–2100 农历表：低 4 位 = 闰月（0 无闰）；0x10000 = 闰月大小；0x8000..0x8 = 1–12 月大小（1 = 30 天）
  const LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x16a95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    0x0d520,
  ]
  const L_MIN = 1900
  const L_MAX = 2100
  const L_EPOCH = Date.UTC(1900, 0, 31) // 1900 正月初一
  const DAY_MS = 864e5
  const lLeap = (y) => LUNAR_INFO[y - L_MIN] & 0xf
  const lLeapDays = (y) => (lLeap(y) ? (LUNAR_INFO[y - L_MIN] & 0x10000 ? 30 : 29) : 0)
  const lMonthDays = (y, m) => (LUNAR_INFO[y - L_MIN] & (0x10000 >> m) ? 30 : 29)
  function lYearDays(y) {
    let n = 348
    for (let i = 0x8000; i > 0x8; i >>= 1) n += LUNAR_INFO[y - L_MIN] & i ? 1 : 0
    return n + lLeapDays(y)
  }
  const GAN = '甲乙丙丁戊己庚辛壬癸'
  const ZHI = '子丑寅卯辰巳午未申酉戌亥'
  const MN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
  const DN = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']
  const ganzhi = (y) => GAN[(y - 4) % 10] + ZHI[(y - 4) % 12]
  const monthName = (m, leap) => (leap ? '闰' : '') + MN[m - 1] + '月'

  /** 公历 → 农历（1900-01-31 ~ 2100-12-31）。返回 {y,m,d,leap,...名字} 或 null */
  function solarToLunar(y, m, d) {
    let off = Math.round((Date.UTC(y, m - 1, d) - L_EPOCH) / DAY_MS)
    if (!(off >= 0) || y > L_MAX) return null
    let ly = L_MIN
    while (ly <= L_MAX && off >= lYearDays(ly)) {
      off -= lYearDays(ly)
      ly++
    }
    if (ly > L_MAX) return null
    const lp = lLeap(ly)
    let isLeap = false
    let lm = 1
    for (; lm <= 12; lm++) {
      let md = lMonthDays(ly, lm)
      if (off < md) break
      off -= md
      if (lm === lp) {
        md = lLeapDays(ly)
        if (off < md) {
          isLeap = true
          break
        }
        off -= md
      }
    }
    return lunarFill({ y: ly, m: lm, d: off + 1, leap: isLeap })
  }
  function lunarFill(l) {
    l.gz = ganzhi(l.y)
    l.mName = monthName(l.m, l.leap)
    l.dName = DN[l.d - 1]
    l.name = `${l.gz}年${l.mName}${l.dName}`
    return l
  }
  /** 农历 → 公历 {y,m,d}；日期不存在（如小月三十、没有的闰月）返回 null */
  function lunarToSolar(y, m, d, leap) {
    if (y < L_MIN || y > L_MAX || m < 1 || m > 12) return null
    if (leap && lLeap(y) !== m) return null
    if (d < 1 || d > (leap ? lLeapDays(y) : lMonthDays(y, m))) return null
    let off = 0
    for (let i = L_MIN; i < y; i++) off += lYearDays(i)
    const lp = lLeap(y)
    for (let i = 1; i < m; i++) {
      off += lMonthDays(y, i)
      if (i === lp) off += lLeapDays(y)
    }
    if (leap) off += lMonthDays(y, m)
    off += d - 1
    const t = new Date(L_EPOCH + off * DAY_MS)
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
  }
  function lunarName(l, m, d, leap) {
    if (typeof l === 'number') l = { y: l, m, d, leap }
    return lunarFill({ y: l.y, m: l.m, d: l.d, leap: !!l.leap }).name
  }
  /** 从 from{y,m,d}（含当天）起，下一次农历 m 月 d 日（leap 月不存在则用平月，三十不存在则用二十九） */
  function nextOccurrence(m, d, leap, from) {
    const cur = solarToLunar(from.y, from.m, from.d)
    if (!cur) return null
    const fromMs = Date.UTC(from.y, from.m - 1, from.d)
    for (let ly = cur.y; ly <= Math.min(L_MAX, cur.y + 2); ly++) {
      let s = lunarToSolar(ly, m, d, leap)
      if (!s && leap) s = lunarToSolar(ly, m, d, false)
      if (!s && d === 30) s = lunarToSolar(ly, m, 29, false)
      if (!s) continue
      const ms = Date.UTC(s.y, s.m - 1, s.d)
      if (ms >= fromMs) return { y: s.y, m: s.m, d: s.d, lunarYear: ly, days: Math.round((ms - fromMs) / DAY_MS) }
    }
    return null
  }
  // </lunar-core>

  DM.lunar = { solarToLunar, lunarToSolar, lunarName, nextOccurrence, leapMonth: lLeap, monthDays: lMonthDays, ganzhi, DN, MN, monthName }

  const BASE = DM.BASE
  const baseMs = Date.UTC(BASE.getFullYear(), BASE.getMonth(), BASE.getDate())
  const offOf = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - baseMs) / DAY_MS)
  const ymdOf = (off) => {
    const t = new Date(baseMs + off * DAY_MS)
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
  }
  const solarDays = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
  const WK = '日一二三四五六'
  const wkOf = (y, m, d) => WK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const lunarOfOff = (off) => {
    const s = ymdOf(off)
    return solarToLunar(s.y, s.m, s.d)
  }

  function lunarState(it) {
    const s = ymdOf(it.date)
    const l = solarToLunar(s.y, s.m, s.d)
    return { type: 'lunar', id: it.id, mode: it.lunar ? 'lunar' : 'solar', sy: s.y, sm: s.m, sd: s.d, ly: l.y, lm: l.m, ld: l.d, lleap: l.leap, rep: !!it.lunar }
  }
  /** 以公历为准重算农历字段 */
  function syncFromSolar(o) {
    const l = solarToLunar(o.sy, o.sm, o.sd)
    if (l) Object.assign(o, { ly: l.y, lm: l.m, ld: l.d, lleap: l.leap })
  }
  function syncFromLunar(o) {
    const s = lunarToSolar(o.ly, o.lm, o.ld, o.lleap)
    if (s) Object.assign(o, { sy: s.y, sm: s.m, sd: s.d })
  }
  /** 实际落地的日期：按农历每年重复且已过去 → 取下一次 */
  function lunarTarget(o) {
    const todayY = ymdOf(S.simDay)
    const off = offOf(o.sy, o.sm, o.sd)
    if (o.rep && off < S.simDay) {
      const nx = nextOccurrence(o.lm, o.ld, o.lleap, todayY)
      if (nx) return { off: offOf(nx.y, nx.m, nx.d), y: nx.y, m: nx.m, d: nx.d, rolled: true }
    }
    return { off, y: o.sy, m: o.sm, d: o.sd, rolled: false }
  }

  const opt = (v, label, sel) => `<option value="${v}" ${sel ? 'selected' : ''}>${label}</option>`
  DM.OV.lunar = (o) => {
    const it = DM.it$(o.id)
    if (!it) return ''
    const isL = o.mode === 'lunar'
    const y0 = ymdOf(S.simDay).y
    const yMin = Math.min(y0 - 1, o.sy, o.ly)
    const yMax = Math.max(y0 + 12, o.sy, o.ly)
    const years = []
    for (let y = yMin; y <= yMax; y++) years.push(y)
    let selY, selM, selD
    if (isL) {
      selY = years.map((y) => opt(y, `${y} ${ganzhi(y)}年`, y === o.ly)).join('')
      const lp = lLeap(o.ly)
      const ms = []
      for (let m = 1; m <= 12; m++) {
        ms.push(opt(m, monthName(m, false), m === o.lm && !o.lleap))
        if (m === lp) ms.push(opt(m + '*', monthName(m, true), m === o.lm && o.lleap))
      }
      selM = ms.join('')
      const n = o.lleap ? lLeapDays(o.ly) : lMonthDays(o.ly, o.lm)
      selD = Array.from({ length: n }, (_, i) => opt(i + 1, DN[i], i + 1 === o.ld)).join('')
    } else {
      selY = years.map((y) => opt(y, `${y} 年`, y === o.sy)).join('')
      selM = Array.from({ length: 12 }, (_, i) => opt(i + 1, `${i + 1} 月`, i + 1 === o.sm)).join('')
      selD = Array.from({ length: solarDays(o.sy, o.sm) }, (_, i) => opt(i + 1, `${i + 1} 日`, i + 1 === o.sd)).join('')
    }
    const lun = solarToLunar(o.sy, o.sm, o.sd)
    const other = isL
      ? `公历 <b>${o.sy} 年 ${o.sm} 月 ${o.sd} 日 · 周${wkOf(o.sy, o.sm, o.sd)}</b>`
      : `农历 <b>${lun ? lun.name : '—'}</b>`
    const t = lunarTarget(o)
    const days = t.off - S.simDay
    let when
    if (days < 0) when = '这一天已经过去了，换一个日期吧'
    else if (days === 0) when = '就是今天'
    else when = `${t.rolled ? '下一次在 ' + t.y + ' 年 ' + t.m + ' 月 ' + t.d + ' 日，' : ''}还有 <b>${days}</b> 天`
    return `<div class="dim" data-act="close"></div>
      <div class="sheet lunar-sheet" style="${DM.hueStyle(it.hue)}">
        <div class="grab"></div>
        <div class="sheet-h"><h3>${esc(it.title)} · 哪一天？</h3>${X_BTN}</div>
        <p class="sheet-sub">生日、节日常常按农历过。选农历，它每年都会自己找到那一天。</p>
        <div class="seg lu-seg">
          <button class="${!isL ? 'is-on' : ''}" data-act="lunSet" data-k="mode" data-v="solar">公历</button>
          <button class="${isL ? 'is-on' : ''}" data-act="lunSet" data-k="mode" data-v="lunar">农历</button>
        </div>
        <div class="lu-pick card">
          <select data-lun="y" aria-label="年">${selY}</select>
          <select data-lun="m" aria-label="月">${selM}</select>
          <select data-lun="d" aria-label="日">${selD}</select>
        </div>
        <div class="lu-other">${other}</div>
        <div class="card list lu-rep">
          <div class="li"><span class="grow">每年按农历重复<small class="li-sub">闰月、三十号不存在的年份会自动顺延到最近的一天</small></span><button class="toggle ${o.rep ? 'on' : ''}" data-act="lunRepeat" aria-label="每年按农历重复"></button></div>
        </div>
        <div class="lu-when ${days < 0 ? 'past' : ''}">${when}</div>
        <button class="btn block" data-act="lunConfirm" ${days < 0 && !o.rep ? 'disabled style="opacity:.5"' : ''}>就这一天</button>
      </div>`
  }
  const X_BTN = `<button class="x" data-act="close" aria-label="关闭">${ICON.close}</button>`

  DM.OV_AFTER.lunar = (layer, o) => {
    layer.querySelectorAll('select[data-lun]').forEach((sel) => {
      sel.onchange = () => {
        const k = sel.dataset.lun
        const v = sel.value
        if (o.mode === 'solar') {
          if (k === 'y') o.sy = +v
          if (k === 'm') o.sm = +v
          if (k === 'd') o.sd = +v
          o.sd = Math.min(o.sd, solarDays(o.sy, o.sm))
          syncFromSolar(o)
        } else {
          if (k === 'y') {
            o.ly = +v
            if (o.lleap && lLeap(o.ly) !== o.lm) o.lleap = false
          }
          if (k === 'm') {
            o.lleap = String(v).endsWith('*')
            o.lm = parseInt(v, 10)
          }
          if (k === 'd') o.ld = +v
          o.ld = Math.min(o.ld, o.lleap ? lLeapDays(o.ly) : lMonthDays(o.ly, o.lm))
          syncFromLunar(o)
        }
        DM.sfx && DM.sfx('pop')
        DM.updateOv({})
      }
    })
  }

  Object.assign(DM.ACT, {
    openLunar(el) {
      const it = DM.it$(el.dataset.id)
      if (!it || it.type !== 'countdown') return
      DM.openOv(lunarState(it), { push: true })
    },
    lunSet(el) {
      const o = top()
      if (el.dataset.k === 'mode') {
        o.mode = el.dataset.v
        if (o.mode === 'lunar') o.rep = true
        syncFromSolar(o)
      }
      DM.updateOv({})
    },
    lunRepeat() {
      DM.updateOv({ rep: !top().rep })
    },
    lunConfirm() {
      const o = top()
      const it = DM.it$(o.id)
      if (!it) return
      const t = lunarTarget(o)
      if (t.off < S.simDay && !o.rep) return DM.toast('这一天过去啦，选一个之后的日子吧')
      it.date = t.off
      it.lunar = !!o.rep
      if (o.rep) {
        it.repeat = '每年（农历）'
        it.lm = o.lm
        it.ld = o.ld
        it.lleap = o.lleap
      } else if (it.repeat === '每年（农历）') it.repeat = '每年'
      DM.closeOv()
      DM.toast(o.rep ? `记住了 · 每年农历${monthName(o.lm, o.lleap)}${DN[o.ld - 1]}` : '日期改好了')
    },
  })

  // 倒数日：今天页的日期行带上农历；档案页的日期 / 重复 / 提醒三行变成可点
  const lunarSuffix = (html) => {
    const it = DM.focused()
    if (!it || it.type !== 'countdown' || !it.lunar) return html
    const l = lunarOfOff(it.date)
    if (!l) return html
    return html.replace(/(<div class="sc-sub">[^<]*?)( · 每年（农历）)/, `$1 · 农历${l.mName}${l.dName}$2`)
  }
  const wrapToday2 = DM.VIEWS.today
  DM.VIEWS.today = () => lunarSuffix(wrapToday2())

  const origDetail = DM.OV.detail
  DM.OV.detail = (o) => {
    let html = origDetail(o)
    const it = DM.it$(o.id)
    if (!html || !it) return html
    if (it.type === 'countdown') {
      const l = lunarOfOff(it.date)
      html = html
        .replace(/<div class="li"><span class="grow">日期<\/span><small>([^<]*)<\/small><\/div>/, `<button class="li" data-act="openLunar" data-id="${it.id}"><span class="grow">日期${l ? `<small class="li-sub">农历${l.mName}${l.dName}</small>` : ''}</span><small>$1</small><span class="chev">›</span></button>`)
        .replace(/<div class="li"><span class="grow">重复<\/span><small>([^<]*)<\/small><\/div>/, `<button class="li" data-act="openLunar" data-id="${it.id}"><span class="grow">重复</span><small>$1</small><span class="chev">›</span></button>`)
    }
    return html.replace(/<div class="li"><span class="grow">提醒<\/span><small>([^<]*)<\/small><\/div>/, `<button class="li" data-act="openReminder" data-id="${it.id}"><span class="grow">提醒</span><small>$1</small><span class="chev">›</span></button>`)
  }

  // ================================================================ 6 · 提醒编辑

  const CHANNELS = [
    { k: 'notify', n: '通知', pro: false, d: '横幅轻轻提醒' },
    { k: 'widget', n: '桌面小组件', pro: false, d: '看一眼就知道' },
    { k: 'live', n: '锁屏实时活动', pro: true, d: '状态挂在锁屏，不打断' },
    { k: 'island', n: '灵动岛', pro: true, d: '小伙伴住在岛里' },
    { k: 'alarm', n: '系统闹钟', pro: true, d: '像闹钟一样响，即便静音' },
  ]
  const pad2 = (n) => String(n).padStart(2, '0')

  function parseRemind(it) {
    const r = it.remind || ''
    const tm = r.match(/(\d{1,2}):(\d{2})/)
    const o = { type: 'reminder', id: it.id, hh: tm ? +tm[1] : 9, mm: tm ? +tm[2] : 0, days: [], before: 3, rep: it.type === 'countdown' ? 'before' : 'daily', ch: (it.channels || ['notify']).slice(), off: !it.remind }
    if (it.type === 'countdown') {
      const b = r.match(/提前\s*(\d+)/)
      o.before = b ? +b[1] : r.includes('当天') ? 0 : 3
    } else if (r.includes('工作日')) o.rep = 'weekday'
    else if (/周[一二三四五六日]/.test(r)) {
      o.rep = 'weekly'
      for (const c of r.replace(/\d{1,2}:\d{2}/, '')) {
        const i = WK.indexOf(c)
        if (i >= 0) o.days.push(i)
      }
    }
    if (o.rep === 'weekly' && !o.days.length) o.days = [2, 4, 6]
    return o
  }
  function remindText(o) {
    const t = `${pad2(o.hh)}:${pad2(o.mm)}`
    if (o.rep === 'before') return o.before ? `提前 ${o.before} 天 · ${t}` : `当天 · ${t}`
    if (o.rep === 'weekday') return `工作日 ${t}`
    if (o.rep === 'weekly') return `周${[...o.days].sort((a, b) => a - b).map((d) => WK[d]).join(' / ')} ${t}`
    return `每天 ${t}`
  }

  function previewOf(o, it) {
    const t = `${pad2(o.hh)}:${pad2(o.mm)}`
    const msg = it.type === 'countdown' ? (o.before ? `还有 ${o.before} 天` : '就是今天') : '来看看我吧'
    const av = `<span class="pv-av" style="${DM.hueStyle(it.hue)}">${DM.crOf(it, 26)}</span>`
    const m = {
      notify: `<div class="pv pv-n">${av}<span><b>${esc(it.title)}</b><small>${msg}</small></span><em>现在</em></div>`,
      widget: `<div class="pv pv-w" style="${DM.hueStyle(it.hue)}">${DM.crOf(it, 40)}<b>${esc(it.title)}</b><small>${msg}</small></div>`,
      live: `<div class="pv pv-l">${av}<span><b>${esc(it.title)}</b><small>锁屏 · ${t}</small></span><i class="bar"><u></u></i></div>`,
      island: `<div class="pv pv-i">${av}<b>${esc(it.title)}</b><small>${msg}</small></div>`,
      alarm: `<div class="pv pv-a"><b>${t}</b><small>${esc(it.title)} · 响铃（静音也会响）</small><u>稍后</u><u class="go">知道了</u></div>`,
    }
    const on = CHANNELS.filter((c) => o.ch.includes(c.k))
    if (!on.length) return '<div class="pv-empty">还没选提醒方式，小伙伴会安静地等你。</div>'
    return on.map((c) => `<div class="pv-box"><span class="pv-l">${c.n}</span>${m[c.k]}</div>`).join('')
  }

  DM.OV.reminder = (o) => {
    const it = DM.it$(o.id)
    if (!it) return ''
    const isCd = it.type === 'countdown'
    const hours = Array.from({ length: 24 }, (_, i) => opt(i, pad2(i), i === o.hh)).join('')
    const mins = Array.from({ length: 12 }, (_, i) => opt(i * 5, pad2(i * 5), i * 5 === o.mm)).join('')
    const repChips = isCd
      ? [0, 1, 3, 7].map((n) => `<button class="chip ${o.rep === 'before' && o.before === n ? 'is-on' : ''}" data-act="rmRep" data-v="before" data-n="${n}">${n ? `提前 ${n} 天` : '当天'}</button>`).join('')
      : [['daily', '每天'], ['weekday', '工作日'], ['weekly', '每周几']].map(([k, n]) => `<button class="chip ${o.rep === k ? 'is-on' : ''}" data-act="rmRep" data-v="${k}">${n}</button>`).join('')
    const wk = o.rep === 'weekly' ? `<div class="rm-wk">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="${o.days.includes(d) ? 'is-on' : ''}" data-act="rmDay" data-d="${d}">${WK[d]}</button>`).join('')}</div>` : ''
    const chans = CHANNELS.map(
      (c) => `<button class="rm-ch ${o.ch.includes(c.k) ? 'is-on' : ''}" data-act="rmCh" data-k="${c.k}"><b>${c.n}${c.pro ? '<span class="pro-tag">PRO</span>' : '<span class="free-tag">免费</span>'}</b><small>${c.d}</small><i class="ck">${ICON.check}</i></button>`
    ).join('')
    return `<div class="dim" data-act="close"></div>
      <div class="sheet" style="${DM.hueStyle(it.hue)}">
        <div class="grab"></div>
        <div class="sheet-h"><h3>${esc(it.title)} · 提醒</h3>${X_BTN}</div>
        <p class="sheet-sub">轻轻叫你一声就好，不会反复催。</p>
        <div class="lu-pick card rm-time"><select data-rm="hh" aria-label="时">${hours}</select><span class="colon">:</span><select data-rm="mm" aria-label="分">${mins}</select></div>
        <div class="sec-title" style="margin:14px 2px 8px">重复</div>
        <div class="rm-chips">${repChips}</div>${wk}
        <div class="sec-title" style="margin:16px 2px 8px">提醒方式 <small>免费的方式永远够用</small></div>
        <div class="rm-chs">${chans}</div>
        <div class="sec-title" style="margin:16px 2px 8px">到点时是这样 <small>预览</small></div>
        <div class="pv-strip">${previewOf(o, it)}</div>
        <div class="d-actions" style="margin:16px 0 0"><button class="btn ghost" data-act="rmClear">先不提醒</button><button class="btn" data-act="rmSave">保存</button></div>
      </div>`
  }
  DM.OV_AFTER.reminder = (layer, o) => {
    layer.querySelectorAll('select[data-rm]').forEach((sel) => {
      sel.onchange = () => DM.updateOv({ [sel.dataset.rm]: +sel.value })
    })
  }

  Object.assign(DM.ACT, {
    openReminder(el) {
      const it = DM.it$((el && el.dataset.id) || S.focusId)
      if (!it) return DM.toast('先添加一件事，再来设置提醒')
      DM.openOv(parseRemind(it), { push: true })
    },
    rmRep(el) {
      const patch = { rep: el.dataset.v }
      if (el.dataset.n != null) patch.before = +el.dataset.n
      if (patch.rep === 'weekly' && !top().days.length) patch.days = [2, 4, 6]
      DM.updateOv(patch)
    },
    rmDay(el) {
      const o = top()
      const d = +el.dataset.d
      const days = o.days.includes(d) ? o.days.filter((x) => x !== d) : [...o.days, d]
      DM.updateOv({ days: days.length ? days : o.days })
    },
    rmCh(el) {
      const o = top()
      const c = CHANNELS.find((x) => x.k === el.dataset.k)
      const has = o.ch.includes(c.k)
      if (c.pro && !has && !S.pro) return DM.pro.gate('widget')
      DM.updateOv({ ch: has ? o.ch.filter((x) => x !== c.k) : [...o.ch, c.k] })
    },
    rmClear() {
      const it = DM.it$(top().id)
      if (it) {
        it.remind = null
        it.channels = []
      }
      DM.closeOv()
      DM.toast('好的，不提醒了。想起来随时可以再开')
    },
    rmSave() {
      const o = top()
      const it = DM.it$(o.id)
      if (!it) return
      it.remind = remindText(o)
      it.channels = o.ch.slice()
      DM.closeOv()
      DM.toast(`${it.remind} · 到点轻轻叫你`)
    },
  })

  // ================================================================ 7 · 第一次完成之后

  const FD_TIMES = ['08:00', '12:30', '20:00', '22:30']
  DM.OV.firstDone = (o) => {
    const it = DM.it$(o.id) || DM.focused()
    if (!it) return ''
    const step = o.step || 1
    const dots = `<div class="fd-dots">${[1, 2, 3].map((i) => `<i class="${i === step ? 'on' : i < step ? 'ok' : ''}"></i>`).join('')}</div>`
    let body = ''
    if (step === 1) {
      body = `<div class="fd-pet"><span class="pc">${DM.crOf(it, 70, 'happy')}</span></div>
        <h3 class="fd-h">第一次记下啦</h3>
        <p class="fd-p">想让它离你近一点吗？放到桌面上，每次解锁屏幕都能看见它。</p>
        <div class="fd-home">
          <div class="fd-w" style="${DM.hueStyle(it.hue)}">${DM.crOf(it, 54)}<b>${esc(it.title)}</b><small>今天已记 ✓</small></div>
          <div class="fd-apps"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        </div>
        <p class="fd-hint">长按桌面空白处 → 左上角「+」→ 搜索「刻度」</p>
        <button class="btn block" data-act="fdNext">好，下一步</button>
        <button class="fd-skip" data-act="fdSkip">以后再说</button>`
    } else if (step === 2) {
      body = `<h3 class="fd-h">到点轻轻叫你</h3>
        <p class="fd-p">选一个你方便的时间。每天最多一次，不会催。</p>
        <div class="fd-times">${FD_TIMES.map((t) => `<button class="chip ${o.time === t ? 'is-on' : ''}" data-act="fdTime" data-t="${t}">${t}</button>`).join('')}</div>
        ${o.asking
          ? `<div class="fd-perm"><div class="fd-perm-b"><b>“刻度”想给你发送通知</b><p>通知可能包括提醒和声音。只会在你选的时间出现。</p></div><div class="fd-perm-a"><button data-act="fdDeny">不允许</button><button class="y" data-act="fdAllow">允许</button></div></div>`
          : `<button class="btn block" data-act="fdAsk">${o.time} 叫我</button>`}
        <button class="fd-skip" data-act="fdSkip">先不要</button>`
    } else {
      body = `<div class="fd-pet"><span class="pc">${DM.crOf(it, 84, 'happy')}</span></div>
        <h3 class="fd-h">都准备好了</h3>
        <p class="fd-p">${o.allowed ? `每天 ${o.time}，${SPN(it)}会轻轻叫你一声。` : '提醒先不开。想用的时候，在设置里随时可以打开。'}<br>现在，去过你的一天吧。</p>
        <button class="btn block" data-act="fdDone">回到今天</button>`
    }
    return `<div class="dim"></div><div class="sheet fd-sheet">
      <div class="grab"></div>${dots}${body}</div>`
  }
  const SPN = (it) => (it.type === 'countdown' ? '信信' : DM.SPECIES[it.species].name)

  Object.assign(DM.ACT, {
    fdNext() {
      DM.updateOv({ step: 2 })
    },
    fdSkip() {
      const o = top()
      if ((o.step || 1) === 1) DM.updateOv({ step: 2 })
      else DM.updateOv({ step: 3, allowed: false })
    },
    fdTime(el) {
      DM.updateOv({ time: el.dataset.t, asking: false })
    },
    fdAsk() {
      DM.updateOv({ asking: true })
    },
    fdDeny() {
      DM.updateOv({ asking: false, step: 3, allowed: false })
    },
    fdAllow() {
      const o = top()
      const it = DM.it$(o.id)
      if (it) {
        it.remind = `每天 ${o.time}`
        it.channels = ['notify', 'widget']
      }
      DM.updateOv({ asking: false, step: 3, allowed: true })
    },
    fdDone() {
      DM.closeAll()
      DM.refresh()
    },
  })

  // ================================================================ 8 · 演示台接线

  DM.lunar.state = lunarState
  DM.reminderState = parseRemind

  const demo = DM.demo
  if (demo && DM.FLOWS) {
    const plain = (fn) => () => {
      demo.ensureSeed()
      fn()
    }
    DM.FLOWS.push(
      {
        key: 'L',
        title: '会员与设置',
        steps: [
          { id: 'L1', label: '首次完成引导', run: plain(() => { demo.today('sleep'); S.ovs = [{ type: 'firstDone', id: 'sleep', step: 1, time: '20:00' }] }) },
          { id: 'L2', label: '订阅页 · Pro', run: plain(() => { demo.today('sleep'); S.pro = false; S.ovs = [{ type: 'settings' }, { type: 'paywall', source: 'pets', plan: 'year' }] }) },
          { id: 'L3', label: '设置', run: plain(() => { demo.today('sleep'); S.pro = false; S.ovs = [{ type: 'settings' }] }) },
          { id: 'L4', label: '数据统计', run: plain(() => { demo.today('sleep'); S.ovs = [{ type: 'stats' }] }) },
          { id: 'L5', label: '宠物包', run: plain(() => { demo.today('sleep'); S.pro = false; S.ovs = [{ type: 'settings' }, { type: 'petpack' }] }) },
        ],
      },
      {
        key: 'M',
        title: '日期与提醒',
        steps: [
          {
            id: 'M1',
            label: '农历选日期',
            run: plain(() => {
              demo.today('mom')
              const o = lunarState(demo.item('mom'))
              Object.assign(o, { mode: 'lunar', rep: true })
              S.ovs = [o]
            }),
          },
          { id: 'M2', label: '提醒编辑', run: plain(() => { demo.today('run'); S.ovs = [parseRemind(demo.item('run'))] }) },
          {
            id: 'M3',
            label: '倒数日带农历',
            run: plain(() => {
              const it = demo.item('mom')
              const l = lunarOfOff(it.date)
              Object.assign(it, { lunar: true, repeat: '每年（农历）', lm: l.m, ld: l.d, lleap: l.leap })
              demo.today('mom')
            }),
          },
        ],
      }
    )
  }

  DM.sceneHooks &&
    DM.sceneHooks.push(() => {
      const t = top()
      if (!t) return null
      if (t.type === 'paywall') return t.done ? 'paywall-done' : 'paywall'
      if (t.type === 'firstDone') return `firstDone-${t.step || 1}`
      return null
    })

  if (DM.NOTES) {
    Object.assign(DM.NOTES, {
      'firstDone-1': {
        k: 'L · 会员与设置',
        t: '第一次完成之后：先把它放到桌面',
        d: [1, 2],
        p: [
          '<b>在情绪最好的那一刻</b>引导，而不是启动时一口气问四五个权限。刚记下第一次，小伙伴还在开心，这时说「放到桌面」是顺手，不是任务。',
          '用一个迷你小组件预览代替文字说明——看见了才想要。',
          '每一步都有「以后再说」，跳过不会有任何惩罚，也不会再追着问。',
        ],
        try: '点「好，下一步」，或「以后再说」。',
      },
      'firstDone-2': {
        k: 'L · 会员与设置',
        t: '到点轻轻叫你：先选时间，再弹权限',
        d: [2, 4],
        p: [
          '先让用户选一个自己的时间，再出系统的通知授权框。授权被拒率最高的情况，就是不知道为什么要问。',
          '文案承诺「每天最多一次，不会催」，给出可预期的克制。',
          '选「先不要」也能顺利走完，提醒随时可在设置里打开。',
        ],
        try: '选个时间，点「叫我」，再点「允许」。',
      },
      'firstDone-3': {
        k: 'L · 会员与设置',
        t: '都准备好了：收尾要轻',
        d: [2],
        p: ['结尾一句「去过你的一天吧」——这是个陪伴工具，不需要把你留在 App 里。', '根据刚才的选择，说明提醒到底会怎么发生，不含糊。'],
        try: '点「回到今天」。',
      },
      paywall: {
        k: 'L · 会员与设置',
        t: '订阅页：Pro 卖情绪价值，不卖核心功能',
        d: [1, 2],
        p: [
          '先放<b>「永远免费」</b>清单，再放 Pro 清单，并且两个清单一样醒目。记录、倒数、成长、分享、导出都不收费——用户先确认「我不会被卡住」，才会心甘情愿加一点。',
          'Pro 卖的是陪伴感：更多宠物包、皮肤、锁屏/灵动岛/闹钟、iCloud、不限件数。',
          '<b>没有广告</b>，没有倒计时优惠、没有「仅剩 X 个名额」，也没有关不掉的按钮。',
          '参考「一万小时」的结构：免费下载、7 天试用、包年 + 买断，能力清单明确。不同的是，我们的免费清单更长。价格 ¥18 / ¥28 是原型示意。',
        ],
        try: '切换「连续包年 / 永久买断」，再点主按钮。',
      },
      'paywall-done': {
        k: 'L · 会员与设置',
        t: '开通之后：只说谢谢',
        d: [1, 2],
        p: ['撒花 + 一句谢谢，没有「现在去分享给好友」之类的追加要求。', '明确告诉用户怎么取消，让人放心开通。'],
        try: '点「好的」，回到设置看 Pro 卡片的变化。',
      },
      settings: {
        k: 'L · 会员与设置',
        t: '设置：一张深色 Pro 卡，其余都很平静',
        d: [2, 4],
        p: [
          '顶部一张深色的 Pro 卡（四套皮肤里都保持深色，一眼能找到），其余是分组列表，没有红点、没有未读数。',
          '「数据只在本机，永不上传」直接写在同步旁边——隐私承诺放在用户做决定的地方。',
          'iCloud 同步、灵动岛、锁屏、闹钟标 PRO；点到时才弹订阅页，而不是常驻横幅。',
          '「桌面宠物」开关放在设置里，不喜欢随时收起。',
        ],
        try: '点 iCloud 同步（会弹订阅页），或「宠物包」。',
      },
      petpack: {
        k: 'L · 会员与设置',
        t: '宠物包：免费的先摆前面，Pro 的写「敬请期待」',
        d: [1, 2],
        p: ['免费包（默认麻糬、本地导入）排前面，用户一开始就有得选。', 'Pro 包用灰度预览，写明「敬请期待」——不假装已经做好、不制造焦虑。', '换包不影响任何记录，只换外观。'],
        try: '点一个灰色的 Pro 包。',
      },
      stats: {
        k: 'L · 会员与设置',
        t: '数据：自动累计的坚持，单独涂一种颜色',
        d: [1, 2],
        p: [
          '从今天页右上角进入，参考「一万小时」的数据面板。',
          '坚持类（戒烟、在一起）<b>自动累计</b>，不需要打卡，所以热力图里是连续铺满的另一种颜色；习惯类按记录涂。两种来源分开表达，不会让人觉得「没打卡 = 白过了」。',
          '底部洞察卡把「自动累计的 N 天，你一次都没有打卡」说出来——这是对用户最温柔的肯定。',
          '没有连续天数排行、没有「你已经断了 N 天」。',
        ],
        try: '看热力图图例，再看最下面的小卡片。',
      },
      lunar: {
        k: 'M · 日期与提醒',
        t: '农历选日期：生日和节日每年自己找到那一天',
        d: [2, 4],
        p: [
          '公历 / 农历一键切换，选一边，另一边实时换算，所见即所得。',
          '支持闰月（如闰六月），农历三十号不存在的年份自动顺延到最近的一天。',
          '「每年按农历重复」是核心：妈妈的生日不会每年漂移，也不用自己查日历。',
          '底部直接说「还有 N 天」，已经过去的日期用平静的语气请你换一个。',
        ],
        try: '在「公历 / 农历」间切换，把月份改成「闰」月试试。',
      },
      reminder: {
        k: 'M · 日期与提醒',
        t: '提醒编辑：免费的提醒方式永远够用',
        d: [2, 4],
        p: [
          '时间、重复、方式三件事；底部<b>实时预览</b>到点时长什么样，选了什么就看到什么。',
          '免费：通知、桌面小组件。Pro：锁屏实时活动、灵动岛、系统闹钟（「像闹钟一样响，即便静音」）。',
          '点 Pro 方式时才弹订阅页；不选也完全不影响提醒功能。',
          '「先不提醒」是一个正常的选项，不是逃避。',
        ],
        try: '点「系统闹钟」，看订阅页如何被唤起。',
      },
    })
  }
})()

