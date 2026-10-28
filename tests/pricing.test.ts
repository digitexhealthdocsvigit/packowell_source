import { describe, expect, it } from 'vitest'
import { DEFAULT_RATES, estimate, marginToMarkup, markupToMargin, tierLadder } from '../src/lib/pricing/engine'
import type { PriceInput, RateTable } from '../src/lib/pricing/engine'

const RATES: RateTable = {
  ...DEFAULT_RATES,
  id: 'test-rates',
  label: 'Test rate card',
  approved: true,
  targetGrossMargin: 0.3,
  wastePct: 0.1,
  overheadPct: 0,
  taxPct: 0.18,
  boardPerM2: { 'b-flute': 42 },
  printPerM2PerColour: 90,
  printSetupPerColour: 250,
  dieSetup: 2500,
  conversionPer1000: 1800,
  assemblyPerUnit: 0,
  packingPerUnit: 3,
  finishPerM2: { matte: 30 },
  minimumJob: 5000,
  validityDays: 7,
}

const INPUT: PriceInput = {
  structureId: 'mailer',
  productSlug: 'roll-end-mailer',
  blankAreaM2: 0.2394,
  boardId: 'b-flute',
  boardLabel: '3-ply B-flute',
  quantity: 100,
  printColours: 4,
  finishes: ['matte'],
  usesDielineArea: true,
}

describe('pricing engine', () => {
  it('refuses to price on an unapproved rate card', () => {
    const r = estimate(INPUT, DEFAULT_RATES)
    expect(r.status).toBe('quote')
    if (r.status === 'quote') {
      expect(r.reasons.length).toBeGreaterThan(0)
      expect(r.reasons.join(' ')).toMatch(/not been approved/i)
    }
  })

  it('prices from the dieline area, not from L×W', () => {
    const r = estimate(INPUT, RATES)
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    const material = r.lines.find((l) => l.key === 'material')!
    const expected = INPUT.blankAreaM2 * 1.1 * 42
    expect(material.amountPerUnit).toBeCloseTo(expected, 6)
  })

  it('applies gross margin as cost / (1 - margin), not as a markup', () => {
    const r = estimate(INPUT, RATES)
    if (r.status !== 'ok') throw new Error('expected price')
    const expected = r.costTotal / (1 - 0.3)
    expect(r.priceBeforeTaxTotal).toBeCloseTo(expected, 6)
    // a 30% margin is a 42.86% markup, not 30%
    expect(marginToMarkup(0.3)).toBeCloseTo(0.428571, 5)
    expect(markupToMargin(marginToMarkup(0.3))).toBeCloseTo(0.3, 9)
  })

  it('keeps tax separate from production cost', () => {
    const r = estimate(INPUT, RATES)
    if (r.status !== 'ok') throw new Error('expected price')
    expect(r.taxTotal).toBeCloseTo(r.priceBeforeTaxTotal * 0.18, 6)
    expect(r.total).toBeCloseTo(r.priceBeforeTaxTotal + r.taxTotal, 6)
  })

  it('amortises setup across the run', () => {
    const small = estimate({ ...INPUT, quantity: 25 }, RATES)
    const large = estimate({ ...INPUT, quantity: 1000 }, RATES)
    if (small.status !== 'ok' || large.status !== 'ok') throw new Error('expected price')
    expect(small.priceBeforeTaxPerUnit).toBeGreaterThan(large.priceBeforeTaxPerUnit)
    const setupSmall = small.lines.find((l) => l.key === 'setup')!.amountPerUnit
    const setupLarge = large.lines.find((l) => l.key === 'setup')!.amountPerUnit
    expect(setupSmall).toBeCloseTo((2500 + 4 * 250) / 25, 4)
    expect(setupLarge).toBeCloseTo((2500 + 4 * 250) / 1000, 4)
  })

  it('produces a monotonic volume ladder', () => {
    const ladder = tierLadder(INPUT, RATES)
    const prices = ladder.map((t) => t.unitPrice!)
    for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeLessThan(prices[i - 1])
  })

  it('falls back to a quote when a material rate is missing', () => {
    const r = estimate({ ...INPUT, boardId: 'unknown-board', boardLabel: 'Unlisted board' }, RATES)
    expect(r.status).toBe('quote')
  })

  it('rejects a zero quantity', () => {
    const r = estimate({ ...INPUT, quantity: 0 }, RATES)
    expect(r.status).toBe('quote')
  })

  it('never returns a negative or non-finite price', () => {
    const r = estimate(INPUT, RATES)
    if (r.status !== 'ok') throw new Error('expected price')
    for (const l of r.lines) {
      expect(Number.isFinite(l.amountPerUnit)).toBe(true)
      expect(l.amountPerUnit).toBeGreaterThanOrEqual(0)
    }
    expect(r.priceBeforeTaxPerUnit).toBeGreaterThan(0)
  })
})
