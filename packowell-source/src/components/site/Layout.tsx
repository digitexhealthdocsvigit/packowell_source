import { useState, type ReactNode } from 'react'
import { Menu, X, ChevronDown, ArrowRight, MapPin, Phone, Mail, MessageCircle, FileText } from 'lucide-react'
import { addressLines, mailHref, nav, policies, site, telHref, whatsappHref } from '@/lib/site'
import { navigate, usePathname } from '@/lib/router'
import { MarketSelector } from '@/components/site/MarketSelector'
import { cn } from '@/lib/cn'

const PRIMARY = ['/packaging', '/printing', '/branding', '/displays', '/industries', '/studio']

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppWidget />
    </div>
  )
}

function Header() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const [more, setMore] = useState(false)
  const primary = nav.filter((n) => PRIMARY.includes(n.to))
  const moreItems = nav.filter((n) => !PRIMARY.includes(n.to) && n.to !== '/')

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--paper)]/92 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5"
          aria-label={`${site.name} home`}
        >
          <img
            src="/assets/packowell-logo@420w.webp"
            alt=""
            width={420}
            height={133}
            className="h-8 w-auto max-w-none shrink-0 sm:h-10"
          />
          {!site.configured && (
            <span className="hidden rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--ink-soft)] sm:inline">
              demo
            </span>
          )}
        </button>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {primary.map((item) => (
            <button
              key={item.to}
              type="button"
              onClick={() => navigate(item.to)}
              className={cn(
                'rounded-lg px-2.5 py-2 text-[13px] font-medium transition',
                path === item.to
                  ? 'text-[var(--ink)]'
                  : 'text-[var(--ink-soft)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]',
              )}
            >
              {item.label}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMore((v) => !v)}
              onBlur={() => window.setTimeout(() => setMore(false), 160)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-[13px] font-medium text-[var(--ink-soft)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
            >
              More <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {more && (
              <div className="absolute right-0 top-full mt-1 w-52 overflow-hidden rounded-xl border border-[var(--line)] bg-white p-1 shadow-lg">
                {moreItems.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => {
                      setMore(false)
                      navigate(item.to)
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-[var(--ink-soft)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <MarketSelector />
          <button
            type="button"
            onClick={() => navigate('/quote')}
            className="hidden rounded-xl bg-[var(--ink)] px-4 py-2.5 text-[13px] font-semibold text-[#faf8f5] transition hover:bg-[var(--kraft-dark)] sm:inline-flex"
          >
            Get a quote
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--line)] lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--line)] bg-[var(--paper)] px-4 pb-5 pt-2 lg:hidden">
          <div className="grid gap-0.5">
            {nav.map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate(item.to)
                }}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-[14px]',
                  path === item.to ? 'bg-[var(--paper-2)] font-semibold' : 'text-[var(--ink-soft)]',
                )}
              >
                {item.label}
                <ArrowRight className="h-3.5 w-3.5 opacity-40" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              navigate('/quote')
            }}
            className="mt-3 w-full rounded-xl bg-[var(--ink)] px-4 py-3 text-[14px] font-semibold text-[#faf8f5]"
          >
            Get a quote
          </button>
        </div>
      )}
    </header>
  )
}

function Footer() {
  const waMessage = 'Hello Packowell, I would like to discuss packaging.'
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--ink)] px-4 py-12 text-[#e8e2d9] sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/packowell-icon-180.png"
              alt=""
              width={180}
              height={180}
              className="h-8 w-8 shrink-0"
            />
            <span className="text-[15px] font-semibold text-white">{site.name}</span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[#b9b1a6]">
            {site.tagline}. Packaging, commercial print, brand identity and retail display — made in
            India, quoted for delivery in India and by export enquiry.
          </p>
          <p className="mt-4 text-[12px] leading-relaxed text-[#8f887e]">{site.manufacturingStatement}</p>
        </div>

        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f887e]">Catalogue</div>
          <ul className="space-y-1.5 text-[13px]">
            {nav.slice(1, 7).map((item) => (
              <li key={item.to}>
                <button type="button" onClick={() => navigate(item.to)} className="hover:text-white">
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f887e]">Company</div>
          <ul className="space-y-1.5 text-[13px]">
            {[
              { label: 'About', to: '/about' },
              { label: 'Portfolio', to: '/portfolio' },
              { label: 'Resources', to: '/resources' },
              { label: 'Contact', to: '/contact' },
              { label: 'Request a sample', to: '/sample' },
              { label: 'Get a quote', to: '/quote' },
            ].map((item) => (
              <li key={item.to}>
                <button type="button" onClick={() => navigate(item.to)} className="hover:text-white">
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f887e]">Policies</div>
          <ul className="space-y-1.5 text-[13px]">
            {policies.map((item) => (
              <li key={item.to}>
                <button type="button" onClick={() => navigate(item.to)} className="hover:text-white">
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Registered office and contact. Postal block on the left, the two
          phone numbers on the right so they are tappable on a phone. */}
      <div className="mx-auto mt-10 w-full max-w-6xl border-t border-white/10 pt-8">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f887e]">
              Registered office
            </div>
            <address className="not-italic text-[13px] leading-relaxed text-[#b9b1a6]">
              <div className="font-medium text-white">{site.legalName}</div>
              {addressLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
              <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[#8f887e]">
                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>GSTIN {site.gstin}</span>
              </div>
            </address>
          </div>

          <div>
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f887e]">
              Contact us
            </div>
            <ul className="space-y-2 text-[13px]">
              <li>
                <a
                  href={telHref}
                  className="inline-flex items-center gap-2 text-[#e8e2d9] transition-colors hover:text-white"
                >
                  <Phone className="h-4 w-4 shrink-0 text-[#8f887e]" aria-hidden="true" />
                  <span>{site.phone}</span>
                  <span className="text-[11.5px] text-[#8f887e]">Calling support</span>
                </a>
              </li>
              <li>
                <a
                  href={whatsappHref(waMessage)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-[#e8e2d9] transition-colors hover:text-white"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-[#8f887e]" aria-hidden="true" />
                  <span>{site.whatsappDisplay}</span>
                  <span className="text-[11.5px] text-[#8f887e]">WhatsApp</span>
                </a>
              </li>
              <li>
                <a
                  href={mailHref}
                  className="inline-flex items-center gap-2 text-[#e8e2d9] transition-colors hover:text-white"
                >
                  <Mail className="h-4 w-4 shrink-0 text-[#8f887e]" aria-hidden="true" />
                  <span>{site.email}</span>
                </a>
              </li>
              <li className="flex items-start gap-2 text-[12.5px] text-[#8f887e]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {site.city} · dispatch across India, export by enquiry
                </span>
              </li>
            </ul>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={whatsappHref(waMessage)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-[12.5px] font-semibold text-[#073b1d] hover:brightness-105"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Chat on WhatsApp
              </a>
              <a
                href={telHref}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[12.5px] hover:text-white"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" /> Call
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-6xl border-t border-white/10 pt-6">
        <div className="flex flex-col gap-3 text-[12px] text-[#8f887e] sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a href="/enquiries" className="underline-offset-2 hover:text-white hover:underline">
              Business inbox
            </a>
            <a href="/admin/jobs" className="underline-offset-2 hover:text-white hover:underline">
              Production
            </a>
          </div>
        </div>
        {!site.configured && site.setupNote && (
          <p className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11.5px] leading-relaxed text-[#a49c91]">
            {site.setupNote}
          </p>
        )}
      </div>
    </footer>
  )
}

/**
 * Floating WhatsApp button. Fixed to the bottom-right on every page; hidden
 * while printing so a quotation PDF does not carry a chat bubble.
 */
function WhatsAppWidget() {
  return (
    <a
      href={whatsappHref('Hello Packowell, I would like to discuss packaging.')}
      target="_blank"
      rel="noreferrer"
      aria-label={`Chat with ${site.name} on WhatsApp at ${site.whatsappDisplay}`}
      className="group fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-3.5 py-3 text-[#073b1d] shadow-lg shadow-black/20 ring-1 ring-black/5 transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kraft)] motion-reduce:transition-none print:hidden"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.46s1.06 2.85 1.2 3.05c.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.71.22 1.35.19 1.86.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35z" />
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.28-1.38a9.87 9.87 0 0 0 4.76 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.26.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23z" />
      </svg>
      <span className="hidden text-[12.5px] font-semibold sm:inline">WhatsApp</span>
    </a>
  )
}
