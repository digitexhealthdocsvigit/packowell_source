import { describe, expect, it } from 'vitest'
import { buildStructure } from '../src/lib/geometry/build'
import { dielineSvg } from '../src/lib/geometry/dieline'
import { mailerSpec, steSpec } from '../src/lib/geometry/structures'

const DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='

function panelOf(spec: typeof mailerSpec, label: RegExp) {
  const built = buildStructure(spec, spec.defaults, spec.boards[0])
  const panel = built.panels.find((p) => label.test(p.spec.label))
  if (!panel) throw new Error(`no panel matching ${label}`)
  return { built, panel }
}

describe('dieline artwork placement', () => {
  it('emits no image when no artwork is placed', () => {
    const { built } = panelOf(mailerSpec, /lid/i)
    const svg = dielineSvg(built, {})
    expect(svg).not.toContain('<image')
    expect(svg).toContain('<path')
  })

  it('places the artwork on the panel it was checked against', () => {
    const { built, panel } = panelOf(mailerSpec, /lid/i)
    const svg = dielineSvg(built, {
      artwork: { panelId: panel.spec.id, dataUrl: DATA, imageAspect: panel.width / panel.height, fit: 'contain' },
    })
    expect(svg).toContain('<image')
    expect(svg).toContain(DATA)
    expect(svg).toContain('clip-path="url(#panel-clip)"')
    // A contain fit at a matching aspect fills the panel exactly.
    expect(svg).toContain(`width="${Math.round(panel.width * 100) / 100}"`)
  })

  it('keeps a wide image inside a square-ish panel instead of stretching it', () => {
    const { built, panel } = panelOf(steSpec, /front|panel|wall/i)
    const aspect = 2 // twice as wide as tall
    const svg = dielineSvg(built, {
      artwork: { panelId: panel.spec.id, dataUrl: DATA, imageAspect: aspect, fit: 'contain' },
    })
    const image = /<image[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/.exec(svg)
    expect(image).toBeTruthy()
    const w = Number(image![1])
    const h = Number(image![2])
    expect(w / h).toBeCloseTo(aspect, 1)
    expect(h).toBeLessThanOrEqual(panel.height + 0.01)
  })

  it('draws the artwork above the panel fills and below the cut lines', () => {
    const { built, panel } = panelOf(mailerSpec, /lid/i)
    const svg = dielineSvg(built, {
      artwork: { panelId: panel.spec.id, dataUrl: DATA, imageAspect: 1.5, fit: 'contain' },
    })
    const fillAt = svg.indexOf('fill="#f4f1ea"')
    const imageAt = svg.indexOf('<image')
    const cutAt = svg.indexOf('fill="none" stroke=')
    expect(fillAt).toBeGreaterThan(-1)
    expect(imageAt).toBeGreaterThan(fillAt)
    expect(cutAt).toBeGreaterThan(imageAt)
  })

  it('ignores an artwork panel that no longer exists', () => {
    const { built } = panelOf(mailerSpec, /lid/i)
    const svg = dielineSvg(built, {
      artwork: { panelId: 'panel-that-was-renamed', dataUrl: DATA, imageAspect: 1.5 },
    })
    expect(svg).not.toContain('<image')
  })
})
