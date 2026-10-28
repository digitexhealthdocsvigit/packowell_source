/**
 * Route slugs shared between the browser bundle and the server (sitemap).
 * Kept free of React and of `catalog.ts` so importing it server-side is cheap.
 */
export const POLICY_SLUGS = [
  'shipping',
  'returns',
  'refunds',
  'payment-terms',
  'privacy',
  'terms',
  'artwork-guide',
] as const

export type PolicySlug = (typeof POLICY_SLUGS)[number]

export const STATIC_ROUTES = [
  '/',
  '/packaging',
  '/industries',
  '/printing',
  '/branding',
  '/displays',
  '/studio',
  '/quote',
  '/sample',
  '/contact',
  '/about',
  '/portfolio',
  '/resources',
] as const
