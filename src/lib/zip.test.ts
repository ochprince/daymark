import assert from 'node:assert/strict'
import test from 'node:test'
import { deflateRawSync } from 'node:zlib'
import { isPetPackEntry, readZip } from './zip'

test('解压后只留下图片和动作表，并丢掉 macOS 垃圾', async () => {
  const xml = '<Mascot></Mascot>'
  const zip = buildZip([
    { name: 'Blue/actions.xml', data: text(xml) },
    { name: 'Blue/img/shime1.png', data: Uint8Array.of(1, 2, 3, 4) },
    { name: 'Blue/readme.txt', data: text('hi') },
    { name: '__MACOSX/Blue/._shime1.png', data: Uint8Array.of(9) },
    { name: 'Blue/img/', data: Uint8Array.of() },
  ])
  const result = await readZip(zip, { maxBytes: 1024, include: isPetPackEntry })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(
    result.entries.map((entry) => entry.path),
    ['Blue/actions.xml', 'Blue/img/shime1.png'],
  )
  assert.equal(new TextDecoder().decode(result.entries[0].data), xml)
  assert.deepEqual([...result.entries[1].data], [1, 2, 3, 4])
})

test('Deflate 和只写在目录里的大小都能解出来', async () => {
  const png = Uint8Array.from({ length: 80 }, (_, i) => i)
  const zip = buildZip([
    { name: 'img\\shime1.png', data: png, method: 8 },
    { name: 'actions.xml', data: text('<Mascot/>'), sizesInCentralOnly: true },
  ])
  const result = await readZip(zip, { maxBytes: 1024, include: isPetPackEntry })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.entries[0].path, 'img/shime1.png')
  assert.deepEqual([...result.entries[0].data], [...png])
  assert.equal(new TextDecoder().decode(result.entries[1].data), '<Mascot/>')
})

test('坏包、加密包、超限分别报错', async () => {
  assert.deepEqual(await readZip(Uint8Array.of(1, 2, 3, 4), { maxBytes: 100 }), { ok: false, error: 'badzip' })

  const locked = buildZip([{ name: 'shime1.png', data: Uint8Array.of(1), flag: 1 }])
  assert.deepEqual(await readZip(locked, { maxBytes: 100, include: isPetPackEntry }), { ok: false, error: 'badzip' })

  const big = buildZip([{ name: 'shime1.png', data: Uint8Array.of(1, 2, 3, 4) }])
  assert.deepEqual(await readZip(big, { maxBytes: 3, include: isPetPackEntry }), { ok: false, error: 'toobig' })

  const bomb = Uint8Array.from({ length: 200 }, () => 0)
  const lying = buildZip([{ name: 'shime1.png', data: bomb, method: 8, uncompressedSize: 10 }])
  assert.deepEqual(await readZip(lying, { maxBytes: 50, include: isPetPackEntry }), { ok: false, error: 'toobig' })
})

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function buildZip(
  entries: {
    name: string
    data: Uint8Array
    method?: 0 | 8
    flag?: number
    uncompressedSize?: number
    sizesInCentralOnly?: boolean
  }[],
): Uint8Array {
  const locals: number[] = []
  const centrals: number[] = []
  let offset = 0
  for (const entry of entries) {
    const nameBytes = [...Buffer.from(entry.name)]
    const method = entry.method ?? 0
    const compressed = method === 8 ? new Uint8Array(deflateRawSync(entry.data)) : entry.data
    const flag = (entry.flag ?? 0x800) | (entry.sizesInCentralOnly ? 0x8 : 0)
    const localSize = entry.sizesInCentralOnly ? 0 : compressed.length
    const localUncomp = entry.sizesInCentralOnly ? 0 : (entry.uncompressedSize ?? entry.data.length)
    const local = [
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(flag),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(crc32(entry.data)),
      ...u32(localSize),
      ...u32(localUncomp),
      ...u16(nameBytes.length),
      ...u16(0),
      ...nameBytes,
      ...compressed,
    ]
    const central = [
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(flag),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(crc32(entry.data)),
      ...u32(compressed.length),
      ...u32(entry.uncompressedSize ?? entry.data.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...nameBytes,
    ]
    locals.push(...local)
    centrals.push(...central)
    offset += local.length
  }
  const eocd = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(centrals.length),
    ...u32(locals.length),
    ...u16(0),
  ]
  return Uint8Array.from([...locals, ...centrals, ...eocd])
}

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of data) {
    c ^= byte
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (c ^ 0xffffffff) >>> 0
}

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff]
}

function u32(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]
}
