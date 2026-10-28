import { describe, expect, it } from 'vitest'
import { inspectArtwork } from '../src/lib/prepress/inspect'
import { evaluateArtwork, summarise } from '../src/lib/prepress/evaluate'

/* --------------------------- synthetic files --------------------------- */

function u32(v: number): number[] {
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]
}

function chunk(type: string, data: number[]): number[] {
  return [...u32(data.length), ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0]
}

function png(width: number, height: number, opts: { dpi?: number; colourType?: number; alpha?: boolean } = {}): Uint8Array {
  const colourType = opts.colourType ?? 2
  const ihdr = [...u32(width), ...u32(height), 8, colourType, 0, 0, 0]
  const parts = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', ihdr),
  ]
  if (opts.dpi) {
    const ppm = Math.round(opts.dpi / 0.0254)
    parts.push(...chunk('pHYs', [...u32(ppm), ...u32(ppm), 1]))
  }
  if (opts.alpha) parts.push(...chunk('tRNS', [0]))
  parts.push(...chunk('IDAT', [1, 2, 3]), ...chunk('IEND', []))
  return new Uint8Array(parts)
}

function jpeg(width: number, height: number, opts: { dpi?: number; components?: number } = {}): Uint8Array {
  const comps = opts.components ?? 3
  const out: number[] = [0xff, 0xd8]
  // APP0 JFIF
  const app0 = [...[0x4a, 0x46, 0x49, 0x46, 0x00], 1, 1, 1, ...u32(0).slice(0, 0), (opts.dpi ?? 300) >> 8, (opts.dpi ?? 300) & 0xff, (opts.dpi ?? 300) >> 8, (opts.dpi ?? 300) & 0xff, 0, 0]
  out.push(0xff, 0xe0, (app0.length + 2) >> 8, (app0.length + 2) & 0xff, ...app0)
  // SOF0
  const sof = [8, height >> 8, height & 0xff, width >> 8, width & 0xff, comps, ...Array.from({ length: comps * 3 }, () => 0)]
  out.push(0xff, 0xc0, (sof.length + 2) >> 8, (sof.length + 2) & 0xff, ...sof)
  out.push(0xff, 0xd9)
  return new Uint8Array(out)
}

function pdf(body: string): Uint8Array {
  const text = `%PDF-1.6\n${body}\n%%EOF\n`
  return new TextEncoder().encode(text)
}

const bytes = (s: string) => new TextEncoder().encode(s)

/* -------------------------------- tests -------------------------------- */

describe('inspectArtwork', () => {
  it('reads PNG dimensions and declared density from IHDR and pHYs', () => {
    const meta = inspectArtwork(png(3000, 2000, { dpi: 300 }))
    expect(meta.format).toBe('png')
    expect(meta.widthPx).toBe(3000)
    expect(meta.heightPx).toBe(2000)
    expect(meta.dpiX).toBeCloseTo(300, 0)
    expect(meta.colour).toBe('rgb')
    expect(meta.vector).toBe(false)
  })

  it('detects an alpha channel from colour type 6', () => {
    expect(inspectArtwork(png(100, 100, { colourType: 6 })).hasAlpha).toBe(true)
  })

  it('reads JPEG frame dimensions', () => {
    const meta = inspectArtwork(jpeg(4000, 3000))
    expect(meta.format).toBe('jpeg')
    expect(meta.widthPx).toBe(4000)
    expect(meta.heightPx).toBe(3000)
  })

  it('treats a four-component JPEG as CMYK', () => {
    expect(inspectArtwork(jpeg(1000, 1000, { components: 4 })).colour).toBe('cmyk')
  })

  it('reads PDF pages, media and trim boxes', () => {
    const file = pdf(`1 0 obj << /Type /Page /MediaBox [0 0 595.28 841.89] /TrimBox [8.5 8.5 586.78 833.39] >>`)
    const meta = inspectArtwork(file)
    expect(meta.format).toBe('pdf')
    expect(meta.vector).toBe(true)
    expect(meta.pageCount).toBe(1)
    expect(meta.mediaBoxMm?.w).toBeCloseTo(210, 0)
    expect(meta.trimBoxMm?.w).toBeCloseTo(204, 0)
  })

  it('reads an SVG viewBox as a physical size', () => {
    const meta = inspectArtwork(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"></svg>'))
    expect(meta.format).toBe('svg')
    expect(meta.vector).toBe(true)
    expect(meta.mediaBoxMm?.w).toBeCloseTo(25.4, 0)
  })

  it('reads an EPS bounding box', () => {
    const meta = inspectArtwork(bytes('%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 283 283\n'))
    expect(meta.format).toBe('eps')
    expect(meta.mediaBoxMm?.w).toBeCloseTo(100, 0)
  })

  it('refuses to trust an extension: text named like an image is unknown', () => {
    expect(inspectArtwork(bytes('this is not artwork')).format).toBe('unknown')
  })
})

describe('evaluateArtwork', () => {
  const panel = { widthMm: 200, heightMm: 120, bleedMm: 3, minDpi: 300, label: 'front' }

  it('passes a vector PDF with declared bleed', () => {
    const file = pdf(`1 0 obj << /Type /Page /MediaBox [0 0 583.9 357.2] /TrimBox [8.5 8.5 575.4 348.7] /DeviceCMYK >>`)
    const report = evaluateArtwork(inspectArtwork(file), panel)
    expect(report.effectiveDpi).toBeNull()
    expect(report.includesBleed).toBe(true) // the page proportion is trim + bleed
    expect(report.ready).toBe(true)
    expect(report.findings.find((f) => f.id === 'bleed')?.severity).toBe('pass')
    expect(report.findings.find((f) => f.id === 'resolution')?.severity).toBe('pass')
  })

  it('blocks artwork that is far too low resolution at final size', () => {
    const meta = inspectArtwork(png(600, 360)) // 200 × 120 mm → ~76 dpi
    const report = evaluateArtwork(meta, panel)
    expect(report.effectiveDpi).toBeLessThan(100)
    expect(report.ready).toBe(false)
    const res = report.findings.find((f) => f.id === 'resolution')
    expect(res?.severity).toBe('error')
    expect(res?.fix).toMatch(/pixels|vector/)
  })

  it('passes a file with enough pixels', () => {
    // 200 × 120 mm at 300 dpi = 2362 × 1417 px
    const meta = inspectArtwork(png(2362, 1417))
    const report = evaluateArtwork(meta, panel)
    expect(report.effectiveDpi).toBeGreaterThanOrEqual(299)
    expect(report.ready).toBe(true)
  })

  it('flags RGB artwork as a colour risk but allows the order', () => {
    const report = evaluateArtwork(inspectArtwork(jpeg(4000, 2400)), { ...panel, widthMm: 400, heightMm: 240 })
    const colour = report.findings.find((f) => f.id === 'colour')
    expect(colour?.severity).toBe('warn')
    expect(report.ready).toBe(true)
  })

  it('reports CMYK artwork as safe', () => {
    const report = evaluateArtwork(inspectArtwork(jpeg(4000, 2400, { components: 4 })), {
      ...panel,
      widthMm: 400,
      heightMm: 240,
    })
    expect(report.findings.find((f) => f.id === 'colour')?.severity).toBe('pass')
  })

  it('detects proportions that already include the bleed', () => {
    // trim 200×120 + 3 mm bleed = 206×126 → same ratio as 2060×1260 px
    const meta = inspectArtwork(png(2060, 1260))
    const report = evaluateArtwork(meta, panel)
    expect(report.includesBleed).toBe(true)
    expect(report.findings.find((f) => f.id === 'bleed')?.severity).toBe('pass')
  })

  it('blocks artwork whose proportions are badly wrong', () => {
    const meta = inspectArtwork(png(4000, 500))
    const report = evaluateArtwork(meta, panel)
    expect(report.findings.find((f) => f.id === 'aspect')?.severity).toBe('error')
    expect(report.ready).toBe(false)
  })

  it('warns on a small proportion error rather than blocking', () => {
    const meta = inspectArtwork(png(2390, 1417)) // ~1.2% off
    const report = evaluateArtwork(meta, panel)
    const aspect = report.findings.find((f) => f.id === 'aspect')
    expect(aspect?.severity).toBe('warn')
    expect(report.ready).toBe(true)
  })

  it('blocks an unrecognised format', () => {
    const report = evaluateArtwork(inspectArtwork(bytes('nope')), panel)
    expect(report.ready).toBe(false)
    expect(report.findings[0].severity).toBe('error')
  })

  it('sorts errors first', () => {
    const report = evaluateArtwork(inspectArtwork(png(600, 360)), panel)
    const severities = report.findings.map((f) => f.severity)
    const firstWarn = severities.indexOf('warn')
    const lastError = severities.lastIndexOf('error')
    expect(lastError === -1 || firstWarn === -1 || lastError < firstWarn).toBe(true)
    expect(summarise(report).errors).toBeGreaterThan(0)
  })

  it('flags a file built for a different panel size', () => {
    const meta = inspectArtwork(png(3000, 2000))
    const report = evaluateArtwork(meta, { ...panel, widthMm: 400, heightMm: 300 })
    expect(report.findings.some((f) => f.id === 'box' || f.id === 'aspect')).toBe(true)
  })
})
