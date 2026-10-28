/**
 * Artwork inspection — reads the bytes a customer uploads and reports what is
 * actually in the file, without trusting the extension or the MIME type the
 * browser guessed.
 *
 * Runs unchanged in the browser (instant feedback before upload) and on the
 * server (the record of what was received). Pure functions over a Uint8Array,
 * no DOM, no Node APIs.
 */

export type ArtworkFormat = 'pdf' | 'ai' | 'eps' | 'svg' | 'png' | 'jpeg' | 'tiff' | 'unknown'
export type ColourSpace = 'cmyk' | 'rgb' | 'grey' | 'unknown'

export interface ArtworkMeta {
  format: ArtworkFormat
  /** True for PDF/AI/EPS/SVG: resolution is not a property of the file. */
  vector: boolean
  bytes: number
  widthPx: number | null
  heightPx: number | null
  /** Self-declared density, when the file carries one. Not the density at final size. */
  dpiX: number | null
  dpiY: number | null
  colour: ColourSpace
  /** 4-channel Adobe JPEGs and pixel-alpha PNGs are both "extra" plates to the press. */
  hasAlpha: boolean
  channels: number | null
  pageCount: number | null
  /** Page geometry in millimetres, when the format declares boxes. */
  mediaBoxMm: { w: number; h: number } | null
  trimBoxMm: { w: number; h: number } | null
  /** PDF/EPS version string or SVG profile note, for the artwork log. */
  version: string | null
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function ascii(bytes: Uint8Array, start: number, len: number): string {
  let out = ''
  for (let i = start; i < start + len && i < bytes.length; i++) out += String.fromCharCode(bytes[i])
  return out
}

function u16be(b: Uint8Array, i: number) {
  return (b[i] << 8) | b[i + 1]
}

function u16le(b: Uint8Array, i: number) {
  return b[i] | (b[i + 1] << 8)
}

function u32be(b: Uint8Array, i: number) {
  return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
}

function u32le(b: Uint8Array, i: number) {
  return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0
}

const PT_TO_MM = 25.4 / 72

function empty(): ArtworkMeta {
  return {
    format: 'unknown',
    vector: false,
    bytes: 0,
    widthPx: null,
    heightPx: null,
    dpiX: null,
    dpiY: null,
    colour: 'unknown',
    hasAlpha: false,
    channels: null,
    pageCount: null,
    mediaBoxMm: null,
    trimBoxMm: null,
    version: null,
  }
}

/* ------------------------------- formats ------------------------------- */

function inspectPng(b: Uint8Array): ArtworkMeta {
  const meta = empty()
  meta.format = 'png'
  meta.version = 'PNG'

  // Walk chunks from the IHDR so pHYs, tRNS and gAMA are all seen, not assumed.
  let i = 8
  while (i + 8 <= b.length) {
    const len = u32be(b, i)
    const type = ascii(b, i + 4, 4)
    const data = i + 8
    if (type === 'IHDR' && data + 13 <= b.length) {
      meta.widthPx = u32be(b, data)
      meta.heightPx = u32be(b, data + 4)
      const colourType = b[data + 9]
      meta.colour = colourType === 0 || colourType === 4 ? 'grey' : 'rgb'
      meta.hasAlpha = colourType === 4 || colourType === 6
      meta.channels = colourType === 0 ? 1 : colourType === 2 ? 3 : colourType === 3 ? 1 : colourType === 4 ? 2 : 4
    } else if (type === 'pHYs' && data + 9 <= b.length) {
      const unit = b[data + 8]
      if (unit === 1) {
        // pixels per metre
        meta.dpiX = Math.round(u32be(b, data) * 0.0254)
        meta.dpiY = Math.round(u32be(b, data + 4) * 0.0254)
      }
    } else if (type === 'tRNS') {
      meta.hasAlpha = true
    } else if (type === 'IEND') {
      break
    }
    if (len > b.length) break
    i = data + len + 4
  }
  return meta
}

function inspectJpeg(b: Uint8Array): ArtworkMeta {
  const meta = empty()
  meta.format = 'jpeg'
  meta.version = 'JPEG'
  meta.colour = 'rgb'

  let i = 2
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) {
      i++
      continue
    }
    const marker = b[i + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) break
    const len = u16be(b, i + 2)
    if (len < 2) break
    const seg = i + 4

    // APP0 JFIF declares a density and a unit.
    if (marker === 0xe0 && ascii(b, seg, 4) === 'JFIF' && seg + 14 <= b.length) {
      const units = b[seg + 7]
      const dx = u16be(b, seg + 8)
      const dy = u16be(b, seg + 10)
      if (units === 1) {
        meta.dpiX = dx
        meta.dpiY = dy
      } else if (units === 2) {
        meta.dpiX = Math.round(dx * 2.54)
        meta.dpiY = Math.round(dy * 2.54)
      }
    }

    // APP14 Adobe: transform 0 on a 4-channel file means CMYK/YCCK, not RGB.
    if (marker === 0xee && ascii(b, seg, 5) === 'Adobe' && seg + 11 <= b.length) {
      meta.version = 'JPEG (Adobe)'
    }

    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof && seg + 8 <= b.length) {
      meta.heightPx = u16be(b, seg + 1)
      meta.widthPx = u16be(b, seg + 3)
      meta.channels = b[seg + 5]
      if (meta.channels === 4) meta.colour = 'cmyk'
      else if (meta.channels === 1) meta.colour = 'grey'
      break
    }
    i += 2 + len
  }
  return meta
}

function inspectTiff(b: Uint8Array): ArtworkMeta {
  const meta = empty()
  meta.format = 'tiff'
  meta.version = 'TIFF'
  const little = b[0] === 0x49
  const r16 = little ? u16le : u16be
  const r32 = little ? u32le : u32be
  const ifd = r32(b, 4)
  if (ifd + 2 > b.length) return meta
  const count = r16(b, ifd)
  let unit = 2
  let xres = 0
  let yres = 0
  for (let n = 0; n < count; n++) {
    const e = ifd + 2 + n * 12
    if (e + 12 > b.length) break
    const tag = r16(b, e)
    const type = r16(b, e + 2)
    const value = r32(b, e + 8)
    if (tag === 256) meta.widthPx = value
    if (tag === 257) meta.heightPx = value
    if (tag === 277) meta.channels = value
    if (tag === 296) unit = value
    if (tag === 282 || tag === 283) {
      // rational: offset to numerator/denominator
      if (value + 8 <= b.length) {
        const num = r32(b, value)
        const den = r32(b, value + 4) || 1
        if (tag === 282) xres = num / den
        else yres = num / den
      }
    }
  }
  if (unit === 2 && xres) {
    meta.dpiX = Math.round(xres)
    meta.dpiY = Math.round(yres || xres)
  } else if (unit === 3 && xres) {
    meta.dpiX = Math.round(xres * 2.54)
    meta.dpiY = Math.round((yres || xres) * 2.54)
  }
  if (meta.channels === 4) meta.colour = 'cmyk'
  else if (meta.channels === 1) meta.colour = 'grey'
  else if (meta.channels) meta.colour = 'rgb'
  return meta
}

function text(b: Uint8Array, limit = 200_000): string {
  const end = Math.min(b.length, limit)
  let out = ''
  // Latin-1 is enough for PDF/EPS/SVG syntax and avoids a TextDecoder dependency.
  for (let i = 0; i < end; i++) out += String.fromCharCode(b[i])
  return out
}

function boxFromNumbers(raw: string): { w: number; h: number } | null {
  const nums = raw
    .trim()
    .split(/[\s,]+/)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
  if (nums.length !== 4) return null
  const w = Math.abs(nums[2] - nums[0]) * PT_TO_MM
  const h = Math.abs(nums[3] - nums[1]) * PT_TO_MM
  if (!w || !h) return null
  return { w, h }
}

function inspectPdf(b: Uint8Array): ArtworkMeta {
  const meta = empty()
  meta.format = 'pdf'
  meta.vector = true
  meta.colour = 'unknown'
  const head = text(b)
  const version = /%PDF-(\d\.\d)/.exec(head)
  meta.version = version ? `PDF ${version[1]}` : 'PDF'

  const pages = head.match(/\/Type\s*\/Page[^s]/g)
  meta.pageCount = pages ? pages.length : null

  const media = /\/MediaBox\s*\[\s*([^\]]+)\]/.exec(head)
  if (media) meta.mediaBoxMm = boxFromNumbers(media[1])
  const trim = /\/TrimBox\s*\[\s*([^\]]+)\]/.exec(head)
  if (trim) meta.trimBoxMm = boxFromNumbers(trim[1])

  // Separations named in the document tell us more than any colour flag.
  const hasDeviceCmyk = /\/DeviceCMYK/.test(head)
  const hasIcc = /\/ICCBased/.test(head)
  const hasSep = /\/Separation/.test(head)
  if (hasSep) meta.colour = 'cmyk'
  else if (hasDeviceCmyk && hasIcc) meta.colour = 'cmyk'
  else if (/\/DeviceRGB/.test(head) && !hasDeviceCmyk) meta.colour = 'rgb'

  return meta
}

function inspectEps(b: Uint8Array): ArtworkMeta {
  const meta = empty()
  meta.format = 'eps'
  meta.vector = true
  meta.version = 'EPS'
  const head = text(b, 20_000)
  const bbox = /%%BoundingBox:\s*(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/.exec(head)
  if (bbox) {
    const w = Math.abs(Number(bbox[3]) - Number(bbox[1])) * PT_TO_MM
    const h = Math.abs(Number(bbox[4]) - Number(bbox[2])) * PT_TO_MM
    if (w && h) meta.mediaBoxMm = { w, h }
  }
  const ver = /%!PS-Adobe-(\d\.\d)/.exec(head)
  if (ver) meta.version = `EPS ${ver[1]}`
  if (/%%DocumentProcessColors:.*Cyan|CMYK/.test(head)) meta.colour = 'cmyk'
  return meta
}

function inspectSvg(b: Uint8Array): ArtworkMeta {
  const meta = empty()
  meta.format = 'svg'
  meta.vector = true
  meta.version = 'SVG'
  meta.colour = 'rgb'
  const head = text(b, 20_000)
  const svgTag = /<svg[^>]*>/i.exec(head)
  if (svgTag) {
    const tag = svgTag[0]
    const w = /\bwidth\s*=\s*["']([\d.]+)\s*(mm|cm|in|px|pt)?/i.exec(tag)
    const h = /\bheight\s*=\s*["']([\d.]+)\s*(mm|cm|in|px|pt)?/i.exec(tag)
    const toMm = (v: string, unit?: string) => {
      const n = Number(v)
      if (unit === 'cm') return n * 10
      if (unit === 'in') return n * 25.4
      if (unit === 'pt') return n * PT_TO_MM
      if (unit === 'px' || !unit) return n * (25.4 / 96)
      return n
    }
    if (w && h) {
      meta.mediaBoxMm = { w: toMm(w[1], w[2]), h: toMm(h[1], h[2]) }
    } else {
      const vb = /viewBox\s*=\s*["']([^"']+)["']/i.exec(tag)
      if (vb) {
        const parts = vb[1].trim().split(/[\s,]+/).map(Number)
        if (parts.length === 4 && parts[2] && parts[3]) {
          meta.mediaBoxMm = { w: parts[2] * (25.4 / 96), h: parts[3] * (25.4 / 96) }
        }
      }
    }
  }
  return meta
}

/* ------------------------------- entry -------------------------------- */

/**
 * Reads the format from magic bytes, never from the filename.
 * `bytes` may be truncated for large vector files; the parsers only read headers.
 */
export function inspectArtwork(bytes: Uint8Array): ArtworkMeta {
  const meta = bytes.length ? empty() : empty()
  meta.bytes = bytes.length

  if (bytes.length >= 8 && PNG_SIG.every((v, i) => bytes[i] === v)) return { ...inspectPng(bytes), bytes: bytes.length }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ...inspectJpeg(bytes), bytes: bytes.length }
  }

  if (bytes.length >= 4) {
    const sig = ascii(bytes, 0, 4)
    if (sig === 'II*\0' || sig === 'MM\0*') return { ...inspectTiff(bytes), bytes: bytes.length }
    if (sig === 'GIF8') {
      const g = inspectPng(bytes)
      g.format = 'unknown'
      g.version = 'GIF'
      return { ...g, bytes: bytes.length }
    }
  }

  const head = ascii(bytes, 0, 5)
  if (head === '%PDF-') {
    const pdf = inspectPdf(bytes)
    // Illustrator writes a PDF-compatible stream; the .ai distinction is a
    // private data block, so report it as PDF unless the marker is present.
    if (text(bytes, 4096).includes('Adobe Illustrator')) pdf.version = `Illustrator (${pdf.version})`
    return { ...pdf, bytes: bytes.length }
  }
  if (ascii(bytes, 0, 4) === '%!PS') return { ...inspectEps(bytes), bytes: bytes.length }

  const xmlHead = text(bytes, 4000).trimStart()
  if (xmlHead.startsWith('<svg') || (xmlHead.startsWith('<?xml') && xmlHead.includes('<svg'))) {
    return { ...inspectSvg(bytes), bytes: bytes.length }
  }

  return meta
}
