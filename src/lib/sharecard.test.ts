import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildShareModel,
  growthPercent,
  shareCaption,
  shareDateText,
  shareFileName,
  shareNumSlug,
  shareStamp,
  slugifyTitle,
} from './sharecard'
import { stageOf } from './growth'
import type { CountdownView, HabitView, ItemView, SinceView } from './itemview'
import type { CheckInEvent, CountdownEvent, DayEvent } from './types'

const DAY = 86_400_000

function at(year: number, month: number, day: number, hour = 9): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime()
}

const NOW = at(2026, 10, 25)

function sinceEvent(title: string, startedAt: number): DayEvent {
  return { id: 'e1', title, startedAt, createdAt: startedAt, color: 1, species: 'sprout' }
}

function habitEvent(title: string, createdAt: number, extra: Partial<CheckInEvent> = {}): CheckInEvent {
  return {
    id: 'c1',
    title,
    createdAt,
    color: 4,
    cadence: 'daily',
    days: {},
    times: {},
    ...extra,
  }
}

function countdownEvent(title: string, startedAt: number, repeat: CountdownEvent['repeat'] = 'none'): CountdownEvent {
  return { id: 'd1', title, startedAt, createdAt: at(2026, 1, 1), color: 3, repeat }
}

function sinceView(days: number, title = '戒烟', growth = days): SinceView {
  return {
    key: 'since:e1',
    kind: 'since',
    id: 'e1',
    title,
    color: 1,
    species: 'sprout',
    stage: stageOf(growth),
    growth,
    mood: 'idle',
    days,
    event: sinceEvent(title, NOW - days * DAY),
  }
}

function habitView(growth: number, extra: Partial<HabitView> = {}): HabitView {
  return {
    key: 'habit:c1',
    kind: 'habit',
    id: 'c1',
    title: '读书',
    color: 4,
    species: 'moon',
    stage: stageOf(growth),
    growth,
    mood: 'idle',
    count: 0,
    target: null,
    cadence: 'daily',
    event: habitEvent('读书', NOW - growth * DAY),
    ...extra,
  }
}

function countdownView(days: number, title = '旅行'): CountdownView {
  return {
    key: 'countdown:d1',
    kind: 'countdown',
    id: 'd1',
    title,
    color: 3,
    species: 'post',
    stage: 0,
    growth: 0,
    mood: days === 0 ? 'happy' : 'idle',
    days,
    next: NOW + days * DAY,
    event: countdownEvent(title, NOW + days * DAY),
  }
}

/* ---------------------------------------------------------------- 模型：三类 */

test('坚持类：第 N 天 + 开始日期，配色索引与物种原样带出', () => {
  const model = buildShareModel(sinceView(128), { now: NOW, locale: 'zh' })
  assert.equal(model.kind, 'since')
  assert.equal(model.title, '戒烟')
  assert.equal(model.lead, '第')
  assert.equal(model.number, '128')
  assert.equal(model.unit, '天')
  assert.equal(model.isPhrase, false)
  assert.equal(model.kindLabel, '坚持')
  assert.equal(model.colorIndex, 1)
  assert.equal(model.species, 'sprout')
  assert.equal(model.stage, 4)
  assert.equal(model.showGrowth, true)
  assert.equal(model.dateText, '2026年10月25日')
  assert.equal(model.subtitle, '从 2026年6月19日 起')
})

test('习惯类：大数字是累计天数（一句话），副标题带上今天的次数', () => {
  const model = buildShareModel(habitView(128, { count: 2, target: 3 }), { now: NOW, locale: 'zh' })
  assert.equal(model.kind, 'habit')
  assert.equal(model.isPhrase, true)
  assert.equal(model.number, '128 天')
  assert.equal(model.lead, '')
  assert.equal(model.unit, '')
  assert.equal(model.showGrowth, true)
  assert.equal(model.growth, 128)
  assert.equal(model.subtitle, '从 2026年6月19日 起 · 今天 2 / 3')
})

test('习惯类：没设目标时只报今天几次，一次都没记就不带那一段', () => {
  const logged = buildShareModel(habitView(9, { count: 1 }), { now: NOW, locale: 'zh' })
  assert.equal(logged.subtitle, '从 2026年10月16日 起 · 今天 1 次')

  const idle = buildShareModel(habitView(9), { now: NOW, locale: 'zh' })
  assert.equal(idle.subtitle, '从 2026年10月16日 起')
})

test('倒数日：还有 / 就是今天 / 已经过去 三种说法，且不画成长条', () => {
  const future = buildShareModel(countdownView(12), { now: NOW, locale: 'zh' })
  assert.equal(future.number, '还有 12 天')
  assert.equal(future.isPhrase, true)
  assert.equal(future.showGrowth, false)
  assert.equal(future.species, 'post')
  assert.equal(future.kindLabel, '等待的日子')
  assert.equal(future.subtitle, '2026年11月6日')

  const today = buildShareModel(countdownView(0), { now: NOW, locale: 'zh' })
  assert.equal(today.number, '就是今天')

  const past = buildShareModel(countdownView(-3), { now: NOW, locale: 'zh' })
  assert.equal(past.number, '已经过去 3 天')
})

test('英文口径：Day 128 不再补单位，习惯类是 128 days', () => {
  const since = buildShareModel(sinceView(128), { now: NOW, locale: 'en' })
  assert.equal(since.lead, 'Day')
  assert.equal(since.number, '128')
  assert.equal(since.unit, '')
  assert.equal(since.dateText, 'October 25, 2026')
  assert.equal(since.subtitle, 'Since June 19, 2026')

  const habit = buildShareModel(habitView(128), { now: NOW, locale: 'en' })
  assert.equal(habit.number, '128 days')

  const countdown = buildShareModel(countdownView(12), { now: NOW, locale: 'en' })
  assert.equal(countdown.number, '12 days to go')
})

/* ------------------------------------------------------------ 天数与单位边界 */

test('天数边界：0 天 / 1 天 / 365+ 天都不崩', () => {
  const zero = buildShareModel(sinceView(0), { now: NOW, locale: 'zh' })
  assert.equal(zero.number, '0')
  assert.equal(zero.unit, '天')
  assert.equal(zero.growthPct, 0)

  const one = buildShareModel(sinceView(1, '戒烟', 1), { now: NOW, locale: 'zh' })
  assert.equal(one.number, '1')
  assert.equal(one.growthPct, 33)

  const year = buildShareModel(sinceView(365, '戒烟', 365), { now: NOW, locale: 'zh' })
  assert.equal(year.number, '365')
  assert.equal(year.growthPct, 100)

  const old = buildShareModel(sinceView(4000, '戒烟', 4000), { now: NOW, locale: 'zh' })
  assert.equal(old.number, '4000')
  assert.equal(old.growthPct, 100)
})

test('英文口径：走 i18n 现成的复数和单位，跟舞台卡同一句话', () => {
  assert.equal(buildShareModel(habitView(1), { now: NOW, locale: 'en' }).number, '1 day')
  assert.equal(buildShareModel(habitView(3), { now: NOW, locale: 'en' }).number, '3 days')
  // 倒数日沿用 en.ts 里 stage.countdown.days 的写法（'… days to go'），跟首页保持一致
  assert.equal(buildShareModel(countdownView(1), { now: NOW, locale: 'en' }).number, '1 days to go')
})

test('异常数据兜底：负数天数、超范围配色、非整数成长都收敛', () => {
  const model = buildShareModel({ ...sinceView(-5, '戒烟', -5), color: 12 } as SinceView, {
    now: NOW,
    locale: 'zh',
  })
  assert.equal(model.number, '0')
  assert.equal(model.colorIndex, 7)
  assert.equal(model.growth, 0)

  const odd = buildShareModel({ ...habitView(7), color: -3 } as HabitView, { now: NOW, locale: 'zh' })
  assert.equal(odd.colorIndex, 0)
})

test('成长条进度：按形态门槛分档，满形态恒为 100', () => {
  assert.equal(growthPercent(0, 0), 0)
  assert.equal(growthPercent(1, 0), 33)
  assert.equal(growthPercent(3, 1), 0)
  assert.equal(growthPercent(30, 3), 0)
  assert.equal(growthPercent(100, 4), 100)
  assert.equal(growthPercent(9999, 4), 100)
})

/* ------------------------------------------------------------------ 文件名 */

test('文件名：英文标题直接用，天数带 d 后缀，日期是本地日历日', () => {
  const view = sinceView(128, 'Quit smoking')
  assert.equal(shareFileName(view, NOW), 'daymark-quit-smoking-128d-2026-10-25.png')
})

test('文件名：中文标题回退到 kind 名，绝不出现非 ASCII', () => {
  const view = sinceView(128, '戒烟')
  const name = shareFileName(view, NOW)
  assert.equal(name, 'daymark-since-128d-2026-10-25.png')
  assert.match(name, /^[a-z0-9.-]+$/)
})

test('文件名：空格 / 标点 / emoji / 重音都净化掉', () => {
  assert.equal(slugifyTitle('  Quit   Smoking!!  ', 'since'), 'quit-smoking')
  assert.equal(slugifyTitle('Café ☕ & 茶', 'habit'), 'cafe')
  assert.equal(slugifyTitle('a/b\\c:d*e?f"g<h>i|j', 'habit'), 'a-b-c-d-e-f-g-h-i-j')
  assert.equal(slugifyTitle('🎉🎉', 'countdown'), 'countdown')
  assert.equal(slugifyTitle('', 'countdown'), 'countdown')
  assert.equal(slugifyTitle('  戒烟 128 天  ', 'since'), 'since', '只剩数字也当没有 ASCII 标题')
})

test('文件名：超长标题截断，且不会留结尾连字符', () => {
  const long = 'quit smoking forever and ever and ever and ever amen'
  const slug = slugifyTitle(long, 'since')
  assert.ok(slug.length <= 32, `slug 太长：${slug}`)
  assert.ok(!slug.endsWith('-'))
  assert.match(slug, /^[a-z0-9-]+$/)
})

test('文件名：习惯用成长天数，倒数日分 in / today / past', () => {
  assert.equal(shareNumSlug(habitView(128)), '128d')
  assert.equal(shareFileName(habitView(3, { title: 'Read' }), NOW), 'daymark-read-3d-2026-10-25.png')
  assert.equal(shareNumSlug(countdownView(12)), 'in12d')
  assert.equal(shareNumSlug(countdownView(0)), 'today')
  assert.equal(shareNumSlug(countdownView(-3)), 'past3d')

  const view = countdownView(12, 'Trip to Kyoto')
  assert.equal(shareFileName(view, NOW), 'daymark-trip-to-kyoto-in12d-2026-10-25.png')
})

test('文件名：每个字都落在文件系统安全字符集里', () => {
  const views: ItemView[] = [
    sinceView(0, '戒烟 第一天'),
    habitView(0, { title: '喝水 💧' }),
    countdownView(0, '生日 🎂'),
  ]
  for (const view of views) {
    const name = shareFileName(view, NOW)
    assert.match(name, /^daymark-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.png$/, name)
    assert.ok(name.length < 80, `文件名太长：${name}`)
  }
})

test('日期戳：跟本地日历一致，不因时区漂移', () => {
  assert.equal(shareStamp(at(2026, 1, 5, 0)), '2026-01-05')
  assert.equal(shareStamp(at(2026, 12, 31, 23)), '2026-12-31')
  assert.equal(shareDateText(at(2026, 10, 25), 'zh'), '2026年10月25日')
  assert.equal(shareDateText(at(2026, 10, 25), 'en'), 'October 25, 2026')
})

/* ------------------------------------------------------------------ 分享文案 */

test('分享文案：三类事中英各一句，都带上标题和数字', () => {
  assert.deepEqual(shareCaption(sinceView(128, '戒烟')), {
    zh: '「戒烟」已经第 128 天了。一天一天，都算数。 #刻度',
    en: 'Day 128 of "戒烟". One day at a time. #Daymark',
  })

  const habit = shareCaption(habitView(9))
  assert.equal(habit.zh, '和「读书」一起走过 9 天。 #刻度')
  assert.equal(habit.en, '9 days together with "读书". #Daymark')

  const countdown = shareCaption(countdownView(12, '旅行'))
  assert.equal(countdown.zh, '还有 12 天就是「旅行」。 #刻度')
  assert.equal(countdown.en, '12 days until "旅行". #Daymark')

  assert.equal(shareCaption(countdownView(0, '旅行')).zh, '就是今天：「旅行」。 #刻度')
  assert.equal(shareCaption(countdownView(-3, '旅行')).en, '3 days since "旅行". #Daymark')
})

test('分享文案：英文单数不会写成 1 days', () => {
  assert.equal(shareCaption(habitView(1)).en, 'One day together with "读书". #Daymark')
})
