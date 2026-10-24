/*
 * 演示台：左边按流程跳转，右边跟着当前这一屏给出设计说明。
 * 只读写 DM.S 与 DM 暴露的动作，不碰手机内部的渲染。
 */
;(function () {
  'use strict'
  const DM = window.DM
  const S = DM.S
  const $ = (s) => document.querySelector(s)

  // ---------------------------------------------------------------- 方向标签

  const DIRS = {
    1: ['d1', '①游戏化 · 情绪价值'],
    2: ['d2', '②中性萌系 · 亲和力'],
    3: ['d3', '③风格包 · 主题'],
    4: ['d4', '④注意力聚焦'],
  }

  // ---------------------------------------------------------------- 状态工具

  /** 重新播种演示数据，保留当前的风格包与自定义 */
  function reseed(kind = 'seed') {
    const keep = { theme: S.theme, num: S.num, texture: S.texture, accent: S.accent, sound: S.sound, haptic: S.haptic }
    DM.replaceState(kind === 'fresh' ? DM.fresh() : DM.seed())
    Object.assign(S, keep)
  }
  const ensureSeed = () => S.kind !== 'seed' && reseed()
  const today = (focusId, extra = {}) => Object.assign(S, { tab: 'today', focusId, ovs: [], guide: null, bubble: null }, extra)
  const item = (id) => DM.it$(id)

  // ---------------------------------------------------------------- 流程

  const FLOWS = [
    {
      key: 'A',
      title: '首次见面',
      steps: [
        { id: 'A1', label: '欢迎页', run: () => reseed('fresh') },
        { id: 'A2', label: '想记点什么', run: () => { reseed('fresh'); S.ovs = [{ type: 'add', step: 1, draft: {} }] } },
        { id: 'A3', label: '选一颗蛋', run: () => { reseed('fresh'); S.ovs = [{ type: 'add', step: 3, draft: draftA() }] } },
        { id: 'A4', label: '孵化', run: () => { reseed('fresh'); S.ovs = [{ type: 'hatch', draft: draftA(), taps: 0, born: false }] } },
      ],
    },
    {
      key: 'B',
      title: '每天的小循环',
      steps: [
        { id: 'B1', label: '焦点舞台 · 早睡', run: () => { ensureSeed(); today('sleep') } },
        { id: 'B2', label: '按住记一下 → 长大', run: () => { reseed(); today('sleep', { guide: 'hold' }) } },
        {
          id: 'B3',
          label: '进化过场（直接看）',
          run: () => {
            reseed()
            const it = item('sleep')
            Object.assign(it, { growth: 7, todayCount: 1, lastDay: 0, streak: 7 })
            it.log.push(0)
            today('sleep')
            S.ovs = [{ type: 'evolve', id: 'sleep', from: 1, to: 2 }]
          },
        },
        { id: 'B4', label: '一天多次 · 喝水', run: () => { ensureSeed(); today('water', { guide: 'hold' }) } },
      ],
    },
    {
      key: 'C',
      title: '注意力聚焦',
      steps: [
        { id: 'C1', label: '切换面板', run: () => { ensureSeed(); today(S.focusId && item(S.focusId) ? S.focusId : 'sleep'); S.ovs = [{ type: 'switcher' }] } },
        { id: 'C2', label: '左右滑换焦点', run: () => { ensureSeed(); today('smoke', { guide: 'swipe' }) } },
      ],
    },
    {
      key: 'D',
      title: '记事提醒',
      steps: [
        { id: 'D1', label: '倒数 + 备忘 · 妈妈生日', run: () => { ensureSeed(); today('mom') } },
        { id: 'D2', label: '到了那一天', run: () => { reseed(); item('mom').date = S.simDay; today('mom') } },
      ],
    },
    {
      key: 'E',
      title: '被看见与惊喜',
      steps: [
        { id: 'E1', label: '休息后回来 · 跑步', run: () => { reseed(); today('run', { guide: 'hold' }) } },
        { id: 'E2', label: '小纸条', run: () => { ensureSeed(); today(S.focusId || 'sleep'); S.ovs = [{ type: 'note' }] } },
        { id: 'E3', label: '万圣节彩蛋', run: () => { ensureSeed(); today('smoke', { halloween: true }); S.ovs = [{ type: 'note' }] } },
      ],
    },
    {
      key: 'F',
      title: '告别与藏馆',
      steps: [
        { id: 'F1', label: '档案页 · 戒烟', run: () => { ensureSeed(); today('smoke'); S.ovs = [{ type: 'detail', id: 'smoke' }] } },
        { id: 'F2', label: '结束一章 · 告别仪式', run: () => { reseed(); today('smoke'); S.ovs = [{ type: 'farewell', id: 'smoke', step: 'ask', mode: 'chapter', line: '' }] } },
        { id: 'F3', label: '藏馆 · 书架', run: () => museum('chapters') },
        { id: 'F4', label: '图鉴', run: () => museum('dex') },
        { id: 'F5', label: '徽章与纸条', run: () => museum('badges') },
      ],
    },
    {
      key: 'G',
      title: '风格包',
      steps: [
        { id: 'G1', label: '画廊横滑预览', run: () => { ensureSeed(); Object.assign(S, { tab: 'dress', ovs: [] }) }, after: () => scrollView(0) },
        { id: 'G2', label: '自定义令牌', run: () => { ensureSeed(); Object.assign(S, { tab: 'dress', ovs: [] }) }, after: () => scrollView('custom') },
      ],
    },
    {
      key: 'H',
      title: '相片与分享',
      steps: [
        { id: 'H1', label: '相片背景 · 在一起', run: () => { ensureSeed(); today('love') } },
        { id: 'H2', label: '分享卡片', run: () => { ensureSeed(); today('smoke'); S.ovs = [{ type: 'share', id: 'smoke', tpl: 'sticker', li: 0 }] } },
      ],
    },
  ]
  const STEPS = FLOWS.flatMap((f) => f.steps)

  function draftA() {
    return { type: 'habit', title: '早睡', cadence: 'daily', target: 1, remind: '晚上 22:30', species: 'moon', hue: 'grape' }
  }
  function museum(tab) {
    ensureSeed()
    Object.assign(S, { tab: 'museum', museumTab: tab, ovs: [] })
  }
  /** G2：把「自定义」那一段滚进视野 */
  function scrollView(target) {
    const view = $('#view')
    if (!view) return
    if (target === 0) return (view.scrollTop = 0)
    const el = view.querySelector('[data-section="custom"], .opt, .sec-title')
    const titles = Array.from(view.querySelectorAll('.sec-title'))
    const custom = titles.find((t) => /自定义/.test(t.textContent)) || el
    if (custom) view.scrollTop = Math.max(0, custom.offsetTop - 70)
    else view.scrollTop = 420
  }

  function go(id) {
    const step = STEPS.find((s) => s.id === id)
    if (!step) return
    // 彩蛋只属于 E3，别带到其他流程里
    S.halloween = false
    step.run()
    S.step = id
    const view = $('#view')
    if (view) view.scrollTop = 0
    $('#toastL').innerHTML = ''
    DM.render()
    if (step.after) requestAnimationFrame(() => requestAnimationFrame(step.after))
  }

  // ---------------------------------------------------------------- 场景识别

  function scene() {
    const top = S.ovs[S.ovs.length - 1]
    if (top) {
      if (top.type === 'add') return `add-${top.step || 1}`
      if (top.type === 'farewell') return `farewell-${top.step || 'ask'}`
      return top.type
    }
    if (!S.onboarded) return 'welcome'
    if (S.tab === 'museum') return `museum-${S.museumTab || 'chapters'}`
    if (S.tab === 'dress') return 'dress'
    const it = DM.focused()
    if (!it) return 'empty'
    if (it.type === 'countdown') return DM.left(it) === 0 ? 'dayof' : 'countdown'
    if (it.type === 'since') return it.photo ? 'photo' : 'since'
    if (DM.sleeping(it)) return 'sleeping'
    return it.target > 1 || it.cadence === 'weekly' ? 'habit-multi' : 'habit'
  }

  // ---------------------------------------------------------------- 设计说明

  const NOTES = {
    welcome: {
      k: 'A · 首次见面',
      t: '欢迎页：先给一颗蛋，而不是一张表单',
      d: [1, 2],
      p: [
        '第一屏只有一件事：<b>带一颗蛋回家</b>。现在的 App 首屏是空列表 + 「记录第一个日子」，是工具的开场；这里把「新建」包装成「领养」，从第一秒就进入养成的叙事。',
        '画面主角是会晃动的蛋和环绕的小伙伴剪影，文案只讲产品承诺：<b>一次只看一件，慢慢来</b>。',
        '「我先看看」直接进入演示数据，不强迫用户先建东西。',
        '萌系落点是圆胖造型 + 粗描边 + 暖底色，不用粉色作主色，男女都不排斥。',
      ],
      try: '点「带一颗蛋回家」，走一遍新建 → 选蛋 → 孵化。',
    },
    'add-1': {
      k: 'A · 首次见面',
      t: '想记点什么：三类事统一成「一件事」',
      d: [4, 2],
      p: [
        '现有三页（走过的日子 / 等待的日子 / 积累的日子）在新建入口里收拢成三张卡：<b>坚持一件事 / 养成一个习惯 / 等一个日子</b>，节日是「等一个日子」的快捷入口。',
        '入口用用户语言描述「这是什么样的事」，而不是「正数日 / 倒数日 / 打卡」这类功能名。',
        '三类事在库里仍然分开，但在首页同一个焦点舞台上呈现，规则一致：<b>一件事 = 一个小伙伴</b>。',
      ],
      try: '选「养成一个习惯」，再挑一个预设名字。',
    },
    'add-2': {
      k: 'A · 首次见面',
      t: '起名字与基础设置：一屏写完，默认值够用',
      d: [2, 1],
      p: [
        '预设名字是一排胶囊，点一下就填好；自定义名字照样可写。',
        '只问对这类事真正必要的参数：习惯问频率和次数，坚持问从哪天开始，倒数问日期、重复与提前多久提醒。',
        '<b>相片背景</b>在这里可选（演示为占位图）。落地时走 IndexedDB 存储、上传后压缩，localStorage 放不下图。',
        '提醒是「记事提醒」定位的工具底线，清晰可设，不藏在二级页。',
      ],
      try: '点一个预设名，选好频率，下一步。',
    },
    'add-3': {
      k: 'A · 首次见面',
      t: '选一颗蛋：给这件事一个会长大的东西',
      d: [1, 2],
      p: [
        '每颗蛋对应一个物种：芽芽（坚持）、眠眠（夜晚）、咕噜（一天多次）、跑跑（运动），倒数日是信使「信信」。会按事情类型<b>预选一颗推荐的</b>，用户也可以换。',
        '这是方向文档「养成角色」的入口：每件坚持的事都有一个会长大的东西，情绪变得看得见。',
        '物种只决定头饰和气质，颜色走风格包令牌，换皮肤不用重画。',
      ],
      try: '左右点不同的蛋，看介绍变化，再点「就它了」。',
    },
    hatch: {
      k: 'A · 首次见面',
      t: '孵化：一次只发生一次的仪式',
      d: [1, 2],
      p: [
        '轻点三下蛋壳裂开，小伙伴出来自我介绍。这是整个 App 里<b>最有游戏感的 10 秒</b>，但只在新建时出现一次，属于低频节点。',
        '刚孵出来是「壳宝宝」形态（头顶还顶着蛋壳），成长 3 / 7 / 30 / 100 天各换一次样子。',
        '孵化完直接把焦点切到这件新事上，回到首页就是它。',
      ],
      try: '连点蛋三下。',
    },
    habit: {
      k: 'B · 每天的小循环',
      t: '焦点舞台：一次只强调一件事',
      d: [4, 1, 2],
      p: [
        '首页不再是列表，而是<b>一张舞台卡</b>：小伙伴、一句话、大数字、成长条、一个主按钮。其他的事安静地待在右上角的头像堆和底部圆点里。',
        '核心循环补上了「回头看的理由」：按住 → 蓄满 → 数字 +1 → <b>小伙伴回应一句话 + 成长条往前走</b>。现在的 App 循环到「特效」就断了。',
        '动效节点控制在 3 个以内（蓄力环、跳一下 + 粒子、数字翻牌），沿用项目的真机教训；更大的庆祝只给里程碑。',
        '数字展示的是<b>累计</b>（早睡了 6 晚），不展示会被清零的连续天数，避免把打卡变成 KPI。',
        '对话气泡的文案具体、非功能性：「今晚早点睡吧，眠眠已经在打哈欠了」，而不是「按住卡片记一次」。',
      ],
      try: '按住小伙伴或下方按钮半秒；中途松手不算。早睡差 1 天长大。',
    },
    'habit-multi': {
      k: 'B · 每天的小循环',
      t: '一天多次 / 每周几次：进度看得见，不施压',
      d: [1, 4],
      p: [
        '喝水这类事每按一次 +1 杯，杯子一格格灌满；每周几次的事显示「本周 1/3」。',
        '一天里第一次记录才算一天的成长，多记只是多一句回应，不会让成长「刷」起来。',
        '达到目标后小伙伴开心，但没达到也没有红色、没有警告：「还差 5 杯也没关系」。',
        '撤销放在吐司里，和现有 App 的习惯一致。',
      ],
      try: '连续按住几次，看杯子灌满和气泡变化。',
    },
    sleeping: {
      k: 'E · 被看见与惊喜',
      t: '休息后回来：不惩罚，只是睡着了',
      d: [1, 2],
      p: [
        '好几天没记，小伙伴<b>睡着了</b>（闭眼 + Zzz），成长条显示「暂停生长 · 等你回来」。没有红色、没有「断签」字样。',
        '方向文档要求「断了不退化，只是停止生长」。原型的解读是：形态由<b>累计成长天数</b>决定，所以休息不会让它变小（这一条待 PM 确认，见计划文档）。',
        '回来记一次，小伙伴醒来说「你回来啦！它没有变小，只是睡了一会儿」，并解锁徽章「回来了」——<b>回来本身被当成值得庆祝的事</b>。',
      ],
      try: '按住按钮叫醒跑跑，留意徽章弹窗。',
    },
    since: {
      k: 'B · 每天的小循环',
      t: '坚持天数：自己会长，打开就有变化',
      d: [1, 4],
      p: [
        '戒烟这类「正数日」不需要每天操作，天数自动走；小伙伴按成长天数换形态，所以<b>打开 App 本身就是回头看</b>。',
        '这是第 2 章：第 1 章（23 天）已收进藏馆。成长天数 = 所有章节相加，重置不会让芽芽变小。',
        '没有主操作时给「摸摸它」：轻点小伙伴会跳一下、换一句话，第 7 次有彩蛋——低频、不可预测的小惊喜。',
        '大数字配辅助刻度「4 个月 6 天」，沿用现有 App 的自然月算法。',
      ],
      try: '轻点小伙伴几下；或在右侧「快进一天」。',
    },
    photo: {
      k: 'H · 相片与分享',
      t: '相片背景：这一件很重要',
      d: [1, 3],
      p: [
        '用户可以为某件事上传相片作背景（这里用占位插画）。相片承载的是「这件事对我很重要」的情绪。',
        '可读性处理：<b>上半部分清晰</b>，文字区域用渐变遮罩 + 局部模糊，避免亮图压字；按钮与成长条切到半透明玻璃材质。',
        '落地：IndexedDB 存原图的压缩版本（长边 ~1600px、JPEG/WebP），卡片只存引用 id；分享卡片复用同一张图。',
      ],
      try: '点「分享这一天」，选「相片」模板。',
    },
    countdown: {
      k: 'D · 记事提醒',
      t: '倒数 + 提醒 + 备忘：工具底色要清楚',
      d: [4, 2],
      p: [
        '倒数日由信使「信信」陪着：远时拿着信，7 天内换成礼物盒，到了当天戴派对帽。小伙伴不养成，只表达「快到了」。',
        '提醒规则直接摆在卡片上（提前 3 天 · 09:00），备忘和待办勾选在舞台里就能完成，不必进二级页。',
        '这是「记事提醒类工具」定位的落点：萌只是外衣，信息与操作仍然一眼可用。',
        '节日（如万圣节）走同一套卡片，沿用现有 App 的节日规则与农历离线表。',
      ],
      try: '勾一下备忘里的待办；或在右侧点「生日到了」。',
    },
    dayof: {
      k: 'D · 记事提醒',
      t: '到了那一天：给一次小庆祝',
      d: [1],
      p: [
        '当天卡片撒彩纸，数字换成「就是今天」，信信戴上派对帽。',
        '「说过了，明年见」把这一次收进藏馆（例如「妈妈生日 · 2026」），每年重复的日子会自动排到明年，并解锁徽章「生日快乐」。',
        '等待的日子过去了不是一条 toast，而是一页可以翻回来的记录。',
      ],
      try: '点「说过了，明年见」。',
    },
    switcher: {
      k: 'C · 注意力聚焦',
      t: '切换注意力：库里很多件，台上只有一件',
      d: [4],
      p: [
        '方向文档：<b>聚焦的是当前展示，不是数据</b>。这里按「坚持 / 习惯 / 等待的日子」列出全部事情，点一下就换到舞台上。',
        '「今天还没记」用一个柔和的黄点提示，不用红点、不用数字角标，不制造未读焦虑。',
        '新建入口也放在这里，和「换一件看」是同一种心智。',
      ],
      try: '点任意一行切换焦点。',
    },
    evolve: {
      k: 'B · 每天的小循环',
      t: '进化过场：只挂在低频节点',
      d: [1, 2],
      p: [
        '成长跨过 3 / 7 / 30 / 100 天时播一段约 1.8 秒的过场：光芒、白色剪影闪烁、新形态弹出，配一句话和收集提示（图鉴 +1、徽章）。',
        '<b>右上角随时可以跳过</b>，跳过直接看到结果。',
        '方向文档的规则：过场只挂在里程碑、章节结束这类低频节点；日常打卡仍是 3 个动效节点封顶。',
        '自动生长的事（戒烟）跨过门槛时，下次打开 App 补播——这就是「回头看的理由」。',
      ],
      try: '点「跳过」或等它播完，再「收下」。',
    },
    detail: {
      k: 'F · 告别与藏馆',
      t: '档案页：成长之路、这一章、过去的章节',
      d: [1, 4],
      p: [
        '「成长之路」把 5 个形态摆成一条路：已解锁的有颜色，未解锁的是剪影 + 门槛天数，<b>下一个目标看得见</b>。',
        '「这一章」是当前的这一轮；「过去的章节」复用现有 App 的重置归档（DayEvent.history），点开是一页书。',
        '设置（提醒、相片背景、颜色）都在这里，舞台上只保留最常用的。',
        '「结束这一章」与「让它去旅行（删除）」都会进入告别仪式，而不是一条 toast。',
      ],
      try: '点「结束这一章」。',
    },
    'farewell-ask': {
      k: 'F · 告别与藏馆',
      t: '结束之前：说清楚会发生什么',
      d: [1],
      p: [
        '先解释后果：这一章会被收进藏馆，<b>小伙伴不会变小</b>，下一章从今天重新数。',
        '现有 App 的「设为今天」重置只有一条「上一轮 N 天记进历史了」的提示；这里把它升级成一个有仪式感的选择。',
        '删除被说成「让它去旅行」，同样保留最后一章在藏馆，并可撤销。',
      ],
      try: '选「结束这一章」。',
    },
    'farewell-rite': {
      k: 'F · 告别与藏馆',
      t: '告别仪式：给这一章留一句话',
      d: [1],
      p: [
        '暗场、小伙伴挥手、大数字和起止日期——方向文档里的「结束的仪式」：一轮结束时给一次告别。',
        '可以给这一章留一句话（可不写），有几条现成的句子可点。这句话会印在藏馆的书页上。',
        '整个仪式可以随时返回，不强迫。',
      ],
      try: '点一句建议，再「合上这一章」。',
    },
    'farewell-done': {
      k: 'F · 告别与藏馆',
      t: '合上：书飞进藏馆',
      d: [1],
      p: [
        '书合上、飞向底部的「藏馆」入口，告诉用户它去了哪里。',
        '接着给两个出口：去藏馆看看，或开始下一章。',
        '章节号自动 +1，舞台上的标签会变成「坚持 · 第 3 章」。',
      ],
      try: '点「去藏馆看看」，新书在书架最前面。',
    },
    'museum-chapters': {
      k: 'F · 告别与藏馆',
      t: '藏馆 · 书架：历史是一个可以翻的过去',
      d: [1, 2],
      p: [
        '一轮坚持 = 一本书。书脊的厚薄由天数决定，颜色跟着小伙伴；去旅行的事书脊上有个小飞机。',
        '方向文档：「历史不该只是一列数字，而是一个可以翻的过去」，数据直接复用现有的 streak 归档。',
        '顶部是年度回顾（12 月 31 日开启）——低频、可期待的收集物。',
        '藏馆没有排行榜、没有和别人比，只有自己的过去。',
      ],
      try: '点一本书翻开，左右翻页。',
    },
    'museum-dex': {
      k: 'F · 告别与藏馆',
      t: '图鉴：收集是皮肤体系的配重',
      d: [1, 2],
      p: [
        '每个物种 5 个形态，已遇见的有颜色，没遇见的是剪影 + 解锁提示（成长 30 天）。',
        '特别篇放节日限定形态（如南瓜帽），只在那一天出现——惊喜要低频、不可预测。',
        '图鉴只统计「遇见过」，不会因为休息或删除而减少。',
      ],
      try: '回到「今天」把早睡养到 7 天，回来看新点亮的格子。',
    },
    'museum-badges': {
      k: 'F · 告别与藏馆',
      t: '徽章：奖励行为，不奖励连胜',
      d: [1],
      p: [
        '徽章覆盖里程碑（7 / 30 / 100 / 365 天）、行为（回来了、翻篇、晒一晒）、时刻（夜猫子、早起鸟）和隐藏款（???）。',
        '刻意没有「连续 N 天不断」这类徽章：<b>回来了</b>反而是一枚徽章。',
        '隐藏款只露出问号，制造好奇，不给攻略。',
      ],
      try: '切到「纸条」看小伙伴写过的话。',
    },
    'museum-notes': {
      k: 'F · 告别与藏馆',
      t: '小纸条：被看见的另一种形式',
      d: [1, 2],
      p: [
        '小伙伴偶尔会递来一张纸条，收下后贴在这里，像一本手账。',
        '纸条内容是具体的、非功能性的句子（「下雨天也算数的」），是文案方向最直接的落点。',
        '总量有限（例如 50 张），慢慢攒，是一个长期的「回头看的理由」。',
      ],
      try: '右侧「来一张小纸条」，收下后回来看。',
    },
    chapter: {
      k: 'F · 告别与藏馆',
      t: '翻开一章：拍立得 + 天数 + 那句话',
      d: [1],
      p: [
        '每一页有小伙伴当时的样子（拍立得）、坚持天数、起止日期，以及结束时留下的那句话。',
        '左右翻页浏览所有章节，像翻相册。',
        '这一页也是分享卡片的素材来源。',
      ],
      try: '点「下一本 ›」翻页。',
    },
    dress: {
      k: 'G · 风格包',
      t: '装扮：同一套信息，换一整套皮肤',
      d: [3, 2],
      p: [
        '画廊里每张卡是<b>真实首页的实时缩略</b>，横向滑动预览，松手即应用——方向文档要求的「能看见多套皮肤并快速对比」。',
        '4 套首发示例覆盖不同审美：软糖（默认，可爱卡通）、纸本（安静极简）、夜航（深色微光）、像素（复古游戏）。不是只服务「可爱」一种人格。',
        '皮肤接口 = 一份令牌：色彩、圆角、描边粗细、字体（含数字字体）、卡片材质与投影、背景纹理、小伙伴描边、动效曲线（像素包用阶跃曲线）。组件一行不改。',
        '大数字在每个皮肤里单独设计（圆胖 + 彩色投影 / 衬线斜体 / 发光 / 像素硬投影），回应「可爱风会削弱大数字仪式感」的风险。',
        '自定义区可以覆盖主色、数字字体、背景纹理，只作用于当前皮肤。',
      ],
      try: '横滑画廊，松手看整台手机换装；再往下改数字字体。',
    },
    share: {
      k: 'H · 相片与分享',
      t: '分享卡片：这类产品最重要的传播单元',
      d: [1, 3],
      p: [
        '三种模板：贴纸（皮肤底色 + 小伙伴）、相片（用户相片 + 遮罩）、票根（第 N 天的入场券）。',
        '卡片 = 背景 + 数字 + 一句话，「换一句」可以在文案库里换。',
        '卡片跟着当前风格包变化，所以皮肤也是分享物的一部分。第一次分享解锁「晒一晒」徽章。',
      ],
      try: '切换模板，点「换一句」，再「保存到相册」。',
    },
    note: {
      k: 'E · 被看见与惊喜',
      t: '小纸条：低频、不可预测的小惊喜',
      d: [1, 2],
      p: [
        '某天打开时，小伙伴手里多了一张纸条。频率要低（例如每周最多一两次），时机不固定，才算惊喜。',
        '收下后进入藏馆的「纸条」，成为收集的一部分。',
        '节日当天（万圣节）纸条和小伙伴的装扮都会变——方向文档里的「某个节日的隐藏动画」。',
      ],
      try: '点「收进藏馆」。',
    },
    badge: {
      k: 'E · 被看见与惊喜',
      t: '解锁徽章：盖章的那一下',
      d: [1],
      p: [
        '徽章以「盖章」动效落下，配一句为什么得到它。',
        '弹窗只在真正解锁时出现一次，之后在藏馆里安静地待着。',
        '这里的徽章奖励的是行为本身（回来了、陪一个日子走到那天），而不是不间断。',
      ],
      try: '点「收下」。',
    },
    empty: {
      k: 'A · 首次见面',
      t: '空态：这里还空着',
      d: [2],
      p: ['空态不是一句「还没有记录」，而是邀请：「要不要带一颗蛋回家？」', '只给一个按钮，直达新建。'],
      try: '点按钮新建第一件事。',
    },
  }

  // ---------------------------------------------------------------- 渲染

  const BRAND_MARK = `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M11 3.5C15.6 3.5 18 7 18 11c0 4.2-3.2 7-7 7s-7-2.8-7-7c0-4 2.4-7.5 7-7.5Z" fill="#ffd45c" stroke="#fff" stroke-width="1.6"/><circle cx="8.6" cy="11" r="1.2" fill="#2b2638"/><circle cx="13.4" cy="11" r="1.2" fill="#2b2638"/><path d="M9.6 13.6q1.4 1 2.8 0" stroke="#2b2638" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`

  function renderFlows() {
    const el = $('#flows')
    if (!el) return
    el.innerHTML = `
      <div class="brand"><div class="brand-mark">${BRAND_MARK}</div><h1>刻度 Daymark · 原型 v2<small>焦点 · 养成 · 藏馆 · 风格包</small></h1></div>
      <p class="flows-intro">左边按流程跳转，右边是这一屏的设计说明；手机里的一切都能直接点、按、滑。</p>
      ${FLOWS.map(
        (f) => `<div class="flow"><h3><b>${f.key}</b>${f.title}</h3>${f.steps
          .map((s) => `<button class="step ${S.step === s.id ? 'is-on' : ''}" data-go="${s.id}"><i>${s.id}</i><span>${s.label}</span></button>`)
          .join('')}</div>`,
      ).join('')}
      <button class="reset" data-go="reset">重置演示数据</button>
      <p class="flows-foot">一个 HTML 原型，零依赖、不联网也能跑（字体除外）。手机打开即 App 本体。</p>`
  }

  function renderNotes() {
    const el = $('#notes')
    if (!el) return
    const key = scene()
    const n = NOTES[key] || NOTES.habit
    const themes = DM.THEMES.map((t) => `<button data-theme-btn="${t.id}" class="${S.theme === t.id ? 'is-on' : ''}">${t.name}</button>`).join('')
    el.innerHTML = `
      <div class="kicker">${n.k}</div>
      <h2>${n.t}</h2>
      <div class="dirs">${n.d.map((d) => `<span class="dir ${DIRS[d][0]}">${DIRS[d][1]}</span>`).join('')}</div>
      <ul>${n.p.map((p) => `<li>${p}</li>`).join('')}</ul>
      ${n.try ? `<div class="try"><span>试试</span>${n.try}</div>` : ''}
      <div class="sim">
        <h4>演示开关</h4>
        <div class="sim-grid">
          <button data-sim="day">快进一天</button>
          <button data-sim="halloween">${S.halloween ? '关闭万圣节' : '万圣节彩蛋'}</button>
          <button data-sim="note">来一张小纸条</button>
          <button data-sim="bday">生日到了</button>
          <button data-sim="back">休息后回来</button>
          <button data-sim="close">关闭所有弹层</button>
        </div>
        <small>演示里的「今天」是 2026-10-24（周六）${S.simDay ? `，已快进 ${S.simDay} 天` : ''}。数据只在这个页面里，刷新即恢复。</small>
      </div>
      <div class="quick">
        <h4>风格包</h4>
        <div class="quick-row">${themes}</div>
      </div>
      `
  }

  function renderCaption() {
    const el = $('#caption')
    if (!el) return
    const n = NOTES[scene()] || NOTES.habit
    el.textContent = `${n.t.split('：')[0]} · 可直接操作`
  }

  function refreshDeck() {
    renderFlows()
    renderNotes()
    renderCaption()
  }

  // ---------------------------------------------------------------- 事件

  function onDeckClick(e) {
    const goBtn = e.target.closest('[data-go]')
    if (goBtn) {
      if (goBtn.dataset.go === 'reset') {
        reseed()
        Object.assign(S, { step: null })
        $('#view').scrollTop = 0
        DM.render()
        DM.toast('演示数据已重置')
      } else go(goBtn.dataset.go)
      return
    }
    const themeBtn = e.target.closest('[data-theme-btn]')
    if (themeBtn) {
      S.theme = themeBtn.dataset.themeBtn
      DM.render()
      return
    }
    const sim = e.target.closest('[data-sim]')
    if (!sim) return
    const kind = sim.dataset.sim
    if (kind === 'day') {
      if (!S.onboarded) reseed()
      S.ovs = []
      DM.simNextDay()
    } else if (kind === 'halloween') {
      ensureSeed()
      S.halloween = !S.halloween
      S.bubble = null
      if (S.halloween) {
        Object.assign(S, { tab: 'today' })
        S.ovs = [{ type: 'note' }]
      }
      DM.render()
    } else if (kind === 'note') {
      ensureSeed()
      DM.openOv({ type: 'note' })
    } else if (kind === 'bday') go('D2')
    else if (kind === 'back') go('E1')
    else if (kind === 'close') {
      S.ovs = []
      DM.render()
    }
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#flows') || e.target.closest('#notes')) onDeckClick(e)
  })

  DM.onRender.push(refreshDeck)
  DM.go = go
  DM.scene = scene
  DM.reseed = reseed
})()
