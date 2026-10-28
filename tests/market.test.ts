import { describe, expect, it } from 'vitest'
import {
  COUNTRIES,
  countryName,
  countriesByRegion,
  isCountryCode,
  resolveCurrency,
  searchCountries,
} from '../src/lib/market/countries'
import { validatePostal, postalRule } from '../src/lib/market/postal'
import { CURRENCY_CODES } from '../src/lib/market/currencies'
import { formatMoney } from '../src/lib/market/fx'

describe('country registry', () => {
  it('covers every supported currency with at least one home country', () => {
    for (const code of CURRENCY_CODES) {
      if (code === 'INR') continue
      expect(COUNTRIES.some((c) => c.currency === code)).toBe(true)
    }
  })

  it('has no duplicate country codes', () => {
    const codes = COUNTRIES.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('groups every country exactly once', () => {
    const grouped = countriesByRegion().flatMap((g) => g.countries)
    expect(grouped.length).toBe(COUNTRIES.length)
  })

  it('resolves names and validates codes', () => {
    expect(countryName('AE')).toBe('United Arab Emirates')
    expect(countryName('de')).toBe('Germany')
    expect(isCountryCode('gb')).toBe(true)
    expect(isCountryCode('ZZ')).toBe(false)
  })

  it('searches by name and code', () => {
    expect(searchCountries('germ').map((c) => c.code)).toEqual(['DE'])
    expect(searchCountries('in').some((c) => c.code === 'IN')).toBe(true)
    expect(searchCountries('')).toHaveLength(COUNTRIES.length)
  })
})

describe('currency resolution', () => {
  const cases: [string, string][] = [
    ['IN', 'INR'],
    ['US', 'USD'],
    ['GB', 'GBP'],
    ['DE', 'EUR'],
    ['FR', 'EUR'],
    ['ES', 'EUR'],
    ['NL', 'EUR'],
    ['AE', 'AED'],
    ['CA', 'CAD'],
    ['AU', 'AUD'],
    ['SG', 'SGD'],
  ]

  it.each(cases)('%s defaults to %s', (country, currency) => {
    expect(resolveCurrency(country, 'USD').currency).toBe(currency)
  })

  it('falls back to the configured currency when the local one is unsupported', () => {
    const jp = resolveCurrency('JP', 'USD')
    expect(jp.currency).toBe('USD')
    expect(jp.localSupported).toBe(false)
    expect(jp.localCurrency).toBe('JPY')
    // Fallback is policy, not hard-coded: changing it changes the answer.
    expect(resolveCurrency('JP', 'GBP').currency).toBe('GBP')
  })

  it('honours an explicit override', () => {
    expect(resolveCurrency('DE', 'USD', 'GBP').currency).toBe('GBP')
  })

  it('falls back for an unknown country without inventing one', () => {
    expect(resolveCurrency('ZZ', 'AUD').currency).toBe('AUD')
  })
})

describe('postal validation', () => {
  it('accepts and rejects Indian PIN codes', () => {
    expect(validatePostal('IN', '560001')).toEqual({ ok: true, value: '560001' })
    expect(validatePostal('IN', '012345').ok).toBe(false)
    expect(validatePostal('IN', '56001').ok).toBe(false)
    expect(validatePostal('IN', '').ok).toBe(false)
  })

  it('accepts US ZIP and ZIP+4', () => {
    expect(validatePostal('US', '10001').ok).toBe(true)
    expect(validatePostal('US', '10001-1234').ok).toBe(true)
    expect(validatePostal('US', '1000').ok).toBe(false)
  })

  it('normalises UK postcodes', () => {
    expect(validatePostal('GB', 'sw1a1aa')).toEqual({ ok: true, value: 'SW1A 1AA' })
    expect(validatePostal('GB', 'NOTAPOSTCODE').ok).toBe(false)
  })

  it('normalises German and Dutch codes', () => {
    expect(validatePostal('DE', '10115')).toEqual({ ok: true, value: '10115' })
    expect(validatePostal('DE', '1011').ok).toBe(false)
    expect(validatePostal('NL', '1012ab')).toEqual({ ok: true, value: '1012 AB' })
  })

  it('treats a UAE postal code as optional', () => {
    expect(postalRule('AE').required).toBe(false)
    expect(validatePostal('AE', '')).toEqual({ ok: true, value: '' })
    expect(validatePostal('AE', 'P.O. Box 1234').ok).toBe(true)
  })

  it('accepts a plausible code for an unlisted country', () => {
    expect(validatePostal('KE', '00100').ok).toBe(true)
    expect(validatePostal('KE', '').ok).toBe(false)
  })

  it('requires a Canadian code in the right shape', () => {
    expect(validatePostal('CA', 'k1a0b1')).toEqual({ ok: true, value: 'K1A 0B1' })
    expect(validatePostal('CA', '12345').ok).toBe(false)
  })
})

describe('currency formatting uses locale conventions', () => {
  it('formats INR with Indian digit grouping', () => {
    expect(formatMoney(123456.5, 'INR')).toBe('₹1,23,456.50')
  })
  it('formats USD with western grouping', () => {
    expect(formatMoney(1234.56, 'USD')).toBe('$1,234.56')
  })
  it('formats EUR with German conventions', () => {
    const out = formatMoney(1234.56, 'EUR')
    expect(out).toContain('1.234,56')
    expect(out).toContain('€')
  })
  it('formats AED with an explicit code, not a guessed symbol', () => {
    expect(formatMoney(1234.56, 'AED')).toContain('AED')
  })
})
