/**
 * 中文文案表。所有 key 以这里为准——en.ts 少一条都过不了类型检查。
 * 复数用 { one, other } 表示，中文两格通常一样；英文才区分。
 */
export type Msg = string | { one: string; other: string }

export const zh = {
  /* 通用 */
  'common.ok': '好的',
  'common.cancel': '取消',
  'common.close': '关闭',
  'common.back': '返回',
  'common.save': '保存',
  'common.delete': '删除',
  'common.undo': '撤销',
  'common.next': '下一步',
  'common.skip': '跳过',
  'common.done': '完成',
  'common.retry': '重试',
  'common.loading': '加载中…',

  /* 底部 tab */
  'tab.today': '今天',
  'tab.museum': '藏馆',
  'tab.dress': '装扮',

  /* 三类事 */
  'kind.since': '坚持',
  'kind.habit': '习惯',
  'kind.countdown': '等待的日子',
  'kind.since.desc': '一天一天累积的日子',
  'kind.habit.desc': '想经常做的小事',
  'kind.countdown.desc': '离某个日子还有多久',

  /* 单位与时间 */
  'unit.day': { one: '{n} 天', other: '{n} 天' },
  'unit.daysCount': { one: '{n} 天', other: '{n} 天' },
  'unit.week': { one: '{n} 周', other: '{n} 周' },
  'unit.month': { one: '{n} 个月', other: '{n} 个月' },
  'unit.year': { one: '{n} 年', other: '{n} 年' },
  'time.today': '今天',
  'time.yesterday': '昨天',
  'time.dayBefore': '前天',
  'time.thisWeek': '本周',
  'time.lastWeek': '上周',
  'time.weekBeforeLast': '上上周',
  'time.thisMonth': '本月',
  'time.lastMonth': '上月',
  'period.weekOf': '{date}那周',
  'period.dayWithWeekday': '{date} {weekday}',
  'unit.dayShort': '天',
  'unit.weekShort': '周',
  'unit.monthShort': '个月',

  /* 舞台 */
  'stage.empty.title': '这里还空着',
  'stage.empty.body': '记下第一件事，就有一只小伙伴搬进来。',
  'stage.empty.cta': '记一件事',
  'stage.since.label': '第 {n} 天',
  'stage.since.sub': '从 {date} 起',
  'stage.habit.today': '今天 {n} 次',
  'stage.habit.todayTarget': '今天 {n} / {target}',
  'stage.habit.weekTarget': '本周 {n} / {target}',
  'stage.habit.monthTarget': '本月 {n} / {target}',
  'stage.countdown.days': '还有 {n} 天',
  'stage.countdown.today': '就是今天',
  'stage.countdown.past': '已经过去 {n} 天',

  /* 动作 */
  'action.hold': '按住 · 记一下',
  'action.holdWake': '按住 · 叫醒它',
  'action.logged': '今天已记 · 明天见',
  'action.poke': '摸摸它',
  'action.share': '分享这一天',
  'action.archive': '档案',
  'action.endChapter': '结束这一章',
  'action.travel': '去旅行',
  'action.chapters': '过去的章节',
  'action.newItem': '新的一件事',
  'action.switch': '切换',
  'action.said': '说过了，明年见',
  'action.sound': '声音',
  'action.soundOn': '音效已开',
  'action.soundOff': '音效已关',

  /* 成长 */
  'growth.progress': '成长 {n} 天 · 再 {rest} 天 → {next}',
  'growth.maxed': '已经是最好的样子啦',
  'growth.sleeping': '暂停生长 · 等你回来',
  'growth.nextStage': '第 {n} 天 · 长大了',

  /* 切换面板 */
  'switcher.title': '所有的事',
  'switcher.current': '正在看',
  'switcher.notToday': '今天还没记',
  'switcher.sleeping': '在休息，等你回来',
  'switcher.count': { one: '{n} 件', other: '{n} 件' },

  /* 藏馆 */
  'museum.title': '藏馆',
  'museum.tab.chapters': '章节',
  'museum.tab.dex': '图鉴',
  'museum.tab.badges': '徽章',
  'museum.tab.notes': '纸条',
  'museum.chapters.empty': '书架还空着。走完一章，它就会被收在这里。',
  'museum.dex.empty': '还没遇到小伙伴。',
  'museum.badges.empty': '还没有徽章。',
  'museum.notes.empty': '还没有小纸条。',
  'museum.yearReview': '年度回顾',
  'museum.yearReview.opens': '{n} 天后开启',

  /* 装扮 */
  'dress.title': '装扮',
  'dress.skin': '风格',
  'dress.accent': '主色',
  'dress.num': '数字字体',
  'dress.texture': '背景纹理',
  'dress.other': '其他',
  'dress.haptic': '轻震',
  'dress.reduceMotion': '减弱动效',
  'dress.sound': '音效',
  'dress.followSystem': '跟随系统深浅色',
  'dress.dataNote': '数据只保存在这台设备上。',
  'dress.export': '导出备份',
  'dress.language': '语言',
  'dress.about': '关于',

  /* 新建 */
  'add.title': '想记点什么',
  'add.step1': '选一类',
  'add.step2': '起个名字',
  'add.step3': '选一只小伙伴',
  'add.fromFestival': '从节日里挑一个',
  'add.name.placeholder': '比如：戒烟、喝水、妈妈的生日',
  'add.startNow': '从现在开始',
  'add.startPast': '从过去某一天',
  'add.repeat': '重复',
  'add.target': '每个周期几次',

  /* 孵化 */
  'hatch.title': '孵化',
  'hatch.tap': '轻点三下，叫醒它',
  'hatch.hello': '你好呀，我是 {name}！',
  'hatch.start': '开始吧',

  /* 角色名 */
  'creature.sprout': '芽芽',
  'creature.moon': '眠眠',
  'creature.drop': '咕噜',
  'creature.star': '跑跑',
  'creature.post': '信信',

  /* 形态名 */
  'stageName.sprout.0': '壳宝宝',
  'stageName.sprout.1': '冒芽',
  'stageName.sprout.2': '双叶',
  'stageName.sprout.3': '开花',
  'stageName.sprout.4': '花冠',
  'stageName.moon.0': '壳宝宝',
  'stageName.moon.1': '月牙',
  'stageName.moon.2': '睡帽',
  'stageName.moon.3': '星星帽',
  'stageName.moon.4': '星夜',
  'stageName.drop.0': '壳宝宝',
  'stageName.drop.1': '小水珠',
  'stageName.drop.2': '浪花',
  'stageName.drop.3': '泡泡',
  'stageName.drop.4': '彩虹',
  'stageName.star.0': '壳宝宝',
  'stageName.star.1': '星芽',
  'stageName.star.2': '星耳',
  'stageName.star.3': '汗带',
  'stageName.star.4': '金冠',

  /* 货币化（国际版） */
  'pro.title': '解锁全部',
  'pro.body': '一次买断，永久可用。',
  'pro.cta': '解锁全部 · {price}',
  'pro.restore': '恢复购买',
  'pro.freeLimit': '免费版可以记 {n} 件事',
  'pro.locked': '这是完整版的功能',
} as const

export type MessageKey = keyof typeof zh
