import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FESTIVALS, FESTIVAL_GROUPS, daysToFestival, festivalById, festivalDateIn, nextFestivalDate } from './festivals.ts'

/** 用本地时间构造时间戳 */
function at(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime()
}

function dateOf(id: string, year: number): string {
  const festival = festivalById(id)
  assert.ok(festival, `找不到节日 ${id}`)
  const found = festivalDateIn(festival, year)
  assert.ok(found, `${id} 在 ${year} 年没有解出日期`)
  return `${year}-${String(found!.month).padStart(2, '0')}-${String(found!.day).padStart(2, '0')}`
}

test('节日目录：三组，中国传统的排在最前', () => {
  assert.equal(FESTIVAL_GROUPS[0].id, 'cn-traditional')
  assert.deepEqual(
    FESTIVAL_GROUPS.map((group) => group.id),
    ['cn-traditional', 'cn-statutory', 'western'],
  )
  assert.equal(FESTIVALS.length, new Set(FESTIVALS.map((f) => f.id)).size, '节日 id 不应重复')
  assert.ok(FESTIVALS.length >= 24, `节日数量偏少：${FESTIVALS.length}`)
})

test('农历节日查表正确（春节/中秋/端午/腊八）', () => {
  assert.equal(dateOf('spring-festival', 2026), '2026-02-17')
  // 2027 春节是官方历法的 2 月 6 日；浏览器 ICU 的 Chinese 日历给 02-07，
  // 差一天的坑就靠这条守着（见 scripts/gen-lunar-dates.py 的说明）
  assert.equal(dateOf('spring-festival', 2027), '2027-02-06')
  assert.equal(dateOf('spring-festival', 2028), '2028-01-26')
  assert.equal(dateOf('spring-festival', 2030), '2030-02-03')
  assert.equal(dateOf('mid-autumn', 2026), '2026-09-25')
  assert.equal(dateOf('dragon-boat', 2026), '2026-06-19')
  assert.equal(dateOf('lantern', 2026), '2026-03-03')
  assert.equal(dateOf('lantern', 2027), '2027-02-20')
})

test('腊月节日落在下一个公历年', () => {
  // 农历 2026 年的腊八/小年在公历 2027 年 1 月
  assert.equal(dateOf('laba', 2027), '2027-01-15')
  assert.equal(dateOf('xiaonian', 2027), '2027-01-30')
})

test('除夕是当年春节的前一天', () => {
  assert.equal(dateOf('chuxi', 2026), '2026-02-16')
  assert.equal(dateOf('chuxi', 2027), '2027-02-05')
})

test('公历固定节日与清明', () => {
  assert.equal(dateOf('new-year', 2026), '2026-01-01')
  assert.equal(dateOf('national-day', 2026), '2026-10-01')
  assert.equal(dateOf('christmas', 2026), '2026-12-25')
  assert.equal(dateOf('qingming', 2026), '2026-04-05')
  assert.equal(dateOf('qingming', 2024), '2024-04-04')
})

test('第 n 个星期几：母亲节、父亲节、感恩节', () => {
  assert.equal(dateOf('mothers-day', 2026), '2026-05-10')
  assert.equal(dateOf('fathers-day', 2026), '2026-06-21')
  assert.equal(dateOf('thanksgiving', 2026), '2026-11-26')
  assert.equal(dateOf('mothers-day', 2027), '2027-05-09')
})

test('复活节（西方教会算法）', () => {
  assert.equal(dateOf('easter', 2026), '2026-04-05')
  assert.equal(dateOf('easter', 2027), '2027-03-28')
  assert.equal(dateOf('easter', 2024), '2024-03-31')
})

test('所有节日在未来若干年都能解出日期，且落在合理范围', () => {
  for (const festival of FESTIVALS) {
    for (let year = 2026; year <= 2035; year += 1) {
      const found = festivalDateIn(festival, year)
      assert.ok(found, `${festival.name} 在 ${year} 年没有日期`)
      assert.ok(found!.month >= 1 && found!.month <= 12, `${festival.name} ${year} 月份异常`)
      assert.ok(found!.day >= 1 && found!.day <= 31, `${festival.name} ${year} 日期异常`)
    }
  }
})

test('下一次发生：含当天，跨年也能算', () => {
  const national = festivalById('national-day')!
  assert.equal(daysToFestival(national, at(2026, 9, 30)), 1)
  assert.equal(daysToFestival(national, at(2026, 10, 1)), 0)
  assert.equal(daysToFestival(national, at(2026, 10, 2)), 364 + 0, '国庆已过则算下一年')
  const newYear = festivalById('new-year')!
  assert.equal(daysToFestival(newYear, at(2026, 9, 30)), 93)
  const spring = festivalById('spring-festival')!
  assert.equal(daysToFestival(spring, at(2026, 9, 30)), 129)
  assert.equal(nextFestivalDate(spring, at(2026, 9, 30)), at(2027, 2, 6, 0))
})

test('记忆日：圣诞当天算 0 天，第二天算下一年', () => {
  const christmas = festivalById('christmas')!
  assert.equal(daysToFestival(christmas, at(2026, 12, 25, 8)), 0)
  assert.equal(daysToFestival(christmas, at(2026, 12, 26)), 364)
})
