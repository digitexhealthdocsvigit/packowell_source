import { ArrowRight, Check, ChevronLeft, Loader2, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Section, Eyebrow, H2, Lede, LinkButton, Notice, SpecRow } from '@/components/site/ui'
import { ModelPreview } from '@/components/studio/ModelPreview'
import { PRODUCTS, productBySlug } from '@/lib/catalog'
import { STRUCTURES, STRUCTURE_BY_ID } from '@/lib/geometry/structures'
import { navigate, goBack, useQuery } from '@/lib/router'
import { site } from '@/lib/site'
import { cn } from '@/lib/cn'
import { useSeo } from '@/lib/seo'
import { useMarket } from '@/lib/market/context'
import { countriesByRegion } from '@/lib/market/countries'
import { postalRule, validatePostal } from '@/lib/market/postal'
import { CONVERSION_DISCLAIMER } from '@/lib/market/fx'

type Kind = 'quote' | 'sample' | 'contact'

const TITLES: Record<Kind, { eyebrow: string; h: string; lede: string; submit: string }> = {
  quote: {
    eyebrow: 'Quotation request',
    h: 'Send the specification',
    lede:
      'Five things decide a packaging price: structure, dimensions, board grade, quantity and finishing. Tell us those and the quote is a calculation, not a guess.',
    submit: 'Send quotation request',
  },
  sample: {
    eyebrow: 'Sample request',
    h: 'Ask for a sample first',
    lede:
      'Samples are the approval step that a preview cannot replace. Tell us which structure and size, and how many units you need to evaluate.',
    submit: 'Send sample request',
  },
  contact: {
    eyebrow: 'Contact',
    h: 'Ask a question',
    lede:
      'Anything that is not a straight quote — a structure you cannot find, a compliance sheet to check, an existing order, or a supplier questionnaire.',
    submit: 'Send message',
  },
}

const inputBase =
  'w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-[13.5px] outline-none transition placeholder:text-[var(--ink-soft)]/60 focus:border-[var(--kraft)] focus:ring-2 focus:ring-[var(--kraft)]/15'

export function QuotePage({ kind = 'quote' as Kind }: { kind?: Kind }) {
  const query = useQuery()
  const initialProduct = query.get('product') ?? ''
  const initialStructure = query.get('structure') ?? ''
  const initialDims =
    query.get('dims') ??
    (() => {
      const l = query.get('l')
      const w = query.get('w')
      const h = query.get('h')
      return l && w && h ? `${l} × ${w} × ${h} mm` : ''
    })()
  const initialBoard = query.get('board') ?? ''
  const initialFinishing = query.get('fin') ?? ''
  const initialFoil = query.get('foil') ?? ''
  const artworkRef = query.get('artwork') ?? ''
  const copy = TITLES[kind]

  useSeo({
    title:
      kind === 'quote' ? 'Request a quotation' : kind === 'sample' ? 'Request a sample' : 'Contact',
    description: copy.lede,
    path: kind === 'quote' ? '/quote' : `/${kind}`,
  })

  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    city: '',
    destination: '',
    postalCode: '',
    productSlug: initialProduct,
    structureId: initialStructure,
    quantity: '',
    dimensions: initialDims,
    board: initialBoard,
    finishing: initialFinishing,
    foil: initialFoil,
    printing: '',
    deliveryRequirements: '',
    message: '',
    website: '',
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const [reference, setReference] = useState<string | null>(null)

  useEffect(() => {
    setForm((f) => ({ ...f, productSlug: initialProduct, structureId: initialStructure }))
  }, [initialProduct, initialStructure])

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const market = useMarket()
  const rule = postalRule(market.country)
  const postalCheck = validatePostal(market.country, form.postalCode)
  const postalError = form.postalCode.length > 0 && !postalCheck.ok ? postalCheck.message : ''
  const cannotDeliver = market.destinationStatus === 'not-served'
  const productBlocked = (() => {
    if (!form.productSlug) return null
    const ruleForProduct = market.productRule(form.productSlug)
    return ruleForProduct && !ruleForProduct.available ? ruleForProduct : null
  })()

  const product = form.productSlug ? productBySlug(form.productSlug) : undefined

  const spec = useMemo(() => {
    if (form.structureId && STRUCTURE_BY_ID[form.structureId]) return STRUCTURE_BY_ID[form.structureId]
    if (product?.structureId) return STRUCTURE_BY_ID[product.structureId]
    return undefined
  }, [form.structureId, product])


  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.name.trim().length < 2) return setError('Please give a name we can put on the quote.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      return setError('That email address does not look valid — it is how the quote reaches you.')
    }
    if (cannotDeliver) {
      return setError(`We do not deliver to ${market.countryName} yet, so this cannot be submitted. Nothing was sent.`)
    }
    if (!postalCheck.ok) {
      return setError(`${rule.label}: ${postalCheck.message}`)
    }
    if (productBlocked) {
      return setError(
        `That format is not offered for ${market.countryName}. Ask us and we will suggest an alternative.`,
      )
    }
    if (kind === 'quote' && !form.productSlug && !form.structureId && form.message.trim().length < 10) {
      return setError('Pick a format or describe what you need, otherwise we cannot quote it.')
    }
    if (kind === 'contact' && form.message.trim().length < 10) {
      return setError('Please add a sentence or two of detail.')
    }

    setStatus('sending')
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          ...form,
          postalCode: postalCheck.ok ? postalCheck.value : form.postalCode,
          country: market.country,
          currency: market.currency,
          source: window.location.pathname + window.location.search,
          artworkRef: artworkRef || undefined,
          payload: spec
            ? {
                structureName: spec.name,
                boards: spec.boards.map((b) => `${b.label} (${b.spec})`),
              }
            : undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? `Could not send that (HTTP ${res.status}).`)
        setStatus('error')
        return
      }
      setReference(body.reference ?? null)
      setStatus('sent')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('Network error — nothing was sent. Please try again, or email us directly.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <Section>
        <div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-9">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-700">
            <Check className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-display text-2xl tracking-tight sm:text-3xl">Received.</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">
            {reference ? (
              <>
                Your reference is <strong className="text-[var(--ink)]">{reference}</strong>. Quote it
                in any follow-up so the thread stays together.
              </>
            ) : (
              'Your enquiry is logged.'
            )}{' '}
            The production desk reads {kind === 'quote' ? 'quotation requests' : 'these'} in the order
            they arrive, and comes back with written questions if the specification is incomplete.
          </p>
          <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
              Saved with the enquiry
            </div>
            <dl className="mt-1.5">
              <SpecRow k="Type" v={kind === 'quote' ? 'Quotation' : kind === 'sample' ? 'Sample' : 'Message'} />
              <SpecRow k="Name" v={form.name} />
              <SpecRow k="Email" v={form.email} />
              <SpecRow k="Delivery country" v={`${market.countryName} (${market.country})`} />
              <SpecRow k="Quotation currency" v={market.currency} />
              {postalCheck.ok && postalCheck.value && <SpecRow k={rule.label} v={postalCheck.value} />}
              {product && <SpecRow k="Format" v={product.name} />}
              {form.dimensions && <SpecRow k="Dimensions" v={form.dimensions} />}
              {form.quantity && <SpecRow k="Quantity" v={form.quantity} />}
            </dl>
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <LinkButton to="/packaging" variant="outline">
              Back to the catalogue
            </LinkButton>
            <LinkButton to="/studio">Open the studio</LinkButton>
          </div>
          <p className="mt-4 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
            Nothing is charged and no order is placed by this form. A quote is a written offer; it
            becomes an order only when you accept it in writing.
          </p>
        </div>
      </Section>
    )
  }

  return (
    <>
      <Section className="pb-6 sm:pb-8">
        <div className="mb-3">
          <button
            type="button"
            onClick={() => goBack('/quote')}
            className="inline-flex items-center gap-1 text-[12px] text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <H2 as="h1" className="max-w-3xl">
          {copy.h}
        </H2>
        <Lede className="max-w-2xl">{copy.lede}</Lede>
      </Section>

      <Section className="pt-0 sm:pt-2">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <form onSubmit={submit} className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
            <fieldset className="space-y-3.5" disabled={status === 'sending'}>
              <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                1 · Who is asking
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" required>
                  <input
                    className={inputBase}
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    autoComplete="name"
                    placeholder="Asha Rao"
                  />
                </Field>
                <Field label="Company">
                  <input
                    className={inputBase}
                    value={form.company}
                    onChange={(e) => set('company', e.target.value)}
                    autoComplete="organization"
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Email" required>
                  <input
                    className={inputBase}
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    className={inputBase}
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    autoComplete="tel"
                    placeholder="Optional"
                  />
                </Field>
                <Field label="City">
                  <input
                    className={inputBase}
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    autoComplete="address-level2"
                    placeholder="Where it is made or stored"
                  />
                </Field>
                <Field
                  label="Delivery country"
                  hint="Sets the currency, the postal format and whether we can serve the address."
                >
                  <select
                    className={inputBase}
                    value={market.country}
                    onChange={(e) => market.setCountry(e.target.value)}
                    autoComplete="country"
                  >
                    {countriesByRegion().map((group) => (
                      <optgroup key={group.region} label={group.region}>
                        {group.countries.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.currency})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <Field label="Delivery city or address">
                  <input
                    className={inputBase}
                    value={form.destination}
                    onChange={(e) => set('destination', e.target.value)}
                    placeholder="City, state or full address"
                  />
                </Field>
                <Field
                  label={rule.label}
                  hint={postalError || rule.hint}
                  required={rule.required}
                >
                  <input
                    className={cn(inputBase, postalError && 'border-red-400')}
                    value={form.postalCode}
                    onChange={(e) => set('postalCode', e.target.value.toUpperCase().slice(0, 20))}
                    inputMode={market.country === 'US' || market.country === 'DE' ? 'numeric' : 'text'}
                    autoComplete="postal-code"
                    placeholder={
                      market.country === 'IN'
                        ? '560001'
                        : market.country === 'US'
                          ? '10001'
                          : market.country === 'GB'
                            ? 'SW1A 1AA'
                            : market.country === 'DE'
                              ? '10115'
                              : market.country === 'AE'
                                ? 'P.O. Box 1234'
                                : ''
                    }
                    aria-invalid={Boolean(postalError)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
                    <span>
                      Quotation currency:{' '}
                      <strong className="text-[var(--ink)]">{market.currency}</strong>
                      {market.currencyPinned ? ' (chosen)' : ` — default for ${market.countryName}`}
                      {!market.localSupported && (
                        <> · {market.localCurrency} is not a currency we quote in, so {market.currency} is shown instead</>
                      )}
                    </span>
                    {market.currencyPinned && (
                      <button
                        type="button"
                        onClick={() => market.setCurrency(null)}
                        className="underline underline-offset-2"
                      >
                        Use the {market.countryName} default
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {cannotDeliver && (
                <Notice tone="warn" title={`We do not deliver to ${market.countryName}`}>
                  You can still read the site, but this form will not submit. Write to {site.email} if you are
                  arranging your own freight or collection.
                </Notice>
              )}
              {productBlocked && (
                <Notice tone="warn" title={`${product?.name ?? 'That format'} is not offered for ${market.countryName}`}>
                  Change the delivery country or the format, or ask us and we will suggest an alternative.
                </Notice>
              )}

            </fieldset>

            <div className="my-5 h-px bg-[var(--line)]" />

            {artworkRef && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] leading-relaxed text-emerald-900">
                Artwork <span className="font-semibold tabular">{artworkRef}</span> is attached to
                this request — the file that was checked, not a description of it. Mention any
                change you have made since the check, because the desk will work from that version.
              </div>
            )}

            <fieldset className="space-y-3.5" disabled={status === 'sending'}>
              <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                2 · What you need
              </legend>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Catalogue format">
                  <select
                    className={inputBase}
                    value={form.productSlug}
                    onChange={(e) => {
                      set('productSlug', e.target.value)
                      const p = productBySlug(e.target.value)
                      set('structureId', p?.structureId ?? '')
                    }}
                  >
                    <option value="">Not sure / other</option>
                    {PRODUCTS.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Structure">
                  <select
                    className={inputBase}
                    value={form.structureId}
                    onChange={(e) => set('structureId', e.target.value)}
                  >
                    <option value="">Decide with us</option>
                    {STRUCTURES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Dimensions (L × W × H)">
                  <input
                    className={inputBase}
                    value={form.dimensions}
                    onChange={(e) => set('dimensions', e.target.value)}
                    placeholder="200 × 150 × 80 mm"
                  />
                </Field>

                <Field label="Quantity">
                  <input
                    className={inputBase}
                    value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)}
                    placeholder="500 units"
                    inputMode="numeric"
                  />
                </Field>

                <Field label="Board / material">
                  <input
                    className={inputBase}
                    value={form.board}
                    onChange={(e) => set('board', e.target.value)}
                    placeholder={spec ? spec.boards[0]?.label : 'E-flute, 350 GSM, 12 micron BOPP…'}
                  />
                </Field>

                <Field label="Finishing">
                  <input
                    className={inputBase}
                    value={form.finishing}
                    onChange={(e) => set('finishing', e.target.value)}
                    placeholder="Matte lamination, spot UV…"
                  />
                </Field>

                <Field label="Printing">
                  <input
                    className={inputBase}
                    value={form.printing}
                    onChange={(e) => set('printing', e.target.value)}
                    placeholder={
                      product?.finishing?.[0] ?? 'Digital CMYK, 1-colour flexo, no print…'
                    }
                  />
                </Field>

                <Field label="Foil stamping" hint="Leave blank if not required.">
                  <input
                    className={inputBase}
                    value={form.foil}
                    onChange={(e) => set('foil', e.target.value)}
                    placeholder="No foil, gold, silver, holographic…"
                  />
                </Field>
              </div>

              <Field
                label="Delivery requirements"
                hint="Deadline, split shipments, labelling or barcode rules, customs documents, Incoterms."
              >
                <textarea
                  className={`${inputBase} min-h-[72px] resize-y`}
                  value={form.deliveryRequirements}
                  onChange={(e) => set('deliveryRequirements', e.target.value)}
                  placeholder={
                    market.country === 'IN'
                      ? 'e.g. deliver to two warehouses in Bengaluru by 20 Nov.'
                      : `e.g. DAP ${market.countryName}, palletised, 12 cartons per pallet, commercial invoice required.`
                  }
                />
              </Field>

              <Field
                label={kind === 'quote' ? 'Anything else about the job' : 'Your message'}
                hint={
                  kind === 'quote'
                    ? 'Artwork status, retailer requirements, delivery deadline, or what the product is.'
                    : undefined
                }
                required={kind === 'contact'}
              >
                <textarea
                  className={`${inputBase} min-h-[110px] resize-y`}
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  placeholder={
                    kind === 'quote'
                      ? 'e.g. 400 g coffee bags with a valve, artwork ready, needs to be shelf-stable for 9 months.'
                      : 'Tell us what you need.'
                  }
                />
              </Field>

              {/* Honeypot — hidden from people, irresistible to bots. */}
              <div className="hidden" aria-hidden="true">
                <label>
                  Website
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => set('website', e.target.value)}
                  />
                </label>
              </div>
            </fieldset>

            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 text-[14px] font-semibold text-[#faf8f5] transition hover:bg-[var(--kraft-dark)] disabled:opacity-60 sm:w-auto"
            >
              {status === 'sending' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  {copy.submit} <Send className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
              This sends an enquiry, not an order. No payment is taken and no production slot is
              booked. See the{' '}
              <button
                type="button"
                onClick={() => navigate('/privacy')}
                className="underline underline-offset-2"
              >
                privacy notice
              </button>{' '}
              for what happens to the details.
            </p>
          </form>

          <aside className="lg:sticky lg:top-24">
            {spec ? (
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-b from-[#efe9e1] to-[#e4dbcf]">
                <ModelPreview spec={spec} open={0.18} className="h-[240px] w-full sm:h-[280px]" />
                <div className="border-t border-[var(--line)] bg-white/75 px-4 py-3">
                  <div className="text-[13px] font-semibold">{spec.name}</div>
                  <div className="mt-0.5 text-[11.5px] text-[var(--ink-soft)]">
                    {spec.boards.length} board option{spec.boards.length === 1 ? '' : 's'} ·{' '}
                    {spec.status === 'validated-geometry'
                      ? 'validated geometry'
                      : 'concept preview — not approved for production'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-5">
                <div className="text-[13px] font-semibold">No structure selected yet</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
                  Pick a catalogue format or a structure and the live model appears here. If you do
                  not know which structure fits, leave it blank and describe the product instead —
                  that is a normal way to start.
                </p>
                <LinkButton to="/studio" variant="outline" className="mt-4">
                  Browse structures <ArrowRight className="h-3.5 w-3.5" />
                </LinkButton>
              </div>
            )}

            <div className="mt-4 space-y-3">
              <Notice tone="info" title="What happens next">
                A written quote with unit price, MOQ, tooling (if any), lead time and the assumptions
                behind the number. If something is unconfirmed, the quote says so rather than
                estimating quietly.
              </Notice>
              <Notice tone="warn" title="No published rates yet">
                Online pricing is being switched on only once the rate table is approved. Until then
                every price comes from a written quote.
              </Notice>

              <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4 text-[12px] leading-relaxed text-[var(--ink-soft)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
                  What this quotation will not include
                </div>
                <ul className="mt-1.5 space-y-1.5">
                  <li>
                    <span className="font-medium text-[var(--ink)]">Freight</span> — {market.data?.shippingNote ?? 'quoted per destination once the packed volume is known.'}
                  </li>
                  <li>
                    <span className="font-medium text-[var(--ink)]">Duties</span> — {market.data?.dutyNote ?? 'the buyer’s responsibility unless stated on the quotation.'}
                  </li>
                  <li>
                    <span className="font-medium text-[var(--ink)]">Tax</span> — {market.data?.taxNote ?? 'depends on the destination.'}
                  </li>
                  <li>
                    <span className="font-medium text-[var(--ink)]">Payment</span> — {market.data?.paymentNote ?? 'no online payment is taken by this site.'}
                  </li>
                </ul>
                <p className="mt-2 border-t border-[var(--line)] pt-2 text-[11px]">
                  {CONVERSION_DISCLAIMER}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white/70 p-4 text-[12px] leading-relaxed text-[var(--ink-soft)]">
              Prefer email? Write to{' '}
              <span className="font-medium text-[var(--ink)]">{site.email}</span>
              {site.configured ? '' : ' (placeholder — confirm before launch)'}.
            </div>
          </aside>
        </div>
      </Section>
    </>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-[var(--ink)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--kraft-dark)]">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-[var(--ink-soft)]">{hint}</span>}
    </label>
  )
}
