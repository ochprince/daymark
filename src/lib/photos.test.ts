/**
 * 相片背景的数据层单测。
 *
 * node 里没有 IndexedDB / OffscreenCanvas，所以这里测的是「拆出来的纯函数」：
 * 缩边尺寸、mime 与体积校验、参数兜底、缓存 key 规则、超标判断；
 * 末尾再确认一遍「不支持的环境里公开 API 返回空而不是抛」。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_EDGE,
  PHOTO_MAX_SOURCE_BYTES,
  PHOTO_TARGET_BYTES,
  clearAll,
  deletePhoto,
  estimateUsage,
  fitWithin,
  getPhotoUrl,
  isImageMime,
  isPhotoPipelineSupported,
  overBudget,
  photoUrlCacheKey,
  prunePhotos,
  rejectReason,
  sanitizePhotoOptions,
  savePhoto,
} from './photos'

const KB = 1024

test('fitWithin：横图按最长边缩到 1600', () => {
  assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 })
})

test('fitWithin：竖图同样按最长边缩，比例不变', () => {
  assert.deepEqual(fitWithin(3000, 4000, 1600), { width: 1200, height: 1600 })
})

test('fitWithin：小图不放大', () => {
  assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 })
})

test('fitWithin：正方形刚好取到边长上限', () => {
  assert.deepEqual(fitWithin(2400, 2400, 1600), { width: 1600, height: 1600 })
})

test('fitWithin：极端细长图最窄也得留 1px，不能缩成 0', () => {
  const size = fitWithin(8000, 1, 1600)
  assert.deepEqual(size, { width: 1600, height: 1 })
})

test('fitWithin：尺寸非法返回 null，不画 0×0 的画布', () => {
  assert.equal(fitWithin(0, 1200, 1600), null)
  assert.equal(fitWithin(-5, 1200, 1600), null)
  assert.equal(fitWithin(Number.NaN, 900, 1600), null)
  assert.equal(fitWithin(900, Number.POSITIVE_INFINITY, 1600), null)
})

test('fitWithin：maxEdge 传坏值就退回默认 1600，缩出来的最长边仍是 1600', () => {
  assert.deepEqual(fitWithin(4000, 3000, Number.NaN), { width: 1600, height: 1200 })
  assert.deepEqual(fitWithin(4000, 3000, 0), { width: 1600, height: 1200 })
  assert.deepEqual(fitWithin(4000, 3000, 1200), { width: 1200, height: 900 })
})

test('isImageMime：只认 image/ 开头且带子类型', () => {
  assert.equal(isImageMime('image/png'), true)
  assert.equal(isImageMime('IMAGE/JPEG'), true)
  assert.equal(isImageMime('  image/heic  '), true)
  assert.equal(isImageMime('image/'), false)
  assert.equal(isImageMime('text/plain'), false)
  assert.equal(isImageMime('imagex/png'), false)
  assert.equal(isImageMime(''), false)
  assert.equal(isImageMime(undefined), false)
  assert.equal(isImageMime(null), false)
})

test('rejectReason：正常图片通过，非图片 / 空文件 / 超限各给一个原因', () => {
  assert.equal(rejectReason({ type: 'image/png', size: 3 * 1024 * KB }), null)
  assert.equal(rejectReason(null), 'no-file')
  assert.equal(rejectReason({ type: 'text/plain', size: 1024 }), 'not-image')
  assert.equal(rejectReason({ type: 'image/png', size: 0 }), 'empty')
  assert.equal(rejectReason({ type: 'image/png' }), 'empty')
  assert.equal(rejectReason({ type: 'image/jpeg', size: PHOTO_MAX_SOURCE_BYTES + 1 }), 'too-large')
  // 正好卡在上限上放行
  assert.equal(rejectReason({ type: 'image/jpeg', size: PHOTO_MAX_SOURCE_BYTES }), null)
})

test('rejectReason：上限可传小值，方便直接把「太大」这条打出来', () => {
  assert.equal(rejectReason({ type: 'image/png', size: 3 * KB }, 2 * KB), 'too-large')
  assert.equal(rejectReason({ type: 'image/png', size: 2 * KB }, 2 * KB), null)
})

test('sanitizePhotoOptions：默认值就是验收标准那三个数', () => {
  assert.deepEqual(sanitizePhotoOptions(), {
    maxEdge: PHOTO_MAX_EDGE,
    quality: PHOTO_JPEG_QUALITY,
    maxBytes: PHOTO_TARGET_BYTES,
  })
  assert.equal(PHOTO_MAX_EDGE, 1600)
  assert.equal(PHOTO_JPEG_QUALITY, 0.82)
  assert.equal(PHOTO_TARGET_BYTES, 400 * KB)
})

test('sanitizePhotoOptions：越界参数夹到边界，质量保留两位', () => {
  assert.equal(sanitizePhotoOptions({ maxEdge: 5000 }).maxEdge, 1600)
  assert.equal(sanitizePhotoOptions({ maxEdge: 10 }).maxEdge, 64)
  assert.equal(sanitizePhotoOptions({ quality: 2 }).quality, 0.95)
  assert.equal(sanitizePhotoOptions({ quality: 0 }).quality, 0.3)
  assert.equal(sanitizePhotoOptions({ quality: 0.8234 }).quality, 0.82)
  assert.equal(sanitizePhotoOptions({ maxBytes: 1 }).maxBytes, 64 * KB)
})

test('photoUrlCacheKey：一个 id 一个 key，前后空白抹掉，空 id 不占坑', () => {
  assert.equal(photoUrlCacheKey('abc'), 'daymark.photo.abc')
  assert.equal(photoUrlCacheKey('  abc  '), 'daymark.photo.abc')
  assert.equal(photoUrlCacheKey(''), '')
  assert.equal(photoUrlCacheKey('   '), '')
  assert.equal(photoUrlCacheKey(undefined), '')
  assert.equal(photoUrlCacheKey(null), '')
  assert.notEqual(photoUrlCacheKey('a'), photoUrlCacheKey('b'))
})

test('overBudget：目标是 400KB，超一点也算超，空/坏数当超标', () => {
  assert.equal(overBudget(399 * KB), false)
  assert.equal(overBudget(400 * KB), false)
  assert.equal(overBudget(401 * KB), true)
  assert.equal(overBudget(0), true)
  assert.equal(overBudget(Number.NaN), true)
  assert.equal(overBudget(5 * KB, 4 * KB), true)
})

test('node 里没有 IndexedDB / OffscreenCanvas：流水线判定为不可用', () => {
  assert.equal(isPhotoPipelineSupported(), false)
})

test('不支持的环境下公开 API 一律返回空，不抛异常', async () => {
  const file = new Blob([new Uint8Array(64)], { type: 'image/png' })

  assert.equal(await savePhoto(file), null)
  assert.equal(await savePhoto(null), null)
  assert.equal(await savePhoto(new Blob(['x'], { type: 'text/plain' })), null)
  assert.equal(await getPhotoUrl('nope'), null)
  assert.equal(await getPhotoUrl(''), null)
  assert.equal(await getPhotoUrl(undefined), null)
  assert.equal(await estimateUsage(), null)
  assert.equal(await prunePhotos(['a', 'b']), 0)
  await deletePhoto('nope')
  await clearAll()
})
