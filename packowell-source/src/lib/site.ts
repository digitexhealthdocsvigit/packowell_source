/**
 * Single source of truth for business identity.
 *
 * These are the confirmed registration details. Anything the business has not
 * given us stays `null` and is simply not rendered, rather than being filled
 * with a plausible-looking invention — an invented GSTIN or address on a live
 * site is worse than an obvious gap.
 */

export interface PostalAddress {
  line1: string
  line2: string
  city: string
  district: string
  state: string
  postalCode: string
  country: string
}

export const address: PostalAddress = {
  line1: 'Casa Sereno B1 / 1204, Lodha Upper Thane',
  line2: 'Mankoli Road, Sarai Anjur-Sarai Road',
  city: 'Bhiwandi',
  district: 'Thane',
  state: 'Maharashtra',
  postalCode: '421302',
  country: 'India',
}

/** Address as lines, for a footer or a postal block. */
export const addressLines: string[] = [
  address.line1,
  address.line2,
  `${address.city}, ${address.district}, ${address.state} ${address.postalCode}`,
  address.country,
]

/** One-line form, for schema.org and single-line footers. */
export const addressOneLine = addressLines.join(', ')

export const site = {
  name: 'Packowell',
  /** Trading name as registered, including the studio it trades as. */
  legalName: 'Packowell (Digitex Studio)',
  tagline: 'Packaging, printing and displays that bring your brand to life',
  domain: 'packowell.com',
  url: 'https://packowell.com',
  address,
  addressLines,
  /** Convenience for the places that only want a city. */
  city: `${address.city}, ${address.state}`,
  country: address.country,
  /**
   * Derived from the confirmed domain. The business has not separately
   * confirmed this mailbox, so it is the one detail here still worth checking.
   */
  email: 'hello@packowell.com',
  phone: '+91 77159 12764',
  /** Digits only — this is what wa.me expects. */
  whatsapp: '919004962871',
  /** Display form of the WhatsApp number. */
  whatsappDisplay: '+91 90049 62871',
  gstin: '27AAAPP9753F2ZF',
  /** Not supplied by the business, so not claimed. */
  udyam: null as string | null,
  foundedYear: null as number | null,
  currency: 'INR',
  currencySymbol: '₹',
  configured: true,
  /** Shown in the footer until the owner confirms manufacturing arrangements. */
  manufacturingStatement:
    'Manufacturing is delivered through qualified production partners. We do not claim in-house presses until that capability is confirmed and listed here.',
  setupNote: '',
} as const

/** `tel:` target — no spaces or punctuation. */
export const telHref = `tel:+${site.phone.replace(/[^\d]/g, '')}`

/** `wa.me` target with an optional prefilled message. */
export const whatsappHref = (message?: string) =>
  message
    ? `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${site.whatsapp}`

export const mailHref = `mailto:${site.email}`

export const nav = [
  { label: 'Home', to: '/' },
  { label: 'Packaging', to: '/packaging' },
  { label: 'Printing', to: '/printing' },
  { label: 'Branding & Design', to: '/branding' },
  { label: 'Displays & Standees', to: '/displays' },
  { label: 'Industries', to: '/industries' },
  { label: '3D Studio', to: '/studio' },
  { label: 'Portfolio', to: '/portfolio' },
  { label: 'Resources', to: '/resources' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

export const policies = [
  { label: 'Shipping & delivery', to: '/shipping' },
  { label: 'Returns, reprints & defects', to: '/returns' },
  { label: 'Refund & cancellation', to: '/refunds' },
  { label: 'Payment terms', to: '/payment-terms' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Artwork & file preparation', to: '/artwork-guide' },
]

export const whatsappLink = (message: string) => whatsappHref(message)
