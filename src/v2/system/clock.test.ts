import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEMO_SPEED,
  DEMO_START_SECONDS,
  addLocalDays,
  dayProgress,
  dayProgressPercent,
  demoNow,
  elapsedDays,
  formatClock,
  formatClockShort,
  formatMMSS,
  formatPercent,
  frozenClock,
  isSameDay,
  localDayKey,
  progressRatio,
  realMsForDay,
  remainingDays,
  remainingSeconds,
  secondsOfDay,
  weekFlags,
} from './clock'

/** 2026-05-24 是周日；用本地构造，换时区也不会错位 */
const at = (day: number, hour: number, minute = 0, second = 0): number =>
  new Date(2026, 4, day, hour, minute, second).getTime()

test('格式化：时刻补零 / 锁屏不补零 / 倒计时 mm:ss / 百分比', () => {
  assert.equal(formatClock(at(24, 9, 41)), '09:41')
  assert.equal(formatClock(at(24, 0, 0)), '00:00')
  assert.equal(formatClockShort(at(24, 9, 41)), '9:41')
  assert.equal(formatClockShort(at(24, 21, 5)), '21:05')
  assert.equal(formatMMSS(25 * 60), '25:00')
  assert.equal(formatMMSS(24 * 60 + 12), '24:12')
  assert.equal(formatMMSS(-3), '00:00')
  assert.equal(formatMMSS(120 * 60 + 7), '120:07')
  assert.equal(formatPercent(40.347), '40.3%')
  assert.equal(formatPercent(100, 0), '100%')
})

test('剩余天数：今天 0 / 明天 1 / 昨天 -1 / 跨月跨年按自然日', () => {
  const now = at(24, 15, 30)
  assert.equal(remainingDays(at(24, 0, 5), now), 0)
  assert.equal(remainingDays(at(24, 23, 59), now), 0)
  assert.equal(remainingDays(at(25, 0, 0), now), 1)
  assert.equal(remainingDays(at(23, 23, 0), now), -1)
  assert.equal(remainingDays(new Date(2026, 5, 1, 0, 0).getTime(), now), 8)
  assert.equal(remainingDays(new Date(2027, 0, 1, 0, 0).getTime(), now), 222)
})

test('已走过天数：起始日当天 0，第二天 1，未来一律 0', () => {
  assert.equal(elapsedDays(at(24, 8, 0), at(24, 23, 59)), 0)
  assert.equal(elapsedDays(at(24, 8, 0), at(25, 0, 1)), 1)
  assert.equal(elapsedDays(at(1, 8, 0), at(24, 12, 0)), 23)
  assert.equal(elapsedDays(at(30, 8, 0), at(24, 12, 0)), 0)
})

test('当天进度：0 点 0%，中午 50%，23:59 接近 100%，百分比与秒数一致', () => {
  assert.equal(dayProgress(at(24, 0, 0)), 0)
  assert.equal(dayProgress(at(24, 12, 0)), 0.5)
  assert.equal(dayProgressPercent(at(24, 6, 0)), 25)
  assert.equal(dayProgressPercent(at(24, 18, 0)), 75)
  assert.ok(dayProgress(at(24, 23, 59)) > 0.999)
  assert.equal(secondsOfDay(at(24, 9, 41)), 9 * 3600 + 41 * 60)
  assert.equal(secondsOfDay(at(24, 0, 0)), 0)
})

test('进度比例：目标为空时记过算满，超额收敛到 100%，负值归零', () => {
  assert.equal(progressRatio(0, 3), 0)
  assert.equal(progressRatio(2, 3), 2 / 3)
  assert.equal(progressRatio(3, 3), 1)
  assert.equal(progressRatio(9, 3), 1)
  assert.equal(progressRatio(0, null), 0)
  assert.equal(progressRatio(1, null), 1)
  assert.equal(progressRatio(0, 0), 0)
  assert.equal(progressRatio(5, 0), 1)
  assert.equal(progressRatio(-2, 4), 0)
})

test('演示时钟：默认 9:41 起、40×，走完一天要 36 分钟真实时间', () => {
  const anchor = at(24, 8, 0)
  const start = demoNow(anchor, 0)
  assert.equal(formatClock(start), '09:41')
  assert.equal(start, at(24, 9, 41))
  // 1 秒真实 → 40 秒演示
  assert.equal(demoNow(anchor, 1000) - start, 40_000)
  // 30 秒真实 → 20 分钟演示
  assert.equal(formatClock(demoNow(anchor, 30_000)), '10:01')
  assert.equal(DEMO_START_SECONDS, 34_860)
  assert.equal(DEMO_SPEED, 40)
  assert.equal(realMsForDay(DEMO_SPEED), 36 * 60 * 1000)
})

test('跨天：演示走半小时真实 = 20 小时演示，落到第二天清晨，天数与进度都翻篇', () => {
  const anchor = at(24, 8, 0)
  const before = demoNow(anchor, 0)
  const after = demoNow(anchor, 30 * 60 * 1000)

  assert.equal(formatClock(after), '05:41')
  assert.equal(localDayKey(after), localDayKey(addLocalDays(anchor, 1)))
  assert.equal(isSameDay(before, after), false)
  assert.equal(remainingDays(at(26, 9, 41), after), 1)
  assert.equal(remainingDays(at(26, 9, 41), before), 2)
  assert.equal(elapsedDays(before, after), 1)
  assert.ok(dayProgressPercent(after) > 20 && dayProgressPercent(after) < 25)
})

test('一周足迹：最近 7 天（旧 → 今天），跨月也能对上日期键', () => {
  const now = at(24, 21, 0)
  const flags = weekFlags([localDayKey(now), localDayKey(addLocalDays(now, -2))], now)
  assert.deepEqual(flags, [false, false, false, false, true, false, true])

  const monthEdge = new Date(2026, 5, 2, 9, 0).getTime()
  const edge = weekFlags([localDayKey(new Date(2026, 4, 31, 9, 0).getTime())], monthEdge)
  assert.equal(edge.length, 7)
  assert.equal(edge.filter(Boolean).length, 1)
})

test('倒计时剩余秒数向上取整，冻结时钟字段自洽', () => {
  const now = at(24, 9, 41)
  assert.equal(remainingSeconds(now + 1500_000, now), 1500)
  assert.equal(remainingSeconds(now + 900_000, now), 900)
  assert.equal(remainingSeconds(now - 5000, now), 0)

  const clock = frozenClock(now)
  assert.equal(clock.now, now)
  assert.equal(clock.secondsOfDay, 9 * 3600 + 41 * 60)
  assert.equal(clock.dayPercent, dayProgressPercent(now))
  clock.play()
  assert.equal(clock.playing, false)
})
