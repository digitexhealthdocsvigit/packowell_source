/**
 * Pricing engine.
 *
 * Every number it uses comes from a RateTable. Nothing is hard-coded here.
 * A rate table that has not been approved by the business owner returns
 * `{ status: 'quote' }` — the platform must never invent a price.
 */

export interface RateTable {
  id: string
  label: string
  /** true only when the owner has confirmed every rate below */
  approved: boolean
  updatedAt: string | null
  currency: 'INR'
  /** target gross margin, 0..0.9 — converted with cost / (1 - margin) */
  targetGrossMargin: number
  /** material lost in setup, trim and make-ready */
  wastePct: number
  /** overhead allocated to production, as a fraction of direct cost */
  overheadPct: number
  /** GST rate applied on top of the selling price */
  taxPct: number
  /** board / substrate cost per square metre, keyed by board id */
  boardPerM2: Record<string, number | null>
  /** printing: cost per square metre per colour pass (digital) */
  printPerM2PerColour: number | null
  /** printing: one-off setup (plates, make-ready) per colour */
  printSetupPerColour: number | null
  /** die / cutting forme, one-off */
  dieSetup: number | null
  /** die-cutting + creasing per 1000 units */
  conversionPer1000: number | null
  /** hand assembly per unit (rigid boxes, displays) */
  assemblyPerUnit: number | null
  /** packing + carton per unit */
  packingPerUnit: number | null
  /** finishing costs per square metre */
  finishPerM2: Record<string, number | null>
  /** minimum job charge — a floor on the whole job */
  minimumJob: number | null
  /** quote validity in days */
  validityDays: number
}

export const DEFAULT_RATES: RateTable = {
  id: 'unapproved',
  label: 'Not yet approved by the business owner',
  approved: false,
  updatedAt: null,
  currency: 'INR',
  targetGrossMargin: 0.32,
  wastePct: 0.08,
  overheadPct: 0.12,
  taxPct: 0.18,
  boardPerM2: {},
  printPerM2PerColour: null,
  printSetupPerColour: null,
  dieSetup: null,
  conversionPer1000: null,
  assemblyPerUnit: null,
  packingPerUnit: null,
  finishPerM2: {},
  minimumJob: null,
  validityDays: 7,
}

export interface PriceInput {
  structureId: string
  productSlug: string
  /** consumed blank area for ONE unit, in square metres, from the dieline */
  blankAreaM2: number
  boardId: string
  boardLabel: string
  quantity: number
  printColours: number
  finishes: string[]
  /** flat 2D products (labels, brochures) price per square metre of sheet */
  usesDielineArea: boolean
}

export interface PriceLine {
  key: string
  label: string
  amountPerUnit: number
  amountTotal: number
  basis: string
}

export type PriceResult =
  | {
      status: 'ok'
      lines: PriceLine[]
      directCostPerUnit: number
      costTotal: number
      priceBeforeTaxPerUnit: number
      priceBeforeTaxTotal: number
      taxTotal: number
      total: number
      marginPct: number
      ratesId: string
      ratesLabel: string
      validUntil: string
    }
  | {
      status: 'quote'
      reasons: string[]
    }

const n = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

export function estimate(input: PriceInput, rates: RateTable, now = new Date()): PriceResult {
  const missing: string[] = []
  if (!rates.approved) missing.push('The rate card has not been approved by the business owner.')
  if (!n(rates.boardPerM2[input.boardId])) missing.push(`No material rate for "${input.boardLabel}".`)
  if (!n(rates.printPerM2PerColour)) missing.push('No printing rate on file.')
  if (!n(rates.dieSetup)) missing.push('No die / tooling cost on file.')
  if (!n(rates.conversionPer1000)) missing.push('No conversion rate on file.')
  if (!n(rates.packingPerUnit)) missing.push('No packing rate on file.')
  if (input.quantity <= 0) missing.push('Quantity must be greater than zero.')
  if (input.quantity < 1) missing.push('Enter at least one unit.')

  if (missing.length) return { status: 'quote', reasons: missing }

  const boardRate = rates.boardPerM2[input.boardId] as number
  const qty = Math.max(1, Math.floor(input.quantity))
  const area = Math.max(0.0001, input.blankAreaM2) * (1 + rates.wastePct)

  const material = area * boardRate
  const print = area * (rates.printPerM2PerColour as number) * Math.max(1, input.printColours)
  const conversion = (rates.conversionPer1000 as number) / 1000
  const assembly = n(rates.assemblyPerUnit) ? rates.assemblyPerUnit : 0
  const packing = rates.packingPerUnit as number
  const finishingPerUnit = input.finishes.reduce(
    (sum, f) => sum + (n(rates.finishPerM2[f]) ? (rates.finishPerM2[f] as number) * area : 0),
    0,
  )

  const setupTotal =
    (n(rates.printSetupPerColour) ? rates.printSetupPerColour * Math.max(1, input.printColours) : 0) +
    (rates.dieSetup as number)
  const setupPerUnit = setupTotal / qty

  const directPerUnit = material + print + conversion + finishingPerUnit + assembly + packing + setupPerUnit
  const overheadPerUnit = directPerUnit * rates.overheadPct
  const costPerUnit = directPerUnit + overheadPerUnit
  const costTotal = costPerUnit * qty

  const priceBeforeTaxPerUnit = costPerUnit / (1 - rates.targetGrossMargin)
  const priceBeforeTaxTotal = priceBeforeTaxPerUnit * qty
  const taxTotal = priceBeforeTaxTotal * rates.taxPct

  const lines: PriceLine[] = [
    { key: 'material', label: 'Material', amountPerUnit: material, amountTotal: material * qty, basis: `${(area).toFixed(4)} m² incl. waste × ₹${boardRate}/m²` },
    { key: 'print', label: 'Printing', amountPerUnit: print, amountTotal: print * qty, basis: `${input.printColours} colour pass(es)` },
    { key: 'setup', label: 'Setup & tooling', amountPerUnit: setupPerUnit, amountTotal: setupTotal, basis: 'Amortised over the run' },
    { key: 'conversion', label: 'Cutting & conversion', amountPerUnit: conversion, amountTotal: conversion * qty, basis: 'Per 1000 units' },
    { key: 'finishing', label: 'Finishing', amountPerUnit: finishingPerUnit, amountTotal: finishingPerUnit * qty, basis: input.finishes.join(', ') || 'None' },
    { key: 'assembly', label: 'Assembly', amountPerUnit: assembly, amountTotal: assembly * qty, basis: 'Hand assembly' },
    { key: 'packing', label: 'Packing', amountPerUnit: packing, amountTotal: packing * qty, basis: 'Per unit' },
    { key: 'overhead', label: 'Allocated overhead', amountPerUnit: overheadPerUnit, amountTotal: overheadPerUnit * qty, basis: `${(rates.overheadPct * 100).toFixed(0)}% of direct cost` },
  ].filter((l) => l.amountTotal > 0)

  const validUntil = new Date(now.getTime() + rates.validityDays * 86_400_000).toISOString()

  return {
    status: 'ok',
    lines,
    directCostPerUnit: costPerUnit,
    costTotal,
    priceBeforeTaxPerUnit,
    priceBeforeTaxTotal,
    taxTotal,
    total: priceBeforeTaxTotal + taxTotal,
    marginPct: rates.targetGrossMargin,
    ratesId: rates.id,
    ratesLabel: rates.label,
    validUntil,
  }
}

/** Standard volume ladder offered on packaging jobs. */
export const QUANTITY_TIERS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

export function tierLadder(input: PriceInput, rates: RateTable, tiers = QUANTITY_TIERS) {
  return tiers.map((quantity) => {
    const res = estimate({ ...input, quantity }, rates)
    return {
      quantity,
      status: res.status,
      unitPrice: res.status === 'ok' ? res.priceBeforeTaxPerUnit : null,
      total: res.status === 'ok' ? res.total : null,
    }
  })
}

/** Gross margin vs markup — kept explicit because they are routinely confused. */
export function marginToMarkup(margin: number): number {
  return margin / (1 - margin)
}
export function markupToMargin(markup: number): number {
  return markup / (1 + markup)
}
