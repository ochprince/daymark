import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildIcs,
  firesOn,
  formatReminder,
  formatTime,
  icsFileName,
  icsLocalStamp,
  icsUtcStamp,
  isDue,
  isNone,
  nextTrigger,
  normalizeReminder,
  normalizeTimeString,
  parseTime,
  triggerAt,
} from './reminder'

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime()

test('时间解析：正常、越界、脏数据', () => {
  assert.deepEqual(parseTime('21:00'), { hour: 21, minute: 0 })
  assert.deepEqual(parseTime('9:5'), { hour: 9, minute: 5 })
  assert.deepEqual(parseTime('99:99'), { hour: 23, minute: 59 })
  assert.deepEqual(parseTime(undefined), { hour: 21, minute: 0 })
  assert.deepEqual(parseTime('晚上'), { hour: 21, minute: 0 })
  assert.equal(formatTime(9, 5), '09:05')
  assert.equal(normalizeTimeString('9:5'), '09:05')
  assert.equal(normalizeTimeString(null), '21:00')
})

test('归一化：四种 kind 都能认，坏数据回 none', () => {
  assert.deepEqual(normalizeReminder(undefined), { kind: 'none' })
  assert.deepEqual(normalizeReminder({ kind: 'daily', time: '8:0' }), { kind: 'daily', time: '08:00' })
  assert.deepEqual(normalizeReminder({ kind: 'weekly', weekdays: [3, 1, 3, 9], time: '07:30' }), {
    kind: 'weekly',
    weekdays: [1, 2, 3],
    time: '07:30',
  })
  // 星期全没了就退化成每天
  assert.deepEqual(normalizeReminder({ kind: 'weekly', weekdays: [], time: '07:30' }), {
    kind: 'daily',
    time: '07:30',
  })
  assert.deepEqual(normalizeReminder({ kind: 'before', daysBefore: 999, time: '20:00' }), {
    kind: 'before',
    daysBefore: 365,
    time: '20:00',
  })
  assert.deepEqual(normalizeReminder({ kind: 'whatever' }), { kind: 'none' })
  assert.equal(isNone(undefined), true)
  assert.equal(isNone({ kind: 'none' }), true)
  assert.equal(isNone({ kind: 'daily', time: '09:00' }), false)
})

test('每周：只在自己选的星期上响', () => {
  const monday = at(2026, 10, 26)
  const tuesday = at(2026, 10, 27)
  const weekly = { kind: 'weekly' as const, weekdays: [1], time: '09:00' }
  assert.equal(firesOn(weekly, monday), true)
  assert.equal(firesOn(weekly, tuesday), false)
  assert.equal(firesOn({ kind: 'daily', time: '09:00' }, tuesday), true)
  assert.equal(firesOn({ kind: 'none' }, monday), false)
})

test('到点判断：窗口内算、同一天只弹一次', () => {
  const daily = { kind: 'daily' as const, time: '21:00' }
  const due = at(2026, 10, 25, 21, 0)
  assert.equal(isDue(daily, due, null), true)
  assert.equal(isDue(daily, due, '2026-10-25'), false, '当天弹过就不再弹')
  assert.equal(isDue(daily, at(2026, 10, 25, 20, 59), null), false)
  assert.equal(isDue(daily, at(2026, 10, 25, 21, 1), null), false, '默认窗口 1 分钟')
  assert.equal(isDue(daily, at(2026, 10, 25, 21, 5), null, { windowMinutes: 10 }), true)
  assert.equal(isDue(daily, at(2026, 10, 25, 23, 59), null), false)
})

test('倒数日提前 N 天：只在提前那天响', () => {
  const target = at(2026, 11, 10) // 目标日
  const reminder = { kind: 'before' as const, daysBefore: 3, time: '20:00' }
  assert.equal(triggerAt(reminder, at(2026, 11, 7, 12), target), at(2026, 11, 7, 20, 0))
  assert.equal(triggerAt(reminder, at(2026, 11, 6, 12), target), null)
  assert.equal(triggerAt(reminder, at(2026, 11, 10, 12), target), null)
  // 没有目标日就没有触发时刻
  assert.equal(triggerAt(reminder, at(2026, 11, 7, 12)), null)
})

test('下一次触发：今天没到就今天，过了就明天', () => {
  const daily = { kind: 'daily' as const, time: '21:00' }
  assert.equal(nextTrigger(daily, at(2026, 10, 25, 8, 0)), at(2026, 10, 25, 21, 0))
  assert.equal(nextTrigger(daily, at(2026, 10, 25, 22, 0)), at(2026, 10, 26, 21, 0))
  // 只在周一：周五问就是下周一
  assert.equal(nextTrigger({ kind: 'weekly', weekdays: [1], time: '09:00' }, at(2026, 10, 30, 12, 0)), at(2026, 11, 2, 9, 0))
  assert.equal(nextTrigger({ kind: 'none' }, at(2026, 10, 30)), null)
})

test('文案：每天 / 指定星期 / 提前 N 天 / 中英', () => {
  assert.equal(formatReminder({ kind: 'daily', time: '21:00' }, 'zh'), '每天 21:00')
  assert.equal(formatReminder({ kind: 'weekly', weekdays: [1, 3], time: '9:05' }, 'zh'), '周一、周三 09:05')
  assert.equal(formatReminder({ kind: 'weekly', weekdays: [1, 3], time: '09:05' }, 'en'), 'Mon, Wed 09:05')
  assert.equal(formatReminder({ kind: 'before', daysBefore: 3, time: '20:00' }, 'zh'), '提前 3 天 20:00')
  assert.equal(formatReminder({ kind: 'none' }, 'zh'), '不提醒')
})

test('ics：每天写 RRULE:FREQ=DAILY', () => {
  const ics = buildIcs({
    uid: 'habit:c1',
    title: '喝水',
    reminder: { kind: 'daily', time: '09:00' },
    from: at(2026, 10, 26, 9, 0),
    now: at(2026, 10, 25, 8, 0),
  })
  assert.match(ics, /BEGIN:VCALENDAR/)
  assert.match(ics, /RRULE:FREQ=DAILY/)
  assert.match(ics, /DTSTART:20261026T090000/)
  assert.match(ics, /SUMMARY:喝水/)
  assert.match(ics, /TRIGGER:-PT10M/)
  assert.ok(ics.endsWith('\r\n'))
})

test('ics：指定星期写 BYDAY；提前 N 天且有目标日按年重复', () => {
  const weekly = buildIcs({
    uid: 'since:e1',
    title: '记账',
    reminder: { kind: 'weekly', weekdays: [5, 1], time: '20:30' },
    from: at(2026, 10, 26, 20, 30),
  })
  assert.match(weekly, /RRULE:FREQ=WEEKLY;BYDAY=MO,FR/)

  const before = buildIcs({
    uid: 'countdown:d1',
    title: '生日',
    reminder: { kind: 'before', daysBefore: 3, time: '20:00' },
    from: at(2026, 11, 7, 20, 0),
    targetAt: at(2026, 11, 10),
  })
  assert.match(before, /RRULE:FREQ=YEARLY/)
})

test('ics：特殊字符转义，长行不超 75 字节', () => {
  const ics = buildIcs({
    uid: 'e1',
    title: '跑步,读书;睡觉\\以及很长很长很长很长很长很长很长很长很长很长很长很长的标题',
    reminder: { kind: 'daily', time: '07:00' },
    from: at(2026, 10, 26, 7, 0),
  })
  assert.match(ics, /跑步\\,读书\\;睡觉\\\\/)
  const encoder = new TextEncoder()
  for (const line of ics.split('\r\n')) {
    assert.ok(encoder.encode(line).length <= 76, `行太长：${line}`)
  }
})

test('文件名净化', () => {
  assert.equal(icsFileName('喝水'), '喝水.ics')
  assert.equal(icsFileName('a/b:c*d'), 'a-b-c-d.ics')
  assert.equal(icsFileName('   '), 'daymark.ics')
  assert.ok(icsFileName('x'.repeat(80)).length <= 44)
})

test('本地时间戳不受时区影响', () => {
  assert.equal(icsLocalStamp(at(2026, 1, 2, 3, 4)), '20260102T030400')
})

test('DTSTAMP 用 UTC（带 Z），不能拿本地时间冒充', () => {
  const ts = at(2026, 1, 2, 3, 4)
  const utc = icsUtcStamp(ts)
  assert.match(utc, /^\d{8}T\d{6}Z$/)
  // 本地时间与 UTC 相差一个时区偏移，两者不该相同（东八区）
  assert.notEqual(utc, `${icsLocalStamp(ts)}Z`)
  const ics = buildIcs({ uid: 'x', title: 't', reminder: { kind: 'daily', time: '09:00' }, from: ts, now: ts })
  assert.match(ics, /DTSTAMP:\d{8}T\d{6}Z/)
})
