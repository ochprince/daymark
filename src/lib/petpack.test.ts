import assert from 'node:assert/strict'
import test from 'node:test'
import { compilePetPack } from './petpack'

const ENGLISH = `<?xml version="1.0"?>
<Mascot>
  <Action Name="Stand">
    <Animation>
      <Pose Image="/shime1.png" ImageAnchor="64,128" Duration="250" />
    </Animation>
  </Action>
  <Action Name="Walk">
    <Animation>
      <Pose Image="/shime1.png" Velocity="-2,0" Duration="6" />
      <Pose Image="/shime2.png" Velocity="-2,0" Duration="6" />
    </Animation>
  </Action>
  <Action Name="Dance">
    <Animation>
      <Pose Image="/dance01.png" Duration="4" />
      <Pose Image="/dance02.png" Duration="4" />
    </Animation>
  </Action>
  <Action Name="Stand">
    <ActionReference Name="Walk" />
  </Action>
</Mascot>`

const JAPANESE = `<マスコット>
  <動作 名前="立つ">
    <アニメーション>
      <ポーズ 画像="/shime1.png" 基準座標="64,128" 長さ="60" />
      <ポーズ 画像="/shime60.png" 基準座標="64,128" 長さ="1" />
    </アニメーション>
  </動作>
  <動作 名前="歩く">
    <アニメーション>
      <ポーズ 画像="/Shime2.PNG" 長さ="3" />
    </アニメーション>
  </動作>
</マスコット>`

test('英文动作表：站立不被后面的引用覆盖，跳舞单独收录', () => {
  const spec = compilePetPack(ENGLISH, ['shime1.png', 'shime2.png', 'dance01.png', 'dance02.png'])
  assert.ok(spec)
  assert.deepEqual(spec.states.stand?.map((frame) => frame.img), ['shime1.png'])
  assert.equal(spec.states.stand?.[0].durMs, 250 * 40)
  assert.deepEqual(spec.states.walk?.map((frame) => frame.img), ['shime1.png', 'shime2.png'])
  assert.deepEqual(spec.states.dance?.map((frame) => frame.img), ['dance01.png', 'dance02.png'])
  assert.equal(spec.facing, 'left')
  assert.ok(spec.authored.includes('dance'))
  assert.equal(spec.authored.includes('sit'), false)
})

test('走路速度朝右时，原画按朝右记', () => {
  const xml = `<Mascot>
    <Action Name="Stand"><Animation><Pose Image="/shime1.png" Duration="10" /></Animation></Action>
    <Action Name="Walk"><Animation><Pose Image="/shime2.png" Velocity="3,0" Duration="6" /></Animation></Action>
  </Mascot>`
  const spec = compilePetPack(xml, ['shime1.png', 'shime2.png'])
  assert.equal(spec?.facing, 'right')
})

test('日文动作表：标签和眨眼帧', () => {
  const spec = compilePetPack(JAPANESE, ['shime1.png', 'shime60.png', 'shime2.png'])
  assert.ok(spec)
  assert.deepEqual(spec.states.stand?.map((frame) => frame.img), ['shime1.png', 'shime60.png'])
  assert.equal(spec.states.stand?.[0].durMs, 60 * 40)
  assert.equal(spec.states.stand?.[1].durMs, 60)
  assert.deepEqual(spec.states.walk?.map((frame) => frame.img), ['shime2.png'])
})

test('没有动作表时用默认编号，缺的帧丢掉', () => {
  const spec = compilePetPack(null, ['shime1.png', 'shime2.png', 'shime3.png'])
  assert.ok(spec)
  assert.deepEqual(spec.states.stand?.map((frame) => frame.img), ['shime1.png'])
  assert.deepEqual(spec.states.walk?.map((frame) => frame.img), ['shime1.png', 'shime2.png', 'shime1.png', 'shime3.png'])
  assert.deepEqual(spec.authored, [])
  assert.equal(spec.facing, 'left')
})

test('站立图一张都没有就读不出来', () => {
  assert.equal(compilePetPack(ENGLISH, ['dance01.png']), null)
  assert.equal(compilePetPack(null, ['readme.txt']), null)
})
