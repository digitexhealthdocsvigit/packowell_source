/**
 * Currency conversion.
 *
 * Two rules run through this file:
 *
 * 1. A converted price is a *derived* number. It is never stored as the price,
 *    and it is never presented as an amount payable. The base amount, the rate
 *    used, the converted figure and the rate timestamp travel together.
 * 2. If a usable rate is missing, nothing is guessed. The caller gets
 *    `{ ok: false }` and the UI falls back to "Request a quote".
 */

import { CURRENCIES, isCurrencyCode, type CurrencyCode } from './currencies'

export type RoundingMode = 'none' | 'nearest' | 'up'

export interface FxPolicy {
  /** Every stored price is in this currency. */
  baseCurrency: CurrencyCode
  /** Used when a destination's own currency is not supported. */
  fallbackCurrency: CurrencyCode
  conversionEnabled: boolean
  /** Spread added to the mid-market rate, in percent. Disclosed in the UI. */
  markupPct: number
  roundingMode: RoundingMode
  /** Rounding step in major units of the target currency (1, 5, 10…). */
  roundingStep: number
  /** How often `syncRates` should refresh. */
  refreshHours: number
  /** Rates older than this are not used at all. */
  maxAgeHours: number
}

export const DEFAULT_FX_POLICY: FxPolicy = {
  baseCurrency: 'INR',
  fallbackCurrency: 'USD',
  conversionEnabled: true,
  markupPct: 0,
  roundingMode: 'nearest',
  roundingStep: 1,
  refreshHours: 24,
  maxAgeHours: 168,
}

export interface RateQuote {
  base: string
  quote: string
  rate: number
  /** `live` came from a provider; `manual` was entered by the owner. */
  source: 'live' | 'manual'
  provider: string | null
  fetchedAt: string
}

export interface ConvertedPrice {
  baseCurrency: CurrencyCode
  baseAmount: number
  currency: CurrencyCode
  /** Mid-market rate as reported by the provider. */
  rate: number
  markupPct: number
  /** rate × (1 + markup%). The rate actually applied. */
  effectiveRate: number
  /** baseAmount × effectiveRate, before rounding. */
  convertedAmount: number
  /** The figure shown to the visitor. */
  displayAmount: number
  /** ISO timestamp of the rate itself — not of the page render. */
  fetchedAt: string
  rateSource: 'live' | 'manual'
  /** True when the rate is past its refresh interval (still within maxAge). */
  stale: boolean
  /** False when base and target are the same currency, so nothing was converted. */
  converted: boolean
  /** Always true: this is a converted indication, not a quotation. */
  indicative: true
}

export type ConversionFailure = 'invalid-amount' | 'no-rate' | 'rate-expired' | 'unsupported-currency' | 'disabled'

export type ConversionResult =
  | { ok: true; price: ConvertedPrice }
  | { ok: false; reason: ConversionFailure; message: string }

export function roundAmount(value: number, step: number, mode: RoundingMode): number {
  if (!Number.isFinite(value)) return value
  if (mode === 'none' || !Number.isFinite(step) || step <= 0) return value
  // A step larger than the amount would round a real price to zero; leave it be.
  if (value !== 0 && Math.abs(value) < step) return value
  const units = value / step
  const rolled = mode === 'up' ? Math.ceil(units) : Math.round(units)
  // Floating-point safety: 10 × 0.1 is not 1.
  return Number((rolled * step).toFixed(6))
}

export function isStale(fetchedAt: string, refreshHours: number, now = new Date()): boolean {
  const at = Date.parse(fetchedAt)
  if (!Number.isFinite(at)) return true
  const ageHours = (now.getTime() - at) / 3_600_000
  return ageHours > refreshHours
}

function isExpired(fetchedAt: string, maxAgeHours: number, now = new Date()): boolean {
  const at = Date.parse(fetchedAt)
  if (!Number.isFinite(at)) return true
  return (now.getTime() - at) / 3_600_000 > maxAgeHours
}

/**
 * Convert `amount` from the base currency into `to`.
 *
 * `quote` must be the row whose `quote` is `to` and whose `base` is the policy
 * base. Passing the wrong direction is a bug, so it is rejected rather than
 * silently inverted.
 */
export function convert(
  amount: number,
  to: CurrencyCode,
  quote: RateQuote | null | undefined,
  policy: FxPolicy,
  now = new Date(),
): ConversionResult {
  if (!isCurrencyCode(to)) {
    return { ok: false, reason: 'unsupported-currency', message: `Cannot quote in ${to}.` }
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, reason: 'invalid-amount', message: 'A price is required before it can be converted.' }
  }

  const baseCurrency = policy.baseCurrency

  if (to === baseCurrency) {
    const displayAmount = roundAmount(amount, policy.roundingStep, policy.roundingMode)
    return {
      ok: true,
      price: {
        baseCurrency,
        baseAmount: amount,
        currency: to,
        rate: 1,
        markupPct: 0,
        effectiveRate: 1,
        convertedAmount: amount,
        displayAmount: Number(displayAmount.toFixed(CURRENCIES[to].decimals)),
        fetchedAt: now.toISOString(),
        rateSource: 'live',
        stale: false,
        converted: false,
        indicative: true,
      },
    }
  }

  if (!policy.conversionEnabled) {
    return {
      ok: false,
      reason: 'disabled',
      message: 'Currency conversion is switched off — quoting in the base currency only.',
    }
  }

  if (!quote || !Number.isFinite(quote.rate) || quote.rate <= 0) {
    return {
      ok: false,
      reason: 'no-rate',
      message: `No ${baseCurrency}→${to} exchange rate is on file, so a converted price cannot be shown.`,
    }
  }

  if (quote.base !== baseCurrency || quote.quote !== to) {
    return {
      ok: false,
      reason: 'no-rate',
      message: `An exchange rate for ${quote.base}→${quote.quote} cannot be used for ${baseCurrency}→${to}.`,
    }
  }

  if (quote.source === 'live' && isExpired(quote.fetchedAt, policy.maxAgeHours, now)) {
    return {
      ok: false,
      reason: 'rate-expired',
      message: `The ${baseCurrency}→${to} rate is older than ${policy.maxAgeHours} hours and is no longer used.`,
    }
  }

  const markupPct = Number.isFinite(policy.markupPct) ? policy.markupPct : 0
  const effectiveRate = quote.rate * (1 + markupPct / 100)
  const convertedAmount = amount * effectiveRate
  const displayAmount = roundAmount(convertedAmount, policy.roundingStep, policy.roundingMode)

  return {
    ok: true,
    price: {
      baseCurrency,
      baseAmount: amount,
      currency: to,
      rate: quote.rate,
      markupPct,
      effectiveRate,
      convertedAmount,
      displayAmount: Number(displayAmount.toFixed(CURRENCIES[to].decimals)),
      fetchedAt: quote.fetchedAt,
      rateSource: quote.source,
      stale: quote.source === 'live' && isStale(quote.fetchedAt, policy.refreshHours, now),
      converted: true,
      indicative: true,
    },
  }
}

/**
 * Format an amount in a currency's conventional notation.
 * Falls back to a plain "<CODE> 1,234.56" rather than guessing a symbol.
 */
export function formatMoney(amount: number, code: CurrencyCode, opts: { decimals?: number; locale?: string } = {}): string {
  const meta = CURRENCIES[code]
  if (!meta || !Number.isFinite(amount)) return '—'
  const decimals = opts.decimals ?? meta.decimals
  try {
    return new Intl.NumberFormat(opts.locale ?? meta.locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount)
  } catch {
    return `${code} ${amount.toFixed(decimals)}`
  }
}

/** "USD 1,234.56" — unambiguous when several dollar-ish currencies are in play. */
export function formatMoneyWithCode(amount: number, code: CurrencyCode): string {
  const meta = CURRENCIES[code]
  if (!meta || !Number.isFinite(amount)) return '—'
  try {
    const number = new Intl.NumberFormat(meta.locale, {
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(amount)
    return `${code} ${number}`
  } catch {
    return `${code} ${amount.toFixed(meta.decimals)}`
  }
}

/** One-line provenance for a converted figure, shown next to it. */
export function describeRate(price: ConvertedPrice): string {
  if (!price.converted) return `Base price, no conversion applied.`
  const parts = [
    `1 ${price.baseCurrency} = ${price.effectiveRate.toFixed(4)} ${price.currency}`,
    `${price.rateSource === 'live' ? 'rate' : 'manually set rate'} of ${new Date(price.fetchedAt).toISOString().slice(0, 10)}`,
  ]
  if (price.markupPct) parts.push(`${price.markupPct}% conversion spread`)
  if (price.stale) parts.push('past its refresh interval')
  return parts.join(' · ')
}

export const CONVERSION_DISCLAIMER =
  'Converted amounts are an indication at today’s rate, not a final payable price. The quotation is issued in the currency you request and is only final once it is accepted in writing.'
