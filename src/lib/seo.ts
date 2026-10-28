import { useEffect } from 'react'
import { site } from './site'

export interface SeoInput {
  title: string
  description: string
  path: string
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
  noindex?: boolean
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

const JSONLD_ID = 'page-jsonld'
const OG_IMAGE_PATH = '/assets/packowell-og.png'
const OG_IMAGE_ALT =
  'Packowell — packaging, printing and retail displays, with the Packowell logo and packowell.com'

/**
 * Absolute URLs are only emitted once the domain is real. `packowell.com` is
 * confirmed, so this is true; the guard stays so a future placeholder cannot
 * leak `https://[...]/…` into a canonical tag or an `@id`.
 */
const URL_CONFIRMED = !site.url.includes('[')
const absolute = (path: string): string | undefined =>
  URL_CONFIRMED ? `${site.url}${path}` : undefined

/**
 * Per-route metadata + structured data.
 *
 * NOTE: this app is served as a client-rendered SPA by the current runtime, so
 * crawlers that do not execute JavaScript will only see the shell HTML. The
 * metadata below is correct and will be picked up by crawlers that render JS
 * (and by every social/link preview service that does). Real SSR is documented
 * as a migration item in docs/STATUS.md — it is not claimed here.
 */
export function useSeo({ title, description, path, jsonLd, noindex }: SeoInput) {
  useEffect(() => {
    const fullTitle = title.includes(site.name) ? title : `${title} · ${site.name}`
    document.title = fullTitle
    upsertMeta('name', 'description', description)
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    const ogImage = absolute(OG_IMAGE_PATH)
    if (ogImage) {
      upsertMeta('property', 'og:image', ogImage)
      upsertMeta('property', 'og:image:type', 'image/png')
      upsertMeta('property', 'og:image:width', '1200')
      upsertMeta('property', 'og:image:height', '630')
      upsertMeta('property', 'og:image:alt', OG_IMAGE_ALT)
      upsertMeta('name', 'twitter:image', ogImage)
      upsertMeta('name', 'twitter:image:alt', OG_IMAGE_ALT)
    }
    const abs = absolute(path)
    if (abs) {
      upsertMeta('property', 'og:url', abs)
      upsertLink('canonical', abs)
    }
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')

    const existing = document.getElementById(JSONLD_ID)
    if (existing) existing.remove()
    if (jsonLd) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.id = JSONLD_ID
      script.textContent = JSON.stringify(
        Array.isArray(jsonLd) ? { '@context': 'https://schema.org', '@graph': jsonLd } : { '@context': 'https://schema.org', ...jsonLd },
      )
      document.head.appendChild(script)
    }
  }, [title, description, path, jsonLd, noindex])
}

export const orgJsonLd = () => ({
  '@type': 'Organization',
  name: site.name,
  legalName: site.configured ? site.legalName : undefined,
  url: URL_CONFIRMED ? site.url : undefined,
  description: site.tagline,
  address: site.configured
    ? {
        '@type': 'PostalAddress',
        streetAddress: `${site.address.line1}, ${site.address.line2}`,
        addressLocality: site.address.city,
        addressRegion: site.address.state,
        postalCode: site.address.postalCode,
        addressCountry: 'IN',
      }
    : undefined,
  email: site.configured ? site.email : undefined,
  telephone: site.configured ? `+${site.phone.replace(/[^\d]/g, '')}` : undefined,
  vatID: site.configured ? site.gstin : undefined,
})

export const breadcrumbJsonLd = (crumbs: { name: string; path: string }[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.name,
    item: absolute(c.path),
  })),
})

/**
 * Product structured data. Prices and offers are deliberately omitted until a
 * real price is quoted — an unavailable price must not be invented for search.
 */
export const productJsonLd = (args: {
  name: string
  description: string
  path: string
  category: string
  material?: string[]
}) => ({
  '@type': 'Product',
  name: args.name,
  description: args.description,
  category: args.category,
  brand: { '@type': 'Brand', name: site.name },
  url: absolute(args.path),
  material: args.material,
})
