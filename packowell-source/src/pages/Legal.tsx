import { ArrowRight, FileText } from 'lucide-react'
import { Section, Eyebrow, H2, Lede, LinkButton, Notice } from '@/components/site/ui'
import { navigate } from '@/lib/router'
import { policies, site } from '@/lib/site'
import { useSeo, breadcrumbJsonLd } from '@/lib/seo'
import { POLICY_SLUGS } from '@/lib/slugs'

interface PolicyDoc {
  slug: string
  title: string
  summary: string
  sections: { heading: string; body: string[]; placeholder?: boolean }[]
}

const DOCS: PolicyDoc[] = [
  {
    slug: 'shipping',
    title: 'Shipping & delivery',
    summary:
      'How finished goods leave production, who arranges freight, and what happens when a consignment arrives damaged.',
    sections: [
      {
        heading: 'Where we ship',
        body: [
          'We quote delivery to a named destination — city, state and postcode. Quotes for anywhere else in the country are issued per job rather than from a published rate card.',
          'Export consignments are quoted individually: destination, Incoterms, duties and documentation are confirmed in writing before production is scheduled.',
        ],
        placeholder: true,
      },
      {
        heading: 'Lead time starts at approval, not at enquiry',
        body: [
          'Production is scheduled from the date the printed proof or physical sample is approved in writing and any advance payment has cleared. An order sitting in artwork review is not in the production queue.',
        ],
      },
      {
        heading: 'Freight and risk',
        body: [
          'Unless the quote states otherwise, freight is charged separately and is not included in the unit price. Risk passes on handover to the carrier; if you want transit insurance, say so at quotation so it can be priced in.',
        ],
        placeholder: true,
      },
      {
        heading: 'Receiving a consignment',
        body: [
          'Check the carton count against the delivery note before signing, and photograph any visible damage at the point of receipt. Damage that is discovered after the carrier has left must be reported in writing within [CLAIM WINDOW — to be confirmed] for a claim to be possible.',
        ],
        placeholder: true,
      },
    ],
  },
  {
    slug: 'returns',
    title: 'Returns, reprints & defects',
    summary:
      'What counts as a defect on a printed or converted job, how a claim is assessed, and when a reprint is the remedy.',
    sections: [
      {
        heading: 'What is a defect',
        body: [
          'A defect is a deviation from the approved proof or the approved specification: wrong stock, wrong dimensions outside the stated tolerance, a print variation that is visible in normal viewing conditions, or faulty conversion such as a die cut that will not close.',
          'It is not a defect: a colour that differs from an uncalibrated screen, a substrate texture variation within the mill’s declared range, minor registration movement within trade tolerance, or an artwork error that was present in the proof you approved.',
        ],
      },
      {
        heading: 'How to raise a claim',
        body: [
          'Report it in writing with photographs of the affected units, the delivery note reference and the quantity affected. Keep the consignment intact until the claim is assessed — material that has been used, distributed or destroyed cannot be inspected.',
        ],
        placeholder: true,
      },
      {
        heading: 'The remedy',
        body: [
          'Where a defect is confirmed, the standard remedy is a reprint of the affected quantity or a credit for it, at our option. Consequential loss — a missed launch, lost sales, third-party costs — is not covered unless it is separately agreed in writing before production.',
        ],
        placeholder: true,
      },
      {
        heading: 'Approved work is approved',
        body: [
          'Once a proof is signed off, the approved proof becomes the specification. Work that matches it is correct, including a typo or a low-resolution image that was visible in the proof. This is the reason proofs are sent.',
        ],
      },
    ],
  },
  {
    slug: 'refunds',
    title: 'Refund & cancellation',
    summary:
      'What can be cancelled, at which stage, and which costs are already committed once production starts.',
    sections: [
      {
        heading: 'Before artwork approval',
        body: [
          'A job can be cancelled with a written instruction before plates, dies or cylinders are ordered. Any prepress work already completed is chargeable at the rate stated on the quotation.',
        ],
        placeholder: true,
      },
      {
        heading: 'After tooling or material is committed',
        body: [
          'Bespoke dies, cylinders and special-order substrates are made for one job and cannot be returned to a supplier. Once they are ordered, those costs are not refundable — the quotation itemises them so this is visible before you commit.',
        ],
      },
      {
        heading: 'After production starts',
        body: [
          'A print run in progress cannot usually be stopped without losing the material already consumed. Where it can be stopped, the charge is the material consumed plus the work completed to that point.',
        ],
        placeholder: true,
      },
      {
        heading: 'Refund method',
        body: [
          'Approved refunds are returned by the original payment method. Bank charges and payment-gateway fees that have already been incurred are deducted where the processor does not return them.',
        ],
        placeholder: true,
      },
    ],
  },
  {
    slug: 'payment-terms',
    title: 'Payment terms',
    summary:
      'Advance and balance, what triggers an invoice, and which taxes appear on it.',
    sections: [
      {
        heading: 'Standard structure',
        body: [
          'New orders are typically split between an advance at order confirmation and a balance before dispatch. The exact split is stated on the quotation; nothing enters the production queue until the advance has cleared.',
        ],
        placeholder: true,
      },
      {
        heading: 'Credit terms',
        body: [
          'Credit terms are available to repeat customers by written agreement only, and are reviewed periodically. They are not implied by a previous order on credit.',
        ],
        placeholder: true,
      },
      {
        heading: 'Taxes and documentation',
        body: [
          'Invoices are raised in INR and carry GST at the rate applicable to the goods and the delivery state. Our registration details are printed on every invoice and listed in the footer of this site.',
          'Where a tax rate or registration is shown as a placeholder on this site, it is not yet confirmed and must not be relied on for accounting purposes.',
        ],
      },
      {
        heading: 'Late payment',
        body: [
          'Where an agreed credit period is exceeded, further work may be held until the account is settled. Any interest or charge for late payment is stated on the invoice terms rather than applied silently.',
        ],
        placeholder: true,
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy notice',
    summary:
      'What this site collects, why it is collected, how long it is kept, and how to have it removed.',
    sections: [
      {
        heading: 'What is collected',
        body: [
          'When you send a quotation, sample or contact request, this site stores the details you typed: name, company, email, phone, city, delivery destination, the packaging specification you configured, and your message.',
          'The page you sent it from is recorded with the enquiry so the request can be understood in context. A reference code is generated so you can refer to the enquiry later.',
          'No payment details are collected on this site, because no ordering or payment is enabled here.',
        ],
      },
      {
        heading: 'What is not done with it',
        body: [
          'Enquiry details are used to answer the enquiry, prepare a quotation and — if you become a customer — to produce and deliver the job. They are not sold, and they are not added to a marketing list without a separate, explicit opt-in.',
        ],
      },
      {
        heading: 'How long it is kept',
        body: [
          'Enquiries are retained for [RETENTION PERIOD — to be confirmed] and then deleted. Records tied to an invoice are retained for the period required by tax law, which overrides a deletion request for that specific data.',
        ],
        placeholder: true,
      },
      {
        heading: 'Who can see it',
        body: [
          'Access is limited to the people who need it to quote or produce the job. Where production is carried out by a partner, only the specification and delivery details needed for that job are shared — never a marketing list.',
        ],
        placeholder: true,
      },
      {
        heading: 'Your requests',
        body: [
          'You can ask what is held about you, ask for it to be corrected, or ask for it to be deleted by writing to ' +
            site.email +
            '. A request is actioned in writing; if data has to be kept for tax or contractual reasons, that is explained rather than silently refused.',
        ],
        placeholder: true,
      },
      {
        heading: 'Cookies and tracking',
        body: [
          'This site sets no advertising or cross-site tracking cookies. The interface stores no analytics identifiers beyond what the hosting platform records in its own access logs.',
        ],
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of use',
    summary:
      'The basis on which specifications, quotations, previews and downloads on this site may be used.',
    sections: [
      {
        heading: 'What this site is',
        body: [
          'This site publishes packaging specifications, a parametric 3D preview tool and a quotation request workflow. It is not an online shop: nothing here constitutes an order, a price commitment or a contract for supply.',
        ],
      },
      {
        heading: 'Previews and exports',
        body: [
          'Models and dielines generated here are engineering aids produced from the structural specification. They are labelled “concept preview — not approved for production” until checked by the production desk. They are not a manufacturing drawing and must not be sent to a third-party toolmaker as one.',
          'Geometry is generated; material behaviour is not simulated. Board crush, crease cracking, magnet pull, barrier performance and load-bearing capacity are not modelled.',
        ],
      },
      {
        heading: 'Quotations',
        body: [
          'A quotation is a written offer valid for the period stated on it, and is conditional on the assumptions printed with it. If the quantity, substrate, finishing or delivery destination changes, the price changes.',
        ],
        placeholder: true,
      },
      {
        heading: 'Artwork and intellectual property',
        body: [
          'You confirm that you hold the rights to any artwork, logo or likeness you send. Do not send third-party characters, trademarks or photography you are not licensed to reproduce.',
          'Artwork prepared by us remains licensed to you for the agreed job until it is paid for in full, at which point ownership transfers as stated in the engagement letter.',
        ],
        placeholder: true,
      },
      {
        heading: 'Liability',
        body: [
          'Our liability for a confirmed defect is limited to reprinting or crediting the affected quantity. Liability for consequential or indirect loss is excluded except where the law does not permit it to be excluded.',
        ],
        placeholder: true,
      },
      {
        heading: 'Governing law',
        body: [
          'These terms are governed by the laws of India, with jurisdiction in Thane, Maharashtra, where our registered office is. Confirm this with your legal adviser before relying on it.',
        ],
        placeholder: true,
      },
    ],
  },
  {
    slug: 'artwork-guide',
    title: 'Artwork & file preparation',
    summary:
      'The technical requirements for a file that prints first time: dieline, bleed, resolution, fonts and colour.',
    sections: [
      {
        heading: 'Start from the dieline, not from a rectangle',
        body: [
          'Build artwork on the dieline exported for the exact structure and dimensions. Every panel, fold and glue flap has its own safe area, and a uniform margin will put text under a crease on at least one panel.',
          'Keep the dieline on its own layer or spot colour, registered exactly to the trim. Contact us before adapting artwork from a different structure — panel widths rarely transfer cleanly.',
        ],
      },
      {
        heading: 'Bleed and safe area',
        body: [
          'Add 3 mm bleed on every trim edge unless the dieline states otherwise, and keep text and critical graphics at least 3 mm inside the trim and 5 mm clear of a fold. On a curve or a corner, allow more.',
        ],
      },
      {
        heading: 'Resolution, judged at final size',
        body: [
          'Images should be 300 DPI at the size they are placed, not at the size they were downloaded. A 300 DPI image scaled to 200% is a 150 DPI image. Large-format display graphics can go lower because they are viewed from further away — ask for the figure on your job rather than assuming.',
        ],
      },
      {
        heading: 'Fonts',
        body: [
          'Outline or embed every font. Do not rely on the supplier having the family, and do not send a Word or Canva export as final artwork — those re-flow text on import and change line breaks.',
        ],
      },
      {
        heading: 'Colour',
        body: [
          'Supply CMYK with a printed reference for anything colour-critical, or a spot colour where a brand colour must match. Keep small text in a single black rather than a four-colour build, which registration error turns fuzzy.',
          'Screens are not colour-accurate. A soft proof confirms layout; a hard proof confirms colour. If the colour matters, budget for the hard proof.',
        ],
      },
      {
        heading: 'Formats',
        body: [
          'PDF/X-4 or a packaged native file with linked images and fonts. Vector logos as AI, EPS or SVG — never a screenshot. For variable data, supply the template plus the data file with the column mapping described in writing.',
        ],
      },
      {
        heading: 'What we check before quoting',
        body: [
          'Bleed, image resolution at final size, colour build, font embedding, dieline registration and whether the panel layout matches the structure. Problems found at this stage are cheap; the same problems found at press are not.',
        ],
      },
    ],
  },
]

export function PolicyPage({ slug }: { slug: string }) {
  const doc = DOCS.find((d) => d.slug === slug)

  useSeo({
    title: doc ? doc.title : 'Policy not found',
    description: doc ? doc.summary : 'This policy page does not exist.',
    path: `/${slug}`,
    noindex: !doc,
    jsonLd: doc
      ? [
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: doc.title, path: `/${doc.slug}` },
          ]),
        ]
      : undefined,
  })

  if (!doc) {
    return (
      <Section>
        <H2>Policy page not found</H2>
        <Lede>The list of published policies is on every footer.</Lede>
        <div className="mt-5">
          <LinkButton to="/contact">Ask us directly</LinkButton>
        </div>
      </Section>
    )
  }

  const placeholderCount = doc.sections.filter((s) => s.placeholder).length

  return (
    <>
      <Section className="pb-6 sm:pb-8">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
          <button type="button" onClick={() => navigate('/')} className="hover:text-[var(--ink)]">
            Home
          </button>
          <span>/</span>
          <span className="text-[var(--ink)]">{doc.title}</span>
        </nav>
        <Eyebrow>Policy</Eyebrow>
        <H2 as="h1" className="max-w-3xl">
          {doc.title}
        </H2>
        <Lede className="max-w-2xl">{doc.summary}</Lede>
      </Section>

      <Section className="pt-0 sm:pt-2">
        <div className="grid gap-8 lg:grid-cols-[1fr_260px] lg:items-start">
          <article className="max-w-2xl">
            {placeholderCount > 0 && (
              <Notice tone="warn" title="Draft — business decisions still open">
                {placeholderCount} section{placeholderCount === 1 ? '' : 's'} below contain
                placeholders because the underlying decision (timelines, percentages, jurisdiction,
                retention) belongs to the business, not to a template. They are marked rather than
                filled with a plausible-looking number.
              </Notice>
            )}

            <div className="mt-6 space-y-7">
              {doc.sections.map((s) => (
                <section key={s.heading}>
                  <h3 className="text-[15px] font-semibold">{s.heading}</h3>
                  {s.body.map((p) => (
                    <p
                      key={p.slice(0, 40)}
                      className="mt-2 text-[13.5px] leading-relaxed text-[var(--ink-soft)]"
                    >
                      {p}
                    </p>
                  ))}
                  {s.placeholder && (
                    <p className="mt-2 inline-flex rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900">
                      Contains a placeholder — confirm before publishing
                    </p>
                  )}
                </section>
              ))}
            </div>

            <p className="mt-8 border-t border-[var(--line)] pt-4 text-[11.5px] text-[var(--ink-soft)]">
              Last reviewed: [DATE — to be confirmed]. This page is a working draft and is not legal
              advice; it should be reviewed before the site is published.
            </p>
          </article>

          <aside className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                <FileText className="h-3.5 w-3.5" /> All policies
              </div>
              <ul className="mt-2.5 space-y-1">
                {policies.map((p) => (
                  <li key={p.to}>
                    <button
                      type="button"
                      onClick={() => navigate(p.to)}
                      className={`block w-full rounded-md px-2 py-1.5 text-left text-[12.5px] transition ${
                        p.to === `/${doc.slug}`
                          ? 'bg-[var(--paper-2)] font-semibold text-[var(--ink)]'
                          : 'text-[var(--ink-soft)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--line)] bg-white/70 p-4 text-[12px] leading-relaxed text-[var(--ink-soft)]">
              Something unclear? Ask in writing instead of assuming —{' '}
              <button
                type="button"
                onClick={() => navigate('/contact')}
                className="font-medium text-[var(--kraft-dark)] underline underline-offset-2"
              >
                send a question
              </button>
              .
            </div>
          </aside>
        </div>
      </Section>
    </>
  )
}

// The slug list lives in src/lib/slugs.ts because the server builds the sitemap
// from it; keep the two in step when a policy is added.
if (DOCS.length !== POLICY_SLUGS.length) {
  console.warn('[legal] DOCS and POLICY_SLUGS disagree — the sitemap will be incomplete')
}

export { POLICY_SLUGS }
