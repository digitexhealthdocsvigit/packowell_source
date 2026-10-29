/**
 * Visitor market state — country, currency, and the rates behind them.
 *
 * The rules this file enforces:
 *   - a stored manual choice always beats a geolocation suggestion;
 *   - the suggestion is only ever a default, and the UI says where it came from;
 *   - changing country changes the currency default, but an explicitly chosen
 *     currency stays chosen;
 *   - nothing is converted without a rate from the server.
 *
 * State is kept in localStorage (authoritative) and mirrored to a cookie so a
 * server-rendered page could read it later without a round trip.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CURRENCIES, isCurrencyCode, type CurrencyCode } from './currencies'
import { COUNTRY_BY_CODE, isCountryCode, resolveCurrency, type Region } from './countries'
import { convert, formatMoney, type ConversionResult, type RateQuote } from './fx'
import type { DestinationStatus, MarketSnapshot, ProductRule } from './policy'

const STORAGE_KEY = 'packowell.market.v2'
const COOKIE_KEY = 'packowell_market'
const ONE_YEAR = 60 * 60 * 24 * 365

export interface MarketData extends MarketSnapshot {
  countries: { code: string; name: string; region: Region; currency: string }[]
  currencies: { code: CurrencyCode; symbol: string; name: string; locale: string; decimals: number; step: number }[]
  postal: Record<string, { label: string; hint: string; required: boolean }>
}

interface Stored {
  country: string
  currency?: CurrencyCode | null
  pinned?: boolean
  suggested?: boolean
  at?: string
}

export interface MarketContextValue {
  /** ISO code of the visitor's chosen destination. */
  country: string
  countryName: string
  currency: CurrencyCode
  /** The destination's own currency, even when it is not supported. */
  localCurrency: string
  localSupported: boolean
  currencyPinned: boolean
  /** True when the current country came from IP/language detection. */
  suggested: boolean
  geoSource: 'cdn' | 'accept-language' | 'none' | null
  ready: boolean
  data: MarketData | null
  error: string | null
  setCountry: (code: string) => void
  setCurrency: (code: CurrencyCode | null) => void
  destinationStatus: DestinationStatus
  destinationNote: string | null
  productRule: (productSlug: string) => ProductRule | null
  quoteCurrencies: CurrencyCode[]
  /** Convert a base-currency amount into the visitor's currency. */
  priceOf: (baseAmount: number) => ConversionResult
  format: (amount: number, code?: CurrencyCode) => string
  rate: RateQuote | null
  reload: () => Promise<void>
}

const MarketContext = createContext<MarketContextValue | null>(null)

function readStored(): Stored | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Stored
    if (!isCountryCode(parsed.country)) return null
    return parsed
  } catch {
    return null
  }
}

function writeStored(value: Stored) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* storage disabled — the choice still holds for this page */
  }
  const currency = value.currency ?? ''
  document.cookie = `${COOKIE_KEY}=${value.country}.${currency}; path=/; max-age=${ONE_YEAR}; samesite=lax`
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const stored = useRef<Stored | null>(readStored())

  const [country, setCountryState] = useState<string>(() => stored.current?.country ?? '')
  const [pinned, setPinned] = useState<CurrencyCode | null>(() =>
    isCurrencyCode(stored.current?.currency) ? (stored.current!.currency as CurrencyCode) : null,
  )
  const [suggested, setSuggested] = useState<boolean>(Boolean(stored.current?.suggested && !stored.current?.pinned))
  const [geoSource, setGeoSource] = useState<MarketContextValue['geoSource']>(null)
  const [data, setData] = useState<MarketData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/market')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Market configuration unavailable (HTTP ${res.status})`)
      setData(body as MarketData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Market configuration unavailable')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Suggest a country once, only when the visitor has not chosen one. A stored
  // manual choice is never overwritten by this.
  useEffect(() => {
    const current = stored.current
    if (current && !current.suggested) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/market/geo')
        if (!res.ok) return
        const geo = (await res.json()) as { country: string | null; source: MarketContextValue['geoSource'] }
        if (cancelled) return
        setGeoSource(geo.source ?? 'none')
        if (!geo.country || (stored.current && !stored.current.suggested)) return
        setCountryState(geo.country)
        setSuggested(true)
        const next: Stored = {
          country: geo.country,
          currency: stored.current?.currency ?? null,
          pinned: false,
          suggested: true,
          at: new Date().toISOString(),
        }
        stored.current = next
        writeStored(next)
      } catch {
        /* detection is optional; the default below still applies */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Nothing detected and nothing stored: the site's home market is the default.
  const effectiveCountry = isCountryCode(country) ? country : 'IN'

  const fallbackCurrency = (data?.fallbackCurrency ?? 'USD') as CurrencyCode
  const resolution = useMemo(
    () => resolveCurrency(effectiveCountry, fallbackCurrency, pinned),
    [effectiveCountry, fallbackCurrency, pinned],
  )
  const currency = resolution.currency

  const setCountry = useCallback(
    (code: string) => {
      const iso = code.toUpperCase()
      if (!isCountryCode(iso)) return
      setCountryState(iso)
      setSuggested(false)
      const next: Stored = {
        country: iso,
        currency: pinned,
        pinned: Boolean(pinned),
        suggested: false,
        at: new Date().toISOString(),
      }
      stored.current = next
      writeStored(next)
    },
    [pinned],
  )

  const setCurrency = useCallback(
    (code: CurrencyCode | null) => {
      const next = code && isCurrencyCode(code) ? code : null
      setPinned(next)
      const nextStored: Stored = {
        country: effectiveCountry,
        currency: next,
        pinned: Boolean(next),
        suggested,
        at: new Date().toISOString(),
      }
      stored.current = nextStored
      writeStored(nextStored)
    },
    [effectiveCountry, suggested],
  )

  const dataCountry = data?.countries.find((c) => c.code === effectiveCountry)
  const countryLabel = COUNTRY_BY_CODE[effectiveCountry]?.name ?? dataCountry?.name ?? effectiveCountry

  const destinationStatus: DestinationStatus =
    (data?.destinations?.[effectiveCountry]?.status as DestinationStatus | undefined) ?? 'quote-only'
  const destinationNote = data?.destinations?.[effectiveCountry]?.note ?? null

  const fxPolicy = useMemo(
    () => ({
      baseCurrency: (data?.baseCurrency ?? 'INR') as CurrencyCode,
      fallbackCurrency,
      conversionEnabled: data?.conversionEnabled ?? true,
      markupPct: data?.markupPct ?? 0,
      roundingMode: data?.roundingMode ?? 'nearest',
      roundingStep: data?.roundingStep ?? 1,
      refreshHours: data?.refreshHours ?? 24,
      maxAgeHours: data?.maxAgeHours ?? 168,
    }),
    [data, fallbackCurrency],
  )

  const rate = useMemo(() => {
    if (!data) return null
    const forQuote = data.rates.filter((r) => r.quote === currency)
    const live = forQuote.find((r) => r.source === 'live') ?? null
    const manual = forQuote.find((r) => r.source === 'manual') ?? null
    return live ?? manual
  }, [data, currency])

  const priceOf = useCallback(
    (baseAmount: number): ConversionResult => {
      if (!data) {
        return { ok: false, reason: 'no-rate', message: 'Exchange rates have not loaded yet.' }
      }
      return convert(baseAmount, currency, rate, fxPolicy)
    },
    [data, currency, rate, fxPolicy],
  )

  const format = useCallback(
    (amount: number, code?: CurrencyCode) => formatMoney(amount, code ?? currency),
    [currency],
  )

  const productRule = useCallback(
    (productSlug: string): ProductRule | null =>
      data?.products?.find((r) => r.productSlug === productSlug && r.country === effectiveCountry) ?? null,
    [data, effectiveCountry],
  )

  const value: MarketContextValue = {
    country: effectiveCountry,
    countryName: countryLabel,
    currency,
    localCurrency: resolution.localCurrency,
    localSupported: resolution.localSupported,
    currencyPinned: Boolean(pinned),
    suggested,
    geoSource,
    ready: Boolean(data),
    data,
    error,
    setCountry,
    setCurrency,
    destinationStatus,
    destinationNote,
    productRule,
    quoteCurrencies: (data?.quoteCurrencies ?? Object.keys(CURRENCIES)) as CurrencyCode[],
    priceOf,
    format,
    rate,
    reload: load,
  }

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used inside <MarketProvider>')
  return ctx
}

/** Short label for the header: "IN · INR". */
export function marketLabel(country: string, currency: CurrencyCode): string {
  return `${country} · ${currency}`
}
