import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import { Section, Eyebrow, H2, Lede, Card, LinkButton, Notice } from '@/components/site/ui'
import { SERVICES, type Service } from '@/lib/content'
import { navigate } from '@/lib/router'
import { useSeo, breadcrumbJsonLd } from '@/lib/seo'

export function ServicePage({ slug }: { slug: string }) {
  const service = SERVICES.find((s) => s.slug === slug)

  useSeo({
    title: service ? service.name : 'Service not found',
    description: service ? service.intro : 'This service page does not exist.',
    path: `/${slug}`,
    noindex: !service,
    jsonLd: service
      ? [
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: service.name, path: `/${service.slug}` },
          ]),
          {
            '@type': 'Service',
            name: service.name,
            serviceType: service.name,
            description: service.intro,
            areaServed: 'IN',
          },
        ]
      : undefined,
  })

  if (!service) {
    return (
      <Section>
        <H2>Service not found</H2>
        <Lede>Printing, branding and displays all live under their own pages.</Lede>
        <div className="mt-5 flex flex-wrap gap-2">
          {SERVICES.map((s) => (
            <LinkButton key={s.slug} to={`/${s.slug}`} variant="outline">
              {s.name}
            </LinkButton>
          ))}
        </div>
      </Section>
    )
  }

  return <ServiceBody service={service} />
}

function ServiceBody({ service }: { service: Service }) {
  const others = SERVICES.filter((s) => s.slug !== service.slug)

  return (
    <>
      <Section className="pb-8 sm:pb-10">
        <Eyebrow>{service.eyebrow}</Eyebrow>
        <h1 className="max-w-3xl font-display text-3xl leading-[1.08] tracking-tight sm:text-[2.7rem]">
          {service.headline}
        </h1>
        <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-[var(--ink-soft)]">
          {service.intro}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton to="/quote">
            Request a quotation <ArrowRight className="h-4 w-4" />
          </LinkButton>
          <LinkButton to="/contact" variant="outline">
            Talk to the desk
          </LinkButton>
        </div>
      </Section>

      <Section className="pt-0 sm:pt-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {service.items.map((item) => (
            <Card key={item.name} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[13.5px] font-semibold leading-snug">{item.name}</div>
                {item.quoteOnly && (
                  <span className="shrink-0 rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--ink-soft)]">
                    quote
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{item.detail}</p>
            </Card>
          ))}
        </div>
        <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-[var(--ink-soft)]">
          Specifications above are the common range, not a price list. Materials, sizes and
          quantities outside those ranges are quoted per job.
        </p>
      </Section>

      <Section tone="alt">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Eyebrow>Process</Eyebrow>
            <H2 className="text-2xl sm:text-3xl">Four steps, in this order</H2>
            <Lede>
              Steps run in sequence for a reason: approving artwork before the structure is confirmed
              is the most expensive way to start a job.
            </Lede>
          </div>
          <ol className="space-y-3">
            {service.process.map((p, i) => (
              <li key={p.step} className="flex gap-4 rounded-xl border border-[var(--line)] bg-white p-4">
                <span className="font-display text-lg leading-none text-[var(--kraft-dark)]">
                  0{i + 1}
                </span>
                <div>
                  <div className="text-[13.5px] font-semibold">{p.step}</div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{p.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <Eyebrow>Technical notes</Eyebrow>
            <H2 className="text-2xl sm:text-3xl">The three things that decide quality</H2>
            <ul className="mt-5 space-y-3">
              {service.specNotes.map((n) => (
                <li key={n} className="flex gap-3 rounded-xl border border-[var(--line)] bg-white/70 p-4">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kraft-dark)]" />
                  <span className="text-[13px] leading-relaxed text-[var(--ink-soft)]">{n}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>Questions</Eyebrow>
            <H2 className="text-2xl sm:text-3xl">Asked before every job</H2>
            <div className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {service.faqs.map((f) => (
                <details key={f.q} className="group py-3.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-semibold">
                    {f.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ink-soft)] transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section tone="alt" className="py-10 sm:py-12">
        <div className="grid gap-4 sm:grid-cols-2">
          <Notice tone="info" title="Quotes are written, not estimated">
            We do not put a number on a page that depends on quantity, stock and finishing. The quote
            states the assumptions so you can see what would change the price.
          </Notice>
          <Notice tone="warn" title="Rush work is quoted separately">
            Compressing a lead time usually means changing the process, not just the schedule. We will
            say plainly whether a date is achievable before you commit.
          </Notice>
        </div>
      </Section>

      <Section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <H2 className="text-2xl sm:text-3xl">Also handled by the same desk</H2>
          <div className="flex flex-wrap gap-2">
            {others.map((s) => (
              <LinkButton key={s.slug} to={`/${s.slug}`} variant="outline">
                {s.name} <ArrowRight className="h-3.5 w-3.5" />
              </LinkButton>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {others.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => navigate(`/${s.slug}`)}
              className="rounded-2xl border border-[var(--line)] bg-white/70 p-4 text-left hover:border-[var(--kraft)]/60"
            >
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                {s.eyebrow}
              </div>
              <div className="mt-1.5 text-[13.5px] font-semibold">{s.name}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-soft)]">
                {s.items.length} services
              </p>
            </button>
          ))}
        </div>
      </Section>
    </>
  )
}
