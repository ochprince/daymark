/**
 * 读 ZIP 里要用的文件。只认「直接存放」和 Deflate，
 * 访达、资源管理器打出来的压缩包就是这两种。
 */

export type ZipEntry = { path: string; data: Uint8Array }

export type ZipRead = { ok: true; entries: ZipEntry[] } | { ok: false; error: 'badzip' | 'toobig' }

const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50
const MAX_ENTRIES = 4000

/** 萌宠包里真正要留下的：图片和动作表。顺手丢掉 macOS 解压带出来的垃圾。 */
export function isPetPackEntry(path: string): boolean {
  const parts = path.split('/')
  if (parts.some((part) => part === '__MACOSX' || part.startsWith('.'))) return false
  const name = parts[parts.length - 1] ?? ''
  return /\.png$/i.test(name) || /^actions\.xml$/i.test(name)
}

export async function readZip(
  bytes: Uint8Array,
  options: { maxBytes: number; include?: (path: string) => boolean },
): Promise<ZipRead> {
  const eocd = findEocd(bytes)
  if (eocd < 0) return { ok: false, error: 'badzip' }
  if (u16(bytes, eocd + 4) !== 0 || u16(bytes, eocd + 6) !== 0) return { ok: false, error: 'badzip' }
  const total = u16(bytes, eocd + 10)
  if (u16(bytes, eocd + 8) !== total || total > MAX_ENTRIES) return { ok: false, error: 'badzip' }
  const cdSize = u32(bytes, eocd + 12)
  const cdOffset = u32(bytes, eocd + 16)
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) return { ok: false, error: 'badzip' }
  if (cdOffset + cdSize > bytes.length) return { ok: false, error: 'badzip' }

  const include = options.include ?? (() => true)
  const entries: ZipEntry[] = []
  let used = 0
  let cursor = cdOffset
  for (let n = 0; n < total; n++) {
    if (cursor + 46 > bytes.length || u32(bytes, cursor) !== SIG_CENTRAL) return { ok: false, error: 'badzip' }
    const flag = u16(bytes, cursor + 8)
    const method = u16(bytes, cursor + 10)
    const compressedSize = u32(bytes, cursor + 20)
    const uncompressedSize = u32(bytes, cursor + 24)
    const nameLen = u16(bytes, cursor + 28)
    const extraLen = u16(bytes, cursor + 30)
    const commentLen = u16(bytes, cursor + 32)
    const localOffset = u32(bytes, cursor + 42)
    const nameEnd = cursor + 46 + nameLen
    if (nameEnd > bytes.length) return { ok: false, error: 'badzip' }
    const path = cleanPath(new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(cursor + 46, nameEnd)))
    cursor = nameEnd + extraLen + commentLen
    if (cursor > bytes.length) return { ok: false, error: 'badzip' }
    if (!path || !include(path)) continue
    if (
      (flag & 1) !== 0 ||
      (method !== 0 && method !== 8) ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localOffset === 0xffffffff
    ) {
      return { ok: false, error: 'badzip' }
    }
    if (uncompressedSize > options.maxBytes - used) return { ok: false, error: 'toobig' }
    const data = await readEntry(bytes, localOffset, method, compressedSize, options.maxBytes - used)
    if (!data.ok) return data
    used += data.data.length
    entries.push({ path, data: data.data })
  }
  return { ok: true, entries }
}

function cleanPath(name: string): string | null {
  const path = name.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!path || path.endsWith('/')) return null
  const parts = path.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..')) return null
  return parts.join('/')
}

function findEocd(bytes: Uint8Array): number {
  if (bytes.length < 22) return -1
  const start = Math.max(0, bytes.length - (22 + 0xffff))
  for (let i = bytes.length - 22; i >= start; i--) {
    if (u32(bytes, i) !== SIG_EOCD) continue
    if (i + 22 + u16(bytes, i + 20) === bytes.length) return i
  }
  return -1
}

async function readEntry(
  bytes: Uint8Array,
  offset: number,
  method: number,
  compressedSize: number,
  maxOut: number,
): Promise<{ ok: true; data: Uint8Array } | { ok: false; error: 'badzip' | 'toobig' }> {
  if (offset + 30 > bytes.length || u32(bytes, offset) !== SIG_LOCAL) return { ok: false, error: 'badzip' }
  const start = offset + 30 + u16(bytes, offset + 26) + u16(bytes, offset + 28)
  const end = start + compressedSize
  if (start > bytes.length || end > bytes.length) return { ok: false, error: 'badzip' }
  if (method === 0) {
    if (compressedSize > maxOut) return { ok: false, error: 'toobig' }
    return { ok: true, data: bytes.slice(start, end) }
  }
  return inflateRaw(bytes.subarray(start, end), maxOut)
}

async function inflateRaw(
  data: Uint8Array,
  maxOut: number,
): Promise<{ ok: true; data: Uint8Array } | { ok: false; error: 'badzip' | 'toobig' }> {
  try {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const step = await reader.read()
      if (step.done) break
      total += step.value.byteLength
      if (total > maxOut) {
        await reader.cancel()
        return { ok: false, error: 'toobig' }
      }
      chunks.push(step.value)
    }
    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      out.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { ok: true, data: out }
  } catch {
    return { ok: false, error: 'badzip' }
  }
}

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function u32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}
