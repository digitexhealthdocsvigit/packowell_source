import { ArrowRight, Boxes, Camera, Check, Compass, FileText, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Wrench } from 'lucide-react'
import { Section, Eyebrow, H2, Lede, Card, LinkButton, Notice, SpecRow } from '@/components/site/ui'
import { ModelPreview } from '@/components/studio/ModelPreview'
import { RESOURCES, FAQS } from '@/lib/content'
import { STRUCTURES, mailerSpec } from '@/lib/geometry/structures'
import { PRODUCTS, FAMILIES } from '@/lib/catalog'
import { navigate } from '@/lib/router'
import { mailHref, site, telHref, whatsappHref } from '@/lib/site'
import { useSeo, breadcrumbJsonLd, orgJsonLd } from '@/lib/seo'

export function AboutPage() {
  useSeo({
    title: 'About',
    description:
      'How this packaging desk works: specifications before quotes, geometry before artwork, proofs before production — and what it deliberately does not claim.',
    path: '/about',
    jsonLd: [
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'About', path: '/about' },
      ]),
      orgJsonLd(),
    ],
  })

  return (
    <>
      <Section className="pb-8 sm:pb-10">
        <Eyebrow>About</Eyebrow>
        <H2 as="h1" className="max-w-3xl">
          A production desk that shows its working
        </H2>
        <Lede className="max-w-2xl">
          Most packaging sites are a gallery and a phone number. The gap that causes reprints is not
          design taste — it is that nobody wrote down the structure, the board grade and the
          tolerance before the artwork was approved. This site is built around closing that gap.
        </Lede>
      </Section>

      <Section className="pt-0 sm:pt-2">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <Compass className="h-4 w-4" />, t: 'Structure first', d: 'The box is agreed before the artwork. Changing a structure after a design is approval twice.' },
            { icon: <FileText className="h-4 w-4" />, t: 'Written, not verbal', d: 'Dimensions, board, finishing and assumptions live on one sheet that both sides can point at.' },
            { icon: <ShieldCheck className="h-4 w-4" />, t: 'No invented numbers', d: 'Prices, MOQs and lead times come from a quote — never from a plausible-looking placeholder.' },
            { icon: <Wrench className="h-4 w-4" />, t: 'Production reality', d: 'Material behaviour, tooling and transit decide what is possible. The design follows those, not the reverse.' },
          ].map((c) => (
            <Card key={c.t} className="p-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--paper-2)] text-[var(--kraft-dark)]">
                {c.icon}
              </span>
              <div className="mt-2.5 text-[13.5px] font-semibold">{c.t}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{c.d}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="alt">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>What is actually built here</Eyebrow>
            <H2 className="text-2xl sm:text-3xl">Six structures you can dimension yourself</H2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
              The 3D studio is not a gallery of rendered photographs. Each structure is a parametric
              definition: panel layout, crease positions and fold order are computed from your
              dimensions, which is why the dieline and the model cannot disagree.
            </p>
            <ul className="mt-5 space-y-2">
              {STRUCTURES.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2">
                  <span className="text-[12.5px] font-medium">{s.name}</span>
                  <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">
                    {s.boards.length} board{s.boards.length === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <LinkButton to="/studio">
                Open the studio <ArrowRight className="h-4 w-4" />
              </LinkButton>
            </div>
          </div>

          <div>
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-b from-[#efe9e1] to-[#e4dbcf]">
              <ModelPreview spec={mailerSpec} open={0.28} className="h-[280px] w-full" />
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                The catalogue behind it
              </div>
              <dl className="mt-1.5">
                <SpecRow k="Product families" v={String(FAMILIES.length)} />
                <SpecRow k="Catalogue formats" v={String(PRODUCTS.length)} />
                <SpecRow k="Parametric structures" v={String(STRUCTURES.length)} />
                <SpecRow k="Marketed services" v="Packaging, printing, branding, displays" />
              </dl>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <Eyebrow>Honest limits</Eyebrow>
            <H2 className="text-2xl sm:text-3xl">What this is not</H2>
            <ul className="mt-4 space-y-3">
              {[
                'Not a photoreal scan. Models are generated geometry — accurate in dimension, plain in surface.',
                'Not a material simulation. Board crush, crease cracking, magnet pull and barrier performance are not modelled.',
                'Not a manufacturing drawing. Exports are labelled concept preview until the production desk checks them.',
                'Not a shop. There is no online order or payment, because rates, terms and fulfilment are not approved yet.',
                'Not a claim of in-house presses. Production runs through qualified partners until stated otherwise on this site.',
              ].map((l) => (
                <li key={l} className="flex gap-3 rounded-xl border border-[var(--line)] bg-white/70 p-3.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kraft-dark)]" />
                  <span className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{l}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Eyebrow>The business record</Eyebrow>
            <H2 className="text-2xl sm:text-3xl">Details, as confirmed</H2>
            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white p-4">
              <dl>
                <SpecRow k="Trading name" v={site.name} />
                <SpecRow k="Registered entity" v={site.legalName} />
                <SpecRow
                  k="Registered office"
                  v={
                    <span className="block leading-relaxed">
                      {site.addressLines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </span>
                  }
                />
                <SpecRow k="GSTIN" v={site.gstin} />
                {site.udyam && <SpecRow k="Udyam" v={site.udyam} />}
                <SpecRow k="Currency" v={`${site.currency} (${site.currencySymbol})`} />
              </dl>
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                Manufacturing
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
                {site.manufacturingStatement}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="alt">
        <Eyebrow>Questions</Eyebrow>
        <H2 className="text-2xl sm:text-3xl">Answered plainly</H2>
        <div className="mt-5 grid gap-2.5 lg:grid-cols-2">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-xl border border-[var(--line)] bg-white p-4">
              <summary className="cursor-pointer list-none text-[13.5px] font-semibold">{f.q}</summary>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section className="py-10 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-[14px] font-semibold">Talk to the desk</div>
          <div className="flex flex-wrap gap-2.5">
            <LinkButton to="/contact">
              Contact <ArrowRight className="h-4 w-4" />
            </LinkButton>
            <LinkButton to="/quote" variant="outline">
              Request a quotation
            </LinkButton>
          </div>
        </div>
      </Section>
    </>
  )
}

export function ContactPage() {
  useSeo({
    title: 'Contact',
    description:
      'Contact the packaging desk for quotations, samples, artwork checks or supplier questionnaires.',
    path: '/contact',
    jsonLd: [
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Contact', path: '/contact' },
      ]),
      {
        '@type': 'ContactPage',
        name: `Contact ${site.name}`,
        description: 'Quotation requests, samples, artwork checks and general enquiries.',
      },
    ],
  })

  return (
    <>
      <Section className="pb-6 sm:pb-8">
        <Eyebrow>Contact</Eyebrow>
        <H2 as="h1" className="max-w-3xl">
          Tell us what you are trying to pack
        </H2>
        <Lede className="max-w-2xl">
          A straight question usually gets a straight answer. A quotation needs the dimensions, the
          quantity and the destination — everything else can follow.
        </Lede>
      </Section>

      <Section className="pt-0 sm:pt-2">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: <Mail className="h-4 w-4" />,
                t: 'Email',
                v: site.email,
                note: 'Quotations, artwork and general enquiries',
                href: mailHref,
              },
              {
                icon: <Phone className="h-4 w-4" />,
                t: 'Calling support',
                v: site.phone,
                note: 'Mon–Sat, 10:00–19:00 IST',
                href: telHref,
              },
              {
                icon: <MessageCircle className="h-4 w-4" />,
                t: 'WhatsApp',
                v: site.whatsappDisplay,
                note: 'Fastest for a quick question or a photo of a sample',
                href: whatsappHref('Hello Packowell, I would like to discuss packaging.'),
                external: true,
              },
              {
                icon: <FileText className="h-4 w-4" />,
                t: 'GSTIN',
                v: site.gstin,
                note: 'For invoice matching',
              },
            ].map((c) => (
              <Card key={c.t} className="p-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--paper-2)] text-[var(--kraft-dark)]">
                  {c.icon}
                </span>
                <div className="mt-2.5 text-[11px] uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                  {c.t}
                </div>
                {c.href ? (
                  <a
                    href={c.href}
                    {...(c.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                    className="mt-0.5 block text-[13.5px] font-semibold break-words underline-offset-2 hover:underline"
                  >
                    {c.v}
                  </a>
                ) : (
                  <div className="mt-0.5 text-[13.5px] font-semibold break-words">{c.v}</div>
                )}
                <div className="mt-0.5 text-[11px] text-[var(--ink-soft)]">{c.note}</div>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <div className="text-[13.5px] font-semibold">What to send for a fast quote</div>
            <ol className="mt-2.5 space-y-2">
              {[
                'What the product is, and its weight.',
                'Internal or external dimensions, in millimetres.',
                'Quantity for the first run, and expected annual volume.',
                'Where it ships to, and how (courier, pallet, sea).',
                'Artwork status — ready, in progress, or not started.',
              ].map((l, i) => (
                <li key={l} className="flex gap-2.5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
                  <span className="font-display text-[13px] text-[var(--kraft-dark)]">{i + 1}.</span>
                  {l}
                </li>
              ))}
            </ol>
            <LinkButton to="/quote" className="mt-4 w-full justify-center">
              Open the enquiry form <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </Card>
        </div>
      </Section>

      <Section tone="alt" className="py-10 sm:py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          <Notice tone="info" title="Quote requests">
            Use the quotation form — it captures the structure and dimensions in a form that can be
            priced without a second email.
          </Notice>
          <Notice tone="info" title="Artwork checks">
            Send the dieline plus the artwork. We check bleed, resolution at final size, fonts and
            colour build before anything is plated.
          </Notice>
          <Notice tone="warn" title="Urgent work">
            Say the deadline in the first line. A date that cannot be met is worth knowing before the
            job is designed, not after.
          </Notice>
        </div>
      </Section>
    </>
  )
}

export function PortfolioPage() {
  useSeo({
    title: 'Work & case studies',
    description:
      'Structure breakdowns and specification walkthroughs. Client case studies are published only with written permission.',
    path: '/portfolio',
    jsonLd: [
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Portfolio', path: '/portfolio' },
      ]),
    ],
  })

  return (
    <>
      <Section className="pb-6 sm:pb-8">
        <Eyebrow>Work</Eyebrow>
        <H2 as="h1" className="max-w-3xl">
          Work we can show, and work we cannot
        </H2>
        <Lede className="max-w-2xl">
          Packaging is confidential by nature: a pack photographed before launch is a competitor’s
          head start. Case studies appear here only with written client permission — which means this
          page starts with the work that needs no permission: the structures themselves.
        </Lede>
      </Section>

      <Section className="pt-0 sm:pt-2">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STRUCTURES.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <ModelPreview spec={s} open={0.15} className="h-[190px] w-full" />
              <div className="p-4">
                <div className="text-[13.5px] font-semibold">{s.name}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-soft)]">{s.tagline}</p>
                <button
                  type="button"
                  onClick={() => navigate(`/studio?structure=${s.id}`)}
                  className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--kraft-dark)]"
                >
                  Open in studio <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="alt">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <Eyebrow>On request</Eyebrow>
            <H2 className="text-2xl sm:text-3xl">What we can send privately</H2>
            <ul className="mt-4 space-y-2.5">
              {[
                'Structure breakdowns for a format close to yours, with board and finishing.',
                'Physical samples of a stock structure at your dimensions, on request.',
                'Prepress notes for a job similar to yours — what went wrong and how it was fixed.',
                'A written reference list, shared on a call rather than published unilaterally.',
              ].map((l) => (
                <li key={l} className="flex gap-3 rounded-xl border border-[var(--line)] bg-white/70 p-3.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kraft-dark)]" />
                  <span className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{l}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <LinkButton to="/sample">
                Request a sample <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton to="/contact" variant="outline">
                Ask for references
              </LinkButton>
            </div>
          </div>

          <div className="space-y-3">
            <Notice tone="warn" title="No testimonial is published without a name on it">
              A quote from “a leading FMCG brand” is decoration. Either a client agrees to be named,
              or the case study waits — there is no third option used here.
            </Notice>
            <Notice tone="info" title="Images will be credited and labelled">
              Where a case study is published, it states the structure, the material, the constraint
              that made it hard, and who did the work — including partner production where that is
              the case.
            </Notice>
            <Card className="p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                <Camera className="h-3.5 w-3.5" /> Status
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
                Case studies: {0} published, pending client permission. Structure walkthroughs:{' '}
                {STRUCTURES.length} live in the studio.
              </p>
            </Card>
          </div>
        </div>
      </Section>
    </>
  )
}

export function ResourcesIndex() {
  useSeo({
    title: 'Resources',
    description:
      'Practical notes on board grades, artwork preparation, rigid versus folding cartons, low-MOQ economics and designing packaging for transit.',
    path: '/resources',
    jsonLd: [
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Resources', path: '/resources' },
      ]),
      {
        '@type': 'CollectionPage',
        name: 'Packaging resources',
        description: 'Technical notes from the production side of packaging.',
      },
    ],
  })

  return (
    <>
      <Section className="pb-6 sm:pb-8">
        <Eyebrow>Resources</Eyebrow>
        <H2 as="h1" className="max-w-3xl">
          Notes from the production side
        </H2>
        <Lede className="max-w-2xl">
          Short, specific explanations of the decisions that cause reprints — written so a founder,
          a designer and a buyer can all read the same page and agree on what to specify.
        </Lede>
      </Section>

      <Section className="pt-0 sm:pt-2">
        <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {RESOURCES.map((r) => (
            <button
              key={r.slug}
              type="button"
              onClick={() => navigate(`/resources/${r.slug}`)}
              className="group grid w-full gap-2 py-5 text-left sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
            >
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--kraft-dark)]">
                  {r.category} · {r.readMinutes} min read
                </div>
                <div className="mt-1 text-[15px] font-semibold group-hover:text-[var(--kraft-dark)]">
                  {r.title}
                </div>
                <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
                  {r.summary}
                </p>
              </div>
              <ArrowRight className="hidden h-4 w-4 text-[var(--ink-soft)] transition group-hover:translate-x-0.5 sm:block" />
            </button>
          ))}
        </div>
      </Section>

      <Section tone="alt" className="py-10 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[14px] font-semibold">Have a question the notes do not answer?</div>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              Specific questions get specific answers — that is what the contact form is for.
            </p>
          </div>
          <LinkButton to="/contact" variant="outline">
            Ask it <ArrowRight className="h-4 w-4" />
          </LinkButton>
        </div>
      </Section>
    </>
  )
}

export function ResourcePage({ slug }: { slug: string }) {
  const resource = RESOURCES.find((r) => r.slug === slug)

  useSeo({
    title: resource ? resource.title : 'Resource not found',
    description: resource ? resource.summary : 'This resource does not exist.',
    path: `/resources/${slug}`,
    noindex: !resource,
    jsonLd: resource
      ? [
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Resources', path: '/resources' },
            { name: resource.title, path: `/resources/${resource.slug}` },
          ]),
          {
            '@type': 'TechArticle',
            headline: resource.title,
            description: resource.summary,
            articleSection: resource.category,
          },
        ]
      : undefined,
  })

  if (!resource) {
    return (
      <Section>
        <H2>Note not found</H2>
        <Lede>All the published notes are listed on the resources page.</Lede>
        <div className="mt-5">
          <LinkButton to="/resources">All resources</LinkButton>
        </div>
      </Section>
    )
  }

  const others = RESOURCES.filter((r) => r.slug !== resource.slug)

  return (
    <>
      <Section className="pb-4 sm:pb-6">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
          <button type="button" onClick={() => navigate('/resources')} className="hover:text-[var(--ink)]">
            Resources
          </button>
          <span>/</span>
          <span className="text-[var(--ink)]">{resource.category}</span>
        </nav>
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--kraft-dark)]">
          {resource.category} · {resource.readMinutes} min read
        </div>
        <h1 className="mt-2 max-w-3xl font-display text-3xl leading-[1.1] tracking-tight sm:text-[2.5rem]">
          {resource.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--ink-soft)]">
          {resource.summary}
        </p>
      </Section>

      <Section className="pt-2 sm:pt-4">
        <div className="grid gap-10 lg:grid-cols-[1fr_250px] lg:items-start">
          <article className="max-w-2xl space-y-7">
            {resource.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="text-[17px] font-semibold tracking-tight">{s.heading}</h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">{s.body}</p>
              </section>
            ))}
            <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <div className="text-[13.5px] font-semibold">Applying this to your job</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
                {resource.slug === 'artwork-file-preparation'
                  ? 'The studio checks artwork against the exact panel it will print on: resolution at final size, proportion, bleed, colour build and transparency. Upload the file and the findings come back before anything is quoted.'
                  : 'The studio lets you set dimensions and board grade and see the structure change. It is the fastest way to check whether a format will work before asking for a quote.'}
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2.5">
                <LinkButton to="/studio">
                  {resource.slug === 'artwork-file-preparation' ? 'Check your artwork' : 'Open the studio'}{' '}
                  <ArrowRight className="h-3.5 w-3.5" />
                </LinkButton>
                <LinkButton to="/quote" variant="outline">
                  Request a quotation
                </LinkButton>
              </div>
            </div>
          </article>

          <aside className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                <Boxes className="h-3.5 w-3.5" /> More notes
              </div>
              <ul className="mt-2.5 space-y-1.5">
                {others.map((r) => (
                  <li key={r.slug}>
                    <button
                      type="button"
                      onClick={() => navigate(`/resources/${r.slug}`)}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-[12px] leading-snug text-[var(--ink-soft)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
                    >
                      {r.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </Section>
    </>
  )
}

export function NotFoundPage() {
  useSeo({
    title: 'Page not found',
    description: 'That page does not exist.',
    path: '/404',
    noindex: true,
  })

  return (
    <Section>
      <div className="mx-auto max-w-lg text-center">
        <div className="font-display text-5xl text-[var(--kraft-dark)]">404</div>
        <H2 as="h1" className="mt-3">
          That page is not here
        </H2>
        <Lede>
          The link may be out of date, or the page may not be published yet. The catalogue and the
          studio are the two places worth being.
        </Lede>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <LinkButton to="/packaging">Catalogue</LinkButton>
          <LinkButton to="/studio" variant="outline">
            Studio
          </LinkButton>
          <LinkButton to="/contact" variant="outline">
            Contact
          </LinkButton>
        </div>
      </div>
    </Section>
  )
}
