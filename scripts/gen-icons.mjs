/**
 * Genereert de PWA-iconen als echte PNG's, zonder externe dependencies.
 * Een minimale PNG-encoder (zlib zit in Node) plus een kleine rasterizer die
 * het mandje-logo uittekent met 3x3 supersampling voor nette randen.
 *
 *   npm run icons
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public/icons')

/* ---------------------------------------------------------------- PNG ---- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** rgba: Uint8Array van size*size*4 */
function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bitdiepte
  ihdr[9] = 6 // kleurtype RGBA
  // 10..12 blijven 0: deflate, adaptief filter, geen interlace

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filtertype 0 (None)
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    )
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ----------------------------------------------------------- tekenwerk ---- */

const GREEN = [46, 125, 50]
const WHITE = [255, 255, 255]

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

/** Het mandje. Geeft 'bg', 'fg' of null (= achtergrond) terug. */
function basketAt(x, y) {
  const dx = x - 0.5

  // Handvat: bovenste helft van een ring.
  const hy = y - 0.47
  const dist = Math.hypot(dx, hy)
  const handle = hy <= 0 && dist <= 0.205 && dist >= 0.145

  // Lip van de mand.
  const rim = inRoundedRect(x, y, 0.13, 0.44, 0.87, 0.515, 0.037)

  // Body: trapezium dat naar onder toe versmalt.
  let body = false
  if (y >= 0.5 && y <= 0.82) {
    const t = (y - 0.5) / 0.32
    const halfWidth = 0.335 - 0.12 * t
    body = Math.abs(dx) <= halfWidth
    // Onderhoek afronden.
    if (body && y > 0.78) {
      const edge = halfWidth - Math.abs(dx)
      if (edge < 0.03 && y > 0.79) body = false
    }
  }

  if (body) {
    // Drie sleuven, zodat het als mand leest in plaats van als emmer.
    for (const slot of [-0.145, 0, 0.145]) {
      const t = (y - 0.5) / 0.32
      const sx = slot * (1 - 0.3 * t)
      if (y >= 0.555 && y <= 0.755 && Math.abs(dx - sx) <= 0.028) return 'bg'
    }
  }

  return handle || rim || body ? 'fg' : null
}

function render(size, { maskable }) {
  const rgba = new Uint8Array(size * size * 4)
  const SS = 3 // supersampling per as
  const radius = maskable ? 0 : 0.21
  // Maskable iconen worden gecropt tot een cirkel; houd de inhoud in de
  // veilige zone (80%) door hem iets te verkleinen.
  const scale = maskable ? 0.74 : 1

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let fg = 0
      let bg = 0
      let inside = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size
          const y = (py + (sy + 0.5) / SS) / size
          if (!inRoundedRect(x, y, 0, 0, 1, 1, radius)) continue
          inside++
          const cx = (x - 0.5) / scale + 0.5
          const cy = (y - 0.5) / scale + 0.5
          const hit = basketAt(cx, cy)
          if (hit === 'fg') fg++
          else if (hit === 'bg') bg++
        }
      }
      const total = SS * SS
      const alpha = clamp01(inside / total)
      const fgMix = clamp01(fg / total)
      const o = (py * size + px) * 4
      for (let c = 0; c < 3; c++) {
        rgba[o + c] = Math.round(GREEN[c] * (1 - fgMix) + WHITE[c] * fgMix)
      }
      rgba[o + 3] = Math.round(alpha * 255)
    }
  }
  return rgba
}

/* ------------------------------------------------------------- uitvoer ---- */

mkdirSync(OUT, { recursive: true })

const targets = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon-180.png', 180, { maskable: true }],
]

for (const [name, size, opts] of targets) {
  const png = encodePng(render(size, opts), size)
  writeFileSync(resolve(OUT, name), png)
  console.log(`${name.padEnd(28)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`)
}
console.log('Iconen gegenereerd in public/icons/')
