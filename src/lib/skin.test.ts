import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_SKIN,
  NUM_AUTO,
  SKIN_PACKS,
  TEXTURE_AUTO,
  normalizeSkin,
  resolveNum,
  resolveTexture,
} from './skin.ts'
import type { NumStyle, TextureStyle } from './skin.ts'

/**
 * num / texture 的 auto 映射。
 * 断言的是「跟包走」到底走成哪个具体值——这张表以前不存在，全靠 CSS 兜底。
 */

test('软糖 auto → 圆体（proto.css --font-num 是 Baloo 2 / ui-rounded）', () => {
  assert.equal(resolveNum('jelly', 'auto'), 'round')
})

test('纸本 auto → 衬线（--font-num: Instrument Serif）', () => {
  assert.equal(resolveNum('paper', 'auto'), 'serif')
})

test('夜航 auto → 圆体（--font-num: Baloo 2 / ui-rounded，只是字重更轻）', () => {
  assert.equal(resolveNum('night', 'auto'), 'round')
})

test('像素 auto → 像素体（--font-num: Silkscreen）', () => {
  assert.equal(resolveNum('pixel', 'auto'), 'pixel')
})

test('软糖 / 夜航 auto 纹理 → 圆点', () => {
  assert.equal(resolveTexture('jelly', 'auto'), 'dots')
  assert.equal(resolveTexture('night', 'auto'), 'dots')
})

test('纸本 auto 纹理 → 横线（27/28px repeating-linear）', () => {
  assert.equal(resolveTexture('paper', 'auto'), 'lines')
})

test('像素 auto 纹理 → 方格（12px 双向 linear-gradient）', () => {
  assert.equal(resolveTexture('pixel', 'auto'), 'grid')
})

test('显式数字字体不被皮肤覆盖（四套皮肤 × 四种显式值）', () => {
  const explicit: NumStyle[] = ['round', 'serif', 'pixel', 'hand']
  for (const pack of SKIN_PACKS) {
    for (const num of explicit) {
      assert.equal(resolveNum(pack, num), num, `${pack} 选 ${num} 应保持 ${num}`)
    }
  }
})

test('显式纹理不被皮肤覆盖（四套皮肤 × 四种显式值）', () => {
  const explicit: TextureStyle[] = ['plain', 'dots', 'grid', 'lines']
  for (const pack of SKIN_PACKS) {
    for (const texture of explicit) {
      assert.equal(resolveTexture(pack, texture), texture, `${pack} 选 ${texture} 应保持 ${texture}`)
    }
  }
})

test('映射表覆盖全部皮肤包，且不会解析成 auto', () => {
  for (const pack of SKIN_PACKS) {
    assert.ok(NUM_AUTO[pack], `${pack} 缺 num 映射`)
    assert.ok(TEXTURE_AUTO[pack], `${pack} 缺 texture 映射`)
    assert.notEqual(NUM_AUTO[pack], 'auto' as string)
    assert.notEqual(TEXTURE_AUTO[pack], 'auto' as string)
  }
  assert.deepEqual(Object.keys(NUM_AUTO).sort(), [...SKIN_PACKS].sort())
  assert.deepEqual(Object.keys(TEXTURE_AUTO).sort(), [...SKIN_PACKS].sort())
})

test('默认状态就是 auto：默认包解析成圆体 + 圆点', () => {
  assert.equal(DEFAULT_SKIN.num, 'auto')
  assert.equal(DEFAULT_SKIN.texture, 'auto')
  assert.equal(resolveNum(DEFAULT_SKIN.pack, DEFAULT_SKIN.num), 'round')
  assert.equal(resolveTexture(DEFAULT_SKIN.pack, DEFAULT_SKIN.texture), 'dots')
})

test('normalizeSkin 保留 auto 原值，不做提前解析（解析只发生在渲染时）', () => {
  const skin = normalizeSkin({ pack: 'pixel', num: 'auto', texture: 'auto' })
  assert.equal(skin.num, 'auto')
  assert.equal(skin.texture, 'auto')
  // 但渲染前解析出来的就是像素皮肤该有的样子
  assert.equal(resolveNum(skin.pack, skin.num), 'pixel')
  assert.equal(resolveTexture(skin.pack, skin.texture), 'grid')
})
