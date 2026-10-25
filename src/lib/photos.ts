/**
 * 相片背景的图片仓库。
 *
 * 为什么单独放 IndexedDB：手机照片动辄 3–5 MB，塞进 localStorage 会直接爆配额，
 * 所以 localStorage 里只留一个 id（DayEvent / CheckInEvent / CountdownEvent 的 photoId），
 * 像素数据落在 IndexedDB 的 daymark-photos/photos 表里。
 *
 * 三条硬约定：
 * 1. 上传即压缩：最长边 1600px、JPEG 0.82，目标单张 < 400 KB。只用
 *    createImageBitmap + OffscreenCanvas，不引第三方库。
 * 2. 任何一步不支持 / 失败 / 配额满，一律返回 null 静默退回「没有照片」，
 *    绝不把异常抛给调用方 —— 记一件事不能因为配图失败而断掉。
 * 3. 预览用 objectURL，按 id 缓存复用，删图时一并 revoke，避免内存泄漏。
 *
 * 可测的纯函数（缩放尺寸、类型与配额校验、缓存 key 规则）都单独导出，
 * 见 photos.test.ts：node 里没有 IndexedDB，只有这些能在单测里跑。
 */

/** 压缩后的最长边（px） */
export const PHOTO_MAX_EDGE = 1600
/** JPEG 质量 */
export const PHOTO_JPEG_QUALITY = 0.82
/** 单张目标体积（400 KB） */
export const PHOTO_TARGET_BYTES = 400 * 1024
/** 原图体积上限（20 MB）：再大就不像手机照片了，多半是误选了大视频/RAW */
export const PHOTO_MAX_SOURCE_BYTES = 20 * 1024 * 1024

const DB_NAME = 'daymark-photos'
const DB_VERSION = 1
const STORE = 'photos'
/** 对象 URL 缓存的 key 前缀，写在 key 里便于排查（不进 localStorage） */
const URL_KEY_PREFIX = 'daymark.photo.'

export type Size = { width: number; height: number }

/** IndexedDB 里的一行：blob + 压缩后的尺寸，展示时不用再解码才知道比例 */
export type PhotoRecord = {
  id: string
  blob: Blob
  width: number
  height: number
  /** blob.size 的副本，estimateUsage 直接累加，省得把 blob 全读出来 */
  size: number
  createdAt: number
}

export type SavePhotoOptions = {
  /** 最长边，默认 1600，上限也是 1600 */
  maxEdge?: number
  /** JPEG 质量，默认 0.82 */
  quality?: number
  /** 单张体积上限，默认 400 KB */
  maxBytes?: number
}

export type PhotoUsage = {
  /** 库里存了几张 */
  photos: number
  /** 这些照片合计多少字节（压缩后的实际占用） */
  bytes: number
  /** 浏览器给本站的配额（拿不到就是 0） */
  quota: number
  /** 全站已用（含 localStorage、Cache Storage 等，拿不到就是 0） */
  usage: number
}

/** 被拒的原因，只用于内部判断与测试，不对外暴露文案 */
export type PhotoRejectReason = 'no-file' | 'not-image' | 'empty' | 'too-large'

/* ------------------------------------------------------------------ 纯函数 */

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/**
 * 等比缩到最长边不超过 maxEdge；本来就小的图不放大，返回原尺寸。
 * 尺寸非法（0、负数、NaN、Infinity）返回 null —— 宁可不显示，也别画一张 0×0 的画布。
 */
export function fitWithin(width: number, height: number, maxEdge: number = PHOTO_MAX_EDGE): Size | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width < 1 || height < 1) return null

  const edge = Number.isFinite(maxEdge) && maxEdge >= 1 ? Math.round(maxEdge) : PHOTO_MAX_EDGE
  const longest = Math.max(width, height)

  if (longest <= edge) {
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) }
  }

  const scale = edge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** 只收 image/*，且必须带子类型（`image/` 这种残缺 mime 不算） */
export function isImageMime(type: string | null | undefined): boolean {
  if (typeof type !== 'string') return false
  const mime = type.trim().toLowerCase()
  return mime.startsWith('image/') && mime.length > 'image/'.length
}

/**
 * 选中的文件能不能用。返回 null 表示通过，否则是被拒的原因。
 * 注意：`image/svg+xml` 也算 image/*，会照收 —— 解码失败时压缩会返回 null，最终退回无照片。
 */
export function rejectReason(
  file: { type?: string; size?: number } | null | undefined,
  maxSourceBytes: number = PHOTO_MAX_SOURCE_BYTES,
): PhotoRejectReason | null {
  if (!file) return 'no-file'
  if (!isImageMime(file.type)) return 'not-image'

  const size = file.size ?? 0
  if (!Number.isFinite(size) || size <= 0) return 'empty'
  if (size > maxSourceBytes) return 'too-large'

  return null
}

/** 参数兜底：调用方给什么值都不会让画布炸掉（边长 64–1600，质量 0.3–0.95，上限 64 KB–8 MB） */
export function sanitizePhotoOptions(opts: SavePhotoOptions = {}): Required<SavePhotoOptions> {
  const quality = Math.round(clamp(opts.quality ?? PHOTO_JPEG_QUALITY, 0.3, 0.95) * 100) / 100
  return {
    maxEdge: Math.round(clamp(opts.maxEdge ?? PHOTO_MAX_EDGE, 64, PHOTO_MAX_EDGE)),
    quality,
    maxBytes: Math.round(clamp(opts.maxBytes ?? PHOTO_TARGET_BYTES, 64 * 1024, 8 * 1024 * 1024)),
  }
}

/**
 * 对象 URL 缓存的 key：一个 id 一个 key，id 前后空白去掉（复制粘贴来的 id 也能命中）。
 * 空 id 返回空串，调用方据此跳过缓存 —— 避免所有空 id 挤在同一个坑里。
 */
export function photoUrlCacheKey(id: string | null | undefined): string {
  const trimmed = typeof id === 'string' ? id.trim() : ''
  return trimmed ? `${URL_KEY_PREFIX}${trimmed}` : ''
}

/** 压缩结果是否超标（超了要继续降质/缩边） */
export function overBudget(bytes: number, maxBytes: number = PHOTO_TARGET_BYTES): boolean {
  if (!Number.isFinite(bytes) || bytes <= 0) return true
  return bytes > Math.max(0, maxBytes)
}

/** 这条流水线在这个浏览器里能不能跑（不支持就静默退回无照片） */
export function isPhotoPipelineSupported(): boolean {
  if (typeof indexedDB === 'undefined') return false
  if (typeof createImageBitmap !== 'function') return false
  if (typeof OffscreenCanvas !== 'function') return false
  return true
}

/* ------------------------------------------------------- IndexedDB（惰性打开） */

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    // 隐私模式、配额满、被别的标签页挡住：都当「没有相片」处理
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

function db(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (!dbPromise) dbPromise = openDb()
  return dbPromise
}

type Runner<T> = (store: IDBObjectStore) => IDBRequest<T>

/** 跑一次读写；任何错误（含 QuotaExceededError）都返回 null，不抛 */
async function withStore<T>(mode: IDBTransactionMode, run: Runner<T>): Promise<T | null> {
  const database = await db()
  if (!database) return null

  return new Promise<T | null>((resolve) => {
    let settled = false
    const done = (value: T | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    try {
      const tx = database.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      request.onsuccess = () => done(request.result as T)
      request.onerror = () => done(null)
      // 配额满时请求可能「成功」而事务 abort，所以读的结果等事务提交再交出去
      tx.onabort = () => done(null)
      tx.onerror = () => done(null)
    } catch {
      done(null)
    }
  })
}

async function putRecord(record: PhotoRecord): Promise<boolean> {
  const database = await db()
  if (!database) return false

  return new Promise<boolean>((resolve) => {
    let settled = false
    const done = (value: boolean) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    try {
      const tx = database.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(record)
      tx.oncomplete = () => done(true)
      tx.onerror = () => done(false)
      tx.onabort = () => done(false)
    } catch {
      done(false)
    }
  })
}

async function getRecord(id: string): Promise<PhotoRecord | null> {
  if (!id) return null
  const result = await withStore<PhotoRecord | undefined>('readonly', (store) => store.get(id))
  if (!result || typeof result.blob === 'undefined') return null
  return result
}

async function allRecords(): Promise<PhotoRecord[] | null> {
  const result = await withStore<PhotoRecord[]>('readonly', (store) => store.getAll())
  return Array.isArray(result) ? result : null
}

/* ---------------------------------------------------------- 压缩（不引库） */

async function renderJpeg(bitmap: ImageBitmap, size: Size, quality: number): Promise<Blob | null> {
  try {
    const canvas = new OffscreenCanvas(size.width, size.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 透明 PNG 转 JPEG 会变黑，先铺一层白
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size.width, size.height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, size.width, size.height)

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    return blob && blob.size > 0 ? blob : null
  } catch {
    return null
  }
}

type Compressed = { blob: Blob; width: number; height: number }

/** 解码 → 缩边 → 编码；超过目标体积就先降质量、再缩边长，最多来回三轮 */
async function compressImage(file: Blob, opts: Required<SavePhotoOptions>): Promise<Compressed | null> {
  if (!isPhotoPipelineSupported()) return null

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)

    let edge = opts.maxEdge
    let quality = opts.quality
    let size = fitWithin(bitmap.width, bitmap.height, edge)
    if (!size) return null

    let blob = await renderJpeg(bitmap, size, quality)

    for (let round = 0; round < 3 && blob && overBudget(blob.size, opts.maxBytes); round++) {
      if (quality > 0.6) {
        quality = Math.max(0.5, Math.round((quality - 0.12) * 100) / 100)
      } else {
        edge = Math.max(640, Math.round(edge * 0.72))
        const next = fitWithin(bitmap.width, bitmap.height, edge)
        if (!next) break
        size = next
      }
      blob = await renderJpeg(bitmap, size, quality)
    }

    if (!blob) return null
    return { blob, width: size.width, height: size.height }
  } catch {
    // 解码失败（损坏文件、不认识的格式、内存不够）：静默退回无照片
    return null
  } finally {
    bitmap?.close()
  }
}

/* ------------------------------------------------------------ 对象 URL 缓存 */

const urlCache = new Map<string, string>()
const inFlight = new Map<string, Promise<string | null>>()

function rememberUrl(key: string, blob: Blob): string | null {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null
  const previous = urlCache.get(key)
  try {
    const url = URL.createObjectURL(blob)
    urlCache.set(key, url)
    // 同一 id 换了图（换一张）时，旧的 objectURL 要收掉
    if (previous && previous !== url) URL.revokeObjectURL(previous)
    return url
  } catch {
    return null
  }
}

function forgetUrl(key: string): void {
  const url = urlCache.get(key)
  if (!url) return
  urlCache.delete(key)
  try {
    URL.revokeObjectURL(url)
  } catch {
    // 已经失效的 URL 再 revoke 一次也不该响
  }
}

function newPhotoId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/* ------------------------------------------------------------------ 公开 API */

/**
 * 存一张照片：校验 → 压缩 → 写 IndexedDB，返回 photoId。
 * 任何一步失败都返回 null（调用方按「没有照片」继续，不要弹错挡路）。
 */
export async function savePhoto(
  file: Blob | null | undefined,
  opts?: SavePhotoOptions,
): Promise<string | null> {
  if (rejectReason(file)) return null
  if (!isPhotoPipelineSupported()) return null
  if (!file) return null

  const options = sanitizePhotoOptions(opts)
  const compressed = await compressImage(file, options)
  if (!compressed) return null

  const record: PhotoRecord = {
    id: newPhotoId(),
    blob: compressed.blob,
    width: compressed.width,
    height: compressed.height,
    size: compressed.blob.size,
    createdAt: Date.now(),
  }

  const stored = await putRecord(record)
  if (!stored) return null

  // 先热一份 objectURL，选完图缩略图能立刻出
  rememberUrl(photoUrlCacheKey(record.id), record.blob)
  return record.id
}

/**
 * 取这个 id 的 objectURL（同一 id 只造一次，之后走缓存）。
 * 图不在了 / IndexedDB 用不了，返回 null。
 */
export async function getPhotoUrl(id: string | null | undefined): Promise<string | null> {
  const key = photoUrlCacheKey(id)
  if (!key) return null

  const cached = urlCache.get(key)
  if (cached) return cached

  const pending = inFlight.get(key)
  if (pending) return pending

  const task = (async () => {
    const record = await getRecord(key.slice(URL_KEY_PREFIX.length))
    if (!record) {
      // 记录没了但缓存还在（比如另一个标签页清了库），顺手把脏缓存丢掉
      forgetUrl(key)
      return null
    }
    return rememberUrl(key, record.blob)
  })()

  inFlight.set(key, task)
  try {
    return await task
  } finally {
    inFlight.delete(key)
  }
}

/** 删一张（同时 revoke 缓存里的 objectURL） */
export async function deletePhoto(id: string | null | undefined): Promise<void> {
  const key = photoUrlCacheKey(id)
  if (!key) return
  forgetUrl(key)
  await withStore<undefined>('readwrite', (store) => store.delete(key.slice(URL_KEY_PREFIX.length)))
}

/** 清空整个图片库（卸载/重置用） */
export async function clearAll(): Promise<void> {
  for (const key of Array.from(urlCache.keys())) forgetUrl(key)
  inFlight.clear()
  await withStore<undefined>('readwrite', (store) => store.clear())
}

/**
 * 清掉「没有任何事件引用」的照片（换一张 / 去掉之后留下的孤儿）。
 * 调用方把当前所有 photoId 传进来即可；返回删掉的张数。
 */
export async function prunePhotos(keepIds: readonly string[]): Promise<number> {
  const records = await allRecords()
  if (!records) return 0

  const keep = new Set(keepIds.map((id) => id.trim()).filter(Boolean))
  let removed = 0
  for (const record of records) {
    if (keep.has(record.id)) continue
    await deletePhoto(record.id)
    removed += 1
  }
  return removed
}

/** 库里占了多少：张数、合计字节、浏览器配额 */
export async function estimateUsage(): Promise<PhotoUsage | null> {
  const records = await allRecords()
  if (!records) return null

  const bytes = records.reduce((sum, record) => {
    const size = Number(record?.size)
    return Number.isFinite(size) && size > 0 ? sum + size : sum
  }, 0)

  let quota = 0
  let usage = 0
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
    if (storage && typeof storage.estimate === 'function') {
      const estimate = await storage.estimate()
      quota = typeof estimate.quota === 'number' ? estimate.quota : 0
      usage = typeof estimate.usage === 'number' ? estimate.usage : 0
    }
  } catch {
    // 隐私模式下有的浏览器直接抛；配额信息只是参考值，拿不到就当 0
  }

  return { photos: records.length, bytes, quota, usage }
}
