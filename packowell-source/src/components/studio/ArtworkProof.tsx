import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileCheck2,
  Info,
  Loader2,
  Upload,
  X,
  XCircle,
} from 'lucide-react'
import { inspectArtwork, type ArtworkMeta } from '@/lib/prepress/inspect'
import { evaluateArtwork, summarise, type PrepressReport } from '@/lib/prepress/evaluate'
import type { PackagingViewer } from '@/lib/three/viewer'
import { navigate } from '@/lib/router'
import type { PlacedArtwork } from '@/lib/geometry/dieline'
import { cn } from '@/lib/cn'

const IMAGE_FORMATS = new Set(['png', 'jpeg', 'svg'])

const SEVERITY = {
  error: {
    icon: XCircle,
    tone: 'text-red-700',
    chip: 'bg-red-50 text-red-800 border-red-200',
    label: 'Blocks the job',
  },
  warn: {
    icon: AlertTriangle,
    tone: 'text-amber-700',
    chip: 'bg-amber-50 text-amber-900 border-amber-200',
    label: 'Needs a decision',
  },
  info: {
    icon: Info,
    tone: 'text-[var(--ink-soft)]',
    chip: 'bg-[var(--paper-2)] text-[var(--ink-soft)] border-[var(--line)]',
    label: 'For information',
  },
  pass: {
    icon: CheckCircle2,
    tone: 'text-emerald-700',
    chip: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    label: 'Passes',
  },
} as const

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Artwork proof: inspect a real file against the real panel size, show what
 * would actually go wrong at press, and put the artwork on the box.
 *
 * The check runs in the browser so feedback is instant, then again on the
 * server when saved, so the stored verdict is not something a client can fake.
 */
export function ArtworkProof({
  viewer,
  structureId,
  onPlacement,
}: {
  viewer: PackagingViewer | null
  structureId: string
  onPlacement?: (placed: PlacedArtwork | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [aspect, setAspect] = useState(1)
  const [meta, setMeta] = useState<ArtworkMeta | null>(null)
  const [report, setReport] = useState<PrepressReport | null>(null)
  const [panelId, setPanelId] = useState<string | null>(null)
  const [fit, setFit] = useState<'contain' | 'cover'>('contain')
  const [onModel, setOnModel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedRef, setSavedRef] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Recomputed on every render: the panels change with structure and size.
  const panels = useMemo(() => (viewer ? viewer.listPanels() : []), [viewer, structureId])

  const panel = panels.find((p) => p.id === panelId) ?? panels[0] ?? null

  useEffect(() => {
    if (panelId && panels.some((p) => p.id === panelId)) return
    if (panels[0]?.id) setPanelId(panels[0].id)
  }, [panels, panelId])

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  useEffect(() => {
    if (!viewer) return
    if (onModel && url) viewer.setArtwork(url, { panelId: panel?.id ?? null, fit })
    else viewer.setArtwork(null)
  }, [viewer, url, panel?.id, fit, onModel])

  // The blank and the export draw from this, so what is on the box is what is
  // on the dieline. Emitting is guarded by the last payload: a parent that
  // passes an unstable callback must not turn this into a render loop.
  const emitted = useRef<{ panelId: string; dataUrl: string; aspect: number; fit: string; name?: string } | null>(null)
  useEffect(() => {
    if (!onPlacement) return
    const next =
      onModel && panel && dataUrl
        ? { panelId: panel.id, dataUrl, imageAspect: aspect, fit, name: file?.name }
        : null
    const prev = emitted.current
    const same =
      prev === next ||
      (prev !== null &&
        next !== null &&
        prev.panelId === next.panelId &&
        prev.dataUrl === next.dataUrl &&
        prev.aspect === next.imageAspect &&
        prev.fit === next.fit &&
        prev.name === next.name)
    if (same) return
    emitted.current = next ? { panelId: next.panelId, dataUrl: next.dataUrl, aspect: next.imageAspect, fit: next.fit, name: next.name } : null
    onPlacement(next)
  }, [onPlacement, onModel, panel?.id, dataUrl, aspect, fit, file?.name])

  async function pick(next: File | null) {
    setError('')
    setSavedRef(null)
    setOnModel(false)
    if (!next) return
    if (!panel) {
      setError(
        panels.length === 0
          ? 'This structure is a formed shell, not a folded blank, so there are no flat panels to check artwork against.'
          : 'The model is still starting, so the panel size is not known yet.',
      )
      return
    }
    try {
      const bytes = new Uint8Array(await next.arrayBuffer())
      const found = inspectArtwork(bytes)
      const verdict = evaluateArtwork(found, {
        widthMm: panel.widthMm,
        heightMm: panel.heightMm,
        label: panel.label.toLowerCase(),
      })
      setMeta(found)
      setReport(verdict)
      setFile(next)
      setAspect(found.widthPx && found.heightPx ? found.widthPx / found.heightPx : 1)
      const reader = new FileReader()
      const asData = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => resolve('')
        reader.readAsDataURL(next)
      })
      setDataUrl(asData || null)
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(next)
      })
      setOnModel(IMAGE_FORMATS.has(found.format))
    } catch {
      setError('That file could not be read. Try exporting a fresh PDF or PNG from your design tool.')
    }
  }

  async function save() {
    if (!file || !panel) return
    setBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.set('file', file)
      body.set('panelWidthMm', String(panel.widthMm))
      body.set('panelHeightMm', String(panel.heightMm))
      body.set('panelLabel', panel.label)
      body.set('panelId', panel.id)
      body.set('structureId', structureId)
      const res = await fetch('/api/artwork', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? `The artwork could not be saved (HTTP ${res.status}).`)
        return
      }
      setSavedRef(data.reference ?? data.id ?? null)
    } catch {
      setError('The upload did not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setFile(null)
    setMeta(null)
    setReport(null)
    setSavedRef(null)
    setOnModel(false)
    setCopied(false)
    setDataUrl(null)
    setUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    if (inputRef.current) inputRef.current.value = ''
  }

  const counts = report ? summarise(report) : null

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
          Artwork proof
        </div>
        {counts && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {counts.errors > 0 && <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-red-800">{counts.errors} blocking</span>}
            {counts.warnings > 0 && <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-900">{counts.warnings} to review</span>}
            {counts.passes > 0 && <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-900">{counts.passes} pass</span>}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.ai,.eps,.svg,.png,.jpg,.jpeg,.tif,.tiff"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />

      {!file && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border border-dashed border-[var(--line)] bg-[var(--paper-2)]/50 px-4 py-6 text-center transition hover:border-[var(--kraft-dark)]/50"
        >
          <Upload className="mx-auto h-5 w-5 text-[var(--ink-soft)]" />
          <div className="mt-2 text-[13px] font-medium">Check your artwork against this box</div>
          <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-soft)]">
            PDF, AI, EPS, SVG, PNG, JPEG or TIFF · up to 25 MB. Resolution is judged at{' '}
            {panel ? `${Math.round(panel.widthMm)} × ${Math.round(panel.heightMm)} mm` : 'the panel size'}, not at pixel size.
          </div>
        </button>
      )}

      {file && report && meta && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-[var(--line)] bg-white p-2.5">
            <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-soft)]" />
            <div className="min-w-0 flex-1">
              <div className="break-all text-[12.5px] font-medium leading-snug">{file.name}</div>
              <div className="mt-0.5 text-[11px] text-[var(--ink-soft)]">
                {meta.format.toUpperCase()} · {fmtBytes(file.size)}
                {meta.widthPx ? ` · ${meta.widthPx} × ${meta.heightPx} px` : ' · vector'}
                {report.effectiveDpi ? ` · ${Math.round(report.effectiveDpi)} dpi at final size` : ''}
              </div>
            </div>
            <button type="button" onClick={reset} className="rounded p-1 text-[var(--ink-soft)] hover:bg-[var(--paper-2)]" aria-label="Remove artwork">
              <X className="h-4 w-4" />
            </button>
          </div>

          {panels.length > 1 && (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">Panel</div>
              <div className="flex flex-wrap gap-1">
                {panels.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPanelId(p.id)
                      if (meta) {
                        setReport(
                          evaluateArtwork(meta, {
                            widthMm: p.widthMm,
                            heightMm: p.heightMm,
                            label: p.label.toLowerCase(),
                          }),
                        )
                      }
                    }}
                    className={cn(
                      'rounded-md border px-2 py-1 text-[11px] transition',
                      p.id === panel?.id
                        ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                        : 'border-[var(--line)] bg-white hover:border-[var(--ink)]/40',
                    )}
                  >
                    {p.label} · {Math.round(p.widthMm)}×{Math.round(p.heightMm)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ul className="space-y-1.5">
            {report.findings.map((f) => {
              const s = SEVERITY[f.severity]
              const Icon = s.icon
              return (
                <li key={f.id} className="flex gap-2 rounded-lg border border-[var(--line)] bg-white p-2.5">
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', s.tone)} />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium leading-snug">{f.title}</div>
                    <div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">{f.detail}</div>
                    {f.fix && (
                      <div className="mt-1 text-[11.5px] leading-relaxed">
                        <span className="font-medium">Fix: </span>
                        {f.fix}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {IMAGE_FORMATS.has(meta.format) ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOnModel((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition',
                  onModel ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-[var(--line)] bg-white hover:border-[var(--ink)]/40',
                )}
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                {onModel ? 'On the box' : 'Show on the box'}
              </button>
              {onModel && (
                <div className="flex gap-1">
                  {(['contain', 'cover'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFit(f)}
                      className={cn(
                        'rounded-md border px-2 py-1 text-[11px] capitalize transition',
                        fit === f ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-[var(--line)] bg-white',
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
              {meta.format === 'pdf'
                ? 'A PDF cannot be drawn on the model here, but the check above is the one that matters — it reads the page boxes and colour build from the file itself.'
                : 'This format cannot be drawn on the model — the check above still applies to the file you sent.'}
            </p>
          )}

          <div className="rounded-lg border border-[var(--line)] bg-[var(--paper-2)]/60 p-2.5">
            {savedRef ? (
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <span className="text-[12px]">
                  Saved as <span className="font-semibold tabular">{savedRef}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(savedRef)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1800)
                  }}
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium underline-offset-2 hover:underline"
                >
                  <Copy className="h-3 w-3" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/quote?artwork=${savedRef}`)}
                  className="ml-auto rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[11.5px] font-medium hover:border-[var(--ink)]/40"
                >
                  Quote with this artwork
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] text-[var(--ink-soft)]">
                  {report.ready
                    ? 'Nothing blocks this file. Send it with your enquiry so the desk works from the same version.'
                    : 'Fix the blocking items above before this can go to press.'}
                </span>
                <button
                  type="button"
                  onClick={save}
                  disabled={busy}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-[11.5px] font-medium hover:border-[var(--ink)]/40 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {busy ? 'Saving…' : 'Save to enquiry'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11.5px] text-red-800">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink-soft)]">
        This is a prepress check, not an approval. It reads the file, not your intent: it cannot
        see a font that has been outlined wrongly or a colour that is legal for ink but wrong for
        your brand. A printed proof is still the only thing that settles colour.
      </p>
    </div>
  )
}
