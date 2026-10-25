import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addTodo,
  cleanTodoText,
  MEMO_TEXT_MAX,
  normalizeTodo,
  removeTodo,
  renameTodo,
  TODO_MAX_ITEMS,
  TODO_TEXT_MAX,
  todoProgress,
  toggleTodo,
} from './todo'
import type { TodoItem } from './types'

const list = (...texts: string[]): TodoItem[] => texts.map((text) => ({ text, done: false }))

test('normalizeTodo：不是数组的脏数据一律收敛成空清单', () => {
  for (const junk of [undefined, null, 42, '待办', {}, { length: 2 }]) {
    assert.deepEqual(normalizeTodo(junk), [])
  }
})

test('normalizeTodo：丢掉空文本与非对象，字符串项按纯文本收下', () => {
  const out = normalizeTodo([
    { text: '买牛奶', done: true },
    { text: '   ', done: false },
    { text: 123 },
    null,
    undefined,
    { done: true },
    '手动塞进来的字符串',
    { text: '还信用卡', done: 'yes' },
  ])
  assert.deepEqual(out, [
    { text: '买牛奶', done: true },
    { text: '手动塞进来的字符串', done: false },
    { text: '还信用卡', done: false },
  ])
})

test('normalizeTodo：压空白、去重（先出现的为准）、限量', () => {
  assert.deepEqual(normalizeTodo([{ text: '  买\n\n牛奶  ', done: false }]), [{ text: '买 牛奶', done: false }])

  const dup = normalizeTodo([
    { text: '浇花', done: false },
    { text: ' 浇花 ', done: true },
    { text: '浇花', done: true },
  ])
  assert.deepEqual(dup, [{ text: '浇花', done: false }])

  const many = normalizeTodo(Array.from({ length: TODO_MAX_ITEMS + 20 }, (_, i) => ({ text: `第 ${i} 条`, done: false })))
  assert.equal(many.length, TODO_MAX_ITEMS)
  assert.equal(many[0]?.text, '第 0 条')
})

test('cleanTodoText：限长、非字符串算空、备忘有更宽的上限', () => {
  assert.equal(cleanTodoText('x'.repeat(TODO_TEXT_MAX + 50)).length, TODO_TEXT_MAX)
  assert.equal(cleanTodoText(null), '')
  assert.equal(cleanTodoText({ text: 'a' }), '')
  assert.equal(cleanTodoText('y'.repeat(MEMO_TEXT_MAX + 50), MEMO_TEXT_MAX).length, MEMO_TEXT_MAX)
})

test('addTodo：正常追加，返回新数组且不改原数组', () => {
  const before = list('浇花')
  const after = addTodo(before, '  买牛奶  ')
  assert.deepEqual(after, [
    { text: '浇花', done: false },
    { text: '买牛奶', done: false },
  ])
  assert.notEqual(after, before)
  assert.equal(before.length, 1)
  assert.deepEqual(before, [{ text: '浇花', done: false }])
})

test('addTodo：空文本 / 纯空白拒绝，重名拒绝，满了拒绝', () => {
  const before = list('浇花')
  assert.equal(addTodo(before, ''), before)
  assert.equal(addTodo(before, '   \n '), before)
  assert.equal(addTodo(before, '浇花'), before)
  assert.equal(addTodo(before, ' 浇花 '), before)

  const full = normalizeTodo(Array.from({ length: TODO_MAX_ITEMS }, (_, i) => ({ text: `第 ${i} 条`, done: false })))
  assert.equal(addTodo(full, '再来一条'), full)
})

test('addTodo：超长文本被截断再存', () => {
  const [item] = addTodo([], 'a'.repeat(TODO_TEXT_MAX + 30))
  assert.equal(item?.text.length, TODO_TEXT_MAX)
})

test('toggleTodo：勾上再取消，只动目标那条', () => {
  const before = list('浇花', '买牛奶')
  const once = toggleTodo(before, '0')
  assert.deepEqual(once, [
    { text: '浇花', done: true },
    { text: '买牛奶', done: false },
  ])
  const twice = toggleTodo(once, 0)
  assert.deepEqual(twice, [
    { text: '浇花', done: false },
    { text: '买牛奶', done: false },
  ])
  assert.notEqual(once, before)
  assert.deepEqual(before, list('浇花', '买牛奶'))
})

test('toggleTodo：id 越界或不是整数时原样返回', () => {
  const before = list('浇花')
  for (const bad of ['1', '-1', 'abc', 1.5, '', 99]) {
    assert.equal(toggleTodo(before, bad), before)
  }
})

test('removeTodo：删掉中间一条，其余顺序不变', () => {
  const before = list('一', '二', '三')
  const after = removeTodo(before, '1')
  assert.deepEqual(after, [
    { text: '一', done: false },
    { text: '三', done: false },
  ])
  assert.equal(before.length, 3)
  assert.equal(removeTodo(before, '9'), before)
})

test('renameTodo：改文字、保留 done，空文本与重名拒绝', () => {
  const before: TodoItem[] = [
    { text: '浇花', done: true },
    { text: '买牛奶', done: false },
  ]
  const after = renameTodo(before, '0', '  浇  花（阳台） ')
  assert.deepEqual(after, [
    { text: '浇 花（阳台）', done: true },
    { text: '买牛奶', done: false },
  ])
  assert.equal(renameTodo(before, '0', '   '), before)
  assert.equal(renameTodo(before, '0', '买牛奶'), before)
  assert.equal(before[0]?.text, '浇花')
})

test('todoProgress：数勾掉的与总数，脏数据算空', () => {
  assert.deepEqual(todoProgress([]), { done: 0, total: 0 })
  assert.deepEqual(todoProgress(undefined), { done: 0, total: 0 })
  assert.deepEqual(todoProgress(list('a', 'b')), { done: 0, total: 2 })
  assert.deepEqual(
    todoProgress([
      { text: 'a', done: true },
      { text: 'b', done: false },
      { text: 'c', done: true },
    ]),
    { done: 2, total: 3 },
  )
})

test('批量操作全是纯函数：同样的输入反复调用结果一致，原数组永不被改', () => {
  const before: TodoItem[] = [
    { text: '一', done: false },
    { text: '二', done: true },
  ]
  const snapshot = JSON.stringify(before)
  const step1 = addTodo(before, '三')
  const step2 = toggleTodo(step1, '0')
  const step3 = renameTodo(step2, '1', '二二')
  const step4 = removeTodo(step3, '2')
  assert.equal(JSON.stringify(before), snapshot)
  assert.deepEqual(
    step4,
    [
      { text: '一', done: true },
      { text: '二二', done: true },
    ],
  )
  // 每一步都是新数组，链路里没有一步复用上一步的引用
  for (const arr of [step1, step2, step3, step4]) assert.notEqual(arr, before)
  assert.deepEqual(step4, removeTodo(renameTodo(toggleTodo(addTodo(before, '三'), '0'), '1', '二二'), '2'))
})
