import { ArrowRight, AlertTriangle, PackageCheck } from 'lucide-react'
import { Section, Eyebrow, H2, Lede, Card, LinkButton, Notice } from '@/components/site/ui'
import { INDUSTRIES } from '@/lib/content'
import { productBySlug, familyById } from '@/lib/catalog'
import { navigate } from '@/lib/router'
import { useSeo, breadcrumbJsonLd } from '@/lib/seo'

export function IndustriesIndex() {
  useSeo({
    title: 'Industries',
    description:
      'How packaging specification changes by category: food barrier data, beauty finish durability, electronics drop testing, retail compliance, export transit strength.',
    path: '/industries',
    jsonLd: [
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Industries', path: '/industries' },
      ]),
    ],
  })

  return (
    <>
      <Section className="pb-6 sm:pb-8">
        <Eyebrow>Industries</Eyebrow>
        <H2 as="h1" className="max-w-3xl">
          The category decides the constraint, not the designer
        </H2>
        <Lede>
          Food needs barrier data before a shelf-life claim. Beauty needs a finish that survives
          transit without scuffing. Electronics needs a drop test. These pages say what actually
          governs the specification in each category — and where we will refuse to guess.
        </Lede>
      </Section>

      <Section className="pt-0 sm:pt-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((i) => (
            <Card
              key={i.slug}
              as="button"
              onClick={() => navigate(`/industries/${i.slug}`)}
              className="group flex flex-col p-5 text-left hover:-translate-y-0.5 hover:border-[var(--kraft)]/60"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--paper-2)] text-[var(--kraft-dark)]">
                  <PackageCheck className="h-4 w-4" />
                </span>
                <span className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                  {i.products.length} formats
                </span>
              </div>
              <h3 className="mt-2.5 text-[14.5px] font-semibold leading-snug group-hover:text-[var(--kraft-dark)]">
                {i.name}
              </h3>
              <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{i.short}</p>
              <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--kraft-dark)]">
                Read the constraints <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </>
  )
}

export function IndustryPage({ slug }: { slug: string }) {
  const industry = INDUSTRIES.find((i) => i.slug === slug)

  useSeo({
    title: industry ? `Packaging for ${industry.name.toLowerCase()}` : 'Industry not found',
    description: industry ? industry.intro : 'This industry page does not exist.',
    path: `/industries/${slug}`,
    noindex: !industry,
    jsonLd: industry
      ? [
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Industries', path: '/industries' },
            { name: industry.name, path: `/industries/${industry.slug}` },
          ]),
        ]
      : undefined,
  })

  if (!industry) {
    return (
      <Section>
        <H2>Industry page not found</H2>
        <Lede>The full list of categories is one page back.</Lede>
        <div className="mt-5">
          <LinkButton to="/industries">All industries</LinkButton>
        </div>
      </Section>
    )
  }

  const products = industry.products.map(productBySlug).filter(Boolean)

  return (
    <>
      <Section className="pb-6 sm:pb-8">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
          <button type="button" onClick={() => navigate('/')} className="hover:text-[var(--ink)]">
            Home
          </button>
          <span>/</span>
          <button type="button" onClick={() => navigate('/industries')} className="hover:text-[var(--ink)]">
            Industries
          </button>
          <span>/</span>
          <span className="text-[var(--ink)]">{industry.name}</span>
        </nav>
        <Eyebrow>Industry</Eyebrow>
        <h1 className="max-w-3xl font-display text-3xl leading-[1.08] tracking-tight sm:text-[2.6rem]">
          Packaging for {industry.name.toLowerCase()}
        </h1>
        <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-[var(--ink-soft)]">
          {industry.intro}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton to="/quote">
            Request a quotation <ArrowRight className="h-4 w-4" />
          </LinkButton>
          <LinkButton to="/studio" variant="outline">
            Open the 3D studio
          </LinkButton>
        </div>
      </Section>

      <Section className="pt-0 sm:pt-2">
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="p-5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5" /> What causes failures here
            </div>
            <ul className="mt-3 space-y-2.5">
              {industry.pains.map((p) => (
                <li key={p} className="flex gap-2.5 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-600" />
                  {p}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--kraft-dark)]">
              <PackageCheck className="h-3.5 w-3.5" /> Formats we quote most in this category
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {industry.makes.map((m) => (
                <span
                  key={m}
                  className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 text-[12px] text-[var(--ink-soft)]"
                >
                  {m}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
              Formats listed are the usual starting point, not a restriction. If the product needs
              something else, describe it — we would rather quote the right structure than the
              familiar one.
            </p>
          </Card>
        </div>
      </Section>

      <Section tone="alt">
        <Eyebrow>Technical notes</Eyebrow>
        <H2 className="text-2xl sm:text-3xl">What decides the specification</H2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {industry.specNotes.map((n, i) => (
            <div key={n} className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <div className="font-display text-lg text-[var(--kraft-dark)]">0{i + 1}</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{n}</p>
            </div>
          ))}
        </div>
      </Section>

      {products.length > 0 && (
        <Section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <H2 className="text-2xl sm:text-3xl">Formats to start from</H2>
            <LinkButton to="/packaging" variant="outline">
              Full catalogue <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <Card
                key={p!.slug}
                as="button"
                onClick={() => navigate(`/packaging/${familyById(p!.family).slug}/${p!.slug}`)}
                className="p-4 text-left hover:border-[var(--kraft)]/60"
              >
                <div className="text-[10.5px] uppercase tracking-[0.13em] text-[var(--ink-soft)]">
                  {familyById(p!.family).name}
                </div>
                <div className="mt-1.5 text-[13px] font-semibold leading-snug">{p!.name}</div>
                <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-[var(--ink-soft)]">
                  {p!.summary}
                </p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section tone="alt" className="py-10 sm:py-12">
        <div className="grid gap-4 sm:grid-cols-2">
          <Notice tone="warn" title="Regulatory claims are yours to confirm">
            Food contact, fire rating, child-resistance and recycling claims depend on the exact
            substrate and use. We will supply the supplier documentation we hold; we will not assert
            compliance on your behalf.
          </Notice>
          <Notice tone="info" title="Send the retailer sheet first">
            If you sell through a chain, their packaging manual overrides every preference in this
            page. Attach it to the quote request and the specification starts from there.
          </Notice>
        </div>
      </Section>

      <Section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[14px] font-semibold">Next category</div>
          <div className="flex flex-wrap gap-2">
            {INDUSTRIES.filter((i) => i.slug !== industry.slug)
              .slice(0, 5)
              .map((i) => (
                <button
                  key={i.slug}
                  type="button"
                  onClick={() => navigate(`/industries/${i.slug}`)}
                  className="rounded-lg border border-[var(--line)] bg-white/70 px-2.5 py-1.5 text-[12px] hover:border-[var(--kraft)]/60"
                >
                  {i.name}
                </button>
              ))}
          </div>
        </div>
      </Section>
    </>
  )
}
