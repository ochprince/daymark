import assert from 'node:assert/strict'
import test from 'node:test'
import { frenzyKind } from './frenzy.ts'

test('没有客人：连戳五下是它自己出门', () => {
  assert.equal(frenzyKind(false), 'debut')
})

test('有客人在场：变成两只一起玩，主人不出门', () => {
  assert.equal(frenzyKind(true), 'play')
})
