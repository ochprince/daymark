import assert from 'node:assert/strict'
import test from 'node:test'
import { setLocaleForTest } from './i18n/locale'
import type { ItemView } from './itemview'
import { bubbleLine } from './lines.ts'

setLocaleForTest('zh')

/** 只关心 kind / days / mood，其余字段这条线用不到 */
const countdownView = (days: number) =>
  ({ kind: 'countdown', days, mood: 'idle' } as unknown as ItemView)

test('过了那天：气泡不重复卡片正中间那句话，也不出现负数', () => {
  const line = bubbleLine(countdownView(-1))
  assert.equal(line, '那天已经过了，我陪你记着。')
  assert.ok(!line.includes('-1'), `气泡里不该出现负数：${line}`)
  // 「已经过去 N 天」是卡片大数字那一行的原文，气泡里再念一遍就是两行一样的话
  assert.ok(!line.includes('已经过去'), `气泡不该复述大数字：${line}`)
})

test('就是今天 / 快到了 / 还早，各自的说法不变', () => {
  assert.equal(bubbleLine(countdownView(0)), '就是今天！')
  assert.equal(bubbleLine(countdownView(2)), '只剩 2 天了，东西都准备好了吗？')
  assert.ok(bubbleLine(countdownView(30)).includes('30'))
})
