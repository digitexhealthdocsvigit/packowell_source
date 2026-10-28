/**
 * Production job board.
 *
 * Everything here is driven by the real job API — there is no local state that
 * pretends a stage moved. When the server refuses (a stage cannot be skipped, a
 * file is unapproved, prepress found blocking errors) the refusal is shown as
 * the server worded it, because those messages are the useful part.
 *
 * The passcode session is shared with the enquiry inbox and market admin: one
 * sign-in covers all three.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  CircleSlash,
  Clock,
  Download,
  FileUp,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { Section, Eyebrow, H2, Lede, Card, Field, Notice, SpecRow } from '@/components/site/ui'
import { STAGES, stageIndex, nextStage, stageLabel } from '@/lib/production/stages'
import { cn } from '@/lib/cn'
import { useSeo } from '@/lib/seo'

const TOKEN_KEY = 'kl-admin-token'
const ACTOR_KEY = 'kl-admin-actor'

const inputBase =
  'w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-2 text-[13px] outline-none focus:border-[var(--kraft)] focus:ring-2 focus:ring-[var(--kraft)]/15'

interface VersionRow {
  id: string
  version: number
  role: string
  status: string
  reference: string
  filename: string
  mime: string
  bytes: number
  format: string | null
  sha256: string
  prepressReady: boolean
  prepressErrors: number
  prepressWarnings: number
  approvedBy: string | null
  approvedAt: string | null
  note: string | null
  createdAt: string
}

interface EventRow {
  id: string
  type: string
  fromStage: string | null
  toStage: string | null
  actor: string | null
  note: string | null
  createdAt: string
}

interface CheckRow {
  id: string
  kind: string
  result: string
  checkName: string | null
  notes: string | null
  actor: string | null
  createdAt: string
}

interface Job {
  id: string
  reference: string
  leadId: string | null
  quoteRef: string | null
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  productSlug: string | null
  productName: string | null
  dimensions: string | null
  material: string | null
  boardGrade: string | null
  quantity: number | null
  finishes: string | null
  printSpec: string | null
  destination: string | null
  destinationCountry: string | null
  stage: string
  status: string
  specsConfirmed: boolean
  specsConfirmedBy: string | null
  artworkApproved: boolean
  artworkApprovedBy: string | null
  productionReady: boolean
  dispatchCarrier: string | null
  dispatchTracking: string | null
  dispatchedAt: string | null
  deliveredAt: string | null
  versions: VersionRow[]
  events?: EventRow[]
  checks?: CheckRow[]
  gate: { ok: boolean; blockers: string[]; proofVersion: number | null; productionFileVersion: number | null }
  createdAt: string
  updatedAt: string
}

interface JobSummary {
  id: string
  reference: string
  customerName: string
  customerEmail: string | null
  productName: string | null
  quantity: number | null
  destination: string | null
  stage: string
  stageLabel: string
  stageIndex: number
  status: string
  specsConfirmed: boolean
  artworkApproved: boolean
  productionReady: boolean
  blockers: string[]
  versionCount: number
  updatedAt: string
}

interface Stats {
  total: number
  byStage: Record<string, number>
  blocked: number
  ready: number
}

function fdate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fbytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** One authenticated call. Surfaces the server's own error text. */
function useApi(token: string | null, onExpired: () => void) {
  return useCallback(
    async (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      if (token) headers.set('authorization', `Bearer ${token}`)
      if (init.body && typeof init.body === 'string') headers.set('content-type', 'application/json')

      const res = await fetch(`/api${path}`, { ...init, headers })
      if (res.status === 401) {
        onExpired()
        return { ok: false as const, status: 401, error: 'That session expired. Sign in again.', blockers: [] as string[] }
      }
      if (res.headers.get('content-type')?.includes('application/json')) {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          return {
            ok: false as const,
            status: res.status,
            error: (body as { error?: string }).error ?? `HTTP ${res.status}`,
            blockers: ((body as { blockers?: string[] }).blockers ?? []) as string[],
          }
        }
        return { ok: true as const, status: res.status, body }
      }
      return { ok: res.ok, status: res.status, body: null, error: res.ok ? undefined : `HTTP ${res.status}`, blockers: [] as string[] }
    },
    [token, onExpired],
  )
}

export function JobBoardPage() {
  useSeo({
    title: 'Production job board',
    description: 'Track packaging jobs from accepted quote to dispatch.',
    path: '/admin/jobs',
    noindex: true,
  })

  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY))
  const signOut = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }, [])

  if (!token) {
    return (
      <SignIn
        onToken={(t) => {
          sessionStorage.setItem(TOKEN_KEY, t)
          setToken(t)
        }}
      />
    )
  }
  return <Board token={token} onSignOut={signOut} />
}

function SignIn({ onToken }: { onToken: (token: string) => void }) {
  useSeo({ title: 'Production sign-in', description: 'Staff access.', path: '/admin/jobs', noindex: true })
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
      <H2 as="h1">Production job board</H2>
      <Lede className="max-w-2xl">
        Jobs, artwork versions and the production gate. This page needs the business passcode — it
        carries customer details and the files that go to press.
      </Lede>

      {configured === false && (
        <div className="mt-5 max-w-xl">
          <Notice tone="warn" title="No passcode is configured">
            <code className="text-[12px]">ADMIN_PASSCODE</code> is not set on the server, so this page
            cannot be opened. Set it in the environment and restart the API.
          </Notice>
        </div>
      )}

      <form onSubmit={submit} className="mt-6 max-w-sm space-y-3">
        <Field label="Business passcode" required error={error || undefined}>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className={inputBase}
            autoComplete="current-password"
            required
          />
        </Field>
        <button
          type="submit"
          disabled={busy || configured === false}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Open the board
        </button>
      </form>
    </Section>
  )
}

function Board({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [stageFilter, setStageFilter] = useState('')
  const [query, setQuery] = useState('')
  const [onlyBlocked, setOnlyBlocked] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingJob, setLoadingJob] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const detailRef = useRef<HTMLDivElement | null>(null)
  const flashTimer = useRef<number | null>(null)

  const api = useApi(token, onSignOut)

  const notify = useCallback((m: string) => {
    // Two actions in quick succession used to leave the second message to be
    // wiped by the first message's timer; only the latest timer may clear it.
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    setFlash(m)
    flashTimer.current = window.setTimeout(() => {
      setFlash('')
      flashTimer.current = null
    }, 3600)
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    const [s, l] = await Promise.all([api('/admin/jobs/stats'), api('/admin/jobs')])
    if (s.ok && s.body) setStats(s.body as Stats)
    if (l.ok && l.body) setJobs(((l.body as { jobs: JobSummary[] }).jobs ?? []) as JobSummary[])
    else if (!l.ok) setError(l.error ?? 'Could not load the job list')
    setLoading(false)
  }, [api])

  const loadJob = useCallback(
    async (ref: string) => {
      setLoadingJob(true)
      const res = await api(`/admin/jobs/${ref}`)
      if (res.ok && res.body) setJob((res.body as { job: Job }).job)
      else setError(res.error ?? 'Could not load that job')
      setLoadingJob(false)
    },
    [api],
  )

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (!selected) {
      setJob(null)
      return
    }
    void loadJob(selected)
  }, [selected, loadJob])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs.filter((row) => {
      if (stageFilter && row.stage !== stageFilter) return false
      if (onlyBlocked && row.productionReady) return false
      if (!q) return true
      return [row.reference, row.customerName, row.customerEmail, row.productName]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    })
  }, [jobs, stageFilter, query, onlyBlocked])

  const pick = (ref: string) => {
    setSelected(ref)
    setError('')
    if (window.innerWidth < 1024) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    }
  }

  const afterMutation = async (message: string) => {
    notify(message)
    await loadList()
    if (selected) await loadJob(selected)
  }

  return (
    <Section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Production</Eyebrow>
          <H2 as="h1">Job board</H2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadList()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-[12.5px] hover:bg-[var(--paper-2)]"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Reload
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-[12.5px] text-[var(--ink-soft)] hover:bg-[var(--paper-2)]"
          >
            Sign out
          </button>
        </div>
      </div>

      <Lede className="max-w-3xl">
        Every job moves through twelve stages in order. The production gate cannot be talked past:
        it needs a specification confirmed by a person, a proof approved by a person, and a
        production file approved by a person. Blockers are named, not summarised.
      </Lede>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {flash && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-900">
          <Check className="h-4 w-4 shrink-0" /> {flash}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Jobs" value={stats?.total ?? jobs.length} />
        <StatTile label="Ready to produce" value={stats?.ready ?? 0} tone="ok" />
        <StatTile label="Held at gate" value={stats?.blocked ?? 0} tone="warn" />
        <StatTile
          label="In production"
          value={jobs.filter((j) => stageIndex(j.stage) >= stageIndex('production-file-ready') && j.stage !== 'dispatched' && j.stage !== 'delivered').length}
        />
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-soft)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Job ref, customer or product"
            className={cn(inputBase, 'pl-8')}
            aria-label="Search jobs"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className={cn(inputBase, 'sm:w-64')}
          aria-label="Filter by stage"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-[12.5px] text-[var(--ink-soft)]">
          <input
            type="checkbox"
            checked={onlyBlocked}
            onChange={(e) => setOnlyBlocked(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--kraft)]"
          />
          Only jobs the gate is holding
        </label>
        <span className="text-[12px] text-[var(--ink-soft)] sm:ml-auto">
          {visible.length} of {jobs.length}
        </span>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {/* List: below the detail on phones so the detail is not off-screen. */}
        <div className={cn('order-2 lg:order-1', selected && 'hidden lg:block')}>
          {loading && jobs.length === 0 && (
            <div className="flex items-center gap-2 py-8 text-[13px] text-[var(--ink-soft)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading jobs…
            </div>
          )}
          {!loading && visible.length === 0 && (
            <Card className="p-5">
              <p className="text-[13px] font-medium">No jobs match this view.</p>
              <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
                {jobs.length === 0
                  ? 'Jobs are created when a quote is accepted, or directly against this API.'
                  : 'Clear the filters to see the rest of the board.'}
              </p>
            </Card>
          )}
          <ul className="space-y-2">
            {visible.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  onClick={() => pick(j.reference)}
                  className={cn(
                    'w-full rounded-xl border bg-white/80 p-3 text-left transition hover:bg-[var(--paper-2)]',
                    selected === j.reference ? 'border-[var(--kraft)] ring-1 ring-[var(--kraft)]/25' : 'border-[var(--line)]',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[12.5px] font-semibold">{j.reference}</span>
                        {j.productionReady ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-800">
                            <ShieldCheck className="h-3 w-3" /> gate clear
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-900">
                            <CircleSlash className="h-3 w-3" /> {j.blockers.length} blocker{j.blockers.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[13px] font-medium">{j.customerName}</p>
                      <p className="truncate text-[12px] text-[var(--ink-soft)]">
                        {j.productName ?? 'Unnamed product'}
                        {j.quantity ? ` · ${j.quantity}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--ink-soft)]" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--ink-soft)]">
                    <StageChip stage={j.stage} />
                    <span>·</span>
                    <span>{j.versionCount} file{j.versionCount === 1 ? '' : 's'}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fdate(j.updatedAt)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Detail */}
        <div ref={detailRef} className={cn('order-1 lg:order-2', !selected && 'hidden lg:block')}>
          {!selected && (
            <Card className="p-8 text-center">
              <p className="text-[13px] font-medium">Pick a job</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-[var(--ink-soft)]">
                Its specification, artwork versions, gate blockers and history will appear here.
              </p>
            </Card>
          )}
          {selected && loadingJob && !job && (
            <div className="flex items-center gap-2 py-8 text-[13px] text-[var(--ink-soft)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading {selected}…
            </div>
          )}
          {selected && job && (
            <JobDetail
              job={job}
              api={api}
              onChanged={afterMutation}
              onError={setError}
              onClose={() => {
                setSelected(null)
                setJob(null)
              }}
            />
          )}
        </div>
      </div>
    </Section>
  )
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5">
      <div
        className={cn(
          'text-[20px] font-semibold leading-tight',
          tone === 'ok' && 'text-emerald-700',
          tone === 'warn' && value > 0 && 'text-amber-700',
        )}
      >
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--ink-soft)]">{label}</div>
    </div>
  )
}

function StageChip({ stage }: { stage: string }) {
  const i = stageIndex(stage)
  const done = stage === 'delivered'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium',
        done ? 'bg-[var(--ink)] text-white' : i >= stageIndex('production-file-ready') ? 'bg-[var(--kraft)]/15 text-[var(--kraft-dark)]' : 'bg-[var(--paper-2)] text-[var(--ink-soft)]',
      )}
    >
      {STAGES[i]?.short ?? stage} · {i + 1}/12
    </span>
  )
}

type ApiFn = ReturnType<typeof useApi>

function JobDetail({
  job,
  api,
  onChanged,
  onError,
  onClose,
}: {
  job: Job
  api: ApiFn
  onChanged: (message: string) => Promise<void>
  onError: (message: string) => void
  onClose: () => void
}) {
  const [actor, setActor] = useState(() => sessionStorage.getItem(ACTOR_KEY) ?? '')
  const [busy, setBusy] = useState('')
  const [blockers, setBlockers] = useState<string[]>([])

  useEffect(() => {
    setBlockers([])
  }, [job.id])

  const rememberActor = (value: string) => {
    setActor(value)
    sessionStorage.setItem(ACTOR_KEY, value)
  }

  const next = nextStage(job.stage)

  const act = async (key: string, path: string, body: unknown, okMessage: string) => {
    setBusy(key)
    setBlockers([])
    onError('')
    const res = await api(path, { method: 'POST', body: JSON.stringify(body) })
    setBusy('')
    if (!res.ok) {
      onError(res.error ?? 'That did not work')
      setBlockers(res.blockers ?? [])
      return false
    }
    await onChanged(okMessage)
    return true
  }

  const download = async (v: VersionRow) => {
    if (!v) return
    const res = await fetch(`/api/admin/jobs/${job.reference}/files/${v.id}`, {
      headers: { authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      onError(body.error ?? `Could not download that file (HTTP ${res.status})`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = v.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[15px] font-semibold">{job.reference}</span>
              <StageChip stage={job.stage} />
              {job.status === 'closed' && (
                <span className="rounded-full bg-[var(--paper-2)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--ink-soft)]">
                  closed
                </span>
              )}
            </div>
            <p className="mt-1 text-[14px] font-medium">{job.customerName}</p>
            <p className="text-[12.5px] text-[var(--ink-soft)]">
              {job.customerEmail ?? 'no email'}
              {job.customerPhone ? ` · ${job.customerPhone}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-[12px] text-[var(--ink-soft)] hover:bg-[var(--paper-2)] lg:hidden"
          >
            Back to list
          </button>
        </div>

        <div className="mt-4">
          <StageRail stage={job.stage} />
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <SpecRow k="Product" v={job.productName ?? '—'} />
          <SpecRow k="Quantity" v={job.quantity ?? '—'} />
          <SpecRow k="Dimensions" v={job.dimensions ?? 'not recorded'} />
          <SpecRow k="Material" v={job.material ?? 'not recorded'} />
          <SpecRow k="Board grade" v={job.boardGrade ?? '—'} />
          <SpecRow k="Finishes" v={job.finishes ?? '—'} />
          <SpecRow k="Print spec" v={job.printSpec ?? '—'} />
          <SpecRow k="Destination" v={job.destination ?? job.destinationCountry ?? '—'} />
          <SpecRow
            k="Specification"
            v={
              job.specsConfirmed ? (
                <span className="text-emerald-700">confirmed by {job.specsConfirmedBy}</span>
              ) : (
                <span className="text-amber-700">not confirmed</span>
              )
            }
          />
          <SpecRow
            k="Proof"
            v={
              job.artworkApproved ? (
                <span className="text-emerald-700">approved by {job.artworkApprovedBy}</span>
              ) : (
                <span className="text-amber-700">not approved</span>
              )
            }
          />
          {job.dispatchCarrier && <SpecRow k="Carrier" v={job.dispatchCarrier} />}
          {job.dispatchTracking && <SpecRow k="Tracking" v={job.dispatchTracking} />}
        </dl>
      </Card>

      {/* Gate */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold">
            {job.gate.ok ? (
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
            ) : (
              <CircleSlash className="h-4 w-4 text-amber-700" />
            )}
            Production gate
          </h3>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-medium',
              job.gate.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900',
            )}
          >
            {job.gate.ok ? 'clear' : `${job.gate.blockers.length} blocker${job.gate.blockers.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {job.gate.ok ? (
          <p className="mt-2 text-[12.5px] text-[var(--ink-soft)]">
            Approved proof v{job.gate.proofVersion} and its approved production file v
            {job.gate.productionFileVersion} are both in place. The job may enter production.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {job.gate.blockers.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[12.5px] text-amber-950">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {blockers.length > 0 && (
          <ul className="mt-3 space-y-1.5 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2">
            <li className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">Latest refusal</li>
            {blockers.map((b) => (
              <li key={b} className="text-[12.5px] text-amber-950">
                {b}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="Working as" hint="Recorded on every action." className="sm:max-w-[220px]">
            <input
              value={actor}
              onChange={(e) => rememberActor(e.target.value)}
              placeholder="Your name"
              className={inputBase}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {!job.specsConfirmed && (
              <button
                type="button"
                disabled={!actor || busy === 'specs'}
                onClick={() =>
                  act('specs', `/admin/jobs/${job.reference}/confirm-specs`, { by: actor }, 'Specification confirmed')
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[12.5px] font-medium hover:bg-[var(--paper-2)] disabled:opacity-40"
              >
                {busy === 'specs' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Confirm specification
              </button>
            )}
            {next && (
              <button
                type="button"
                disabled={!actor || busy === 'advance'}
                onClick={() => act('advance', `/admin/jobs/${job.reference}/advance`, { to: next, by: actor }, `Moved to ${stageLabel(next)}`)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-2 text-[12.5px] font-medium text-white disabled:opacity-40"
              >
                {busy === 'advance' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Advance to {stageLabel(next)}
              </button>
            )}
            {!next && <span className="text-[12.5px] text-[var(--ink-soft)]">This job is closed.</span>}
          </div>
        </div>
        {!actor && (
          <p className="mt-2 text-[11.5px] text-[var(--ink-soft)]">
            Name yourself first — approvals are refused without a named person.
          </p>
        )}
      </Card>

      <Versions job={job} api={api} actor={actor} onChanged={onChanged} onError={onError} onDownload={download} busy={busy} setBusy={setBusy} setBlockers={setBlockers} />

      <div className="grid gap-4 xl:grid-cols-2">
        <QcCard job={job} api={api} actor={actor} onChanged={onChanged} onError={onError} />
        <DispatchCard job={job} api={api} actor={actor} onChanged={onChanged} onError={onError} />
      </div>

      <History job={job} />
    </div>
  )
}

function StageRail({ stage }: { stage: string }) {
  const current = stageIndex(stage)
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <ol className="flex min-w-max items-stretch gap-1 px-1">
        {STAGES.map((s, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={s.id} className="flex w-[76px] flex-col gap-1">
              <div
                className={cn(
                  'h-1.5 rounded-full',
                  done && 'bg-[var(--kraft)]/50',
                  active && 'bg-[var(--kraft)]',
                  !done && !active && 'bg-[var(--line)]',
                )}
              />
              <span
                className={cn(
                  'text-[10px] leading-tight',
                  active ? 'font-semibold text-[var(--ink)]' : done ? 'text-[var(--ink-soft)]' : 'text-[var(--ink-soft)]/60',
                )}
              >
                {s.short}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Versions({
  job,
  api,
  actor,
  onChanged,
  onError,
  onDownload,
  busy,
  setBusy,
  setBlockers,
}: {
  job: Job
  api: ApiFn
  actor: string
  onChanged: (message: string) => Promise<void>
  onError: (message: string) => void
  onDownload: (v: VersionRow) => void
  busy: string
  setBusy: (v: string) => void
  setBlockers: (v: string[]) => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [role, setRole] = useState<'customer' | 'revised' | 'production'>('customer')
  const [width, setWidth] = useState(job.dimensions?.match(/(\d+(?:\.\d+)?)\s*[x×]/)?.[1] ?? '240')
  const [height, setHeight] = useState(
    job.dimensions?.match(/[x×]\s*(\d+(?:\.\d+)?)/)?.[1] ?? '180',
  )
  const [uploading, setUploading] = useState(false)

  const approve = async (v: VersionRow) => {
    setBusy(`approve-${v.id}`)
    setBlockers([])
    const res = await api(`/admin/jobs/${job.reference}/versions/${v.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ by: actor }),
    })
    setBusy('')
    if (!res.ok) {
      onError(res.error ?? 'That file could not be approved')
      setBlockers(res.blockers ?? [])
      return
    }
    await onChanged(`Version ${v.version} approved`)
  }

  const reject = async (v: VersionRow) => {
    setBusy(`reject-${v.id}`)
    const res = await api(`/admin/jobs/${job.reference}/versions/${v.id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ by: actor || 'desk', note: 'Rejected at the desk' }),
    })
    setBusy('')
    if (!res.ok) {
      onError(res.error ?? 'That file could not be rejected')
      return
    }
    await onChanged(`Version ${v.version} rejected`)
  }

  const upload = async (e: React.FormEvent) => {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) {
      onError('Choose a file to upload.')
      return
    }
    setUploading(true)
    onError('')
    const form = new FormData()
    form.set('file', file)
    form.set('role', role)
    form.set('panelWidthMm', width)
    form.set('panelHeightMm', height)
    form.set('by', actor || 'desk')

    const res = await api(`/admin/jobs/${job.reference}/artwork`, { method: 'POST', body: form })
    setUploading(false)
    if (!res.ok) {
      onError(res.error ?? 'That upload was refused')
      return
    }
    if (fileRef.current) fileRef.current.value = ''
    const made = (res.body as { version?: VersionRow })?.version
    await onChanged(`Uploaded version ${made?.version ?? ''}`)
  }

  const proofs = job.versions.filter((v) => v.role !== 'production')
  const production = job.versions.filter((v) => v.role === 'production')

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">Artwork versions</h3>
        <span className="text-[11.5px] text-[var(--ink-soft)]">
          {proofs.length} proof{proofs.length === 1 ? '' : 's'} · {production.length} production file
          {production.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="mt-3 space-y-4">
        <VersionGroup
          title="Proofs"
          rows={proofs}
          job={job}
          actor={actor}
          busy={busy}
          onApprove={approve}
          onReject={reject}
          onDownload={onDownload}
        />
        <VersionGroup
          title="Production files"
          rows={production}
          job={job}
          actor={actor}
          busy={busy}
          onApprove={approve}
          onReject={reject}
          onDownload={onDownload}
          emptyHint="A production file carries the version number of the proof it was made from."
        />
      </div>

      <form onSubmit={upload} className="mt-5 space-y-3 border-t border-[var(--line)] pt-4">
        <p className="text-[12.5px] font-medium">Add a file</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kind">
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={inputBase}>
              <option value="customer">Customer proof</option>
              <option value="revised">Revised proof</option>
              <option value="production">Production file</option>
            </select>
          </Field>
          <Field label="File">
            <input
              ref={fileRef}
              type="file"
              className="w-full text-[12px] file:mr-2 file:rounded-md file:border-0 file:bg-[var(--paper-2)] file:px-2.5 file:py-1.5 file:text-[12px]"
            />
          </Field>
          <Field label="Panel width (mm)" hint="Used to check effective resolution.">
            <input value={width} onChange={(e) => setWidth(e.target.value)} className={inputBase} inputMode="decimal" />
          </Field>
          <Field label="Panel height (mm)">
            <input value={height} onChange={(e) => setHeight(e.target.value)} className={inputBase} inputMode="decimal" />
          </Field>
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[12.5px] font-medium hover:bg-[var(--paper-2)] disabled:opacity-40"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
          Upload and inspect
        </button>
        <p className="text-[11.5px] text-[var(--ink-soft)]">
          Every upload is hashed and run through prepress. A file with blocking findings cannot be
          approved, and uploading a new proof withdraws the previous approval.
        </p>
      </form>
    </Card>
  )
}

function VersionGroup({
  title,
  rows,
  job,
  actor,
  busy,
  onApprove,
  onReject,
  onDownload,
  emptyHint,
}: {
  title: string
  rows: VersionRow[]
  job: Job
  actor: string
  busy: string
  onApprove: (v: VersionRow) => void
  onReject: (v: VersionRow) => void
  onDownload: (v: VersionRow) => void
  emptyHint?: string
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{emptyHint ?? 'None yet.'}</p>
      ) : (
        <ul className="mt-1.5 space-y-2">
          {rows.map((v) => (
            <li key={v.id} className="rounded-lg border border-[var(--line)] bg-white p-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12.5px] font-semibold">v{v.version}</span>
                    <StatusPill status={v.status} />
                    {v.prepressErrors > 0 ? (
                      <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10.5px] font-medium text-red-800">
                        {v.prepressErrors} blocking
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-800">
                        prepress ok
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[12px] text-[var(--ink-soft)]">
                    {v.filename} · {fbytes(v.bytes)} · {v.format ?? v.mime}
                  </p>
                  <p className="truncate font-mono text-[10.5px] text-[var(--ink-soft)]">
                    sha256 {v.sha256.slice(0, 24)}…
                  </p>
                  {v.approvedBy && (
                    <p className="text-[11px] text-emerald-800">
                      approved by {v.approvedBy} · {fdate(v.approvedAt)}
                    </p>
                  )}
                  {v.note && <p className="text-[11px] italic text-[var(--ink-soft)]">{v.note}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onDownload(v)}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] px-2 py-1 text-[11.5px] hover:bg-[var(--paper-2)]"
                  >
                    <Download className="h-3 w-3" /> File
                  </button>
                  {v.status !== 'approved' && (
                    <button
                      type="button"
                      disabled={!actor || busy === `approve-${v.id}`}
                      onClick={() => onApprove(v)}
                      title={actor ? 'Approve this file' : 'Name yourself first'}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--ink)] px-2 py-1 text-[11.5px] font-medium text-white disabled:opacity-40"
                    >
                      {busy === `approve-${v.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Approve
                    </button>
                  )}
                  {v.status !== 'rejected' && v.status !== 'superseded' && (
                    <button
                      type="button"
                      disabled={!actor || busy === `reject-${v.id}`}
                      onClick={() => onReject(v)}
                      className="rounded-md border border-[var(--line)] px-2 py-1 text-[11.5px] text-[var(--ink-soft)] hover:bg-[var(--paper-2)] disabled:opacity-40"
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <p className="mt-1 text-[10.5px] text-[var(--ink-soft)]">
          {job.reference} · versions are immutable: a change is a new version, never an edit.
        </p>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'approved'
      ? 'bg-emerald-50 text-emerald-800'
      : status === 'rejected'
        ? 'bg-red-50 text-red-800'
        : status === 'superseded'
          ? 'bg-[var(--paper-2)] text-[var(--ink-soft)]'
          : 'bg-amber-50 text-amber-900'
  return <span className={cn('rounded-full px-1.5 py-0.5 text-[10.5px] font-medium', tone)}>{status}</span>
}

function QcCard({
  job,
  api,
  actor,
  onChanged,
  onError,
}: {
  job: Job
  api: ApiFn
  actor: string
  onChanged: (m: string) => Promise<void>
  onError: (m: string) => void
}) {
  const [kind, setKind] = useState('inspection')
  const [result, setResult] = useState('pass')
  const [checkName, setCheckName] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await api(`/admin/jobs/${job.reference}/qc`, {
      method: 'POST',
      body: JSON.stringify({ kind, result, checkName, notes, by: actor || 'desk' }),
    })
    setBusy(false)
    if (!res.ok) {
      onError(res.error ?? 'That check was refused')
      return
    }
    setCheckName('')
    setNotes('')
    await onChanged('Quality record added')
  }

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-[13px] font-semibold">Quality and rework</h3>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputBase}>
              <option value="inspection">Inspection</option>
              <option value="defect">Defect</option>
              <option value="rework">Rework</option>
            </select>
          </Field>
          <Field label="Result">
            <select value={result} onChange={(e) => setResult(e.target.value)} className={inputBase}>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="reworked">Reworked</option>
              <option value="open">Open</option>
            </select>
          </Field>
        </div>
        <Field label="What was checked">
          <input value={checkName} onChange={(e) => setCheckName(e.target.value)} placeholder="e.g. Print registration" className={inputBase} />
        </Field>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputBase} />
        </Field>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[12.5px] font-medium hover:bg-[var(--paper-2)] disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Record check
        </button>
      </form>

      {job.checks && job.checks.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-[var(--line)] pt-3">
          {job.checks.slice(0, 6).map((c) => (
            <li key={c.id} className="text-[11.5px]">
              <span className="font-medium">{c.kind}</span> · {c.result}
              {c.checkName ? ` · ${c.checkName}` : ''}{' '}
              <span className="text-[var(--ink-soft)]">
                {c.actor} {fdate(c.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function DispatchCard({
  job,
  api,
  actor,
  onChanged,
  onError,
}: {
  job: Job
  api: ApiFn
  actor: string
  onChanged: (m: string) => Promise<void>
  onError: (m: string) => void
}) {
  const [carrier, setCarrier] = useState(job.dispatchCarrier ?? '')
  const [tracking, setTracking] = useState(job.dispatchTracking ?? '')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await api(`/admin/jobs/${job.reference}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ carrier, tracking, by: actor || 'desk' }),
    })
    setBusy(false)
    if (!res.ok) {
      onError(res.error ?? 'Dispatch was refused')
      return
    }
    await onChanged('Dispatch recorded')
  }

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold">
        <Truck className="h-4 w-4" /> Dispatch
      </h3>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <Field label="Carrier" required>
          <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. Delhivery Surface" className={inputBase} />
        </Field>
        <Field label="Tracking number">
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} className={inputBase} />
        </Field>
        <button
          type="submit"
          disabled={busy || !carrier}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-2 text-[12.5px] font-medium text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
          Record dispatch
        </button>
      </form>
      <p className="mt-2 text-[11.5px] text-[var(--ink-soft)]">
        Dispatch is refused while the production gate has blockers, so an unapproved file cannot leave
        the building.
      </p>
    </Card>
  )
}

function History({ job }: { job: Job }) {
  const events = job.events ?? []
  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-[13px] font-semibold">History</h3>
      <p className="text-[11.5px] text-[var(--ink-soft)]">
        {events.length} recorded event{events.length === 1 ? '' : 's'}, newest first. Nothing here is
        editable.
      </p>
      <ol className="mt-3 space-y-2">
        {events.slice(0, 40).map((e) => (
          <li key={e.id} className="border-l-2 border-[var(--line)] pl-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[12px] font-medium">{e.type.replace(/-/g, ' ')}</span>
              <span className="text-[11px] text-[var(--ink-soft)]">{fdate(e.createdAt)}</span>
            </div>
            {e.note && <p className="text-[11.5px] text-[var(--ink-soft)]">{e.note}</p>}
            <p className="text-[10.5px] text-[var(--ink-soft)]">
              {e.actor ?? 'system'}
              {e.fromStage && e.toStage ? ` · ${stageLabel(e.fromStage)} → ${stageLabel(e.toStage)}` : ''}
            </p>
          </li>
        ))}
      </ol>
      {events.length === 0 && <p className="mt-2 text-[12px] text-[var(--ink-soft)]">No events yet.</p>}
    </Card>
  )
}
