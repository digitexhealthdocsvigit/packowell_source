import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Boxes,
  Copy,
  Download,
  Eye,
  Grid2x2,
  Layers,
  Maximize2,
  RotateCcw,
  Ruler,
  ScanEye,
  Share2,
  Sparkles,
} from 'lucide-react'
import { PackagingViewer } from '@/lib/three/viewer'
import { buildStructure, validateDims } from '@/lib/geometry/build'
import { STRUCTURES, STRUCTURE_BY_ID } from '@/lib/geometry/structures'
import { blankStats, dielineSvg, downloadText, type PlacedArtwork } from '@/lib/geometry/dieline'
import { fmtLength } from '@/lib/geometry/units'
import { useMarket } from '@/lib/market/context'
import { DEFAULT_RATES, estimate, QUANTITY_TIERS, type PriceInput } from '@/lib/pricing/engine'
import { buildProductSchema, type PriceTier } from '@/lib/seo/productSchema'
import { useJsonLdSchema } from '@/hooks/useJsonLdSchema'
import { PRODUCTS, familyById } from '@/lib/catalog'
import { navigate, useQuery } from '@/lib/router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Card, Field, Notice, Pill, Section, SpecRow } from '@/components/site/ui'
import { ArtworkProof } from '@/components/studio/ArtworkProof'
import { DesignerPanel } from '@/components/studio/DesignerPanel'
import { SizePicker } from '@/components/studio/SizePicker'
import { composeToDataUrl, type DesignLayer } from '@/lib/designer/compose'
import type { LengthUnit } from '@/lib/geometry/units'
import { cn } from '@/lib/cn'

const VIEW_STATES = [
  { id: 'closed', label: 'Closed' },
  { id: 'open', label: 'Open' },
  { id: 'flat', label: 'Flat blank' },
] as const

type ViewId = (typeof VIEW_STATES)[number]['id']

export function Studio({ initialStructure }: { initialStructure?: string }) {
  const query = useQuery()
  const [structureId, setStructureId] = useState(
    () => (initialStructure && STRUCTURE_BY_ID[initialStructure] ? initialStructure : query.get('s')) || 'mailer',
  )
  const spec = STRUCTURE_BY_ID[structureId] ?? STRUCTURE_BY_ID.mailer

  const [dims, setDims] = useState(() => parseDims(query, spec))
  const [boardId, setBoardId] = useState(() => query.get('b') ?? spec.boards[0].id)
  const board = spec.boards.find((b) => b.id === boardId) ?? spec.boards[0]

  const [open, setOpen] = useState(() => clamp01(Number(query.get('o') ?? 0)))
  const [explode, setExplode] = useState(() => clamp01(Number(query.get('e') ?? 0)))
  const [xray, setXray] = useState(false)
  const [showDims, setShowDims] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(() => Number(query.get('q') ?? 100) || 100)
  const [colours, setColours] = useState(4)
  const [finishing, setFinishing] = useState('Matt lamination')
  const [foil, setFoil] = useState('No foil')
  const [unit, setUnit] = useState<LengthUnit>('mm')
  const [view2d, setView2d] = useState(false)
  const [shareMsg, setShareMsg] = useState('')

  const canvasRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<PackagingViewer | null>(null)
  const [webglError, setWebglError] = useState(false)
  const [viewerReady, setViewerReady] = useState(false)
  const [viewerInstance, setViewerInstance] = useState<PackagingViewer | null>(null)
  const [placed, setPlaced] = useState<PlacedArtwork | null>(null)
  const [layers, setLayers] = useState<DesignLayer[]>([])
  const [designPanelId, setDesignPanelId] = useState<string | null>(null)
  const [design, setDesign] = useState<PlacedArtwork | null>(null)
  // Stable identity: ArtworkProof reports placement from an effect that depends
  // on this callback, so a fresh arrow each render would re-fire it forever.
  const handlePlacement = useCallback((next: PlacedArtwork | null) => setPlaced(next), [])

  /* Design-online layers composite to one texture used by both the 2D blank and the 3D model. */
  const designPanels = useMemo(
    () =>
      viewerInstance
        ? viewerInstance.listPanels().map((p) => ({ id: p.id, label: p.label, widthMm: p.widthMm, heightMm: p.heightMm }))
        : [],
    [viewerInstance, spec.id],
  )

  useEffect(() => {
    if (!designPanelId && designPanels[0]) setDesignPanelId(designPanels[0].id)
  }, [designPanels, designPanelId])

  useEffect(() => {
    const p = designPanelId ? designPanels.find((x) => x.id === designPanelId) : null
    if (!layers.length || !p) {
      setDesign(null)
      return
    }
    const dataUrl = composeToDataUrl(layers, { width: p.widthMm, height: p.heightMm })
    setDesign(
      dataUrl
        ? { panelId: p.id, dataUrl, imageAspect: p.widthMm / p.heightMm, fit: 'contain', name: 'Design' }
        : null,
    )
  }, [layers, designPanelId, designPanels])

  const artwork = design ?? placed

  const result = useMemo(() => buildStructure(spec, dims, board), [spec, dims.l, dims.w, dims.h, board])
  const issues = useMemo(() => validateDims(spec, dims, board), [spec, dims, board])
  const flat = open < -1 // placeholder, replaced below
  void flat

  /* viewer lifecycle */
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    let viewer: PackagingViewer
    try {
      viewer = new PackagingViewer(el)
    } catch {
      setWebglError(true)
      return
    }
    viewerRef.current = viewer
    setViewerInstance(viewer)
    viewer.onSelection((id) => setSelected(id))
    setViewerReady(true)
    return () => {
      viewer.dispose()
      viewerRef.current = null
      setViewerInstance(null)
      setViewerReady(false)
    }
  }, [])

  /* rebuild when the structural configuration changes */
  useEffect(() => {
    const v = viewerRef.current
    if (!v) return
    v.setModel(spec, result)
  }, [viewerReady, spec, result])

  /* push view state */
  useEffect(() => {
    viewerRef.current?.setState({ open, explode, xray, showDims })
  }, [open, explode, xray, showDims, viewerReady])

  /* keep the URL shareable */
  useEffect(() => {
    const params = new URLSearchParams({
      s: structureId,
      l: String(Math.round(dims.l)),
      w: String(Math.round(dims.w)),
      h: String(Math.round(dims.h)),
      b: board.id,
      o: open.toFixed(2),
      e: explode.toFixed(2),
      q: String(quantity),
    })
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
  }, [structureId, dims, board.id, open, explode, quantity])

  const changeStructure = (id: string) => {
    const next = STRUCTURE_BY_ID[id]
    if (!next) return
    setStructureId(id)
    setDims(next.defaults)
    setBoardId(next.boards[0].id)
    setOpen(0)
    setExplode(0)
    setSelected(null)
  }

  const setDim = useCallback((key: 'l' | 'w' | 'h', value: number) => {
    setDims((d) => ({ ...d, [key]: Number.isFinite(value) ? value : d[key] }))
  }, [])

  const setView = (v: ViewId) => {
    if (v === 'closed') {
      setOpen(0)
      setExplode(0)
    } else if (v === 'open') {
      setOpen(1)
      setExplode(0)
    } else {
      setOpen(0)
      setExplode(0)
      // flat is a separate mode: all folds unrolled
      viewerRef.current?.setState({ flat: true, open: 1 })
      setTimeout(() => viewerRef.current?.resetCamera(), 60)
      return
    }
    viewerRef.current?.setState({ flat: false })
  }

  const activeView: ViewId | null = open >= 0.98 ? 'open' : open <= 0.02 ? 'closed' : null
  const stats = blankStats(result.panels)
  const priceInput: PriceInput = {
    structureId: spec.id,
    productSlug: PRODUCTS.find((p) => p.structureId === spec.id)?.slug ?? spec.id,
    blankAreaM2: stats.areaMm2 / 1_000_000,
    boardId: board.id,
    boardLabel: board.label,
    quantity,
    printColours: colours,
    finishes: [],
    usesDielineArea: spec.klass === 'fold',
  }
  const price = estimate(priceInput, DEFAULT_RATES)
  const market = useMarket()
  const baseCurrency = market.data?.baseCurrency ?? 'INR'
  const shown = (amount: number) => {
    const converted = market.priceOf(amount)
    return converted.ok
      ? market.format(converted.price.displayAmount)
      : market.format(amount, baseCurrency)
  }
  const unitText = price.status === 'ok' ? shown(price.priceBeforeTaxPerUnit) : ''
  const totalText = price.status === 'ok' ? shown(price.total) : ''
  const product = PRODUCTS.find((p) => p.structureId === spec.id)

  const priceKey = JSON.stringify(priceInput)
  const schemaTiers = useMemo<PriceTier[]>(() => {
    if (price.status !== 'ok') return []
    const out: PriceTier[] = []
    for (const q of QUANTITY_TIERS) {
      const r = estimate({ ...priceInput, quantity: q }, DEFAULT_RATES)
      if (r.status === 'ok') out.push({ quantity: q, unitPrice: r.priceBeforeTaxPerUnit })
    }
    return out
  }, [priceKey, price.status])

  const productSchema = useMemo(
    () =>
      buildProductSchema({
        name: product?.name ?? spec.name,
        slug: product?.slug ?? spec.id,
        url: `https://packowell.com/studio?product=${product?.slug ?? ''}&structure=${spec.id}`,
        brand: 'Packowell',
        material: board.label,
        structure: spec.name,
        dimsMm: { l: dims.l, w: dims.w, h: dims.h },
        currency: 'INR',
        tiers: schemaTiers,
      }),
    [product?.name, product?.slug, spec.id, spec.name, board.label, dims.l, dims.w, dims.h, schemaTiers],
  )

  useJsonLdSchema('packowell-product', productSchema)
  const selectedItem =
    result.panels.find((p) => p.spec.id === selected)?.spec ??
    (result.parts.find((p) => p.id === selected)
      ? { id: selected!, label: result.parts.find((p) => p.id === selected)!.label, note: result.parts.find((p) => p.id === selected)!.info }
      : null)

  const share = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setShareMsg('Link copied')
    } catch {
      setShareMsg('Copy failed — select the URL bar')
    }
    setTimeout(() => setShareMsg(''), 2400)
  }

  const slideDieline = useMemo(
    () => (result.panels.length ? dielineSvg(result, { showLabels: true, pad: 12, artwork }) : ''),
    [result, artwork],
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--kraft-dark)]">
            <Sparkles className="h-3.5 w-3.5" /> Parametric 3D studio
          </div>
          <h1 className="font-display text-2xl sm:text-3xl">Configure it. Fold it. Look inside it.</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-[var(--ink-soft)]">
            Six structures are live, drawn from their real construction — not a textured model. Change a
            dimension and the blank, the folds and the dieline all change with it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-medium">
            Template v{spec.version}
          </span>
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium',
              spec.status === 'validated-geometry'
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800',
            )}
          >
            {spec.status === 'validated-geometry' ? 'Geometry tested' : 'Concept preview'}
          </span>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        {/* ---------------- viewport ---------------- */}
        <Card className="relative overflow-hidden bg-white p-0">
          <div
            className={cn(
              'relative h-[52vh] min-h-[330px] w-full sm:h-[62vh]',
              view2d && 'invisible h-0 min-h-0 sm:h-0',
            )}
            ref={canvasRef}
          >
            {webglError && (
              <div className="absolute inset-0 grid place-items-center p-8 text-center text-[13px] text-[var(--ink-soft)]">
                WebGL is not available in this browser, so the interactive model cannot start. The
                dieline, bill of materials and specification below are still accurate.
              </div>
            )}
            {!webglError && !viewerReady && (
              <div className="absolute inset-0 grid place-items-center text-[13px] text-[var(--ink-soft)]">
                Starting the geometry engine…
              </div>
            )}
          </div>

          {view2d && (
            <div className="flex h-[52vh] min-h-[330px] w-full flex-col bg-white p-3 sm:h-[62vh]">
              {slideDieline ? (
                <>
                  <div
                    className="min-h-0 flex-1 [&>svg]:h-full [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: slideDieline }}
                  />
                  <p className="mt-2 shrink-0 text-center text-[11px] leading-snug text-[var(--ink-soft)]">
                    Flat blank — cut lines, creases and panel labels. Artwork appears on the panel it
                    was placed on. This is a drawing, not a press-ready proof.
                  </p>
                </>
              ) : (
                <div className="grid h-full place-items-center px-6 text-center text-[13px] text-[var(--ink-soft)]">
                  This structure has no flat blank to draw — it is assembled, not folded.
                </div>
              )}
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
            <div className="pointer-events-auto rounded-xl border border-[var(--line)] bg-white/90 px-3 py-2 backdrop-blur">
              <div className="text-[12.5px] font-semibold leading-tight">{spec.name}</div>
              <div className="text-[11px] text-[var(--ink-soft)]">
                {fmtLength(dims.l)} × {fmtLength(dims.w)} × {fmtLength(dims.h)} int.
              </div>
            </div>
            <div className="pointer-events-auto flex gap-1 rounded-xl border border-[var(--line)] bg-white/90 p-1 backdrop-blur">
              {VIEW_STATES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition',
                    activeView === v.id || (v.id === 'flat' && viewerRef.current?.getState().flat)
                      ? 'bg-[var(--ink)] text-white'
                      : 'text-[var(--ink-soft)] hover:bg-[var(--paper-2)]',
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {selectedItem && (
            <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-[var(--line)] bg-white/95 p-3 backdrop-blur sm:left-3 sm:right-auto sm:max-w-[260px]">
              <div className="text-[12px] font-semibold">{selectedItem.label}</div>
              {'note' in selectedItem && selectedItem.note && (
                <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-soft)]">{selectedItem.note}</div>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  viewerRef.current?.select(null)
                }}
                className="mt-1.5 text-[11px] font-medium text-[var(--kraft-dark)] underline-offset-2 hover:underline"
              >
                Clear selection
              </button>
            </div>
          )}

          <div className="border-t border-[var(--line)] bg-[var(--paper-2)]/60 px-3 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Slider label="Open" value={open} onChange={(v) => setOpen(v)} disabled={spec.klass === 'assembly' && spec.id === 'rollup'} />
              <Slider label="Explode" value={explode} onChange={(v) => setExplode(v)} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Toggle active={xray} onClick={() => setXray((v) => !v)} icon={<ScanEye className="h-3.5 w-3.5" />}>
                X-ray
              </Toggle>
              <Toggle active={view2d} onClick={() => setView2d((v) => !v)}>
                {view2d ? '3D model' : '2D blueprint'}
              </Toggle>
              <Toggle active={showDims} onClick={() => setShowDims((v) => !v)} icon={<Ruler className="h-3.5 w-3.5" />}>
                Dimensions
              </Toggle>
              <Toggle
                onClick={() => {
                  viewerRef.current?.resetCamera()
                  viewerRef.current?.setState({ flat: false })
                  viewerRef.current?.resetCamera()
                }}
                icon={<RotateCcw className="h-3.5 w-3.5" />}
              >
                Reset view
              </Toggle>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={share}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[11.5px] font-medium hover:border-[var(--ink)]/40"
                >
                  <Share2 className="h-3.5 w-3.5" /> Share config
                </button>
                {shareMsg && <span className="text-[11px] text-emerald-700">{shareMsg}</span>}
              </div>
            </div>
          </div>
        </Card>

        {/* ---------------- config panel ---------------- */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
              Structure
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STRUCTURES.map((s) => (
                <Pill key={s.id} active={s.id === structureId} onClick={() => changeStructure(s.id)}>
                  {s.name}
                </Pill>
              ))}
            </div>

            <div className="mt-4">
              <SizePicker dims={dims} unit={unit} onUnit={setUnit} onChange={setDim} />
            </div>
            {issues.length > 0 && (
              <div className="mt-2 space-y-1">
                {issues.map((i) => (
                  <div key={i.message} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11.5px] text-red-800">
                    {i.message}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3">
              <Field label="Board / substrate">
                <Select value={board.id} onValueChange={(v) => setBoardId(v)}>
                  <SelectTrigger className="h-9 text-[13px]">
                    <span>{board.label}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {spec.boards.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.label} · {b.spec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="Quantity">
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="h-9 text-[13px]"
                />
              </Field>
              <Field label="Print colours">
                <Select value={String(colours)} onValueChange={(v) => setColours(Number(v))}>
                  <SelectTrigger className="h-9 text-[13px]">
                    <span>{colours === 0 ? 'Unprinted' : `${colours} colour`}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 4, 6].map((c) => (
                      <SelectItem key={c} value={String(c)}>
                        {c === 0 ? 'Unprinted' : `${c} colour`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Finishing">
                <Select value={finishing} onValueChange={setFinishing}>
                  <SelectTrigger className="h-9 text-[13px]" aria-label="Finishing">
                    <span>{finishing}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {['None', 'Matt lamination', 'Gloss lamination', 'Soft-touch lamination', 'Spot UV'].map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Foil stamping">
                <Select value={foil} onValueChange={setFoil}>
                  <SelectTrigger className="h-9 text-[13px]" aria-label="Foil stamping">
                    <span>{foil}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {['No foil', 'Gold foil', 'Silver foil', 'Rose-gold foil', 'Holographic foil'].map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {QUANTITY_TIERS.map((q) => (
                <Pill key={q} active={quantity === q} onClick={() => setQuantity(q)}>
                  {q}
                </Pill>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                Design online
              </h3>
              <span className="rounded-full bg-[var(--paper)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">
                Mockup
              </span>
            </div>
            <DesignerPanel
              panels={designPanels}
              panelId={designPanelId}
              onPanel={setDesignPanelId}
              layers={layers}
              onChange={setLayers}
            />
            <p className="mt-3 text-[11px] leading-snug text-[var(--ink-soft)]">
              Layers added here are a design mockup composited onto the panel texture — the same image
              appears on the 2D blank and the 3D model. This is not a print file: upload finished
              artwork above for the prepress check.
            </p>
          </Card>

          <Card className="p-4">
            <ArtworkProof viewer={viewerInstance} structureId={spec.id} onPlacement={handlePlacement} />
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                What this configuration is
              </div>
              <Boxes className="h-4 w-4 text-[var(--ink-soft)]" />
            </div>
            <dl>
              <SpecRow k="Structure" v={spec.name} />
              <SpecRow k="Template" v={`v${spec.version}`} />
              <SpecRow k="Board" v={`${board.label} (${board.spec})`} />
              <SpecRow
                k="Blank area / unit"
                v={stats.areaMm2 ? `${(stats.areaMm2 / 1_000_000).toFixed(4)} m²` : 'Formed shell — no flat blank'}
              />
              <SpecRow k="Panels" v={result.panels.length || `${result.parts.length} formed parts`} />
              <SpecRow k="Internal size" v={`${Math.round(dims.l)} × ${Math.round(dims.w)} × ${Math.round(dims.h)} mm`} />
            </dl>

            <div className="mt-3">
              {price.status === 'ok' ? (
                <div className="rounded-xl bg-[var(--ink)] p-3 text-[#faf8f5]">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/60">
                      Indicative estimate
                    </div>
                    <div className="text-[10.5px] tabular text-white/50">{market.currency}</div>
                  </div>
                  <div className="mt-0.5 text-xl font-semibold tabular">
                    {unitText}
                    <span className="text-[12px] font-normal text-white/60"> / unit ex-GST</span>
                  </div>
                  <div className="mt-1 text-[11.5px] text-white/70">
                    {quantity} units ·{' '}
                    {totalText}{' '}
                    incl. GST
                  </div>
                  <p className="mt-1.5 border-t border-white/15 pt-1.5 text-[10.5px] leading-snug text-white/60">
                    {market.currency === baseCurrency
                      ? 'Indicative estimate. A written quotation is the offer.'
                      : `Converted from ${baseCurrency} at the stored rate. Indicative only — not a final payable price.`}
                  </p>
                </div>
              ) : (
                <Notice tone="warn" title="Price on quotation">
                  The rate card has not been approved yet, so this configuration is quoted rather than
                  priced. Your specification — structure, board, dimensions, quantity and blank area —
                  goes straight into the quote request.
                </Notice>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <Button
                className="h-10 w-full"
                onClick={() =>
                  navigate(
                    `/quote?product=${product?.slug ?? ''}&structure=${spec.id}&l=${Math.round(dims.l)}&w=${Math.round(dims.w)}&h=${Math.round(dims.h)}&board=${board.id}&q=${quantity}&fin=${encodeURIComponent(finishing)}&foil=${encodeURIComponent(foil)}`,
                  )
                }
              >
                Request a quotation for this box
              </Button>
              <Button
                variant="outline"
                className="h-10 w-full"
                onClick={() => {
                  const svg = dielineSvg(result, { showLabels: true, pad: 12, artwork })
                  downloadText(`${spec.id}-${Math.round(dims.l)}x${Math.round(dims.w)}x${Math.round(dims.h)}.svg`, svg, 'image/svg+xml')
                }}
              >
                <Download className="h-4 w-4" /> Download dieline (SVG)
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* ---------------- below the fold ---------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              <Grid2x2 className="h-4 w-4" /> Flat blank &amp; crease layout
            </div>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium text-amber-800">
              Concept — not for production
            </span>
          </div>
          {slideDieline ? (
            <div
              className="overflow-auto rounded-xl border border-[var(--line)] bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
              style={{ maxHeight: 360 }}
              dangerouslySetInnerHTML={{ __html: slideDieline }}
            />
          ) : (
            <p className="rounded-xl bg-[var(--paper-2)] p-3 text-[12.5px] text-[var(--ink-soft)]">
              This structure is a formed shell, not a folded blank — its panels are pulled apart in the
              exploded view instead of being laid flat.
            </p>
          )}
          <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
            Cut lines are solid, creases are dashed. The export comes from the same structural
            specification as the 3D model, so dimensions agree — but it has not been checked against a
            cutting forme, so it is a concept drawing until a template is signed off.
          </p>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold">
            <Layers className="h-4 w-4" /> Parts &amp; construction
          </div>
          <div className="space-y-1">
            {spec.parts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelected(p.id)
                  viewerRef.current?.isolate(viewerRef.current.getState().isolated === p.id ? null : p.id)
                }}
                className={cn(
                  'flex w-full items-start justify-between gap-3 rounded-lg border px-2.5 py-2 text-left transition',
                  selected === p.id
                    ? 'border-[var(--kraft)] bg-[var(--paper-2)]'
                    : 'border-transparent hover:border-[var(--line)] hover:bg-[var(--paper-2)]/60',
                )}
              >
                <span>
                  <span className="block text-[12.5px] font-medium">{p.label}</span>
                  <span className="block text-[11.5px] text-[var(--ink-soft)]">{p.info}</span>
                </span>
                <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ink-soft)]" />
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-[var(--paper-2)] p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
              Known limitations of this template
            </div>
            <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
              {spec.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {product && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3">
          <div className="text-[13px]">
            <span className="font-semibold">{product.name}</span>{' '}
            <span className="text-[var(--ink-soft)]">— full specification, materials and artwork guidance</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/packaging/${familyById(product.family).slug}/${product.slug}`)}>
            <Maximize2 className="h-3.5 w-3.5" /> Open product page
          </Button>
        </div>
      )}
    </div>
  )
}

function Slider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div className={cn(disabled && 'opacity-40')}>
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--ink-soft)]">
        <span>{label}</span>
        <span className="tabular">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--line)] accent-[var(--kraft)] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--ink)]"
      />
    </div>
  )
}

function Toggle({
  children,
  active,
  onClick,
  icon,
}: {
  children: React.ReactNode
  active?: boolean
  onClick: () => void
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition',
        active
          ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
          : 'border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--ink)]/40',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

function parseDims(query: URLSearchParams, spec: { defaults: { l: number; w: number; h: number } }) {
  const l = Number(query.get('l'))
  const w = Number(query.get('w'))
  const h = Number(query.get('h'))
  return {
    l: Number.isFinite(l) && l > 0 ? l : spec.defaults.l,
    w: Number.isFinite(w) && w > 0 ? w : spec.defaults.w,
    h: Number.isFinite(h) && h > 0 ? h : spec.defaults.h,
  }
}

export function StudioPage() {
  return (
    <>
      <Section className="!py-0">
        <Studio />
      </Section>
      <div className="border-t border-[var(--line)] bg-[var(--paper-2)] px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-[12px] leading-relaxed text-[var(--ink-soft)]">
            <strong className="font-semibold text-[var(--ink)]">How to read this:</strong> the geometry is
            computed from the structure definition, so fold angles, panel sizes and the dieline stay
            consistent with the dimensions you enter. Material behaviour — crease cracking, board crush,
            magnet pull, laminate barrier — is a physical question and is listed as a known limitation on
            each structure.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/quote')}>
            <Copy className="h-3.5 w-3.5" /> Send this to a human
          </Button>
        </div>
      </div>
    </>
  )
}
