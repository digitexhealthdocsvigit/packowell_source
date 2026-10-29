/**
 * Schema.org builders for the configurator.
 *
 * Honesty rules encoded here:
 *  - Offers are emitted ONLY when real tier prices exist. A `Product` with a
 *    fabricated `offers` block is worse than a `Product` with none.
 *  - A `3DModel` node is emitted only when there is an actual model URL to
 *    fetch. We do not publish a 3DModel pointing at nothing.
 */

export type PriceTier = { quantity: number; unitPrice: number }

export type ProductSchemaInput = {
  name: string
  slug: string
  description?: string
  url: string
  images?: string[]
  brand?: string
  material?: string
  structure?: string
  dimsMm?: { l: number; w: number; h: number }
  currency?: string
  tiers?: PriceTier[]
  modelUrl?: string
  sku?: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function buildProductSchema(input: ProductSchemaInput): Record<string, unknown> {
  const product: Record<string, unknown> = {
    '@type': 'Product',
    name: input.name,
    sku: input.sku ?? input.slug,
    url: input.url,
  }

  if (input.description) product.description = input.description
  if (input.brand) product.brand = { '@type': 'Brand', name: input.brand }
  if (input.images?.length) product.image = input.images
  if (input.material) product.material = input.material

  const props: Record<string, unknown>[] = []
  if (input.dimsMm) {
    const { l, w, h } = input.dimsMm
    props.push(
      { '@type': 'PropertyValue', name: 'Length', value: round2(l), unitCode: 'MMT' },
      { '@type': 'PropertyValue', name: 'Width', value: round2(w), unitCode: 'MMT' },
      { '@type': 'PropertyValue', name: 'Height', value: round2(h), unitCode: 'MMT' },
    )
  }
  if (input.structure) {
    props.push({ '@type': 'PropertyValue', name: 'Structure', value: input.structure })
  }
  if (props.length) product.additionalProperty = props

  const tiers = (input.tiers ?? []).filter((t) => Number.isFinite(t.unitPrice) && t.unitPrice > 0)
  if (tiers.length > 0) {
    const currency = input.currency ?? 'INR'
    const prices = tiers.map((t) => round2(t.unitPrice))
    const sorted = [...tiers].sort((a, b) => a.quantity - b.quantity)

    product.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: currency,
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: sorted.length,
      offers: sorted.map((t) => ({
        '@type': 'Offer',
        price: round2(t.unitPrice),
        priceCurrency: currency,
        eligibleQuantity: { '@type': 'QuantitativeValue', value: t.quantity, unitText: 'unit' },
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: round2(t.unitPrice),
          priceCurrency: currency,
          unitText: 'per unit',
          eligibleQuantity: { '@type': 'QuantitativeValue', value: t.quantity, unitText: 'unit' },
        },
      })),
    }
  }

  const graph: Record<string, unknown>[] = [product]

  if (input.modelUrl) {
    graph.push({
      '@type': '3DModel',
      name: `${input.name} — 3D model`,
      contentUrl: input.modelUrl,
      encodingFormat: 'model/gltf-binary',
      isPartOf: { '@type': 'Product', name: input.name, url: input.url },
    })
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}
