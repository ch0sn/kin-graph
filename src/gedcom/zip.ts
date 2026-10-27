/**
 * Just enough of the ZIP format to put a GEDCOM file and its photos in one
 * download, and to read such files back, including ones other programs made.
 * Files are written uncompressed: photos are JPEGs and wouldn't shrink.
 */

export interface ZipEntry {
  /** The path inside the archive, with forward slashes: "photos/a.jpg". */
  name: string
  data: Uint8Array
}

export class ZipError extends Error {
  override name = 'ZipError'
}

const LOCAL = 0x04034b50
const CENTRAL = 0x02014b50
const END = 0x06054b50
/** Bit 11 of the flags: the file name is UTF-8. */
const UTF8 = 0x0800

export function createZip(entries: ZipEntry[]): Blob {
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const { name, data } of entries) {
    const nameBytes = new TextEncoder().encode(name)
    const crc = crc32(data)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, LOCAL, true)
    local.setUint16(4, 20, true) // version needed: 2.0
    local.setUint16(6, UTF8, true)
    local.setUint16(8, 0, true) // stored
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, nameBytes.length, true)
    parts.push(new Uint8Array(local.buffer), nameBytes, data)

    const header = new DataView(new ArrayBuffer(46))
    header.setUint32(0, CENTRAL, true)
    header.setUint16(4, 20, true)
    header.setUint16(6, 20, true)
    header.setUint16(8, UTF8, true)
    header.setUint32(16, crc, true)
    header.setUint32(20, data.length, true)
    header.setUint32(24, data.length, true)
    header.setUint16(28, nameBytes.length, true)
    header.setUint32(42, offset, true)
    central.push(new Uint8Array(header.buffer), nameBytes)

    offset += 30 + nameBytes.length + data.length
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, END, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: 'application/zip' })
}

/** Whether the bytes start like a ZIP archive. */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true) === LOCAL
}

/** Reads every file in an archive, by its path. Folders are left out. */
export async function readZip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // The end record sits in the last 22 bytes, plus a comment of up to 64 KB.
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === END) {
      end = i
      break
    }
  }
  if (end < 0) throw new ZipError('not a zip file')

  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const files = new Map<string, Uint8Array>()
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL) throw new ZipError('damaged zip file')
    const flags = view.getUint16(at + 8, true)
    const method = view.getUint16(at + 10, true)
    const size = view.getUint32(at + 20, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const localAt = view.getUint32(at + 42, true)
    const nameBytes = bytes.subarray(at + 46, at + 46 + nameLength)
    const name = new TextDecoder(flags & UTF8 ? 'utf-8' : 'windows-1252').decode(nameBytes)
    at += 46 + nameLength + extraLength + commentLength

    if (name.endsWith('/') || flags & 0x1) continue // a folder, or encrypted
    if (view.getUint32(localAt, true) !== LOCAL) throw new ZipError('damaged zip file')
    const start = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true)
    const data = bytes.subarray(start, start + size)
    if (method === 0) files.set(name, data)
    else if (method === 8) files.set(name, await inflate(data))
  }
  return files
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

let table: Uint32Array | undefined

function crc32(data: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
