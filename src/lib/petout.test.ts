import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePetOut } from './petout.ts'

test('没存过 / 存坏了，都当成在家里', () => {
  assert.equal(parsePetOut(null).out, false)
  assert.equal(parsePetOut('').out, false)
  assert.equal(parsePetOut('不是 json').out, false)
  assert.equal(parsePetOut('{"out":"yes"}').out, false)
  assert.equal(parsePetOut('null').out, false)
})

test('出门的身份跟着一起存，刷新后不会变成卡片里临时那只', () => {
  const snap = parsePetOut(
    JSON.stringify({ out: true, from: 'since:c1', species: 'moon', stage: 2, hue: 3 }),
  )
  assert.equal(snap.out, true)
  assert.equal(snap.from, 'since:c1')
  assert.equal(snap.species, 'moon')
  assert.equal(snap.stage, 2)
  assert.equal(snap.hue, 3)
})

test('字段类型不对就当作没存，不把脏数据塞进物理层', () => {
  const snap = parsePetOut(JSON.stringify({ out: true, stage: '2', hue: null, from: 7 }))
  assert.equal(snap.out, true)
  assert.equal(snap.stage, null)
  assert.equal(snap.hue, null)
  assert.equal(snap.from, null)
})
