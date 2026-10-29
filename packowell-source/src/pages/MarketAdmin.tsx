/**
 * Market administration.
 *
 * Gated by the same business passcode as the enquiry inbox (`ADMIN_PASSCODE`,
 * POST /api/admin/session). Everything here is owner-editable configuration:
 * currency policy, exchange rates, destination availability and product MOQs.
 *
 * The capabilities strip is deliberately blunt about what is *not* wired up —
 * payments, freight rates, tax and email are separate systems and are not
 * simulated anywhere in this app.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Loader2, RefreshCw, Save } from 'lucide-react'
import { Section, Eyebrow, H2, Lede, Notice } from '@/components/site/ui'
import { PRODUCTS } from '@/lib/catalog'
import { COUNTRIES, countriesByRegion } from '@/lib/market/countries'
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from '@/lib/market/currencies'
import { DESTINATION_LABEL, DESTINATION_STATUSES, type DestinationStatus } from '@/lib/market/policy'
import type { RateQuote } from '@/lib/market/fx'
import { cn } from '@/lib/cn'
import { useSeo } from '@/lib/seo'

const TOKEN_KEY = 'kl-admin-token'
const inputBase =
  'w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-2 text-[13px] outline-none focus:border-[var(--kraft)] focus:ring-2 focus:ring-[var(--kraft)]/15'

interface DestinationRow {
  code: string
  status: DestinationStatus
  currency: CurrencyCode | null
  note: string | null
}

interface ProductRuleRow {
  productSlug: string
  country: string
  available: boolean
  moq: number | null
  leadTimeDays: number | null
  note: string | null
}

interface Policy {
  fx: {
    baseCurrency: CurrencyCode
    fallbackCurrency: CurrencyCode
    conversionEnabled: boolean
    markupPct: number
    roundingMode: 'none' | 'nearest' | 'up'
    roundingStep: number
    refreshHours: number
    maxAgeHours: number
  }
  quoteCurrencies: CurrencyCode[]
  rateProvider: 'auto' | 'manual'
  shippingNote: string
  dutyNote: string
  taxNote: string
  paymentNote: string
  updatedAt: string | null
}

interface MarketAdminData {
  policy: Policy
  rates: RateQuote[]
  destinations: DestinationRow[]
  products: ProductRuleRow[]
  capabilities: Record<string, boolean | string>
}

function fmtDate(iso: string | null) {
  if (!iso) return 'never'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function hoursAgo(iso: string | null) {
  if (!iso) return null
  const diff = (Date.now() - new Date(iso).getTime()) / 3_600_000
  return diff
}

export function MarketAdminPage() {
  useSeo({
    title: 'Market configuration',
    description: 'Countries, currencies, exchange rates and quotation policy.',
    path: '/admin/markets',
  })

  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY))
  const [data, setData] = useState<MarketAdminData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  const load = useCallback(
    async (auth: string) => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/admin/market', { headers: { authorization: `Bearer ${auth}` } })
        const body = await res.json().catch(() => ({}))
        if (res.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY)
          setToken(null)
          setError('That session expired. Sign in again.')
          return
        }
        if (!res.ok) throw new Error(body.error ?? `Could not load configuration (HTTP ${res.status})`)
        setData(body as MarketAdminData)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load configuration')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (token) void load(token)
  }, [token, load])

  const notify = (message: string) => {
    setFlash(message)
    setTimeout(() => setFlash(''), 3200)
  }

  const call = async (path: string, init: RequestInit, okMessage: string) => {
    if (!token) return
    setError('')
    try {
      const res = await fetch(path, {
        ...init,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          ...(init.headers ?? {}),
        },
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setError('That session expired. Sign in again.')
        return
      }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      notify(okMessage)
      await load(token)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save')
    }
  }

  if (!token) return <SignIn onToken={(t) => { sessionStorage.setItem(TOKEN_KEY, t); setToken(t) }} />

  return (
    <Section>
      <Eyebrow>Business configuration</Eyebrow>
      <H2 as="h1">Markets, currencies and destinations</H2>
      <Lede className="max-w-3xl">
        What the site is allowed to promise, in one place. Nothing here changes a price: there is no
        approved rate card yet, so every product still resolves to “Request a quote”.
      </Lede>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
          {error}
        </div>
      )}
      {flash && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-900">
          <Check className="h-4 w-4" /> {flash}
        </div>
      )}

      {loading && !data && (
        <div className="mt-6 flex items-center gap-2 text-[13px] text-[var(--ink-soft)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration…
        </div>
      )}

      {data && (
        <div className="mt-6 space-y-6">
          <Capabilities data={data} />
          <Rates data={data} call={call} />
          <PolicyCard data={data} call={call} />
          <Destinations data={data} call={call} />
          <Products data={data} call={call} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4 text-[11.5px] text-[var(--ink-soft)]">
            <span>Last policy change: {fmtDate(data.policy.updatedAt)}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => token && load(token)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 hover:bg-[var(--paper-2)]"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reload
              </button>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem(TOKEN_KEY)
                  setToken(null)
                  setData(null)
                }}
                className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 hover:bg-[var(--paper-2)]"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}

function SignIn({ onToken }: { onToken: (token: string) => void }) {
  const [passcode, setPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((b) => setConfigured(Boolean(b.configured)))
      .catch(() => setConfigured(null))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      onToken(body.token)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section>
      <Eyebrow>Restricted</Eyebrow>
      <H2 as="h1">Market configuration</H2>
      <Lede className="max-w-2xl">
        This page needs the business passcode. It controls what the site is allowed to promise
        internationally, so it is not public.
      </Lede>
      {configured === false ? (
        <Notice tone="warn" title="No passcode configured">
          Set <code className="font-mono">ADMIN_PASSCODE</code> in the project <code className="font-mono">.env</code> and
          restart the API server.
        </Notice>
      ) : (
        <form onSubmit={submit} className="mt-5 max-w-sm space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium">Business passcode</span>
            <input
              type="password"
              className={inputBase}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !passcode}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-[13px] font-semibold text-[#faf8f5] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Sign in
          </button>
        </form>
      )}
    </Section>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
      <h3 className="text-[14px] font-semibold">{title}</h3>
      {subtitle && <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[var(--ink-soft)]">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function Capabilities({ data }: { data: MarketAdminData }) {
  const items: { label: string; ok: boolean | string; note: string }[] = [
    { label: 'Exchange rates', ok: typeof data.capabilities.exchangeRates === 'string', note: String(data.capabilities.exchangeRates) },
    { label: 'Freight / shipping rates', ok: Boolean(data.capabilities.shippingRates), note: 'No carrier API or rate card is connected. Freight is quoted by hand per job.' },
    { label: 'Tax & duty calculation', ok: Boolean(data.capabilities.taxEngine), note: 'No tax engine. GST, VAT and duties are stated on a quotation by the desk.' },
    { label: 'Online payments', ok: Boolean(data.capabilities.payments), note: 'No payment provider is configured, so no currency can be settled online.' },
    { label: 'Email notifications', ok: Boolean(data.capabilities.emailNotifications), note: 'Enquiries are stored and read in the inbox; no email is sent automatically.' },
  ]
  return (
    <Card title="What is actually connected" subtitle="This strip is the honest status of each subsystem, not a roadmap.">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.label} className="rounded-xl border border-[var(--line)] p-2.5">
            <div className="flex items-center gap-1.5 text-[12.5px] font-medium">
              {item.ok ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              )}
              {item.label}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[var(--ink-soft)]">{item.note}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Rates({ data, call }: { data: MarketAdminData; call: (path: string, init: RequestInit, ok: string) => Promise<void> }) {
  const [manual, setManual] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const oldest = data.rates.reduce<string | null>((acc, r) => (!acc || r.fetchedAt < acc ? r.fetchedAt : acc), null)
  const age = hoursAgo(oldest)

  return (
    <Card
      title="Exchange rates"
      subtitle={`Base currency is ${data.policy.fx.baseCurrency}. Every stored price is in ${data.policy.fx.baseCurrency}; other currencies are derived, never substituted.`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--ink-soft)]">
        <span className="rounded-full border border-[var(--line)] px-2 py-0.5">
          {data.rates.length} pairs on file
        </span>
        <span className="rounded-full border border-[var(--line)] px-2 py-0.5">
          oldest: {oldest ? `${age?.toFixed(1)} h ago` : 'none'}
        </span>
        <span className="rounded-full border border-[var(--line)] px-2 py-0.5">
          refresh target: every {data.policy.fx.refreshHours} h
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await call('/api/admin/market/rates/sync', { method: 'POST' }, 'Rates refreshed from the provider')
            setBusy(false)
          }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-[12px] font-semibold text-[#faf8f5] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh from provider
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">
              <th className="py-1.5 pr-2">Pair</th>
              <th className="py-1.5 pr-2">Rate</th>
              <th className="py-1.5 pr-2">Source</th>
              <th className="py-1.5 pr-2">Fetched</th>
              <th className="py-1.5">Manual override</th>
            </tr>
          </thead>
          <tbody>
            {CURRENCY_CODES.filter((c) => c !== data.policy.fx.baseCurrency).map((code) => {
              const live = data.rates.find((r) => r.quote === code && r.source === 'live')
              const manualRow = data.rates.find((r) => r.quote === code && r.source === 'manual')
              const effective = live ?? manualRow
              return (
                <tr key={code} className="border-b border-[var(--line)]/60">
                  <td className="py-1.5 pr-2 font-medium tabular">
                    {data.policy.fx.baseCurrency}→{code}
                  </td>
                  <td className="py-1.5 pr-2 tabular">{effective ? effective.rate.toFixed(6) : <span className="text-amber-700">none</span>}</td>
                  <td className="py-1.5 pr-2">
                    {effective ? (
                      <span className={effective.source === 'manual' ? 'text-amber-700' : 'text-[var(--ink-soft)]'}>
                        {effective.source}
                        {effective.provider ? ` · ${effective.provider}` : ''}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-[var(--ink-soft)]">{effective ? fmtDate(effective.fetchedAt) : '—'}</td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        className="w-24 rounded border border-[var(--line)] px-2 py-1 tabular"
                        placeholder={effective ? effective.rate.toFixed(6) : '0.000000'}
                        value={manual[code] ?? ''}
                        onChange={(e) => setManual((m) => ({ ...m, [code]: e.target.value }))}
                        inputMode="decimal"
                      />
                      <button
                        type="button"
                        disabled={!manual[code]}
                        onClick={async () => {
                          await call(
                            '/api/admin/market/rates/manual',
                            { method: 'POST', body: JSON.stringify({ currency: code, rate: Number(manual[code]) }) },
                            `Manual ${code} rate saved`,
                          )
                          setManual((m) => ({ ...m, [code]: '' }))
                        }}
                        className="rounded border border-[var(--line)] px-2 py-1 text-[11px] disabled:opacity-40"
                      >
                        Save
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink-soft)]">
        A manual rate never expires; a live rate older than {data.policy.fx.maxAgeHours} hours is not used at all and
        the site falls back to “Request a quote”. Providers: open.er-api.com, then frankfurter.dev.
      </p>
    </Card>
  )
}

function PolicyCard({ data, call }: { data: MarketAdminData; call: (path: string, init: RequestInit, ok: string) => Promise<void> }) {
  const [form, setForm] = useState(data.policy)
  const [saving, setSaving] = useState(false)

  const update = <K extends keyof Policy>(key: K, value: Policy[K]) => setForm((f) => ({ ...f, [key]: value }))
  const updateFx = (patch: Partial<Policy['fx']>) => setForm((f) => ({ ...f, fx: { ...f.fx, ...patch } }))

  return (
    <Card
      title="Currency and quotation policy"
      subtitle="Markup and rounding apply to converted figures only. Nothing here can turn a converted estimate into a payable price."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium">Base currency</span>
          <input className={inputBase} value={form.fx.baseCurrency} readOnly />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium">Fallback for unsupported currencies</span>
          <select
            className={inputBase}
            value={form.fx.fallbackCurrency}
            onChange={(e) => updateFx({ fallbackCurrency: e.target.value as CurrencyCode })}
          >
            {CURRENCY_CODES.map((c) => (
              <option key={c} value={c}>
                {c} — {CURRENCIES[c].name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium">Rate source</span>
          <select
            className={inputBase}
            value={form.rateProvider}
            onChange={(e) => update('rateProvider', e.target.value as 'auto' | 'manual')}
          >
            <option value="auto">Live, falling back to manual</option>
            <option value="manual">Manual only</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium">Conversion markup (%)</span>
          <input
            className={inputBase}
            type="number"
            min={0}
            max={25}
            step={0.25}
            value={form.fx.markupPct}
            onChange={(e) => updateFx({ markupPct: Number(e.target.value) })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium">Rounding</span>
          <div className="flex gap-1.5">
            <select
              className={inputBase}
              value={form.fx.roundingMode}
              onChange={(e) => updateFx({ roundingMode: e.target.value as Policy['fx']['roundingMode'] })}
            >
              <option value="none">None</option>
              <option value="nearest">Nearest</option>
              <option value="up">Up</option>
            </select>
            <input
              className={cn(inputBase, 'w-20')}
              type="number"
              min={0}
              step={1}
              value={form.fx.roundingStep}
              onChange={(e) => updateFx({ roundingStep: Number(e.target.value) })}
              aria-label="Rounding step"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium">Refresh every (hours)</span>
          <input
            className={inputBase}
            type="number"
            min={1}
            max={168}
            value={form.fx.refreshHours}
            onChange={(e) => updateFx({ refreshHours: Number(e.target.value) })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium">Discard live rates older than (hours)</span>
          <input
            className={inputBase}
            type="number"
            min={1}
            max={8760}
            value={form.fx.maxAgeHours}
            onChange={(e) => updateFx({ maxAgeHours: Number(e.target.value) })}
          />
        </label>
        <label className="flex items-center gap-2 pt-5 text-[12.5px]">
          <input
            type="checkbox"
            checked={form.fx.conversionEnabled}
            onChange={(e) => updateFx({ conversionEnabled: e.target.checked })}
          />
          Currency conversion enabled
        </label>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[11.5px] font-medium">Currencies a quotation may be requested in</div>
        <div className="flex flex-wrap gap-1.5">
          {CURRENCY_CODES.map((code) => {
            const on = form.quoteCurrencies.includes(code)
            return (
              <button
                key={code}
                type="button"
                onClick={() =>
                  update(
                    'quoteCurrencies',
                    on ? form.quoteCurrencies.filter((c) => c !== code) : [...form.quoteCurrencies, code],
                  )
                }
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11.5px]',
                  on ? 'border-[var(--ink)] bg-[var(--ink)] text-[#faf8f5]' : 'border-[var(--line)] bg-white text-[var(--ink-soft)]',
                )}
              >
                {code} · {CURRENCIES[code].name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(
          [
            ['shippingNote', 'Shipping note shown to customers'],
            ['dutyNote', 'Duty / customs note'],
            ['taxNote', 'Tax note'],
            ['paymentNote', 'Payment terms note'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            <span className="mb-1 block text-[11.5px] font-medium">{label}</span>
            <textarea
              className={`${inputBase} min-h-[64px] resize-y`}
              value={form[key]}
              onChange={(e) => update(key, e.target.value)}
            />
          </label>
        ))}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true)
          await call('/api/admin/market/policy', { method: 'PATCH', body: JSON.stringify({
            fx: form.fx,
            quoteCurrencies: form.quoteCurrencies,
            rateProvider: form.rateProvider,
            shippingNote: form.shippingNote,
            dutyNote: form.dutyNote,
            taxNote: form.taxNote,
            paymentNote: form.paymentNote,
          }) }, 'Policy saved')
          setSaving(false)
        }}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2 text-[12.5px] font-semibold text-[#faf8f5] disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save policy
      </button>
    </Card>
  )
}

function Destinations({ data, call }: { data: MarketAdminData; call: (path: string, init: RequestInit, ok: string) => Promise<void> }) {
  const [term, setTerm] = useState('')
  const [showAll, setShowAll] = useState(false)

  const configured = new Map(data.destinations.map((d) => [d.code, d]))
  const homeMarkets = ['IN', 'US', 'GB', 'DE', 'AE', 'CA', 'AU', 'SG']

  const rows = useMemo(() => {
    const base = showAll || term.trim()
      ? COUNTRIES
      : COUNTRIES.filter((c) => homeMarkets.includes(c.code) || configured.has(c.code))
    const q = term.trim().toLowerCase()
    return q ? base.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q) : base
  }, [term, showAll, configured])

  return (
    <Card
      title="Destination policy"
      subtitle="A country with no row is “quote only”: enquiries are accepted, freight and duties are confirmed per job. “Not served” refuses the submission with a reason."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className={`${inputBase} max-w-xs`}
          placeholder="Search a country…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-[12px]">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show all {COUNTRIES.length} countries
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">
              <th className="py-1.5 pr-2">Country</th>
              <th className="py-1.5 pr-2">Local currency</th>
              <th className="py-1.5 pr-2">Status</th>
              <th className="py-1.5">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((country) => {
              const row = configured.get(country.code)
              return (
                <tr key={country.code} className="border-b border-[var(--line)]/60">
                  <td className="py-1.5 pr-2">
                    {country.name} <span className="text-[var(--ink-soft)]">({country.code})</span>
                  </td>
                  <td className="py-1.5 pr-2 tabular">
                    {country.currency}
                    {!CURRENCY_CODES.includes(country.currency as CurrencyCode) && (
                      <span className="ml-1 text-[10.5px] text-[var(--ink-soft)]">→ {data.policy.fx.fallbackCurrency}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      className="rounded border border-[var(--line)] px-1.5 py-1 text-[11.5px]"
                      value={row?.status ?? 'quote-only'}
                      onChange={(e) =>
                        call(
                          `/api/admin/market/destinations/${country.code}`,
                          { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) },
                          `${country.name}: ${DESTINATION_LABEL[e.target.value as DestinationStatus]}`,
                        )
                      }
                    >
                      {DESTINATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5">
                    <input
                      className="w-full min-w-[140px] rounded border border-[var(--line)] px-2 py-1 text-[11.5px]"
                      placeholder={row?.note ?? 'Optional note for the desk'}
                      defaultValue={row?.note ?? ''}
                      onBlur={(e) => {
                        if ((row?.note ?? '') === e.target.value) return
                        void call(
                          `/api/admin/market/destinations/${country.code}`,
                          { method: 'PATCH', body: JSON.stringify({ note: e.target.value }) },
                          `${country.name}: note saved`,
                        )
                      }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Products({ data, call }: { data: MarketAdminData; call: (path: string, init: RequestInit, ok: string) => Promise<void> }) {
  const [productSlug, setProductSlug] = useState(PRODUCTS[0]?.slug ?? '')
  const [country, setCountry] = useState('US')
  const [available, setAvailable] = useState(true)
  const [moq, setMoq] = useState('')
  const [leadTimeDays, setLeadTimeDays] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <Card
      title="Product availability and MOQ per destination"
      subtitle="Unconfigured means “we will answer the enquiry”. A saved rule is the only thing that can refuse a product for a country."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block lg:col-span-2">
          <span className="mb-1 block text-[11.5px] font-medium">Product</span>
          <select className={inputBase} value={productSlug} onChange={(e) => setProductSlug(e.target.value)}>
            {PRODUCTS.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium">Country</span>
          <select className={inputBase} value={country} onChange={(e) => setCountry(e.target.value)}>
            {countriesByRegion().map((g) => (
              <optgroup key={g.region} label={g.region}>
                {g.countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium">MOQ (units)</span>
          <input className={inputBase} value={moq} onChange={(e) => setMoq(e.target.value)} inputMode="numeric" placeholder="unset" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium">Lead time (days)</span>
          <input
            className={inputBase}
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(e.target.value)}
            inputMode="numeric"
            placeholder="unset"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-[12.5px]">
          <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
          Offered for this destination
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            await call(
              '/api/admin/market/products',
              {
                method: 'PATCH',
                body: JSON.stringify({ productSlug, country, available, moq: moq || null, leadTimeDays: leadTimeDays || null }),
              },
              'Product rule saved',
            )
            setSaving(false)
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2 text-[12.5px] font-semibold text-[#faf8f5] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save rule
        </button>
      </div>

      {data.products.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">
                <th className="py-1.5 pr-2">Product</th>
                <th className="py-1.5 pr-2">Country</th>
                <th className="py-1.5 pr-2">Offered</th>
                <th className="py-1.5 pr-2">MOQ</th>
                <th className="py-1.5">Lead time</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((rule) => (
                <tr key={`${rule.productSlug}-${rule.country}`} className="border-b border-[var(--line)]/60">
                  <td className="py-1.5 pr-2">{PRODUCTS.find((p) => p.slug === rule.productSlug)?.name ?? rule.productSlug}</td>
                  <td className="py-1.5 pr-2 tabular">{rule.country}</td>
                  <td className="py-1.5 pr-2">{rule.available ? 'yes' : 'no'}</td>
                  <td className="py-1.5 pr-2 tabular">{rule.moq ?? '—'}</td>
                  <td className="py-1.5 tabular">{rule.leadTimeDays ? `${rule.leadTimeDays} d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
