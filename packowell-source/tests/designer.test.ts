import { describe, expect, it } from 'vitest'
import { planComposition, type DesignLayer } from '../src/lib/designer/compose'
import { buildProductSchema } from '../src/lib/seo/productSchema'

const text = (over: Partial<Extract<DesignLayer, { type: 'text' }>> = {}): DesignLayer => ({
  id: 't1',
  type: 'text',
  text: 'Packowell',
  size: 0.1,
  color: '#201d1a',
  align: 'center',
  weight: 600,
  x: 0.5,
  y: 0.5,
  ...over,
})

const bg = (over: Partial<Extract<DesignLayer, { type: 'background' }>> = {}): DesignLayer => ({
  id: 'b1',
  type: 'background',
  color: '#ffffff',
  pattern: 'none',
  patternColor: '#201d1a',
  ...over,
})

describe('planComposition', () => {
  it('returns nothing for an empty design', () => {
    expect(planComposition([], 100, 100)).toEqual([])
  })

  it('hoists a background behind content regardless of array position', () => {
    const ops = planComposition([text(), bg({ color: '#c98224' })], 100, 100)
    expect(ops[0].kind).toBe('background')
    expect(ops[1].kind).toBe('text')
  })

  it('uses the last background when several are present', () => {
    const ops = planComposition([bg({ id: 'b1', color: '#111111' }), bg({ id: 'b2', color: '#222222' })], 10, 10)
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ kind: 'background', color: '#222222' })
  })

  it('preserves layer order for content', () => {
    const ops = planComposition(
      [text({ id: 'a', text: 'first' }), text({ id: 'b', text: 'second' })],
      100,
      100,
    )
    expect(ops.map((o) => (o.kind === 'text' ? o.text : ''))).toEqual(['first', 'second'])
  })

  it('scales text with panel height, not width', () => {
    const short = planComposition([text({ size: 0.1 })], 1000, 100)
    const tall = planComposition([text({ size: 0.1 })], 100, 1000)
    const px = (ops: ReturnType<typeof planComposition>) => (ops[0].kind === 'text' ? ops[0].px : 0)
    expect(px(short)).toBe(10)
    expect(px(tall)).toBe(100)
  })

  it('maps normalised coordinates onto the panel', () => {
    const ops = planComposition([text({ x: 0.25, y: 0.5 })], 400, 200)
    expect(ops[0]).toMatchObject({ x: 100, y: 100 })
  })

  it('clamps out-of-range and non-finite coordinates', () => {
    const ops = planComposition([text({ x: 2, y: Number.NaN })], 400, 200)
    expect(ops[0]).toMatchObject({ x: 400, y: 0 })
  })

  it('drops empty text layers', () => {
    expect(planComposition([text({ text: '   ' })], 100, 100)).toEqual([])
  })

  it('clamps text weight into a renderable range', () => {
    const ops = planComposition([text({ weight: 5000 })], 100, 100)
    expect(ops[0]).toMatchObject({ weight: 900 })
  })

  it('emits a shape with a path and a size derived from the panel', () => {
    const ops = planComposition(
      [{ id: 's1', type: 'shape', shape: 'recycle', color: '#1f5f4b', x: 0.5, y: 0.5, scale: 0.2 }],
      200,
      100,
    )
    expect(ops[0].kind).toBe('shape')
    if (ops[0].kind === 'shape') {
      expect(ops[0].path.length).toBeGreaterThan(10)
      expect(ops[0].size).toBe(20)
    }
  })

  it('applies a background pattern without adding extra ops', () => {
    const ops = planComposition([bg({ pattern: 'diagonal' })], 100, 100)
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ kind: 'background', pattern: 'diagonal' })
  })
})

describe('buildProductSchema', () => {
  const base = {
    name: 'Roll-end tuck mailer',
    slug: 'roll-end-tuck-mailer',
    url: 'https://packowell.com/studio?structure=mailer',
    brand: 'Packowell',
  }

  it('never invents offers when there are no tiers', () => {
    const schema = buildProductSchema(base)
    const product = (schema['@graph'] as Record<string, unknown>[])[0]
    expect(product.offers).toBeUndefined()
  })

  it('never invents offers when every tier price is invalid', () => {
    const schema = buildProductSchema({
      ...base,
      tiers: [
        { quantity: 10, unitPrice: 0 },
        { quantity: 100, unitPrice: Number.NaN },
      ],
    })
    const product = (schema['@graph'] as Record<string, unknown>[])[0]
    expect(product.offers).toBeUndefined()
  })

  it('emits AggregateOffer with low/high and per-tier UnitPriceSpecification', () => {
    const schema = buildProductSchema({
      ...base,
      currency: 'INR',
      tiers: [
        { quantity: 100, unitPrice: 42 },
        { quantity: 10, unitPrice: 61 },
      ],
    })
    const product = (schema['@graph'] as Record<string, unknown>[])[0]
    const offers = product.offers as Record<string, unknown>
    expect(offers['@type']).toBe('AggregateOffer')
    expect(offers.lowPrice).toBe(42)
    expect(offers.highPrice).toBe(61)
    expect(offers.offerCount).toBe(2)

    const list = offers.offers as Record<string, unknown>[]
    expect(list[0].price).toBe(61)
    expect((list[0].priceSpecification as Record<string, unknown>)['@type']).toBe('UnitPriceSpecification')
  })

  it('records dimensions in millimetres with the MMT unit code', () => {
    const schema = buildProductSchema({ ...base, dimsMm: { l: 240, w: 180, h: 90 } })
    const product = (schema['@graph'] as Record<string, unknown>[])[0]
    const props = product.additionalProperty as Record<string, unknown>[]
    expect(props).toHaveLength(3)
    expect(props[0]).toMatchObject({ name: 'Length', value: 240, unitCode: 'MMT' })
  })

  it('omits a 3DModel node when there is no model URL', () => {
    const schema = buildProductSchema(base)
    const types = (schema['@graph'] as Record<string, unknown>[]).map((n) => n['@type'])
    expect(types).not.toContain('3DModel')
  })

  it('adds a 3DModel node only when a real URL is supplied', () => {
    const schema = buildProductSchema({ ...base, modelUrl: 'https://packowell.com/models/mailer.glb' })
    const nodes = schema['@graph'] as Record<string, unknown>[]
    const model = nodes.find((n) => n['@type'] === '3DModel')
    expect(model?.contentUrl).toBe('https://packowell.com/models/mailer.glb')
  })
})
