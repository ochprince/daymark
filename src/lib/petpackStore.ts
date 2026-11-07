/**
 * 用户导入的萌宠包存在这台设备的 IndexedDB 里，不进备份、不上传。
 * 当前选中的是「卡片里的小伙伴」还是某个包，记在 localStorage。
 */
import { compilePetPack, packImageNames, type PackFacing, type PackFrame, type PackSpec, type PackState } from './petpack'
import { isPetPackEntry, readZip } from './zip'

export const CARD_PACK_ID = 'card'
const ACTIVE_KEY = 'daymark.petpack.active'
const DB_NAME = 'daymark.petpacks'
const DB_STORE = 'packs'
const MAX_PACKS = 24
const MAX_BYTES = 48 * 1024 * 1024

export type PetPackMeta = {
  id: string
  name: string
  createdAt: number
  thumbUrl: string
  frameCount: number
  dance: boolean
  hug: boolean
  /** 跟 App 一起发出去的，删不掉，也不用导入 */
  builtin?: boolean
}

/**
 * 随 App 一起发的萌宠包（public/packs/<dir>）：第二套默认萌宠走这里。
 * 资源不塞进 JS，按 BASE_URL 拼路径直接引用，和导入包共用同一套解析/渲染。
 */
export type BuiltinPack = {
  id: string
  name: string
  /** public/ 下的目录 */
  dir: string
  /** 列表里的缩略图，相对 dir */
  thumb: string
}

export const BUILTIN_PACKS: readonly BuiltinPack[] = [
  { id: 'builtin:blue', name: 'Blue', dir: 'packs/blue', thumb: 'img/stand01.png' },
]

const builtinSpecs = new Map<string, PackSpec>()

/** public 下的资源地址；GitHub Pages 是 /daymark/ 这种子路径，别写死 / */
function assetUrl(relative: string): string {
  const env = (import.meta as { env?: { BASE_URL?: string } }).env
  const base = env?.BASE_URL ?? '/'
  return `${base.endsWith('/') ? base : `${base}/`}${relative}`
}

async function loadBuiltin(pack: BuiltinPack): Promise<void> {
  if (builtinSpecs.has(pack.id)) return
  if (typeof fetch !== 'function') return
  try {
    const [xml, list] = await Promise.all([
      fetch(assetUrl(`${pack.dir}/actions.xml`))
        .then((response) => (response.ok ? response.text() : null))
        .catch(() => null),
      fetch(assetUrl(`${pack.dir}/manifest.json`))
        .then((response) => (response.ok ? (response.json() as Promise<{ images?: string[] }>) : null))
        .catch(() => null),
    ])
    const files = Array.isArray(list?.images) ? list.images : []
    const spec = compilePetPack(xml, files)
    if (spec) builtinSpecs.set(pack.id, spec)
  } catch {
    /* 拉不到就当这次没有内置包，界面上少一项，不报错 */
  }
}

function builtinMeta(pack: BuiltinPack): PetPackMeta | null {
  const spec = builtinSpecs.get(pack.id)
  if (!spec) return null
  return {
    id: pack.id,
    name: pack.name,
    createdAt: 0,
    builtin: true,
    thumbUrl: assetUrl(`${pack.dir}/${pack.thumb}`),
    frameCount: packImageNames(spec).length,
    dance: !!spec.states.dance?.length,
    hug: !!spec.states.hug?.length,
  }
}

export type LiveFrame = { src: string; durMs: number }

export type LivePack = {
  id: string
  name: string
  facing: PackFacing
  authored: PackState[]
  frames: Partial<Record<PackState, LiveFrame[]>>
}

type StoredPack = {
  id: string
  name: string
  createdAt: number
  thumb: string
  spec: PackSpec
  images: Record<string, Blob>
}

type Snapshot = { activeId: string; packs: PetPackMeta[] }

export type ImportResult =
  | { ok: true; name: string; id: string }
  | { ok: false; error: 'empty' | 'nostand' | 'toobig' | 'toomany' | 'badzip' }

const listeners = new Set<() => void>()
let snapshot: Snapshot = { activeId: readActive(), packs: [] }
let thumbUrls: string[] = []
let loading: Promise<void> | null = null

type LiveEntry = { pack: LivePack; n: number; urls: string[] }
const liveCache = new Map<string, LiveEntry>()

function readActive(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) || CARD_PACK_ID
  } catch {
    return CARD_PACK_ID
  }
}

function writeActive(id: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, id)
  } catch {
    /* 隐私模式写不进也不影响这一次的选择 */
  }
}

function emit(next: Snapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

export function getPetPackSnapshot(): Snapshot {
  return snapshot
}

export function subscribePetPacks(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readAll(): Promise<StoredPack[]> {
  if (typeof indexedDB === 'undefined') return []
  const db = await openDb()
  try {
    const rows = await requestToPromise(db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAll())
    return (rows as StoredPack[]).slice().sort((a, b) => a.createdAt - b.createdAt)
  } finally {
    db.close()
  }
}

function metaOf(row: StoredPack): PetPackMeta {
  const thumbBlob = row.images[row.thumb]
  const thumbUrl = thumbBlob ? URL.createObjectURL(thumbBlob) : ''
  if (thumbUrl) thumbUrls.push(thumbUrl)
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    thumbUrl,
    frameCount: packImageNames(row.spec).length,
    dance: !!row.spec.states.dance?.length,
    hug: !!row.spec.states.hug?.length,
  }
}

function publish(rows: StoredPack[], activeId = snapshot.activeId) {
  const previous = thumbUrls
  thumbUrls = []
  // 内置包排在前面：不用导入，装好就能选
  const builtin = BUILTIN_PACKS.map(builtinMeta).filter((meta): meta is PetPackMeta => meta !== null)
  const packs = [...builtin, ...rows.map(metaOf)]
  const known = new Set(packs.map((pack) => pack.id))
  const nextActive = activeId !== CARD_PACK_ID && !known.has(activeId) ? CARD_PACK_ID : activeId
  if (nextActive !== activeId) writeActive(nextActive)
  emit({ activeId: nextActive, packs })
  previous.forEach((url) => URL.revokeObjectURL(url))
}

export function loadPetPacks(): Promise<void> {
  if (!loading) {
    loading = Promise.all(BUILTIN_PACKS.map(loadBuiltin))
      .then(() => readAll())
      .then((rows) => publish(rows, readActive()))
      .catch(() => {
        loading = null
      })
  }
  return loading
}

export function selectPetPack(id: string): void {
  writeActive(id)
  emit({ ...snapshot, activeId: id })
}

function filePath(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
  return relative.replace(/\\/g, '/')
}

function folderName(files: File[]): string {
  const counts = new Map<string, number>()
  for (const file of files) {
    const top = filePath(file).split('/')[0]
    if (!top || top === file.name) continue
    counts.set(top, (counts.get(top) || 0) + 1)
  }
  let best = ''
  let bestCount = 0
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best || '萌宠包'
}

function isZipFile(file: File): boolean {
  return /\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed'
}

function fileFromZipEntry(path: string, data: Uint8Array): File {
  const name = path.split('/').pop() || path
  const file = new File([data.slice()], name, { type: /\.png$/i.test(name) ? 'image/png' : 'application/xml' })
  Object.defineProperty(file, 'webkitRelativePath', { value: path })
  return file
}

export async function importPetPack(files: File[]): Promise<ImportResult> {
  if (files.length === 1 && isZipFile(files[0])) {
    const zip = files[0]
    if (zip.size > MAX_BYTES) return { ok: false, error: 'toobig' }
    const unpacked = await readZip(new Uint8Array(await zip.arrayBuffer()), {
      maxBytes: MAX_BYTES,
      include: isPetPackEntry,
    })
    if (!unpacked.ok) return unpacked
    const extracted = unpacked.entries.map((entry) => fileFromZipEntry(entry.path, entry.data))
    const title = zip.name.replace(/\.zip$/i, '').trim() || folderName(extracted)
    return savePetPack(extracted, title)
  }
  return savePetPack(files, folderName(files))
}

async function savePetPack(files: File[], name: string): Promise<ImportResult> {
  const pngs = files.filter((file) => /\.png$/i.test(file.name))
  if (!pngs.length) return { ok: false, error: 'empty' }
  const bytes = pngs.reduce((sum, file) => sum + file.size, 0)
  if (bytes > MAX_BYTES) return { ok: false, error: 'toobig' }
  const rows = await readAll()
  if (rows.length >= MAX_PACKS) return { ok: false, error: 'toomany' }

  const xmlFile = files.find((file) => /(^|\/)actions\.xml$/i.test(filePath(file)))
  const xml = xmlFile ? await xmlFile.text() : null
  const spec = compilePetPack(xml, pngs.map((file) => file.name))
  if (!spec) return { ok: false, error: 'nostand' }

  const needed = new Set(packImageNames(spec))
  const images: Record<string, Blob> = {}
  for (const file of pngs) {
    const key = file.name.toLowerCase()
    if (needed.has(key) && !images[key]) images[key] = file
  }
  const thumb = images['shime1.png'] ? 'shime1.png' : images['stand01.png'] ? 'stand01.png' : spec.states.stand?.[0].img || ''
  const row: StoredPack = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    thumb,
    spec,
    images,
  }
  const db = await openDb()
  try {
    await requestToPromise(db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(row))
  } finally {
    db.close()
  }
  writeActive(row.id)
  publish([...rows, row], row.id)
  return { ok: true, name: row.name, id: row.id }
}

export async function removePetPack(id: string): Promise<void> {
  if (BUILTIN_PACKS.some((pack) => pack.id === id)) return
  const rows = (await readAll()).filter((row) => row.id !== id)
  if (typeof indexedDB !== 'undefined') {
    const db = await openDb()
    try {
      await requestToPromise(db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).delete(id))
    } finally {
      db.close()
    }
  }
  const nextActive = snapshot.activeId === id ? CARD_PACK_ID : snapshot.activeId
  if (nextActive !== snapshot.activeId) writeActive(nextActive)
  publish(rows, nextActive)
}

async function readOne(id: string): Promise<StoredPack | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await openDb()
  try {
    const row = await requestToPromise(db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(id))
    return (row as StoredPack) || null
  } finally {
    db.close()
  }
}

function framesOf(spec: PackSpec, urlFor: (name: string) => string): LivePack['frames'] {
  const frames: LivePack['frames'] = {}
  for (const state of Object.keys(spec.states) as PackState[]) {
    const list = (spec.states[state] || [])
      .map((frame: PackFrame) => ({ src: urlFor(frame.img), durMs: frame.durMs }))
      .filter((frame) => frame.src)
    if (list.length) frames[state] = list
  }
  return frames
}

export async function retainLivePack(id: string): Promise<LivePack | null> {
  const cached = liveCache.get(id)
  if (cached) {
    cached.n += 1
    return cached.pack
  }
  const builtin = BUILTIN_PACKS.find((pack) => pack.id === id)
  if (builtin) {
    if (!builtinSpecs.has(id)) await loadBuiltin(builtin)
    const spec = builtinSpecs.get(id)
    if (!spec) return null
    const live: LivePack = {
      id,
      name: builtin.name,
      facing: spec.facing === 'right' ? 'right' : 'left',
      authored: spec.authored ?? [],
      frames: framesOf(spec, (name) => assetUrl(`${builtin.dir}/img/${name}`)),
    }
    liveCache.set(id, { pack: live, n: 1, urls: [] })
    return live
  }
  const row = await readOne(id)
  if (!row) return null
  const urls: string[] = []
  const byName = new Map<string, string>()
  const urlFor = (name: string) => {
    const existing = byName.get(name)
    if (existing) return existing
    const blob = row.images[name]
    if (!blob) return ''
    const url = URL.createObjectURL(blob)
    byName.set(name, url)
    urls.push(url)
    return url
  }
  const pack: LivePack = {
    id: row.id,
    name: row.name,
    facing: row.spec.facing === 'right' ? 'right' : 'left',
    authored: row.spec.authored ?? [],
    frames: framesOf(row.spec, urlFor),
  }
  liveCache.set(id, { pack, n: 1, urls })
  return pack
}

export function releaseLivePack(id: string): void {
  const cached = liveCache.get(id)
  if (!cached) return
  cached.n -= 1
  if (cached.n > 0) return
  cached.urls.forEach((url) => URL.revokeObjectURL(url))
  liveCache.delete(id)
}
