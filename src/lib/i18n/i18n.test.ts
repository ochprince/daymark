import assert from 'node:assert/strict'
import test from 'node:test'
import { intlLocale, MESSAGES, t, tIn } from './index'
import { setLocaleForTest } from './locale'
import { zh } from './zh'
import { en } from './en'

setLocaleForTest('zh')

test('中英文案表 key 完全对齐', () => {
  const zhKeys = Object.keys(zh).sort()
  const enKeys = Object.keys(en).sort()
  assert.deepEqual(enKeys, zhKeys)
  assert.ok(zhKeys.length > 100, '文案表至少要有 100 条')
})

test('占位符插值，缺参数时保留原样', () => {
  setLocaleForTest('zh')
  assert.equal(t('stage.since.label', { n: 12 }), '第 12 天')
  assert.equal(t('stage.since.label'), '第 {n} 天')
  setLocaleForTest('en')
  assert.equal(t('stage.since.label', { n: 12 }), 'Day 12')
})

test('复数：英文按 1 / 其他，中文两格一致', () => {
  setLocaleForTest('en')
  assert.equal(t('unit.day', { n: 1 }), '1 day')
  assert.equal(t('unit.day', { n: 2 }), '2 days')
  assert.equal(t('switcher.count', { n: 1 }), '1 item')
  assert.equal(t('switcher.count', { n: 3 }), '3 items')
  setLocaleForTest('zh')
  assert.equal(t('unit.day', { n: 1 }), '1 天')
  assert.equal(t('unit.day', { n: 3 }), '3 天')
})

test('切换语言立刻生效，tIn 可以指定语言', () => {
  setLocaleForTest('en')
  assert.equal(t('tab.today'), 'Today')
  assert.equal(tIn('zh', 'tab.today'), '今天')
  setLocaleForTest('zh')
  assert.equal(t('tab.today'), '今天')
})

test('Intl 地区码', () => {
  assert.equal(intlLocale('zh'), 'zh-CN')
  assert.equal(intlLocale('en'), 'en-US')
})

test('文案表没有空串', () => {
  for (const [locale, table] of Object.entries(MESSAGES)) {
    for (const [key, value] of Object.entries(table)) {
      const texts = typeof value === 'string' ? [value] : [value.one, value.other]
      for (const text of texts) {
        assert.ok(text.trim().length > 0, `${locale}:${key} 是空的`)
      }
    }
  }
})
