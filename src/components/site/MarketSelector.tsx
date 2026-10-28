/**
 * Country + currency selector.
 *
 * Two jobs, one control: pick the delivery country (which decides the currency,
 * the postal format and whether we can serve it) and, if you want, override the
 * quotation currency. The override is explicit and reversible — it never
 * silently disagrees with the country.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Globe2, Search, X } from 'lucide-react'
import { CURRENCIES } from '@/lib/market/currencies'
import { COUNTRIES, countriesByRegion, searchCountries } from '@/lib/market/countries'
import { useMarket, marketLabel } from '@/lib/market/context'
import { cn } from '@/lib/cn'

export function MarketSelector({ className }: { className?: string }) {
  const market = useMarket()
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) setTerm('')
  }, [open])

  const groups = useMemo(() => {
    const matches = searchCountries(term)
    if (term.trim()) return [{ region: 'Matching countries' as const, countries: matches }]
    return countriesByRegion()
  }, [term])

  const countryHint = market.suggested
    ? market.geoSource === 'cdn'
      ? 'Suggested from your connection'
      : 'Suggested from your browser language'
    : null

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Delivery country and currency: ${market.countryName}, ${market.currency}. Change`}
        className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2.5 text-[12.5px] font-medium text-[var(--ink)] transition hover:bg-[var(--paper-2)]"
      >
        <Globe2 className="h-4 w-4 text-[var(--ink-soft)]" />
        <span className="tabular">{marketLabel(market.country, market.currency)}</span>
        <ChevronDown className="h-3.5 w-3.5 text-[var(--ink-soft)]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10 sm:bg-transparent" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose delivery country and quotation currency"
            className="fixed inset-x-3 top-[68px] z-50 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xl sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[364px]"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                  Deliver to
                </div>
                <div className="text-[13px] font-semibold">{market.countryName}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper-2)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {countryHint && (
              <div className="border-b border-[var(--line)] bg-[var(--paper)] px-4 py-2 text-[11.5px] text-[var(--ink-soft)]">
                {countryHint} — change it any time. Your choice is remembered in this browser.
              </div>
            )}

            <div className="border-b border-[var(--line)] px-3 py-2.5">
              <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-2">
                <Search className="h-3.5 w-3.5 text-[var(--ink-soft)]" />
                <input
                  autoFocus
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder={`Search ${COUNTRIES.length} countries`}
                  className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--ink-soft)]/70"
                  aria-label="Search countries"
                />
              </label>
            </div>

            <div className="max-h-[44vh] overflow-y-auto px-1.5 py-1.5 sm:max-h-[300px]">
              {groups.every((g) => g.countries.length === 0) && (
                <p className="px-3 py-4 text-[12.5px] text-[var(--ink-soft)]">
                  No country matches “{term}”. We quote for the destinations in this list.
                </p>
              )}
              {groups.map((group) => (
                <div key={group.region} className="py-1">
                  <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                    {group.region}
                  </div>
                  {group.countries.map((country) => {
                    const active = country.code === market.country
                    const supported = country.currency in CURRENCIES
                    return (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => {
                          market.setCountry(country.code)
                          setOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition',
                          active ? 'bg-[var(--paper-2)] font-semibold' : 'hover:bg-[var(--paper)]',
                        )}
                      >
                        <span className="truncate">{country.name}</span>
                        <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-[var(--ink-soft)]">
                          {supported ? country.currency : `${country.currency} → ${market.data?.fallbackCurrency ?? 'USD'}`}
                          {active && <Check className="h-3.5 w-3.5 text-[var(--kraft-dark)]" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--line)] bg-[var(--paper)] px-3 py-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                Quotation currency
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => market.setCurrency(null)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11.5px] transition',
                    !market.currencyPinned
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-[#faf8f5]'
                      : 'border-[var(--line)] bg-white text-[var(--ink-soft)] hover:text-[var(--ink)]',
                  )}
                >
                  Country default
                </button>
                {market.quoteCurrencies.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => market.setCurrency(code)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11.5px] tabular transition',
                      market.currencyPinned && market.currency === code
                        ? 'border-[var(--ink)] bg-[var(--ink)] text-[#faf8f5]'
                        : 'border-[var(--line)] bg-white text-[var(--ink-soft)] hover:text-[var(--ink)]',
                    )}
                  >
                    {code}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10.5px] leading-snug text-[var(--ink-soft)]">
                Quotations are issued in the currency you choose. Converted figures are indicative, not
                final payable amounts.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
