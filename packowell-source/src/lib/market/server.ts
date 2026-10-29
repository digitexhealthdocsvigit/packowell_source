/**
 * Server-side market store.
 *
 * SERVER ONLY. Imports Prisma, so it must never be reached from a component or
 * page — the browser gets its configuration from `GET /api/market`.
 *
 * Responsibilities:
 *   - read/write the owner-editable policy (Setting row, JSON)
 *   - keep a history of exchange rates and pick the right one per currency
 *   - fetch rates from a provider when the owner asks for a refresh
 *   - resolve destination and product × destination policy
 */

import { prisma } from '../db'
import { CURRENCIES, CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from './currencies'
import { COUNTRY_BY_CODE, isCountryCode } from './countries'
import {
  DEFAULT_MARKET_POLICY,
  pickRate,
  DESTINATION_STATUSES,
  type DestinationOverride,
  type DestinationStatus,
  type MarketPolicy,
  type ProductRule,
} from './policy'
import type { RateQuote } from './fx'

const POLICY_KEY = 'market.policy.v1'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Merge a stored/patched object over the defaults, discarding anything invalid. */
export function mergePolicy(input: Partial<MarketPolicy> | null | undefined): MarketPolicy {
  const base = DEFAULT_MARKET_POLICY
  const fx = { ...base.fx, ...(input?.fx ?? {}) }

  const fallback = isCurrencyCode(fx.fallbackCurrency) ? fx.fallbackCurrency : base.fx.fallbackCurrency
  const quoteCurrencies = Array.isArray(input?.quoteCurrencies)
    ? input!.quoteCurrencies.filter(isCurrencyCode)
    : base.quoteCurrencies

  return {
    fx: {
      baseCurrency: isCurrencyCode(fx.baseCurrency) ? fx.baseCurrency : base.fx.baseCurrency,
      fallbackCurrency: fallback,
      conversionEnabled: Boolean(fx.conversionEnabled),
      markupPct: clamp(Number.isFinite(fx.markupPct) ? Number(fx.markupPct) : 0, 0, 25),
      roundingMode: ['none', 'nearest', 'up'].includes(fx.roundingMode) ? fx.roundingMode : 'nearest',
      roundingStep: clamp(Number.isFinite(fx.roundingStep) ? Number(fx.roundingStep) : 1, 0, 1000),
      refreshHours: clamp(Number.isFinite(fx.refreshHours) ? Number(fx.refreshHours) : 24, 1, 168),
      maxAgeHours: clamp(Number.isFinite(fx.maxAgeHours) ? Number(fx.maxAgeHours) : 168, 1, 8760),
    },
    quoteCurrencies: quoteCurrencies.length
      ? Array.from(new Set(quoteCurrencies))
      : base.quoteCurrencies,
    rateProvider: input?.rateProvider === 'manual' ? 'manual' : 'auto',
    shippingNote: typeof input?.shippingNote === 'string' ? input.shippingNote.slice(0, 600) : base.shippingNote,
    dutyNote: typeof input?.dutyNote === 'string' ? input.dutyNote.slice(0, 600) : base.dutyNote,
    taxNote: typeof input?.taxNote === 'string' ? input.taxNote.slice(0, 600) : base.taxNote,
    paymentNote: typeof input?.paymentNote === 'string' ? input.paymentNote.slice(0, 600) : base.paymentNote,
    updatedAt: typeof input?.updatedAt === 'string' ? input.updatedAt : base.updatedAt,
  }
}

export async function loadPolicy(): Promise<MarketPolicy> {
  const row = await prisma.setting.findUnique({ where: { key: POLICY_KEY } })
  if (!row) return mergePolicy(null)
  try {
    return mergePolicy(JSON.parse(row.value))
  } catch {
    return mergePolicy(null)
  }
}

export async function savePolicy(patch: Partial<MarketPolicy>): Promise<MarketPolicy> {
  const current = await loadPolicy()
  const next = mergePolicy({
    ...current,
    ...patch,
    fx: { ...current.fx, ...(patch.fx ?? {}) },
    updatedAt: new Date().toISOString(),
  })
  await prisma.setting.upsert({
    where: { key: POLICY_KEY },
    create: { key: POLICY_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  })
  return next
}

interface RateRow {
  base: string
  quote: string
  rate: number
  source: string
  provider: string | null
  fetchedAt: Date
}

function toQuote(row: RateRow): RateQuote {
  return {
    base: row.base,
    quote: row.quote,
    rate: row.rate,
    source: row.source === 'manual' ? 'manual' : 'live',
    provider: row.provider,
    fetchedAt: new Date(row.fetchedAt).toISOString(),
  }
}

/**
 * Latest rate per (base, quote), split by source. History is kept in the table;
 * this is the view the app reads.
 */
export async function listRates(base?: string): Promise<RateQuote[]> {
  const policy = base ? null : await loadPolicy()
  const baseCurrency = base ?? policy!.fx.baseCurrency
  const rows = await prisma.exchangeRate.findMany({
    where: { base: baseCurrency },
    orderBy: { fetchedAt: 'desc' },
    take: 400,
  })
  const seen = new Set<string>()
  const out: RateQuote[] = []
  for (const row of rows) {
    const key = `${row.source}:${row.quote}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(toQuote(row))
  }
  return out
}

export async function recordManualRate(quote: CurrencyCode, rate: number, base: string): Promise<RateQuote> {
  const row = await prisma.exchangeRate.create({
    data: {
      base,
      quote,
      rate,
      source: 'manual',
      provider: null,
      fetchedAt: new Date(),
    },
  })
  return toQuote(row)
}

const PROVIDERS = [
  {
    id: 'open.er-api.com',
    url: (base: string) => `https://open.er-api.com/v6/latest/${base}`,
    parse: (json: unknown): Record<string, number> | null => {
      const j = json as { result?: string; rates?: Record<string, number> }
      return j?.result === 'success' && j.rates ? j.rates : null
    },
  },
  {
    id: 'frankfurter.dev',
    url: (base: string) =>
      `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${CURRENCY_CODES.filter((c) => c !== base).join(',')}`,
    parse: (json: unknown): Record<string, number> | null => {
      const j = json as { rates?: Record<string, number> }
      return j?.rates ?? null
    },
  },
]

export interface SyncOutcome {
  added: RateQuote[]
  missing: CurrencyCode[]
  errors: { provider: string; message: string }[]
}

/**
 * Refresh live rates for every supported currency except the base.
 * Partial success is normal (ECB does not publish AED) — the caller is told
 * exactly which currencies have no live rate rather than shown a stale one.
 */
export async function syncRates(policy: MarketPolicy): Promise<SyncOutcome> {
  const base = policy.fx.baseCurrency
  const targets = CURRENCY_CODES.filter((c) => c !== base)
  const found = new Map<string, { rate: number; provider: string }>()
  const errors: SyncOutcome['errors'] = []

  for (const provider of PROVIDERS) {
    if (found.size === targets.length) break
    try {
      const res = await fetch(provider.url(base), {
        signal: AbortSignal.timeout(8000),
        headers: { accept: 'application/json' },
      })
      if (!res.ok) {
        errors.push({ provider: provider.id, message: `HTTP ${res.status}` })
        continue
      }
      const rates = provider.parse(await res.json())
      if (!rates) {
        errors.push({ provider: provider.id, message: 'Unexpected response shape' })
        continue
      }
      for (const code of targets) {
        const rate = rates[code]
        if (!found.has(code) && Number.isFinite(rate) && rate > 0) {
          found.set(code, { rate: rate as number, provider: provider.id })
        }
      }
    } catch (error) {
      errors.push({ provider: provider.id, message: error instanceof Error ? error.message : 'fetch failed' })
    }
  }

  const now = new Date()
  const added: RateQuote[] = []
  for (const [code, { rate, provider }] of found) {
    const row = await prisma.exchangeRate.create({
      data: { base, quote: code, rate, source: 'live', provider, fetchedAt: now },
    })
    added.push(toQuote(row))
  }

  const missing = targets.filter((c) => !found.has(c))
  return { added, missing, errors }
}

export async function listDestinations(): Promise<DestinationOverride[]> {
  const rows = await prisma.destination.findMany({ orderBy: { code: 'asc' } })
  return rows.map((r) => ({
    code: r.code,
    status: (DESTINATION_STATUSES.includes(r.status as DestinationStatus) ? r.status : 'quote-only') as DestinationStatus,
    currency: isCurrencyCode(r.currency) ? r.currency : null,
    note: r.note,
  }))
}

export async function setDestination(
  code: string,
  patch: { status?: string; currency?: string | null; note?: string | null },
): Promise<DestinationOverride> {
  const iso = code.toUpperCase()
  if (!isCountryCode(iso)) throw new Error(`Unknown country code: ${code}`)
  const row = await prisma.destination.upsert({
    where: { code: iso },
    create: {
      code: iso,
      status: DESTINATION_STATUSES.includes(patch.status as DestinationStatus) ? patch.status! : 'quote-only',
      currency: isCurrencyCode(patch.currency) ? patch.currency : null,
      note: patch.note?.slice(0, 400) ?? null,
    },
    update: {
      ...(patch.status && DESTINATION_STATUSES.includes(patch.status as DestinationStatus)
        ? { status: patch.status }
        : {}),
      ...(patch.currency !== undefined
        ? { currency: isCurrencyCode(patch.currency) ? patch.currency : null }
        : {}),
      ...(patch.note !== undefined ? { note: patch.note?.slice(0, 400) ?? null } : {}),
    },
  })
  return {
    code: row.code,
    status: row.status as DestinationStatus,
    currency: isCurrencyCode(row.currency) ? row.currency : null,
    note: row.note,
  }
}

export async function listProductRules(): Promise<ProductRule[]> {
  const rows = await prisma.productMarket.findMany({ orderBy: [{ productSlug: 'asc' }, { country: 'asc' }] })
  return rows.map((r) => ({
    productSlug: r.productSlug,
    country: r.country,
    available: r.available,
    moq: r.moq,
    leadTimeDays: r.leadTimeDays,
    note: r.note,
  }))
}

export async function setProductRule(rule: ProductRule): Promise<ProductRule> {
  const iso = rule.country.toUpperCase()
  if (!isCountryCode(iso)) throw new Error(`Unknown country code: ${rule.country}`)
  const existing = await prisma.productMarket.findFirst({
    where: { productSlug: rule.productSlug, country: iso },
  })
  const data = {
    productSlug: rule.productSlug,
    country: iso,
    available: Boolean(rule.available),
    moq: rule.moq == null ? null : clamp(Math.round(rule.moq), 1, 10_000_000),
    leadTimeDays: rule.leadTimeDays == null ? null : clamp(Math.round(rule.leadTimeDays), 1, 365),
    note: rule.note?.slice(0, 400) ?? null,
  }
  const row = existing
    ? await prisma.productMarket.update({ where: { id: existing.id }, data })
    : await prisma.productMarket.create({ data })
  return {
    productSlug: row.productSlug,
    country: row.country,
    available: row.available,
    moq: row.moq,
    leadTimeDays: row.leadTimeDays,
    note: row.note,
  }
}

/**
 * Destination guess from request headers.
 *
 * This is a *suggestion* only, and it is deliberately header-based: no visitor
 * IP is stored and no third-party geolocation service is called. The browser
 * keeps the visitor's manual choice and never overwrites it.
 */
export function geoFromHeaders(headers: Headers): {
  country: string | null
  currency: CurrencyCode | null
  source: 'cdn' | 'accept-language' | 'none'
} {
  const candidates = [
    headers.get('cf-ipcountry'),
    headers.get('x-vercel-ip-country'),
    headers.get('x-country-code'),
    headers.get('cloudfront-viewer-country'),
    headers.get('x-geo-country'),
  ]
  for (const value of candidates) {
    const code = value?.trim().toUpperCase()
    if (code && isCountryCode(code)) {
      const local = COUNTRY_BY_CODE[code].currency
      return { country: code, currency: isCurrencyCode(local) ? local : null, source: 'cdn' }
    }
  }

  const langs = (headers.get('accept-language') ?? '').split(',')
  for (const tag of langs) {
    const region = tag.split(';')[0]?.split('-')[1]?.trim().toUpperCase()
    if (region && isCountryCode(region)) {
      const local = COUNTRY_BY_CODE[region].currency
      return { country: region, currency: isCurrencyCode(local) ? local : null, source: 'accept-language' }
    }
  }

  return { country: null, currency: null, source: 'none' }
}

export { CURRENCIES, pickRate }
