import { Suspense, lazy, useEffect } from 'react'
import { Layout } from '@/components/site/Layout'
import { usePathname } from '@/lib/router'
import { Home } from '@/pages/Home'
import { PackagingIndex, FamilyPage } from '@/pages/Packaging'
import { ProductPage } from '@/pages/Product'
import { ServicePage } from '@/pages/Service'
import { IndustriesIndex, IndustryPage } from '@/pages/Industries'
import { QuotePage } from '@/pages/Quote'
import { AboutPage, ContactPage, PortfolioPage, ResourcesIndex, ResourcePage, NotFoundPage } from '@/pages/Company'
import { EnquiriesPage } from '@/pages/Enquiries'
import { PolicyPage, POLICY_SLUGS } from '@/pages/Legal'
import { MarketAdminPage } from '@/pages/MarketAdmin'
import { JobBoardPage } from '@/pages/JobBoard'
import { MarketProvider } from '@/lib/market/context'
import { FAMILIES, familyById, productBySlug } from '@/lib/catalog'

// The studio is the only route that needs three.js on load, so it stays out of
// the entry chunk and is fetched when someone actually opens it.
const StudioPage = lazy(() =>
  import('@/components/studio/Studio').then((m) => ({ default: m.StudioPage })),
)

function StudioFallback() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-14 sm:px-6">
      <div className="h-6 w-40 animate-pulse rounded bg-[var(--paper-2)]" />
      <div className="h-10 w-2/3 animate-pulse rounded bg-[var(--paper-2)]" />
      <div className="mt-4 aspect-[4/3] w-full animate-pulse rounded-2xl bg-[var(--paper-2)]" />
    </div>
  )
}

function route(path: string) {
  const seg = path.split('/').filter(Boolean)

  if (seg.length === 0) return <Home />

  if (seg[0] === 'packaging') {
    if (seg.length === 1) return <PackagingIndex />
    if (seg.length === 2) {
      if (FAMILIES.some((f) => f.slug === seg[1])) return <FamilyPage slug={seg[1]} />
      /* Short product URLs (e.g. /packaging/ste-carton) resolve to the product,
         so shared or legacy links never dead-end on "family does not exist". */
      const shortProduct = productBySlug(seg[1])
      if (shortProduct) {
        return (
          <ProductPage familySlug={familyById(shortProduct.family).slug} slug={shortProduct.slug} />
        )
      }
      return <FamilyPage slug={seg[1]} />
    }
    return <ProductPage familySlug={seg[1]} slug={seg[2]} />
  }

  if (seg[0] === 'printing' || seg[0] === 'branding' || seg[0] === 'displays') {
    return <ServicePage slug={seg[0]} />
  }

  if (seg[0] === 'industries') {
    if (seg.length === 1) return <IndustriesIndex />
    return <IndustryPage slug={seg[1]} />
  }

  if (seg[0] === 'studio' && seg.length === 1)
    return (
      <Suspense fallback={<StudioFallback />}>
        <StudioPage />
      </Suspense>
    )

  if (seg[0] === 'quote' && seg.length === 1) return <QuotePage kind="quote" />
  if (seg[0] === 'sample' && seg.length === 1) return <QuotePage kind="sample" />
  if (seg[0] === 'enquiries' && seg.length === 1) return <EnquiriesPage />
  if (seg[0] === 'admin' && seg[1] === 'markets' && seg.length === 2) return <MarketAdminPage />
  if (seg[0] === 'admin' && seg[1] === 'jobs' && seg.length === 2) return <JobBoardPage />

  if (seg[0] === 'contact' && seg.length === 1) return <ContactPage />
  if (seg[0] === 'about' && seg.length === 1) return <AboutPage />
  if (seg[0] === 'portfolio' && seg.length === 1) return <PortfolioPage />

  if (seg[0] === 'resources') {
    if (seg.length === 1) return <ResourcesIndex />
    return <ResourcePage slug={seg[1]} />
  }

  if (seg.length === 1 && (POLICY_SLUGS as readonly string[]).includes(seg[0]))
    return <PolicyPage slug={seg[0]} />

  return <NotFoundPage />
}

export default function App() {
  const path = usePathname()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [path])

  return (
    <MarketProvider>
      <Layout>{route(path)}</Layout>
    </MarketProvider>
  )
}
