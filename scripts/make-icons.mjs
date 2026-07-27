// Generates PWA icons (solid rose square with cream droplet) without any image deps.
// Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelFn(x / size, y / size)
      const off = y * (size * 4 + 1) + 1 + x * 4
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const ROSE = [228, 85, 127]
const CREAM = [255, 248, 244]
const PEACH = [247, 169, 140]

// u,v in [0,1]. Droplet = circle(0.5, 0.60, r=0.22) ∪ cone from apex (0.5, 0.20)
function pixel(u, v) {
  const inCircle = (u - 0.5) ** 2 + (v - 0.6) ** 2 <= 0.22 ** 2
  const inCone = v >= 0.2 && v <= 0.6 && Math.abs(u - 0.5) <= ((v - 0.2) / 0.4) * 0.22
  const inDot = (u - 0.5) ** 2 + (v - 0.62) ** 2 <= 0.075 ** 2
  if (inDot) return PEACH
  if (inCircle || inCone) return CREAM
  return ROSE
}

for (const [file, size] of [['pwa-192.png', 192], ['pwa-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(`../public/${file}`, import.meta.url), png(size, pixel))
  console.log('wrote public/' + file)
}

// Source images for @capacitor/assets (native Android icons/splash)
import { mkdirSync } from 'node:fs'
mkdirSync(new URL('../assets', import.meta.url), { recursive: true })
writeFileSync(new URL('../assets/logo.png', import.meta.url), png(1024, pixel))
// foreground keeps the droplet centred in the adaptive-icon safe zone (inner ~66%)
const inset = (u) => (u - 0.5) / 0.62 + 0.5
writeFileSync(
  new URL('../assets/icon-foreground.png', import.meta.url),
  png(1024, (u, v) => pixel(inset(u), inset(v))),
)
writeFileSync(new URL('../assets/icon-background.png', import.meta.url), png(1024, () => ROSE))
console.log('wrote assets/logo.png, icon-foreground.png, icon-background.png')
