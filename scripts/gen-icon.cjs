const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const CANVAS = 512
const BADGE = 440
const OFFSET = (CANVAS - BADGE) / 2
const SCALE = BADGE / 32
const SS = 2

const RED = [0xff, 0x00, 0x00]
const WHITE = [0xff, 0xff, 0xff]
const ACCENT = [0xc4, 0x6a, 0x41]

const rect = {
  x: OFFSET + 3 * SCALE,
  y: OFFSET + 7 * SCALE,
  w: 26 * SCALE,
  h: 18 * SCALE,
  r: 5 * SCALE
}

const triangle = [
  [OFFSET + 14 * SCALE, OFFSET + 12 * SCALE],
  [OFFSET + 14 * SCALE, OFFSET + 20 * SCALE],
  [OFFSET + 21 * SCALE, OFFSET + 16 * SCALE]
]

const badgeCx = OFFSET + 24 * SCALE
const badgeCy = OFFSET + 24 * SCALE
const badgeR = 7.5 * SCALE

const shaft = {
  x1: badgeCx,
  y1: badgeCy - 0.42 * badgeR,
  x2: badgeCx,
  y2: badgeCy + 0.05 * badgeR,
  w: 0.2 * badgeR
}
const arrowhead = [
  [badgeCx - 0.3 * badgeR, badgeCy + 0.02 * badgeR],
  [badgeCx + 0.3 * badgeR, badgeCy + 0.02 * badgeR],
  [badgeCx, badgeCy + 0.38 * badgeR]
]
const tray = {
  x1: badgeCx - 0.42 * badgeR,
  y1: badgeCy + 0.58 * badgeR,
  x2: badgeCx + 0.42 * badgeR,
  y2: badgeCy + 0.58 * badgeR,
  w: 0.16 * badgeR
}

function inRoundedRect(px, py) {
  const { x, y, w, h, r } = rect
  if (px < x || px > x + w || py < y || py > y + h) return false
  if (px >= x + r && px <= x + w - r) return true
  if (py >= y + r && py <= y + h - r) return true
  const cx = Math.min(Math.max(px, x + r), x + w - r)
  const cy = Math.min(Math.max(py, y + r), y + h - r)
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

function sign(p1, p2, p3) {
  return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
}

function inTriangle(px, py, tri) {
  const p = [px, py]
  const d1 = sign(p, tri[0], tri[1])
  const d2 = sign(p, tri[1], tri[2])
  const d3 = sign(p, tri[2], tri[0])
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function inCircle(px, py, cx, cy, r) {
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

function inThickLine(px, py, seg) {
  return distToSegment(px, py, seg.x1, seg.y1, seg.x2, seg.y2) <= seg.w / 2
}

function samplePixel(px, py) {
  if (inCircle(px, py, badgeCx, badgeCy, badgeR)) {
    if (inThickLine(px, py, shaft) || inTriangle(px, py, arrowhead) || inThickLine(px, py, tray)) {
      return WHITE
    }
    return ACCENT
  }
  if (inTriangle(px, py, triangle)) return WHITE
  if (inRoundedRect(px, py)) return RED
  return null
}

const raw = Buffer.alloc(CANVAS * (1 + CANVAS * 4))
for (let y = 0; y < CANVAS; y++) {
  const rowStart = y * (1 + CANVAS * 4)
  raw[rowStart] = 0
  for (let x = 0; x < CANVAS; x++) {
    let r = 0
    let g = 0
    let b = 0
    let coverage = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS
        const py = y + (sy + 0.5) / SS
        const c = samplePixel(px, py)
        if (c) {
          r += c[0]
          g += c[1]
          b += c[2]
          coverage++
        }
      }
    }
    const samples = SS * SS
    const alpha = Math.round((coverage / samples) * 255)
    const i = rowStart + 1 + x * 4
    if (coverage > 0) {
      raw[i] = Math.round(r / coverage)
      raw[i + 1] = Math.round(g / coverage)
      raw[i + 2] = Math.round(b / coverage)
    }
    raw[i + 3] = alpha
  }
}

function buildCrcTable() {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
}

const CRC_TABLE = buildCrcTable()

function crc32(buf) {
  const table = CRC_TABLE
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(CANVAS, 0)
ihdr.writeUInt32BE(CANVAS, 4)
ihdr[8] = 8
ihdr[9] = 6
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const idatData = zlib.deflateSync(raw, { level: 9 })

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idatData),
  chunk('IEND', Buffer.alloc(0))
])

const resourcesDir = path.join(__dirname, '..', 'resources')
const buildDir = path.join(__dirname, '..', 'build')
fs.mkdirSync(resourcesDir, { recursive: true })
fs.mkdirSync(buildDir, { recursive: true })
fs.writeFileSync(path.join(resourcesDir, 'icon.png'), png)
fs.writeFileSync(path.join(buildDir, 'icon.png'), png)

console.log('icon written', png.length, 'bytes')
