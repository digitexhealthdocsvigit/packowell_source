/**
 * Catalogue asset manifest — the runtime view of the image library.
 *
 * This module is imported by the browser, so it carries only what the UI needs
 * to render an image safely: path, intrinsic size, alt text, what the image
 * depicts, and its approval status. The rights metadata (creator, licence,
 * verification date, attribution) lives in `catalogue-rights.ts`, which only the
 * audit script and the tests import — it never reaches a visitor's bundle.
 *
 * Only `approved` records are published. `blocked` and `unverified` records are
 * deliberately unreachable through these helpers, so an asset whose rights are
 * not established cannot appear on a page even if it is added to the data file.
 */
import { GENERATED_ASSETS } from './catalogue-assets.data'

export type AssetRole = 'thumbnail' | 'detail' | 'model'

export type ApprovalStatus = 'approved' | 'blocked' | 'unverified'

export type AssetSource = 'generated-vector' | 'generated-render' | 'commissioned' | 'stock'

export type AssetFormat = 'svg' | 'webp' | 'png' | 'avif'

export interface CatalogueAsset {
  /** Stable id, `<productSlug>-<role>`. */
  id: string
  productId: string
  role: AssetRole
  /** Path relative to `public/`, e.g. `catalogue/roll-end-mailer-thumbnail.svg`. */
  path: string
  /** Intrinsic dimensions, emitted as width/height so the grid cannot shift. */
  width: number
  height: number
  bytes: number
  format: AssetFormat
  alt: string
  /** What the image shows, so the UI can label it honestly. */
  depicts: string
  approvalStatus: ApprovalStatus
}

/** Backwards-compatible alias used by the audit and tests. */
export type AssetRecord = CatalogueAsset

export const MANIFEST: CatalogueAsset[] = GENERATED_ASSETS

const published = (a: CatalogueAsset) => a.approvalStatus === 'approved'

export const publishedAssetsFor = (productId: string): CatalogueAsset[] =>
  MANIFEST.filter((a) => a.productId === productId && published(a))

export const thumbnailFor = (productId: string): CatalogueAsset | undefined =>
  publishedAssetsFor(productId).find((a) => a.role === 'thumbnail')

export const detailViewsFor = (productId: string): CatalogueAsset[] =>
  publishedAssetsFor(productId).filter((a) => a.role !== 'thumbnail')

export const modelRenderFor = (productId: string): CatalogueAsset | undefined =>
  publishedAssetsFor(productId).find((a) => a.role === 'model')

/** Coverage, used by the audit and the tests. */
export const coverage = () => {
  const withThumb = new Set(
    MANIFEST.filter((a) => a.role === 'thumbnail' && published(a)).map((a) => a.productId),
  )
  const withDetail = new Set(
    MANIFEST.filter((a) => a.role !== 'thumbnail' && published(a)).map((a) => a.productId),
  )
  return { thumbnails: withThumb.size, details: withDetail.size, records: MANIFEST.length }
}
