import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Download, Loader2, LockKeyhole, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/site/ui'
import { cn } from '@/lib/cn'

/**
 * The business side of an enquiry: what was asked for, and the artwork that
 * came with it, exactly as the desk received it.
 *
 * The passcode is checked on the server and the token it returns is held for
 * this tab only. Nothing here can be reached without that token — the page
 * renders a sign-in form, it does not gate anything itself.
 */

interface Artwork {
  reference: string
  filename: string
  format: string
  bytes: number
  ready: boolean
  errors: number
  warnings: number
  effectiveDpi: number | null
  colour: string | null
  panel: string | null
  panelWidthMm: number | null
  panelHeightMm: number | null
  findings: { id: string; severity: string; title: string }[]
  url: string
}

/** The rate snapshot taken when the enquiry was written, not a live conversion. */
interface FxSnapshot {
  baseCurrency: string | null
  baseAmount: number | null
  rate: number | null
  displayAmount: number | null
  fetchedAt: string | null
}

interface Enquiry {
  id: string
  reference: string | null
  kind: string
  status: string
  createdAt: string
  name: string
  company: string | null
  email: string
  phone: string | null
  quantity: string | null
  pincode: string | null
  postalCode: string | null
  country: string | null
  countryName: string | null
  currency: string | null
  fx: FxSnapshot | null
  destination: string | null
  productSlug: string | null
  structureId: string | null
  dimensions: string | null
  board: string | null
  finishing: string | null
  printing: string | null
  deliveryRequirements: string | null
  message: string | null
  payload: Record<string, unknown> | null
  source: string | null
  artworks: Artwork[]
}

const TOKEN_KEY = 'kl-admin-token'
const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'] as const

function useToken() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY))
  const save = useCallback((next: string | null) => {
    if (next) sessionStorage.setItem(TOKEN_KEY, next)
    else sessionStorage.removeItem(TOKEN_KEY)
    setToken(next)
  }, [])
  return { token, save }
}

function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/**
 * Money in the inbox is read by one desk, so every amount uses the same
 * grouping convention and carries its ISO code. Public pages format each
 * currency in its own convention (see lib/market/fx); mixing the two inside one
 * list is how "EUR 23,00" gets read as twenty-three hundred.
 */
function money(amount: number | null | undefined, code: string | null | undefined): string {
  if (amount == null) return '—'
  const n = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  return code ? `${code} ${n}` : n
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">{label}</dt>
      <dd className="text-[12.5px] leading-snug">{value}</dd>
    </div>
  )
}

/** Artwork must be fetched with the token, so it is turned into a blob URL. */
function ArtworkCard({ art, token }: { art: Artwork; token: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState('')

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    fetch(art.url, { headers: { authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setSrc(url)
      })
      .catch((e) => !cancelled && setFailed(e.message))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [art.url, token])

  const isImage = ['png', 'jpeg', 'svg'].includes(art.format)

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[12.5px] font-semibold tabular">{art.reference}</div>
        <span
          className={cn(
            'rounded border px-1.5 py-0.5 text-[10.5px] font-medium',
            art.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800',
          )}
        >
          {art.ready ? 'Passes prepress' : `${art.errors} blocking`}
        </span>
      </div>
      <div className="mt-0.5 break-all text-[11px] text-[var(--ink-soft)]">
        {art.filename} · {art.format.toUpperCase()} · {fmtBytes(art.bytes)}
        {art.panel ? ` · ${art.panel}` : ''}
        {art.effectiveDpi ? ` · ${Math.round(art.effectiveDpi)} dpi` : ''}
      </div>

      {isImage && src && (
        <img src={src} alt={`Artwork ${art.reference}`} className="mt-2 max-h-40 rounded border border-[var(--line)] bg-[var(--paper-2)] object-contain" />
      )}
      {!isImage && src && (
        <a href={src} download={art.filename} className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium underline-offset-2 hover:underline">
          <Download className="h-3.5 w-3.5" /> Download {art.filename}
        </a>
      )}
      {failed && <div className="mt-2 text-[11px] text-red-700">Could not load the file ({failed}).</div>}

      {art.findings.filter((f) => f.severity !== 'pass').length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--ink-soft)]">
          {art.findings
            .filter((f) => f.severity !== 'pass')
            .slice(0, 4)
            .map((f) => (
              <li key={f.id}>
                <span className={f.severity === 'error' ? 'text-red-700' : 'text-amber-700'}>
                  {f.severity === 'error' ? 'Blocks' : 'Review'}
                </span>{' '}
                — {f.title}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

export function EnquiriesPage() {
  const { token, save } = useToken()
  const [passcode, setPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<{ total: number; enquiries: Enquiry[] } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [savingStatus, setSavingStatus] = useState('')

  useEffect(() => {
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(null))
  }, [])

  const load = useCallback(
    async (auth: string) => {
      setBusy(true)
      setError('')
      try {
        const res = await fetch('/api/admin/enquiries', { headers: { authorization: `Bearer ${auth}` } })
        const body = await res.json().catch(() => ({}))
        if (res.status === 401) {
          save(null)
          setError('That session has expired. Sign in again.')
          return
        }
        if (!res.ok) {
          setError(body.error ?? `Could not load enquiries (HTTP ${res.status}).`)
          return
        }
        setData(body)
      } catch {
        setError('The inbox did not answer. Check the server is running.')
      } finally {
        setBusy(false)
      }
    },
    [save],
  )

  useEffect(() => {
    if (token) void load(token)
  }, [token, load])

  async function signIn(e: React.FormEvent) {
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
      if (!res.ok) {
        setError(body.error ?? `Sign-in failed (HTTP ${res.status}).`)
        return
      }
      save(body.token)
      setPasscode('')
      void load(body.token)
    } catch {
      setError('The server did not answer.')
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(id: string, status: string) {
    if (!token) return
    setSavingStatus(id)
    try {
      const res = await fetch(`/api/admin/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setData((d) => (d ? { ...d, enquiries: d.enquiries.map((e) => (e.id === id ? { ...e, status } : e)) } : d))
      }
    } finally {
      setSavingStatus('')
    }
  }

  async function signOut() {
    if (token) await fetch('/api/admin/signout', { method: 'POST', headers: { authorization: `Bearer ${token}` } }).catch(() => undefined)
    save(null)
    setData(null)
  }

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
        <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--kraft-dark)]">
          <LockKeyhole className="h-3.5 w-3.5" /> Business inbox
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Open enquiries</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-soft)]">
          Requests, specifications and the artwork sent with them. This page needs the business passcode —
          it is checked on the server, not in this page.
        </p>

        <form onSubmit={signIn} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium">Passcode</span>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              placeholder="••••••••••"
            />
          </label>
          <button
            type="submit"
            disabled={busy || passcode.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {busy ? 'Checking…' : 'Open inbox'}
          </button>
        </form>

        {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">{error}</div>}

        {configured === false && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-900">
            No passcode is configured on the server yet. Set <code className="font-mono">ADMIN_PASSCODE</code> in
            the project <code className="font-mono">.env</code> and restart the API server.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--kraft-dark)]">
            <LockKeyhole className="h-3.5 w-3.5" /> Business inbox
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Enquiries{data ? ` · ${data.total}` : ''}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => token && load(token)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[11.5px] font-medium hover:border-[var(--ink)]/40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
          </button>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[11.5px] font-medium hover:border-[var(--ink)]/40"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>

      {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">{error}</div>}

      {!data && busy && <div className="mt-6 text-[13px] text-[var(--ink-soft)]">Loading enquiries…</div>}

      {data && data.enquiries.length === 0 && (
        <div className="mt-6 rounded-xl border border-[var(--line)] bg-white p-5 text-[13px] text-[var(--ink-soft)]">
          No enquiries yet. Submissions from the quote, sample and contact forms appear here with their artwork.
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {data?.enquiries.map((e) => {
          const open = openId === e.id
          return (
            <Card key={e.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : e.id)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-[var(--paper-2)]/50"
              >
                <span className="font-semibold tabular text-[13px]">{e.reference ?? e.id.slice(0, 8)}</span>
                <span className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide text-[var(--ink-soft)]">
                  {e.kind}
                </span>
                <span className="text-[12.5px]">{e.name}</span>
                {e.company && <span className="text-[12px] text-[var(--ink-soft)]">{e.company}</span>}
                <span className="text-[11.5px] text-[var(--ink-soft)]">{fmtDate(e.createdAt)}</span>
                {e.artworks.length > 0 && (
                  <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10.5px] text-emerald-900">
                    {e.artworks.length} artwork
                  </span>
                )}
                <span
                  className={cn(
                    'ml-auto rounded px-1.5 py-0.5 text-[10.5px] font-medium',
                    e.status === 'new' ? 'bg-[var(--ink)] text-white' : 'border border-[var(--line)] text-[var(--ink-soft)]',
                  )}
                >
                  {e.status}
                </span>
                <ArrowRight className={cn('h-3.5 w-3.5 text-[var(--ink-soft)] transition', open && 'rotate-90')} />
              </button>

              {open && (
                <div className="border-t border-[var(--line)] px-4 py-3.5">
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Contact" value={`${e.name} · ${e.email}`} />
                    <Field label="Phone" value={e.phone} />
                    <Field label="Quantity" value={e.quantity} />
                    <Field
                      label="Delivery country"
                      value={e.country ? `${e.countryName ?? e.country} (${e.country})` : null}
                    />
                    <Field label="Postal code" value={e.postalCode ?? e.pincode} />
                    <Field label="Product" value={e.productSlug} />
                    <Field label="Structure" value={e.structureId} />
                    <Field label="Dimensions" value={e.dimensions} />
                    <Field label="Board" value={e.board} />
                    <Field label="Finishing" value={e.finishing} />
                    <Field label="Printing" value={e.printing} />
                    <Field label="Sent from" value={e.source} />
                  </dl>

                  <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--paper-2)]/40 p-3">
                    <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">
                      Quotation currency
                    </div>
                    {e.fx?.baseAmount != null ? (
                      <div className="space-y-1 text-[12.5px] leading-relaxed">
                        <div className="tabular">
                          {money(e.fx.baseAmount, e.fx.baseCurrency)}
                          {e.currency && e.currency !== e.fx.baseCurrency && (
                            <>
                              {' ≈ '}
                              {money(e.fx.displayAmount, e.currency)}
                            </>
                          )}
                        </div>
                        <div className="text-[11.5px] text-[var(--ink-soft)]">
                          {e.currency ? `Quoted in ${e.currency}. ` : ''}
                          {e.fx.rate != null && e.fx.baseCurrency && e.currency
                            ? `Rate 1 ${e.fx.baseCurrency} = ${e.fx.rate} ${e.currency}, `
                            : ''}
                          {e.fx.fetchedAt ? `snapshot taken ${fmtDate(e.fx.fetchedAt)}.` : 'No rate snapshot recorded.'}
                        </div>
                        <div className="text-[11px] text-[var(--ink-soft)]">
                          Indicative only — the invoice amount is confirmed on the quotation.
                        </div>
                      </div>
                    ) : (
                      <div className="text-[12.5px] text-[var(--ink-soft)]">
                        {e.currency
                          ? `Quoted in ${e.currency}. No converted amount is on file, so this enquiry carries no price snapshot.`
                          : 'No currency was recorded for this enquiry.'}
                      </div>
                    )}
                  </div>

                  {e.deliveryRequirements && (
                    <div className="mt-3 rounded-lg bg-[var(--paper-2)] p-3 text-[12.5px] leading-relaxed">
                      <div className="mb-1 text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">
                        Delivery requirements
                      </div>
                      {e.deliveryRequirements}
                    </div>
                  )}

                  {e.message && (
                    <div className="mt-3 rounded-lg bg-[var(--paper-2)] p-3 text-[12.5px] leading-relaxed">
                      {e.message}
                    </div>
                  )}

                  {e.payload && Object.keys(e.payload).length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">
                        Configuration sent with the request
                      </div>
                      <pre className="overflow-auto rounded-lg bg-[var(--paper-2)] p-2.5 text-[11px] leading-relaxed">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="mt-3.5">
                    <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">
                      Artwork
                    </div>
                    {e.artworks.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[var(--line)] p-3 text-[12px] text-[var(--ink-soft)]">
                        No artwork was sent with this request.
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {e.artworks.map((a) => (
                          <ArtworkCard key={a.reference} art={a} token={token} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[var(--ink-soft)]">Status</span>
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void setStatus(e.id, s)}
                        disabled={savingStatus === e.id}
                        className={cn(
                          'rounded border px-2 py-1 text-[11px] capitalize transition disabled:opacity-50',
                          e.status === s
                            ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                            : 'border-[var(--line)] bg-white hover:border-[var(--ink)]/40',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                    {savingStatus === e.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
