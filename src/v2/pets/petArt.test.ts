import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decoratePetSvg,
  faceForState,
  petHueVars,
  petSvgKey,
  renderPetSvg,
  stripHueVars,
  uniqueClipIds,
} from './petArt'

/** 一段和正式素材同构的迷你 SVG（根 style 带全套变量 + cb0 clip + data-face 占位） */
const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" style="--c:#8fe3c0;--c2:#2fa77a;--cr-line:#2b2638;--cr-lw:4.5;--leaf:#7bd389;--petal:#fff">
  <defs>
  <clipPath id="cb0"><circle cx="100" cy="128" r="58"/></clipPath>
  <radialGradient id="cb0-sh"><stop offset="1" stop-color="var(--c2)" stop-opacity=".4"/></radialGradient>
  </defs>
  <g clip-path="url(#cb0)"><ellipse cx="100" cy="150" rx="40" ry="20" fill="url(#cb0-sh)"/></g>
  <g class="cr-face" data-face="122,20,0,"/>
</svg>`

const deco = (state: Parameters<typeof decoratePetSvg>[1]['state'], uid = 'u1') =>
  decoratePetSvg(SAMPLE, { state, size: 64, species: 'sprout', stage: 3, uid })

/** 只截出换进去的那张脸，用来比对形状 */
const faceOf = (svg: string) => svg.slice(svg.indexOf('class="cr-face"'))

test('键名：蛋形态（egg:true）走 dough-<species>-<crack>', () => {
  assert.equal(petSvgKey({ species: 'sprout', stage: 0, egg: true }), 'dough-sprout-0')
  assert.equal(petSvgKey({ species: 'moon', stage: 0, crack: 3, egg: true }), 'dough-moon-3')
  // crack 收进 0–3，非法值不炸
  assert.equal(petSvgKey({ species: 'drop', stage: 0, crack: 9, egg: true }), 'dough-drop-3')
  assert.equal(petSvgKey({ species: 'drop', stage: 0, crack: -2, egg: true }), 'dough-drop-0')
  assert.equal(petSvgKey({ species: 'drop', stage: 0, crack: Number.NaN, egg: true }), 'dough-drop-0')
  // stage 0 不是蛋：五天内的第一个形态要真的有素材
  assert.equal(petSvgKey({ species: 'sprout', stage: 0 }), 'sprout-0')
  assert.equal(petSvgKey({ species: 'star', stage: 4 }), 'star-4')
})

test('键名：post 走 post-<hold>，其它走 <species>-<stage>', () => {
  assert.equal(petSvgKey({ species: 'post', stage: 2, hold: 'gift' }), 'post-gift')
  assert.equal(petSvgKey({ species: 'post', stage: 2 }), 'post-letter')
  assert.equal(petSvgKey({ species: 'star', stage: 4 }), 'star-4')
  assert.equal(petSvgKey({ species: 'star', stage: 1 }), 'star-1')
})

test('状态 → 表情：sleep / happy / wow / idle 四档', () => {
  assert.equal(faceForState('sleep'), 'sleep')
  assert.equal(faceForState('cheer'), 'happy')
  assert.equal(faceForState('drag'), 'wow')
  assert.equal(faceForState('fall'), 'wow')
  for (const s of ['stand', 'walk', 'sit', 'climb', 'idle'] as const) {
    assert.equal(faceForState(s), 'idle', `${s} 应该是 idle 脸`)
  }
})

test('clip id 去重：cb0 / cb0-sh 全部换成实例唯一前缀', () => {
  const a = uniqueClipIds(SAMPLE, 'petA')
  const b = uniqueClipIds(SAMPLE, 'petB')
  assert.ok(a.includes('id="cbpetA"'))
  assert.ok(a.includes('id="cbpetA-sh"'))
  assert.ok(a.includes('url(#cbpetA)'))
  assert.ok(a.includes('url(#cbpetA-sh)'))
  assert.ok(!/\bcb0\b/.test(a), '不能再有 cb0')
  assert.ok(!/\bcb0\b/.test(b))
  assert.notEqual(a.match(/id="cb[^"]*"/)![0], b.match(/id="cb[^"]*"/)![0])
  // uid 里的非法字符被清掉，不会破坏选择器
  assert.ok(uniqueClipIds(SAMPLE, 'a b/c').includes('id="cbabc"'))
})

test('根 style 只剥 --c / --c2，别的变量原样留着', () => {
  const s = stripHueVars('--c:#8fe3c0;--c2:#2fa77a;--cr-line:#2b2638;--cr-lw:4.5;--leaf:#7bd389')
  assert.ok(!s.includes('--c:'), '不该再有 --c')
  assert.ok(!s.includes('--c2:'), '不该再有 --c2')
  assert.ok(s.includes('--cr-line:#2b2638'))
  assert.ok(s.includes('--cr-lw:4.5'))
  assert.ok(s.includes('--leaf:#7bd389'))
  // 只有 --c 时也要收成空串，不能留 ';'
  assert.equal(stripHueVars('--c:#fff'), '')
})

test('注入后的根标签：class / data-mood / viewBox / 尺寸 / aria-hidden / 无 --c', () => {
  const svg = deco('sleep')
  const root = svg.slice(0, svg.indexOf('>') + 1)
  const cls = root.match(/class="([^"]*)"/)![1].split(' ')
  for (const want of ['pet-art', 'pet-art--sleep', 'pet-art--ssleep', 'cr', 'cr--sprout', 'cr--s3']) {
    assert.ok(cls.includes(want), `缺类名 ${want}（实际 ${cls.join(' ')}）`)
  }
  assert.ok(root.includes('data-state="sleep"'))
  assert.ok(root.includes('data-mood="sleep"'))
  assert.ok(root.includes('viewBox="0 0 200 200"'))
  assert.ok(root.includes('width="64"') && root.includes('height="64"'))
  assert.ok(root.includes('aria-hidden="true"'))
  assert.ok(!root.includes('--c:'), '根标签里不该再有设计师写死的 --c')
  assert.ok(!root.includes('--c2:'), '根标签里不该再有设计师写死的 --c2')
  assert.ok(root.includes('--cr-line:#2b2638'), '描边等变量要保留')
  assert.ok(!svg.includes('width="200"'), '旧尺寸要换掉')
})

test('data-face 占位被换成真表情，四种脸形状确实不同', () => {
  const idle = deco('stand')
  const sleep = deco('sleep')
  const happy = deco('cheer')
  const wow = deco('fall')
  for (const s of [idle, sleep, happy, wow]) {
    assert.ok(!s.includes('data-face'), '占位要消失')
    assert.ok(s.includes('pet-blush'), '腮红在')
  }

  // idle：圆眼 + 高光点 + 微笑弧
  assert.ok(faceOf(idle).includes('class="pet-eyes"'))
  assert.ok(faceOf(idle).includes('Q100'), 'idle 有微笑弧')

  // sleep：闭眼弧（fill=none 的二次曲线）+ 鼻尖小椭圆，没有眼珠
  assert.ok(!faceOf(sleep).includes('class="pet-eyes"'))
  assert.ok(faceOf(sleep).includes('fill="none"'))
  assert.ok(faceOf(sleep).includes('rx="3.5" ry="4"'), 'sleep 有鼻尖小椭圆')

  // happy：弯月眼（C 曲线闭合）+ 张嘴（mouth 变量）
  assert.ok(!faceOf(happy).includes('class="pet-eyes"'))
  assert.ok(faceOf(happy).includes('fill="var(--mouth, #e5664b)"'))
  assert.ok(faceOf(happy).includes('C'), 'happy 弯月眼是贝塞尔')

  // wow：眼珠更大 + 椭圆张嘴
  assert.ok(faceOf(wow).includes('class="pet-eyes"'))
  assert.match(faceOf(wow), /rx="7\.5" ry="8\.5"/)
  assert.ok(faceOf(wow).includes('rx="5" ry="6"'), 'wow 是椭圆嘴')

  // 四张脸两两不同
  const faces = new Set([faceOf(idle), faceOf(sleep), faceOf(happy), faceOf(wow)])
  assert.equal(faces.size, 4, '四种表情必须各不相同')
})

test('表情跟着状态实时变：walk/sit/climb 是 idle 脸，sleep/cheer/fall 换脸', () => {
  const idleFace = faceOf(deco('stand'))
  for (const s of ['walk', 'sit', 'climb'] as const) {
    assert.equal(faceOf(deco(s)), idleFace, `${s} 用 idle 脸`)
  }
  assert.notEqual(faceOf(deco('sleep')), idleFace)
  assert.notEqual(faceOf(deco('cheer')), idleFace)
  assert.notEqual(faceOf(deco('fall')), idleFace)
  assert.equal(faceOf(deco('drag')), faceOf(deco('fall')), 'drag 与 fall 都是 wow')
})

test('底图写了 force 时用这张脸：面团第一张是闭眼，不跟实时的 idle', () => {
  const raw = SAMPLE.replace('data-face="122,20,0,"', 'data-face="138,17,1,sleep"')
  const svg = decoratePetSvg(raw, { state: 'stand', size: 210, species: 'post', stage: 0, uid: 'egg0' })
  assert.ok(!faceOf(svg).includes('class="pet-eyes"'), '闭眼不该有眼珠')
  assert.ok(faceOf(svg).includes('fill="none"'))
  assert.ok(faceOf(svg).includes('rx="3.5" ry="4"'), '闭眼有鼻尖')
})

test('small 为真时脸缩到 0.8，sx 控制两眼间距', () => {
  const big = decoratePetSvg(SAMPLE, { state: 'stand', size: 64, species: 'sprout', stage: 3, uid: 'x' })
  const smallRaw = SAMPLE.replace('data-face="122,20,0,"', 'data-face="138,17,1,"')
  const small = decoratePetSvg(smallRaw, { state: 'stand', size: 64, species: 'sprout', stage: 0, uid: 'x' })
  // 眼距：100-20=80 / 100+20=120；缩到 sx=17 则是 83 / 117
  assert.ok(faceOf(big).includes('cx="80"') && faceOf(big).includes('cx="120"'))
  assert.ok(faceOf(small).includes('cx="83"') && faceOf(small).includes('cx="117"'))
  // 半径按 0.8 缩：idle 圆眼 rx 5.8*1=5.8 → 5.8*0.8=4.64
  assert.ok(faceOf(small).includes('rx="4.64"'), 'small 时眼珠缩到 0.8')
})

test('没有素材时回退到程序生成器，不白屏', () => {
  // node --test 下 import.meta.glob 不存在 → ASSETS 为空，正好走回退分支
  const svg = renderPetSvg({ species: 'moon', stage: 3, size: 80, hue: 2, mood: 'sleep', uid: 'fb1' })
  assert.match(svg, /^<svg class="pet-art/)
  assert.ok(svg.includes('data-state="sleep"'))
  assert.ok(svg.includes('pet-art--ssleep'), '回退也要有状态 class')
  assert.ok(svg.includes('pet-art--sleep'), '回退也要有表情 class')
  assert.ok(svg.includes('cr--moon'))
  assert.ok(svg.includes('width="80"'))
  assert.ok(svg.includes('fill="var(--c)"'), '回退造型同样吃 CSS 变量')
})

test('色相令牌与 hue.ts 同源（mint / coral 抽查）', () => {
  assert.deepEqual(petHueVars(4), { '--c': '#8fe3c0', '--c2': '#2fa77a' })
  assert.deepEqual(petHueVars(1), { '--c': '#ffb4a2', '--c2': '#e5664b' })
  // 越界索引也要收得住
  assert.deepEqual(petHueVars(9), petHueVars(1))
})
