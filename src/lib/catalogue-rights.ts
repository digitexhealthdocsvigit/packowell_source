/**
 * Catalogue asset rights register — the provenance side of the image library.
 *
 * Deliberately NOT imported by any component: this is ~100 KB of licensing
 * metadata that only the audit script and the tests need, and shipping it to
 * every visitor would be pure weight.
 *
 * Every entry must state who made the asset, on what licence basis, when that
 * was verified, and what attribution (if any) the licence requires. A
 * third-party asset without `sourceUrl` and `retrievedAt` is not approvable.
 */
import type { ApprovalStatus, AssetFormat, AssetRole, AssetSource } from './catalogue-assets'
import { GENERATED_RIGHTS } from './catalogue-rights.data'

export interface AssetRights {
  id: string
  productId: string
  role: AssetRole
  path: string
  format: AssetFormat
  source: AssetSource
  creator: string
  licence: string
  /** Required credit line; empty when none is needed. */
  attribution: string
  /** ISO date the licence basis was confirmed. */
  verifiedAt: string
  /** Set for third-party assets only. */
  sourceUrl?: string
  retrievedAt?: string
  approvalStatus: ApprovalStatus
  /** Why it is blocked, when it is. */
  blockedReason?: string
}

export const RIGHTS: AssetRights[] = GENERATED_RIGHTS

export const rightsFor = (id: string) => RIGHTS.find((r) => r.id === id)

export const isPublishable = (id: string) => rightsFor(id)?.approvalStatus === 'approved'
