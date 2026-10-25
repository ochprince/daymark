/**
 * sharefit 的几何单测：相片 cover 裁剪 + 票根虚线/缺口 + 编号。
 * 这些全是纯函数，node 里直接跑，不需要 canvas。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  coverCrop,
  dashLine,
  fnv1a,
  notchArc,
  ticketHoles,
  ticketSerial,
  type Size,
} from './sharefit'

/** 分享卡的画框 */
const FRAME: Size = { width: 1080, height: 1920 }
const EPS = 1e-6

function near(a: number, b: number, message?: string): void {
  assert.ok(Math.abs(a - b) < 1e-6, message ?? `${a} ≉ ${b}`)
}

/* ------------------------------------------------------------ coverCrop */

test('coverCrop：宽图按高度撑满，左右各裁一半，纵向不裁', () => {
  const crop = coverCrop({ width: 1600, height: 900 }, FRAME)
  assert.ok(crop)
  // scale = max(1080/1600, 1920/900) = 2.1333…
  const scale = Math.max(FRAME.width / 1600, FRAME.height / 900)
  near(crop.sw, FRAME.width / scale)
  near(crop.sh, 900)
  near(crop.sy, 0)
  near(crop.sx, (1600 - crop.sw) / 2)
  assert.ok(crop.sw < 1600, '宽图必须被裁窄')
})

test('coverCrop：高图按宽度撑满，只裁上下', () => {
  const crop = coverCrop({ width: 1000, height: 2000 }, FRAME)
  assert.ok(crop)
  const scale = Math.max(FRAME.width / 1000, FRAME.height / 2000)
  near(crop.sw, 1000)
  near(crop.sh, FRAME.height / scale)
  near(crop.sx, 0)
  near(crop.sy, (2000 - crop.sh) / 2)
})

test('coverCrop：正好 9:16 的图整张都用，不裁不缩', () => {
  const crop = coverCrop({ width: 900, height: 1600 }, FRAME)
  assert.ok(crop)
  near(crop.sx, 0)
  near(crop.sy, 0)
  near(crop.sw, 900)
  near(crop.sh, 1600)
})

test('coverCrop：正方形图从中间横切一条竖条', () => {
  const crop = coverCrop({ width: 1000, height: 1000 }, FRAME)
  assert.ok(crop)
  near(crop.sw, (FRAME.width / FRAME.height) * 1000)
  near(crop.sh, 1000)
  near(crop.sx, (1000 - crop.sw) / 2)
  near(crop.sy, 0)
})

test('coverCrop：极端长条图也不会算出非法矩形', () => {
  const wide = coverCrop({ width: 10000, height: 1 }, FRAME)
  assert.ok(wide)
  assert.ok(Number.isFinite(wide.sw) && wide.sw > 0)
  assert.ok(Number.isFinite(wide.sx))
  near(wide.sh, 1)
  // 一像素高的图铺满 1920：裁出来的宽度只剩 1080/1920
  near(wide.sw, FRAME.width / FRAME.height)

  const tall = coverCrop({ width: 1, height: 10000 }, FRAME)
  assert.ok(tall)
  near(tall.sw, 1)
  near(tall.sh, FRAME.height / FRAME.width)
})

test('coverCrop：零宽 / 零高 / NaN / 负数一律返回 null（零宽漏斗）', () => {
  assert.equal(coverCrop({ width: 0, height: 900 }, FRAME), null)
  assert.equal(coverCrop({ width: 900, height: 0 }, FRAME), null)
  assert.equal(coverCrop({ width: Number.NaN, height: 900 }, FRAME), null)
  assert.equal(coverCrop({ width: -10, height: -10 }, FRAME), null)
  assert.equal(coverCrop({ width: 900, height: 900 }, { width: 0, height: 1920 }), null)
  assert.equal(coverCrop({ width: Infinity, height: 900 }, FRAME), null)
})

test('coverCrop：任何比例的图，裁出来的块都在图内且比例正好等于画框', () => {
  const ratios = [0.05, 0.3, 0.9, 1, 1.6, 4, 40]
  for (const ratio of ratios) {
    const image = { width: 1000, height: Math.round(1000 * ratio) || 1 }
    const crop = coverCrop(image, FRAME)
    assert.ok(crop, `ratio ${ratio} 应该能裁`)
    assert.ok(crop.sx >= -EPS && crop.sx + crop.sw <= image.width + EPS, `ratio ${ratio} 横向越界`)
    assert.ok(crop.sy >= -EPS && crop.sy + crop.sh <= image.height + EPS, `ratio ${ratio} 纵向越界`)
    near(crop.sw / crop.sh, FRAME.width / FRAME.height)
  }
})

/* -------------------------------------------------------------- dashLine */

test('dashLine：1000px 上 dash22/gap18 拆成 25 段，段间正好 18', () => {
  const segments = dashLine({ x: 0, y: 200 }, { x: 1000, y: 200 }, 22, 18)
  assert.equal(segments.length, 25)
  for (const [index, segment] of segments.entries()) {
    near(segment.y1, 200)
    near(segment.y2, 200)
    near(segment.x2 - segment.x1, 22, `第 ${index} 段长度`)
    if (index > 0) near(segment.x1 - segments[index - 1].x2, 18, `第 ${index} 段间隔`)
  }
  assert.ok(segments[segments.length - 1].x2 <= 1000 + EPS)
})

test('dashLine：最后一段被截断，绝不画到线外', () => {
  const segments = dashLine({ x: 100, y: 0 }, { x: 180, y: 0 }, 30, 20)
  assert.equal(segments.length, 2)
  near(segments[0].x2, 130)
  near(segments[1].x1, 150)
  near(segments[1].x2, 180)
})

test('dashLine：斜线按真实长度拆，端点落在直线上', () => {
  const segments = dashLine({ x: 0, y: 0 }, { x: 30, y: 40 }, 10, 10)
  assert.equal(segments.length, 3)
  const length = Math.hypot(30, 40)
  near(Math.hypot(segments[0].x2, segments[0].y2), 10)
  assert.ok(Math.hypot(segments[2].x1, segments[2].y1) <= length + EPS)
})

test('dashLine：dash<=0 / 零长度 / NaN 返回空数组', () => {
  assert.deepEqual(dashLine({ x: 0, y: 0 }, { x: 100, y: 0 }, 0, 10), [])
  assert.deepEqual(dashLine({ x: 0, y: 0 }, { x: 100, y: 0 }, -5, 10), [])
  assert.deepEqual(dashLine({ x: 50, y: 50 }, { x: 50, y: 50 }, 10, 10), [])
  assert.deepEqual(dashLine({ x: 0, y: 0 }, { x: Number.NaN, y: 0 }, 10, 10), [])
})

/* ------------------------------------------------------------- notchArc */

test('notchArc：左侧缺口从上方经票内到下方，弦在票框线上', () => {
  const notch = notchArc({ x: 40, y: 500 }, 44, 'left', 16)
  assert.equal(notch.points.length, 17)
  const first = notch.points[0]
  const middle = notch.points[8]
  const last = notch.points[16]
  near(first.x, 40)
  near(first.y, 456)
  near(last.x, 40)
  near(last.y, 544)
  // 左缺口向票内（右侧）鼓
  near(middle.x, 84)
  near(middle.y, 500)
  for (const point of notch.points) {
    near(Math.hypot(point.x - 40, point.y - 500), 44)
    assert.ok(point.x >= 40 - EPS, '左缺口不能鼓到票外')
  }
})

test('notchArc：右侧缺口向票内（左侧）鼓', () => {
  const notch = notchArc({ x: 1040, y: 500 }, 44, 'right', 8)
  near(notch.points[0].x, 1040)
  near(notch.points[4].x, 996)
  for (const point of notch.points) assert.ok(point.x <= 1040 + EPS)
})

/* ------------------------------------------------------------ ticketHoles */

test('ticketHoles：两条打孔线，虚线段落在两个缺口之间', () => {
  const holes = ticketHoles(FRAME, [452, 1408], { inset: 40, notchRadius: 44, dash: 22, gap: 18 })
  assert.equal(holes.length, 2)
  assert.deepEqual(
    holes.map((hole) => hole.y),
    [452, 1408],
  )
  for (const hole of holes) {
    assert.ok(hole.segments.length > 5)
    for (const segment of hole.segments) {
      near(segment.y1, hole.y)
      near(segment.y2, hole.y)
      assert.ok(segment.x1 >= 84 - EPS, '虚线不能穿进左侧缺口')
      assert.ok(segment.x2 <= 996 + EPS, '虚线不能穿进右侧缺口')
    }
    const [left, right] = hole.notches
    assert.equal(left.side, 'left')
    assert.equal(right.side, 'right')
    near(left.center.x, 40)
    near(right.center.x, 1040)
    near(left.center.y, hole.y)
  }
})

test('ticketHoles：脏输入不抛异常（非法 y 跳过、画布太窄就没有虚线）', () => {
  assert.deepEqual(ticketHoles({ width: 0, height: 0 }, [100]), [])
  const holes = ticketHoles(FRAME, [Number.NaN, -50, 5000])
  assert.equal(holes.length, 2)
  assert.equal(holes[0].y, 0)
  assert.equal(holes[1].y, FRAME.height)
  const narrow = ticketHoles({ width: 60, height: 500 }, [100], { inset: 40, notchRadius: 44 })
  assert.equal(narrow.length, 1)
  assert.deepEqual(narrow[0].segments, [])
  assert.equal(ticketHoles(FRAME, [], {}).length, 0)
})

/* ----------------------------------------------------------- ticketSerial */

test('ticketSerial：同样的输入永远同一个号，格式 6 位大写字母数字', () => {
  const a = ticketSerial('quit|since:1', '2026-10-25')
  const b = ticketSerial('quit|since:1', '2026-10-25')
  assert.equal(a, b)
  assert.match(a, /^[0-9A-Z]{6}$/)
})

test('ticketSerial：换一天或换一件事就换号，且不同序号碰撞极少', () => {
  const base = ticketSerial('quit|since:1', '2026-10-25')
  assert.notEqual(base, ticketSerial('quit|since:1', '2026-10-26'))
  assert.notEqual(base, ticketSerial('read|since:2', '2026-10-25'))
  const seen = new Set<string>()
  for (let day = 1; day <= 28; day += 1) {
    seen.add(ticketSerial(`item-${day % 5}`, `2026-10-${`${day}`.padStart(2, '0')}`))
  }
  assert.ok(seen.size >= 27, '同类事项的日号不该大面积撞车')
})

test('fnv1a：空串有固定初值，中文与 ASCII 都能稳定落值', () => {
  assert.equal(fnv1a(''), 0x811c9dc5)
  assert.equal(fnv1a('daymark'), fnv1a('daymark'))
  assert.notEqual(fnv1a('daymark'), fnv1a('Daymark'))
  assert.ok(fnv1a('戒烟') > 0)
})
