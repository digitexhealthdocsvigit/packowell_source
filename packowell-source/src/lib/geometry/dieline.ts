import { polygonArea } from './blank'
import type { BuildResult, ResolvedPanel } from './types'

export interface PlacedArtwork {
  panelId: string
  /** Data URL — must be self-contained so the SVG travels as one file. */
  dataUrl: string
  /** width / height of the image, so the placement maths can preserve it. */
  imageAspect: number
  fit?: 'contain' | 'cover'
  name?: string
}

export interface DielineOptions {
  /** mm of padding around the blank */
  pad?: number
  showLabels?: boolean
  showCreases?: boolean
  /** stroke scale multiplier, useful for very small blanks */
  stroke?: number
  unitNote?: string
  /** Artwork already placed on a panel, carried through to the blank. */
  artwork?: PlacedArtwork | null
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString()

/**
 * Concept dieline drawn from the same structural specification as the 3D model.
 * Cut = solid, crease = dashed. NOT a production file until the template has
 * passed structural validation — the caller must label it accordingly.
 */
export function dielineSvg(result: BuildResult, opts: DielineOptions = {}): string {
  const pad = opts.pad ?? 20
  const stroke = opts.stroke ?? 0.6
  const panels = result.panels
  if (panels.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>'

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of panels) {
    for (const pt of p.polygon) {
      minX = Math.min(minX, pt.x)
      minY = Math.min(minY, pt.y)
      maxX = Math.max(maxX, pt.x)
      maxY = Math.max(maxY, pt.y)
    }
  }

  const w = maxX - minX + pad * 2
  const h = maxY - minY + pad * 2

  const fills: string[] = []
  const cuts: string[] = []
  const creases: string[] = []
  const labels: string[] = []
  const boxes: { id: string; d: string; x: number; y: number; w: number; h: number }[] = []

  for (const p of panels) {
    const d =
      p.polygon
        .map((pt, i) => `${i === 0 ? 'M' : 'L'}${fmt(pt.x - minX + pad)} ${fmt(maxY - pt.y + pad)}`)
        .join(' ') + ' Z'
    // Fill and outline are separate layers so artwork can sit between them.
    fills.push(`<path d="${d}" fill="#f4f1ea" />`)
    cuts.push(`<path d="${d}" fill="none" stroke="#1f2937" stroke-width="${stroke}" />`)

    const xs = p.polygon.map((pt) => pt.x)
    const ys = p.polygon.map((pt) => pt.y)
    boxes.push({
      id: p.spec.id,
      d,
      x: Math.min(...xs) - minX + pad,
      y: maxY - Math.max(...ys) + pad,
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    })

    if (opts.showLabels !== false && p.spec.id !== opts.artwork?.panelId) {
      const c = p.polygon.reduce((a, b) => ({ x: a.x + b.x / p.polygon.length, y: a.y + b.y / p.polygon.length }), { x: 0, y: 0 })
      // centroid of a convex quad = mean of vertices
      const cx = p.polygon.reduce((a, b) => a + b.x, 0) / p.polygon.length
      const cy = p.polygon.reduce((a, b) => a + b.y, 0) / p.polygon.length
      void c
      labels.push(
        `<text x="${fmt(cx - minX + pad)}" y="${fmt(maxY - cy + pad)}" font-size="${Math.max(4, Math.min(9, p.width / 6))}" text-anchor="middle" fill="#6b7280" font-family="ui-sans-serif,system-ui">${escapeXml(p.spec.label)}</text>`,
      )
    }
    if (opts.showCreases !== false && p.hinge) {
      const [a, b] = p.hinge
      creases.push(
        `<line x1="${fmt(a.x - minX + pad)}" y1="${fmt(maxY - a.y + pad)}" x2="${fmt(b.x - minX + pad)}" y2="${fmt(maxY - b.y + pad)}" stroke="#dc2626" stroke-width="${stroke * 1.2}" stroke-dasharray="${stroke * 4} ${stroke * 2.4}" />`,
      )
    }
  }

  // Artwork placed on a panel, using the same contain/cover maths as the 3D
  // face so the proof and the blank cannot disagree.
  let artDef = ''
  let artImage = ''
  const placed = opts.artwork
  if (placed) {
    const box = boxes.find((b) => b.id === placed.panelId)
    if (box && placed.dataUrl) {
      const aspect = placed.imageAspect > 0 ? placed.imageAspect : box.w / box.h
      const byWidth = box.w / aspect <= box.h
      const cover = placed.fit === 'cover'
      const useWidth = cover ? !byWidth : byWidth
      const dw = useWidth ? box.w : box.h * aspect
      const dh = useWidth ? box.w / aspect : box.h
      const dx = box.x + (box.w - dw) / 2
      const dy = box.y + (box.h - dh) / 2
      artDef = `<clipPath id="panel-clip"><path d="${box.d}" /></clipPath>`
      artImage = `<image href="${placed.dataUrl}" x="${fmt(dx)}" y="${fmt(dy)}" width="${fmt(dw)}" height="${fmt(dh)}" preserveAspectRatio="none" clip-path="url(#panel-clip)" />`
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(w)} ${fmt(h)}" width="${fmt(w)}mm" height="${fmt(h)}mm" role="img" aria-label="Concept dieline">
<defs>${artDef}</defs>
<rect x="0" y="0" width="${fmt(w)}" height="${fmt(h)}" fill="#ffffff" />
${fills.join('\n')}
${artImage}
${cuts.join('\n')}
${creases.join('\n')}
${labels.join('\n')}
</svg>`
}

export function blankStats(panels: ResolvedPanel[]) {
  const area = panels.reduce((s, p) => s + polygonArea(p.polygon), 0)
  return {
    panelCount: panels.length,
    areaMm2: area,
    areaM2: area / 1_000_000,
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] as string,
  )
}

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
