import { ArrowRight, Boxes, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Section, Eyebrow, H2, Lede, Card, LinkButton, Pill, Notice } from '@/components/site/ui'
import { CatalogueImage } from '@/components/site/CatalogueImage'
import { FAMILIES, PRODUCTS, familyById, type FamilyId } from '@/lib/catalog'
import { navigate } from '@/lib/router'
import { site } from '@/lib/site'
import { useSeo, breadcrumbJsonLd } from '@/lib/seo'

export function PackagingIndex() {
  const [q, setQ] = useState('')
  const [active, setActive] = useState<FamilyId | 'all'>('all')

  useSeo({
    title: 'Packaging catalogue',
    description:
      'Corrugated shippers and mailers, folding cartons, rigid boxes, flexible pouches, labels, retail display and protective packaging — with materials, finishing and the limitation that matters for each format.',
    path: '/packaging',
    jsonLd: [
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Packaging', path: '/packaging' },
      ]),
      {
        '@type': 'CollectionPage',
        name: `Packaging catalogue · ${site.name}`,
        description: `${PRODUCTS.length} packaging formats across ${FAMILIES.length} families.`,
      },
    ],
  })

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return PRODUCTS.filter((p) => {
      if (active !== 'all' && p.family !== active) return false
      if (!needle) return true
      return (
        p.name.toLowerCase().includes(needle) ||
        p.summary.toLowerCase().includes(needle) ||
        p.useCases.some((u) => u.toLowerCase().includes(needle)) ||
        p.materials.some((m) => m.toLowerCase().includes(needle))
      )
    })
  }, [q, active])

  return (
    <>
      <Section className="pb-8 sm:pb-10">
        <Eyebrow>Catalogue</Eyebrow>
        <H2 as="h1" className="max-w-3xl">
          Every format, with the trade-off written down
        </H2>
        <Lede>
          Each entry lists the materials, the finishing that suits it, and the one thing most likely
          to go wrong. Formats that can be configured live in the 3D studio are marked — the rest are
          quoted from a specification.
        </Lede>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-md sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search formats…"
              className="w-full rounded-xl border border-[var(--line)] bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none focus:border-[var(--kraft)]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Pill active={active === 'all'} onClick={() => setActive('all')}>
              All {PRODUCTS.length}
            </Pill>
            {FAMILIES.map((f) => (
              <Pill key={f.id} active={active === f.id} onClick={() => setActive(f.id)}>
                {f.name}
              </Pill>
            ))}
          </div>
        </div>
      </Section>

      <Section className="pt-2 sm:pt-4">
        {results.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-8 text-center">
            <p className="text-[14px] font-semibold">Nothing matches “{q}”.</p>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[var(--ink-soft)]">
              The catalogue covers the formats we quote most often — it is not exhaustive. If the
              format is not listed, describe it in a quote request and we will tell you whether we
              can produce it.
            </p>
            <div className="mt-4 flex justify-center">
              <LinkButton to="/quote" variant="outline">
                Describe it instead <ArrowRight className="h-4 w-4" />
              </LinkButton>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p, i) => (
              <Card
                key={p.slug}
                as="button"
                onClick={() => navigate(`/packaging/${familyById(p.family).slug}/${p.slug}`)}
                className="group flex flex-col overflow-hidden p-5 hover:-translate-y-0.5 hover:border-[var(--kraft)]/60 hover:shadow-[0_18px_40px_-30px_rgba(25,22,20,0.5)]"
              >
                <div className="-mx-5 -mt-5 mb-4">
                  <CatalogueImage
                    slug={p.slug}
                    priority={i < 3}
                    className="rounded-none"
                    imgClassName="transition duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                    {familyById(p.family).name}
                  </span>
                  {p.stage === '3d-studio' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--kraft)]/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--kraft-dark)]">
                      <Boxes className="h-3 w-3" /> 3D
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-[15px] font-semibold leading-snug group-hover:text-[var(--kraft-dark)]">
                  {p.name}
                </h3>
                <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
                  {p.summary}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.materials.slice(0, 2).map((m) => (
                    <span
                      key={m}
                      className="rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[10.5px] text-[var(--ink-soft)]"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section tone="alt" className="pt-2 sm:pt-4">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-7">
          <div>
            <div className="text-[14px] font-semibold">Not seeing the format you need?</div>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--ink-soft)]">
              Bespoke structures are quoted with the die cost stated separately, so you can see what
              a custom shape actually adds.
            </p>
          </div>
          <LinkButton to="/quote">
            Send a specification <ArrowRight className="h-4 w-4" />
          </LinkButton>
        </div>
      </Section>
    </>
  )
}

export function FamilyPage({ slug }: { slug: string }) {
  const family = FAMILIES.find((f) => f.slug === slug)
  const items = family ? PRODUCTS.filter((p) => p.family === family.id) : []

  useSeo({
    title: family ? family.name : 'Family not found',
    description: family ? family.intro : 'This packaging family does not exist.',
    path: `/packaging/${slug}`,
    noindex: !family,
    jsonLd: family
      ? [
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Packaging', path: '/packaging' },
            { name: family.name, path: `/packaging/${family.slug}` },
          ]),
        ]
      : undefined,
  })

  if (!family) {
    return (
      <Section>
        <H2 as="h1">That family does not exist</H2>
        <Lede>The link may be out of date. The full catalogue is one page away.</Lede>
        <div className="mt-5">
          <LinkButton to="/packaging">Back to the catalogue</LinkButton>
        </div>
      </Section>
    )
  }

  return (
    <>
      <Section className="pb-6 sm:pb-8">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
          <button type="button" onClick={() => navigate('/')} className="hover:text-[var(--ink)]">
            Home
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => navigate('/packaging')}
            className="hover:text-[var(--ink)]"
          >
            Packaging
          </button>
          <span>/</span>
          <span className="text-[var(--ink)]">{family.name}</span>
        </nav>
        <Eyebrow>{items.length} formats</Eyebrow>
        <H2 as="h1" className="max-w-3xl">
          {family.name}
        </H2>
        <Lede className="max-w-3xl">{family.intro}</Lede>
      </Section>

      <Section className="pt-0 sm:pt-2">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p, i) => (
            <Card
              key={p.slug}
              as="button"
              onClick={() => navigate(`/packaging/${family.slug}/${p.slug}`)}
              className="group flex flex-col overflow-hidden p-5 hover:-translate-y-0.5 hover:border-[var(--kraft)]/60"
            >
              <div className="-mx-5 -mt-5 mb-4">
                <CatalogueImage
                  slug={p.slug}
                  priority={i < 3}
                  className="rounded-none"
                  imgClassName="transition duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                  {p.useCases[0]}
                </span>
                {p.stage === '3d-studio' && (
                  <span className="rounded-full bg-[var(--kraft)]/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--kraft-dark)]">
                    3D
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-[15px] font-semibold leading-snug group-hover:text-[var(--kraft-dark)]">
                {p.name}
              </h3>
              <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
                {p.summary}
              </p>
              <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--kraft-dark)]">
                Specification <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="alt" className="pt-0 sm:pt-2">
        <div className="grid gap-4 lg:grid-cols-2">
          <Notice tone="info" title="What a family page does not tell you">
            Two formats in the same family can differ by a factor of three in unit cost, because
            tooling, board grade and hand assembly differ. The unit price comes from the quote, not
            from the catalogue.
          </Notice>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3">
            <div className="text-[13px] font-medium">Other families with configurable geometry</div>
            <div className="flex flex-wrap gap-1.5">
              {FAMILIES.filter((f) => f.id !== family.id)
                .slice(0, 4)
                .map((f) => (
                  <Pill key={f.id} onClick={() => navigate(`/packaging/${f.slug}`)}>
                    {f.name}
                  </Pill>
                ))}
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
