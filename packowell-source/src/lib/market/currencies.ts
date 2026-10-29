/**
 * Currency metadata for the markets the site can quote in.
 *
 * `locale` is the convention the currency is *written* in, not the visitor's
 * language: a euro amount is formatted 1.234,56 € wherever the buyer sits,
 * because that is how a euro invoice is read. Formatting therefore always goes
 * through Intl.NumberFormat — never through symbol replacement.
 */

export type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'EUR' | 'AED' | 'CAD' | 'AUD' | 'SGD'

export interface CurrencyMeta {
  code: CurrencyCode
  symbol: string
  name: string
  /** Formatting locale for this currency's conventional notation. */
  locale: string
  /** ISO 4217 minor units. */
  decimals: number
  /** Safe default rounding step in major units (1 = whole unit). */
  step: number
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian rupee', locale: 'en-IN', decimals: 2, step: 1 },
  USD: { code: 'USD', symbol: '$', name: 'US dollar', locale: 'en-US', decimals: 2, step: 1 },
  GBP: { code: 'GBP', symbol: '£', name: 'Pound sterling', locale: 'en-GB', decimals: 2, step: 1 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', decimals: 2, step: 1 },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE dirham', locale: 'en-AE', decimals: 2, step: 1 },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian dollar', locale: 'en-CA', decimals: 2, step: 1 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian dollar', locale: 'en-AU', decimals: 2, step: 1 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore dollar', locale: 'en-SG', decimals: 2, step: 1 },
}

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[]

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CURRENCIES, value)
}

/** Total order for UI lists: base currency first, then alphabetical. */
export function sortedCurrencies(base: CurrencyCode = 'INR'): CurrencyMeta[] {
  return [...CURRENCY_CODES]
    .sort((a, b) => (a === base ? -1 : b === base ? 1 : a.localeCompare(b)))
    .map((code) => CURRENCIES[code])
}
