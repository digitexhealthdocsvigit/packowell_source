import { describe, expect, it } from 'vitest'
import { buildStructure } from '../src/lib/geometry/build'
import { dielineSvg } from '../src/lib/geometry/dieline'
import { STRUCTURES } from '../src/lib/geometry/structures'
import type { BuildResult } from '../src/lib/geometry/types'

const DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
const PAD = 20

/**
 * The panel rectangle the dieline will draw into, recomputed from the same
 * polygon transform `dielineSvg` uses. Kept independent of the implementation
 * on purpose: if the drawing maths moves, this expectation moves with it only
 * when the geometry really changed.
 */
function panelBox(result: BuildResult, panelId: string) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of result.panels) {
    for (const pt of p.polygon) {
      minX = Math.min(minX, pt.x)
      minY = Math.min(minY, pt.y)
      maxX = Math.max(maxX, pt.x)
      maxY = Math.max(maxY, pt.y)
    }
  }
  const panel = result.panels.find((p) => p.spec.id === panelId)
  if (!panel) throw new Error(`no panel ${panelId}`)
  const xs = panel.polygon.map((pt) => pt.x)
  const ys = panel.polygon.map((pt) => pt.y)
  return {
    x: Math.min(...xs) - minX + PAD,
    y: maxY - Math.max(...ys) + PAD,
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  }
}

function imageRect(svg: string) {
  const m = /<image[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/.exec(svg)
  if (!m) return null
  return { x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }
}

describe.each(STRUCTURES.map((s) => [s.id, s] as const))('dieline artwork — %s', (_id, spec) => {
  const built = buildStructure(spec, spec.defaults, spec.boards[0])

  if (built.panels.length === 0) {
    // `assembly` structures (pouch, standee) are formed shells rather than
    // folded blanks, so there is no net to draw and nothing to place artwork on.
    it('is a formed shell: no panels, no blank artwork', () => {
      expect(spec.klass).toBe('assembly')
      const svg = dielineSvg(built, { pad: PAD, artwork: { panelId: 'any', dataUrl: DATA, imageAspect: 1 } })
      expect(svg).not.toContain('<image')
    })
    return
  }

  it('has panels to draw', () => {
    expect(built.panels.length).toBeGreaterThan(0)
  })

  it.each(built.panels.map((p) => [p.spec.id, p.spec.label] as const))(
    'places artwork on panel %s (%s) and nowhere else',
    (panelId, _label) => {
      const box = panelBox(built, panelId)
      const svg = dielineSvg(built, {
        pad: PAD,
        artwork: { panelId, dataUrl: DATA, imageAspect: 1.5, fit: 'contain' },
      })

      // Exactly one image, one clip, and the clip is the panel's own outline.
      expect(svg.match(/<image/g)?.length).toBe(1)
      expect(svg.match(/<clipPath/g)?.length).toBe(1)

      const rect = imageRect(svg)
      expect(rect).not.toBeNull()

      // The artwork cannot stray outside the panel it was checked against.
      expect(rect!.x).toBeGreaterThanOrEqual(box.x - 0.01)
      expect(rect!.y).toBeGreaterThanOrEqual(box.y - 0.01)
      expect(rect!.x + rect!.w).toBeLessThanOrEqual(box.x + box.w + 0.01)
      expect(rect!.y + rect!.h).toBeLessThanOrEqual(box.y + box.h + 0.01)

      // Aspect is preserved, and contain means at least one edge touches.
      expect(rect!.w / rect!.h).toBeCloseTo(1.5, 1)
      const touchesW = Math.abs(rect!.w - box.w) < 0.05
      const touchesH = Math.abs(rect!.h - box.h) < 0.05
      expect(touchesW || touchesH).toBe(true)

      // The panel carrying the artwork loses its caption, so text cannot sit on
      // top of the customer's design.
      const labels = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1])
      expect(labels).not.toContain(_label.replace(/[<>&"']/g, (c) =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] as string))
    },
  )

  it('keeps a tall image inside the panel instead of stretching it', () => {
    const panel = built.panels[0]
    const box = panelBox(built, panel.spec.id)
    const svg = dielineSvg(built, {
      pad: PAD,
      artwork: { panelId: panel.spec.id, dataUrl: DATA, imageAspect: 0.25, fit: 'contain' },
    })
    const rect = imageRect(svg)!
    expect(rect.w / rect.h).toBeCloseTo(0.25, 2)
    expect(rect.h).toBeLessThanOrEqual(box.h + 0.01)
    expect(rect.w).toBeLessThanOrEqual(box.w + 0.01)
  })

  it('cover fills the panel and still clips to it', () => {
    const panel = built.panels[0]
    const box = panelBox(built, panel.spec.id)
    const svg = dielineSvg(built, {
      pad: PAD,
      artwork: { panelId: panel.spec.id, dataUrl: DATA, imageAspect: 3, fit: 'cover' },
    })
    const rect = imageRect(svg)!
    expect(rect.w).toBeGreaterThanOrEqual(box.w - 0.01)
    expect(rect.h).toBeGreaterThanOrEqual(box.h - 0.01)
    expect(svg).toContain('clip-path="url(#panel-clip)"')
  })

  it('draws no image when the artwork panel is not in this structure', () => {
    const svg = dielineSvg(built, {
      pad: PAD,
      artwork: { panelId: 'not-a-panel', dataUrl: DATA, imageAspect: 1.5 },
    })
    expect(svg).not.toContain('<image')
    expect(svg).not.toContain('<clipPath')
  })
})
