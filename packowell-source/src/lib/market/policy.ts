/**
 * Market policy — the owner-editable half of international support.
 *
 * Three distinct states per destination, because "we will quote you" and "we
 * will deliver to you" are different promises:
 *
 *   quote-only  → enquiries accepted, freight and duties confirmed per job
 *   served      → owner has confirmed shipping capability for that destination
 *   not-served  → enquiries are refused with a clear reason
 *
 * Nothing here is preticked on the owner's behalf: every destination starts at
 * `quote-only`, which promises nothing beyond a written answer.
 */

import type { CurrencyCode } from './currencies'
import { CURRENCY_CODES } from './currencies'
import { COUNTRY_BY_CODE } from './countries'
import { DEFAULT_FX_POLICY, type FxPolicy, type RateQuote } from './fx'

export type DestinationStatus = 'quote-only' | 'served' | 'not-served'

export const DESTINATION_STATUSES: DestinationStatus[] = ['quote-only', 'served', 'not-served']

export const DESTINATION_LABEL: Record<DestinationStatus, string> = {
  'quote-only': 'Quote only — freight confirmed per job',
  served: 'Served — shipping confirmed',
  'not-served': 'Not served — enquiries refused',
}

export interface DestinationOverride {
  code: string
  status: DestinationStatus
  note?: string | null
  /** Optional currency override for this destination. */
  currency?: CurrencyCode | null
}

export interface ProductRule {
  productSlug: string
  country: string
  available: boolean
  /** Minimum order quantity the owner has confirmed for this product × market. */
  moq?: number | null
  leadTimeDays?: number | null
  note?: string | null
}

export interface MarketPolicy {
  fx: FxPolicy
  /** Currencies a quotation may be requested in. */
  quoteCurrencies: CurrencyCode[]
  /**
   * `auto` prefers live rates and falls back to owner-set ones; `manual` ignores
   * live providers entirely. Manual rates are stored as ExchangeRate rows with
   * `source: 'manual'`, so both kinds share one audit trail.
   */
  rateProvider: 'auto' | 'manual'
  /** Shown on the quote form and in the inbox — never invented by the UI. */
  shippingNote: string
  dutyNote: string
  taxNote: string
  paymentNote: string
  updatedAt: string | null
}

export const DEFAULT_MARKET_POLICY: MarketPolicy = {
  fx: { ...DEFAULT_FX_POLICY },
  quoteCurrencies: [...CURRENCY_CODES],
  rateProvider: 'auto',
  shippingNote:
    'Freight is quoted per destination once the packed volume and weight are known. [FREIGHT PARTNER AND INCOTERMS TO BE CONFIRMED]',
  dutyNote:
    'Import duties and customs clearance are the buyer’s responsibility unless the quotation states otherwise. [DUTY POLICY TO BE CONFIRMED]',
  taxNote:
    'Tax treatment depends on the destination. Indian domestic orders carry GST at the applicable rate; export documentation is issued per the quotation. [TAX REGISTRATION FOR EXPORTS TO BE CONFIRMED]',
  paymentNote:
    'Payment terms are stated on the quotation. No online payment is taken by this site. [PAYMENT TERMS TO BE CONFIRMED]',
  updatedAt: null,
}

export interface DestinationState {
  code: string
  name: string
  status: DestinationStatus
  currency: CurrencyCode
  note: string | null
}

/**
 * Resolve one destination from the sparse override table.
 * Unknown / unconfigured countries are `quote-only`, never `served`.
 */
export function resolveDestination(
  code: string,
  overrides: DestinationOverride[],
  policy: MarketPolicy,
): DestinationState {
  const country = COUNTRY_BY_CODE[code?.toUpperCase()]
  const override = overrides.find((o) => o.code?.toUpperCase() === code?.toUpperCase())
  const supported = CURRENCY_CODES.includes(country?.currency as CurrencyCode)
  return {
    code: code?.toUpperCase() ?? '',
    name: country?.name ?? code ?? 'Unknown',
    status: override?.status ?? 'quote-only',
    currency:
      (override?.currency as CurrencyCode | undefined) ??
      (supported ? (country!.currency as CurrencyCode) : policy.fx.fallbackCurrency),
    note: override?.note ?? null,
  }
}

/** Product × destination availability. Unconfigured means "ask us", i.e. available. */
export function resolveProductRule(
  rules: ProductRule[],
  productSlug: string,
  country: string,
): { configured: boolean; available: boolean; moq: number | null; leadTimeDays: number | null; note: string | null } {
  const rule = rules.find(
    (r) => r.productSlug === productSlug && r.country?.toUpperCase() === country?.toUpperCase(),
  )
  if (!rule) return { configured: false, available: true, moq: null, leadTimeDays: null, note: null }
  return {
    configured: true,
    available: rule.available,
    moq: rule.moq ?? null,
    leadTimeDays: rule.leadTimeDays ?? null,
    note: rule.note ?? null,
  }
}

/** Which rate applies for `quote`, honouring the provider policy. Pure. */
export function pickRate(rates: RateQuote[], quote: CurrencyCode, policy: MarketPolicy): RateQuote | null {
  const forQuote = rates.filter((r) => r.quote === quote)
  const manual = forQuote.find((r) => r.source === 'manual') ?? null
  const live = forQuote.find((r) => r.source === 'live') ?? null
  if (policy.rateProvider === 'manual') return manual
  return live ?? manual
}

/** What the browser is allowed to see. Policy internals stay server-side. */
export interface MarketSnapshot {
  baseCurrency: CurrencyCode
  fallbackCurrency: CurrencyCode
  conversionEnabled: boolean
  markupPct: number
  roundingMode: FxPolicy['roundingMode']
  roundingStep: number
  refreshHours: number
  maxAgeHours: number
  quoteCurrencies: CurrencyCode[]
  shippingNote: string
  dutyNote: string
  taxNote: string
  paymentNote: string
  /** Rates from the base currency, newest first per pair. */
  rates: RateQuote[]
  /** Sparse overrides — absent means `quote-only`. */
  destinations: Record<string, { status: DestinationStatus; note: string | null }>
  products: ProductRule[]
  pricing: { status: 'unapproved' | 'approved'; note: string }
  updatedAt: string | null
  generatedAt: string
}

export function toSnapshot(
  policy: MarketPolicy,
  rates: RateQuote[],
  overrides: DestinationOverride[],
  products: ProductRule[],
  now = new Date(),
): MarketSnapshot {
  return {
    baseCurrency: policy.fx.baseCurrency,
    fallbackCurrency: policy.fx.fallbackCurrency,
    conversionEnabled: policy.fx.conversionEnabled,
    markupPct: policy.fx.markupPct,
    roundingMode: policy.fx.roundingMode,
    roundingStep: policy.fx.roundingStep,
    refreshHours: policy.fx.refreshHours,
    maxAgeHours: policy.fx.maxAgeHours,
    quoteCurrencies: policy.quoteCurrencies,
    shippingNote: policy.shippingNote,
    dutyNote: policy.dutyNote,
    taxNote: policy.taxNote,
    paymentNote: policy.paymentNote,
    rates: rates.map((r) => ({ ...r, provider: r.provider })),
    destinations: Object.fromEntries(
      overrides.map((o) => [o.code.toUpperCase(), { status: o.status, note: o.note ?? null }]),
    ),
    products,
    pricing: {
      status: 'unapproved',
      note: 'No rate card has been approved, so the site shows “Request a quote” rather than a price.',
    },
    updatedAt: policy.updatedAt,
    generatedAt: now.toISOString(),
  }
}
