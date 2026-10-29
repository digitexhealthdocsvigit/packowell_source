import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FX_POLICY,
  convert,
  describeRate,
  formatMoneyWithCode,
  isStale,
  roundAmount,
  type FxPolicy,
  type RateQuote,
} from '../src/lib/market/fx'

const NOW = new Date('2026-10-21T09:00:00.000Z')
const fresh = (over: Partial<RateQuote> = {}): RateQuote => ({
  base: 'INR',
  quote: 'USD',
  rate: 0.010527,
  source: 'live',
  provider: 'open.er-api.com',
  fetchedAt: '2026-10-21T06:00:00.000Z',
  ...over,
})

const policy = (over: Partial<FxPolicy> = {}): FxPolicy => ({ ...DEFAULT_FX_POLICY, ...over })

describe('rounding', () => {
  it('leaves values alone in none mode', () => {
    expect(roundAmount(10.527, 1, 'none')).toBe(10.527)
  })
  it('rounds to the nearest step', () => {
    expect(roundAmount(10.527, 1, 'nearest')).toBe(11)
    expect(roundAmount(10.527, 5, 'nearest')).toBe(10)
    expect(roundAmount(1049, 50, 'nearest')).toBe(1050)
  })
  it('rounds up to the step', () => {
    expect(roundAmount(10.01, 1, 'up')).toBe(11)
    expect(roundAmount(10, 5, 'up')).toBe(10)
  })
  it('never rounds a real price down to zero', () => {
    expect(roundAmount(0.41, 1, 'nearest')).toBe(0.41)
    expect(roundAmount(0, 1, 'up')).toBe(0)
  })
})

describe('convert', () => {
  it('does not convert when the target is the base currency', () => {
    const res = convert(1500, 'INR', null, policy())
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.price.converted).toBe(false)
    expect(res.price.displayAmount).toBe(1500)
    expect(res.price.indicative).toBe(true)
  })

  it('converts the base amount at the stored rate', () => {
    const res = convert(1000, 'USD', fresh(), policy({ roundingMode: 'none' }), NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.price.convertedAmount).toBeCloseTo(10.527, 6)
    expect(res.price.displayAmount).toBe(10.53)
    expect(res.price.baseAmount).toBe(1000)
    expect(res.price.baseCurrency).toBe('INR')
    expect(res.price.rate).toBe(0.010527)
    expect(res.price.fetchedAt).toBe('2026-10-21T06:00:00.000Z')
  })

  it('applies the configured markup to the effective rate, not to the base amount', () => {
    const res = convert(1000, 'USD', fresh(), policy({ markupPct: 2.5, roundingMode: 'none' }), NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.price.effectiveRate).toBeCloseTo(0.010527 * 1.025, 8)
    expect(res.price.markupPct).toBe(2.5)
    expect(res.price.displayAmount).toBeCloseTo(10.79, 1)
  })

  it('applies the configured rounding step', () => {
    const res = convert(1000, 'USD', fresh(), policy({ roundingStep: 5, roundingMode: 'nearest' }), NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.price.displayAmount).toBe(10)
  })

  it('refuses to convert without a rate', () => {
    const res = convert(1000, 'USD', null, policy(), NOW)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('no-rate')
    expect(res.message).toContain('INR→USD')
  })

  it('refuses a rate pointing the wrong way rather than inverting it', () => {
    const res = convert(1000, 'USD', fresh({ base: 'USD', quote: 'INR', rate: 95 }), policy(), NOW)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('no-rate')
  })

  it('refuses an expired live rate', () => {
    const old = fresh({ fetchedAt: '2026-10-01T00:00:00.000Z' })
    const res = convert(1000, 'USD', old, policy({ maxAgeHours: 168 }), NOW)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('rate-expired')
  })

  it('keeps a usable-but-stale rate and says so', () => {
    const res = convert(1000, 'USD', fresh({ fetchedAt: '2026-10-19T06:00:00.000Z' }), policy(), NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.price.stale).toBe(true)
    expect(describeRate(res.price)).toContain('past its refresh interval')
  })

  it('never expires a manually set rate', () => {
    const manual = fresh({ source: 'manual', provider: null, fetchedAt: '2020-01-01T00:00:00.000Z' })
    const res = convert(1000, 'USD', manual, policy(), NOW)
    expect(res.ok).toBe(true)
  })

  it('refuses conversion when the owner has switched it off', () => {
    const res = convert(1000, 'USD', fresh(), policy({ conversionEnabled: false }), NOW)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('disabled')
  })

  it('rejects a non-numeric amount', () => {
    const res = convert(Number.NaN, 'USD', fresh(), policy(), NOW)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('invalid-amount')
  })

  it('rejects a zero or negative rate instead of dividing by it', () => {
    expect(convert(1000, 'USD', fresh({ rate: 0 }), policy(), NOW).ok).toBe(false)
    expect(convert(1000, 'USD', fresh({ rate: -1 }), policy(), NOW).ok).toBe(false)
  })
})

describe('staleness', () => {
  it('flags a rate older than the refresh interval', () => {
    expect(isStale('2026-10-21T06:00:00.000Z', 24, NOW)).toBe(false)
    expect(isStale('2026-10-19T06:00:00.000Z', 24, NOW)).toBe(true)
    expect(isStale('not-a-date', 24, NOW)).toBe(true)
  })
})

describe('provenance text', () => {
  it('names the pair, the date and the spread', () => {
    const res = convert(1000, 'USD', fresh(), policy({ markupPct: 2 }), NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const text = describeRate(res.price)
    expect(text).toContain('1 INR =')
    expect(text).toContain('2% conversion spread')
    expect(text).toContain('2026-10-21')
  })

  it('formats with the ISO code when the symbol is ambiguous', () => {
    expect(formatMoneyWithCode(1234.5, 'CAD')).toBe('CAD 1,234.50')
    expect(formatMoneyWithCode(1234.5, 'AUD')).toBe('AUD 1,234.50')
  })
})
