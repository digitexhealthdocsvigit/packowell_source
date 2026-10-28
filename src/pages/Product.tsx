import { ArrowRight, AlertTriangle, Boxes, FileDown, Layers, Package, Ruler } from 'lucide-react'
import { Section, Eyebrow, H2, Lede, Card, LinkButton, Notice, SpecRow, Pill } from '@/components/site/ui'
import { ModelPreview } from '@/components/studio/ModelPreview'
import { CatalogueImage, AssetKindBadge } from '@/components/site/CatalogueImage'
import { detailViewsFor } from '@/lib/catalogue-assets'
import { PRODUCTS, familyById, productBySlug } from '@/lib/catalog'
import { STRUCTURE_BY_ID } from '@/lib/geometry/structures'
import { navigate } from '@/lib/router'
import { site } from '@/lib/site'
import { useSeo, breadcrumbJsonLd, productJsonLd } from '@/lib/seo'

export function ProductPage({ familySlug, slug }: { familySlug: string; slug: string }) {
  const product = productBySlug(slug)
  const family = product ? familyById(product.family) : undefined
  const spec = product?.structureId ? STRUCTURE_BY_ID[product.structureId] : undefined

  useSeo({
    title: product ? product.name : 'Format not found',
    description: product ? product.summary : 'This packaging format does not exist in the catalogue.',
    path: `/packaging/${familySlug}/${slug}`,
    noindex: !product,
    jsonLd: product
      ? [
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Packaging', path: '/packaging' },
            { name: family?.name ?? 'Family', path: `/packaging/${familySlug}` },
            { name: product.name, path: `/packaging/${familySlug}/${slug}` },
          ]),
          productJsonLd({
            name: product.name,
            description: product.summary,
            path: `/packaging/${familySlug}/${slug}`,
            category: family?.name ?? 'Packaging',
            material: product.materials,
          }),
        ]
      : undefined,
  })

  if (!product || !family) {
    return (
      <Section>
        <H2>That format is not in the catalogue</H2>
        <Lede>
          It may have been renamed. If you are looking for something specific, describe it in a
          quote request rather than hunting for it.
        </Lede>
        <div className="mt-5 flex flex-wrap gap-3">
          <LinkButton to="/packaging">Back to the catalogue</LinkButton>
          <LinkButton to="/quote" variant="outline">
            Describe it instead
          </LinkButton>
        </div>
      </Section>
    )
  }

  const related = product.related.map(productBySlug).filter(Boolean)

  return (
    <>
      <Section className="pb-8 sm:pb-10">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
          <button type="button" onClick={() => navigate('/')} className="hover:text-[var(--ink)]">
            Home
          </button>
          <span>/</span>
          <button type="button" onClick={() => navigate('/packaging')} className="hover:text-[var(--ink)]">
            Packaging
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => navigate(`/packaging/${family.slug}`)}
            className="hover:text-[var(--ink)]"
          >
            {family.name}
          </button>
          <span>/</span>
          <span className="text-[var(--ink)]">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <Eyebrow>{family.name}</Eyebrow>
            <h1 className="font-display text-3xl leading-[1.08] tracking-tight sm:text-[2.6rem]">
              {product.name}
            </h1>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-[var(--ink-soft)]">
              {product.summary}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] bg-white/70 p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--kraft-dark)]">
                  <Package className="h-3.5 w-3.5" /> Used for
                </div>
                <ul className="mt-2 space-y-1 text-[13px] text-[var(--ink-soft)]">
                  {product.useCases.map((u) => (
                    <li key={u}>· {u}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-white/70 p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--kraft-dark)]">
                  <Layers className="h-3.5 w-3.5" /> Finishing
                </div>
                <ul className="mt-2 space-y-1 text-[13px] text-[var(--ink-soft)]">
                  {product.finishing.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-300/70 bg-amber-50 p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5" /> What goes wrong
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-amber-950">{product.watchOut}</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton
                to={spec ? `/studio?structure=${spec.id}` : `/quote?product=${product.slug}`}
              >
                {spec ? 'Open in the 3D studio' : 'Request a quotation'}
                <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton to={`/quote?product=${product.slug}`} variant="outline">
                Quote this format
              </LinkButton>
            </div>
          </div>

          <div>
            <div className="relative overflow-hidden rounded-2xl border border-[var(--line)]">
              <CatalogueImage slug={product.slug} priority imgClassName="object-cover" />
              <div className="absolute left-3 top-3">
                <AssetKindBadge kind="illustration" />
              </div>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
              Illustration of the format — generated from our own structure description, not a
              photograph of a manufactured item. It shows the shape and opening style; it is not a
              manufacturing or print-readiness approval.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {detailViewsFor(product.slug).map((asset, i) => (
                <figure key={asset.id} className="overflow-hidden rounded-xl border border-[var(--line)]">
                  <CatalogueImage slug={product.slug} role="detail" index={i} className="rounded-none" />
                  <figcaption className="border-t border-[var(--line)] bg-white/70 px-2.5 py-1.5 text-[10.5px] capitalize text-[var(--ink-soft)]">
                    {asset.depicts}
                  </figcaption>
                </figure>
              ))}
            </div>

            {spec ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-b from-[#efe9e1] to-[#e4dbcf]">
                <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--kraft-dark)]">
                  <span>Live parametric model</span>
                  <AssetKindBadge kind="model" />
                </div>
                <ModelPreview spec={spec} open={0.2} className="h-[300px] w-full sm:h-[360px]" />
                <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] bg-white/70 px-4 py-2.5 text-[11.5px] text-[var(--ink-soft)]">
                  <span>
                    Parametric · {spec.boards.length} board option{spec.boards.length === 1 ? '' : 's'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--kraft-dark)]">
                    <Boxes className="h-3.5 w-3.5" /> drag to orbit
                  </span>
                </div>
              </div>
            ) : (
              <Card className="p-6">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--paper-2)] text-[var(--kraft-dark)]">
                  <Ruler className="h-5 w-5" />
                </div>
                <div className="mt-3 text-[14px] font-semibold">Quoted from a specification</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                  This format is not generated live in the studio — its geometry depends on tooling
                  or materials we cannot model honestly yet. Send the dimensions and we will come
                  back with a drawing and a price.
                </p>
                <LinkButton to={`/quote?product=${product.slug}`} variant="outline" className="mt-4">
                  Send dimensions <ArrowRight className="h-4 w-4" />
                </LinkButton>
              </Card>
            )}

            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white/70 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                <FileDown className="h-3.5 w-3.5" /> Specification summary
              </div>
              <dl>
                <SpecRow k="Family" v={family.name} />
                <SpecRow k="Materials" v={product.materials.join(', ')} />
                <SpecRow k="Finishing" v={product.finishing.join(', ')} />
                <SpecRow k="Studio" v={spec ? 'Live parametric model' : 'Quoted drawing'} />
                <SpecRow k="Unit price" v="On quotation" />
                <SpecRow k="MOQ" v="Confirmed in quote" />
              </dl>
              <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
                No price or minimum is published here because both depend on quantity, board grade and
                finishing. A number invented for this page would be wrong by the time you read it.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="alt" className="py-10 sm:py-12">
        <div className="grid gap-4 lg:grid-cols-3">
          <Notice tone="info" title="Modelled from structure, not scanned">
            The preview is generated geometry: panels, creases and dimensions are real and internally
            consistent. Surface texture, board crush and crease cracking are not simulated.
          </Notice>
          <Notice tone="info" title="Artwork is a separate approval">
            The dieline exported from the studio is the basis for artwork, and the studio can check
            a file against this exact panel before you order. Nothing goes to press on the back of a
            screen preview — a printed proof or physical sample is the approval.
          </Notice>
          <Notice tone="warn" title="Concept preview">
            Any exported drawing is labelled “concept preview — not approved for production” until it
            is checked by the production desk.
          </Notice>
        </div>
      </Section>

      {related.length > 0 && (
        <Section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>Often specified together</Eyebrow>
              <H2 className="text-2xl sm:text-3xl">Related formats</H2>
            </div>
            <Pill onClick={() => navigate(`/packaging/${family.slug}`)}>
              All {family.name.toLowerCase()} <ArrowRight className="h-3 w-3" />
            </Pill>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {related.map((r) => (
              <Card
                key={r!.slug}
                as="button"
                onClick={() => navigate(`/packaging/${familyById(r!.family).slug}/${r!.slug}`)}
                className="p-4 text-left hover:border-[var(--kraft)]/60"
              >
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                  {familyById(r!.family).name}
                </div>
                <div className="mt-1.5 text-[13.5px] font-semibold">{r!.name}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-soft)]">{r!.summary}</p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section tone="ink" className="py-10 sm:py-12">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d9a355]">
              Next step
            </div>
            <div className="mt-1.5 font-display text-2xl">
              Send dimensions, quantity and destination.
            </div>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[#b9b1a6]">
              That is enough for a written quotation for {product.name.toLowerCase()}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <LinkButton to={`/quote?product=${product.slug}`}>
              Request a quotation <ArrowRight className="h-4 w-4" />
            </LinkButton>
            <LinkButton
              to="/sample"
              variant="outline"
              className="border-white/25 text-[#f6f2ec] hover:border-white/60"
            >
              Request a sample
            </LinkButton>
          </div>
        </div>
      </Section>

      <Section className="py-8 sm:py-10">
        <div className="text-[12px] text-[var(--ink-soft)]">
          {PRODUCTS.length} formats in the catalogue · {family.name} ·{' '}
          <button type="button" onClick={() => navigate('/packaging')} className="underline underline-offset-2">
            browse everything
          </button>
          {' · '}
          <span>{site.name}</span>
        </div>
      </Section>
    </>
  )
}
