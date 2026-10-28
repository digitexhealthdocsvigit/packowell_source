import { ArrowRight, Box, Boxes, FileDown, Layers, Ruler, Sparkles } from 'lucide-react'
import { Section, Eyebrow, H2, Lede, Card, LinkButton, Notice } from '@/components/site/ui'
import { ModelPreview } from '@/components/studio/ModelPreview'
import { FAMILIES, PRODUCTS } from '@/lib/catalog'
import { SERVICES, INDUSTRIES, RESOURCES } from '@/lib/content'
import { mailerSpec } from '@/lib/geometry/structures'
import { navigate } from '@/lib/router'
import { site } from '@/lib/site'
import { useSeo, orgJsonLd } from '@/lib/seo'

export function Home() {
  useSeo({
    title: `${site.name} — packaging, printing and retail displays`,
    description:
      'Specify packaging on screen, see it in 3D, export the dieline and send the whole specification for quotation. Corrugated, folding cartons, rigid boxes, flexible pouches, labels and retail displays.',
    path: '/',
    jsonLd: [
      orgJsonLd(),
      {
        '@type': 'WebSite',
        name: site.name,
        url: site.url,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${site.url}/packaging?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  })

  return (
    <>
      <section className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--paper)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_80%_0%,rgba(184,121,31,0.13),transparent_70%)]" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
          <div>
            <Eyebrow>Packaging · Print · Display</Eyebrow>
            <h1 className="font-display text-[2.1rem] leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              See the box before you pay for the die.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--ink-soft)] sm:text-base">
              {site.tagline}. Set the structure, dimensions and board grade, watch the panels fold,
              export the dieline, then send the exact specification for quotation — with no
              re-keying and no surprises at the proof.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <LinkButton to="/studio">
                Open the 3D studio
                <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton to="/packaging" variant="outline">
                Browse the catalogue
              </LinkButton>
            </div>
            <dl className="mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--line)] pt-5 sm:grid-cols-4">
              {[
                { k: 'Structures', v: '6' },
                { k: 'Formats', v: String(PRODUCTS.length) },
                { k: 'Families', v: String(FAMILIES.length) },
                { k: 'Dieline', v: 'SVG' },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                    {s.k}
                  </dt>
                  <dd className="mt-1 font-display text-2xl">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-gradient-to-b from-[#efe9e1] to-[#e4dbcf] shadow-[0_24px_60px_-30px_rgba(25,22,20,0.4)]">
              <div className="absolute left-3 top-3 z-10 rounded-full border border-[var(--line)] bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)] backdrop-blur">
                Live geometry
              </div>
              <ModelPreview spec={mailerSpec} open={0.22} className="h-[300px] w-full sm:h-[400px]" />
              <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-white/70 px-4 py-3 backdrop-blur">
                <div className="text-[12px] leading-tight">
                  <div className="font-semibold">Roll-end tuck mailer</div>
                  <div className="text-[var(--ink-soft)]">3-ply E-flute · parametric</div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/studio')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-2 text-[12px] font-semibold text-[#faf8f5] hover:bg-[var(--kraft-dark)]"
                >
                  Configure <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
              This is the actual generated model, not a photograph. Geometry follows the structural
              spec — it does not simulate board crush, crease cracking or magnet pull.
            </p>
          </div>
        </div>
      </section>

      <Section tone="alt">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>What we make</Eyebrow>
            <H2>Seven families, one production desk</H2>
            <Lede>
              Corrugated shippers and mailers, retail cartons, rigid presentation boxes, flexible
              pouches, labels, retail display and protective packaging — specified by people who
              know which flute survives a courier.
            </Lede>
          </div>
          <LinkButton to="/packaging" variant="outline">
            All formats <ArrowRight className="h-4 w-4" />
          </LinkButton>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FAMILIES.map((f) => {
            const count = PRODUCTS.filter((p) => p.family === f.id).length
            const studio = PRODUCTS.filter((p) => p.family === f.id && p.structureId).length
            return (
              <Card
                key={f.id}
                as="button"
                onClick={() => navigate(`/packaging/${f.slug}`)}
                className="group flex flex-col p-5 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-30px_rgba(25,22,20,0.5)]"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--paper-2)] text-[var(--kraft-dark)]">
                    <Boxes className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                    {count} formats
                  </span>
                </div>
                <h3 className="mt-3 text-[15px] font-semibold">{f.name}</h3>
                <p className="mt-1 flex-1 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                  {f.blurb}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--kraft-dark)]">
                  {studio > 0 ? `${studio} in 3D studio` : 'Quote only'}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </div>
              </Card>
            )
          })}
          <Card className="flex flex-col justify-between bg-[var(--ink)] p-5 text-[#f6f2ec]">
            <div>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <h3 className="mt-3 text-[15px] font-semibold">Not sure which structure?</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[#c3bbb0]">
                Describe the product and the transit route. We will name two structures and the
                trade-off between them, in writing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/quote')}
              className="mt-4 inline-flex items-center gap-1.5 self-start rounded-lg bg-[#faf8f5] px-3 py-2 text-[12px] font-semibold text-[var(--ink)] hover:bg-white"
            >
              Ask for a recommendation <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </Card>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <Eyebrow>The studio</Eyebrow>
            <H2>A box is a calculation, not a picture</H2>
            <Lede>
              Every model in the studio is generated from the structure definition and your
              dimensions. Change the height and the panels, the creases, the fold sequence and the
              dieline all move together — because they are the same data.
            </Lede>
            <ul className="mt-6 space-y-4">
              {[
                {
                  icon: <Ruler className="h-4 w-4" />,
                  t: 'Dimensioned, not decorated',
                  d: 'L × W × H in millimetres, board grade per family, validated against real minimums before anything renders.',
                },
                {
                  icon: <Layers className="h-4 w-4" />,
                  t: 'Fold and explode',
                  d: 'Scrub the fold open to the structural stop, or explode the parts and the panel stack separately.',
                },
                {
                  icon: <FileDown className="h-4 w-4" />,
                  t: 'Dieline that matches the model',
                  d: 'Fold everything flat and the panels land on the exact 2D die-line. Export it as SVG for the artwork desk.',
                },
              ].map((row) => (
                <li key={row.t} className="flex gap-3.5">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-white text-[var(--kraft-dark)]">
                    {row.icon}
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold">{row.t}</div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--ink-soft)]">{row.d}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <LinkButton to="/studio">
                Try it with your dimensions <ArrowRight className="h-4 w-4" />
              </LinkButton>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { title: 'Procedural core', body: 'Ships as code, a few kilobytes, adapts to any size.', icon: <Box className="h-4 w-4" /> },
              { title: 'Panel chaining', body: 'Each panel hangs off its parent at the crease — real hinge behaviour.', icon: <Layers className="h-4 w-4" /> },
              { title: 'Structural stops', body: 'Panels stop where the board would, not at an arbitrary angle.', icon: <Ruler className="h-4 w-4" /> },
              { title: 'Spec export', body: 'Dimensions, board, finish and artwork notes leave as one document.', icon: <FileDown className="h-4 w-4" /> },
            ].map((c) => (
              <Card key={c.title} className="p-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--paper-2)] text-[var(--kraft-dark)]">
                  {c.icon}
                </span>
                <div className="mt-2.5 text-[13.5px] font-semibold">{c.title}</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{c.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="ink">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d9a355]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#d9a355]" />
              Beyond the box
            </div>
            <h2 className="font-display text-3xl leading-[1.1] sm:text-4xl">
              The pack, the print and the thing it sits on in the shop
            </h2>
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-[#c3bbb0]">
              Packaging rarely ships alone. The same job usually needs cartons printed, a brand
              applied consistently, and a display that survives a shop floor.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <LinkButton to="/quote" variant="outline" className="border-white/25 text-[#f6f2ec] hover:border-white/60">
                Start a quote <ArrowRight className="h-4 w-4" />
              </LinkButton>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {SERVICES.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => navigate(`/${s.slug}`)}
                className="rounded-2xl border border-white/12 bg-white/[0.04] p-4 text-left transition hover:border-white/30 hover:bg-white/[0.07]"
              >
                <div className="text-[11px] uppercase tracking-[0.14em] text-[#8f887e]">
                  {s.eyebrow}
                </div>
                <div className="mt-1.5 text-[14px] font-semibold text-white">{s.name}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#b9b1a6]">
                  {s.items.length} services · {s.specNotes.length} technical notes
                </p>
                <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#d9a355]">
                  Read <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>How it works</Eyebrow>
            <H2>From dimensions to a production-ready spec</H2>
          </div>
          <p className="max-w-sm text-[13px] leading-relaxed text-[var(--ink-soft)]">
            The order and payment steps are switched off until rates, delivery terms and artwork
            approval are confirmed. Everything up to approved production is live.
          </p>
        </div>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: '01', t: 'Configure', d: 'Pick a structure, set L × W × H, choose the board. The preview and the dieline update together.' },
            { n: '02', t: 'Request', d: 'Send the specification with quantity, destination and any artwork you already have.' },
            { n: '03', t: 'Quotation', d: 'You get a written quote: unit price, MOQ, tooling if any, lead time and what would change the price.' },
            { n: '04', t: 'Proof, then produce', d: 'A printed proof or physical sample is approved before the run. Nothing goes to press on a screen preview.' },
          ].map((s) => (
            <li key={s.n} className="rounded-2xl border border-[var(--line)] bg-white/70 p-5">
              <div className="font-display text-xl text-[var(--kraft-dark)]">{s.n}</div>
              <div className="mt-2 text-[14px] font-semibold">{s.t}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{s.d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="alt">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Industries</Eyebrow>
            <H2>The constraints change by category</H2>
            <Lede>
              Food needs barrier data. Beauty needs a scuff-free finish. Electronics needs a drop
              test. Pick the category and read what actually decides the spec.
            </Lede>
          </div>
          <LinkButton to="/industries" variant="outline">
            All industries <ArrowRight className="h-4 w-4" />
          </LinkButton>
        </div>
        <div className="mt-8 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((i) => (
            <button
              key={i.slug}
              type="button"
              onClick={() => navigate(`/industries/${i.slug}`)}
              className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/70 px-4 py-3.5 text-left transition hover:border-[var(--kraft)]/60 hover:bg-white"
            >
              <div>
                <div className="text-[13.5px] font-semibold">{i.name}</div>
                <div className="mt-0.5 text-[12px] leading-snug text-[var(--ink-soft)]">{i.short}</div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--ink-soft)] transition group-hover:translate-x-0.5 group-hover:text-[var(--kraft-dark)]" />
            </button>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <Eyebrow>Resources</Eyebrow>
            <H2>The things that cause reprints</H2>
            <Lede>
              Written from the production side: what to specify, what to check before approval, and
              which trade-offs actually cost money.
            </Lede>
            <div className="mt-5">
              <LinkButton to="/resources" variant="outline">
                All resources <ArrowRight className="h-4 w-4" />
              </LinkButton>
            </div>
          </div>
          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {RESOURCES.map((r) => (
              <button
                key={r.slug}
                type="button"
                onClick={() => navigate(`/resources/${r.slug}`)}
                className="group flex w-full items-start justify-between gap-4 py-4 text-left"
              >
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--kraft-dark)]">
                    {r.category} · {r.readMinutes} min
                  </div>
                  <div className="mt-1 text-[14px] font-semibold group-hover:text-[var(--kraft-dark)]">
                    {r.title}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
                    {r.summary}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--ink-soft)] transition group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="alt">
        <div className="rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-10">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <Eyebrow>Next step</Eyebrow>
              <H2>Send the dimensions. Get a real number.</H2>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[var(--ink-soft)]">
                A quote request needs the product, the dimensions, the quantity and the destination.
                If you have artwork, attach it — if you do not, we will quote with the structure and
                a blank print area.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <LinkButton to="/quote">
                  Request a quotation <ArrowRight className="h-4 w-4" />
                </LinkButton>
                <LinkButton to="/sample" variant="outline">
                  Request a sample
                </LinkButton>
              </div>
            </div>
            <Notice tone="warn" title="Rates are not published">
              Online pricing is not live yet, and unit rates are deliberately not shown as if they
              were final. Nothing is invented to fill a price slot — a quote is written per job
              until the rate table is approved.
            </Notice>
          </div>
        </div>
      </Section>
    </>
  )
}
