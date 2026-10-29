import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRODUCTS } from '../src/lib/catalog'
import {
  MANIFEST,
  coverage,
  detailViewsFor,
  publishedAssetsFor,
  thumbnailFor,
} from '../src/lib/catalogue-assets'
import { RIGHTS } from '../src/lib/catalogue-rights'

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public')

describe('catalogue asset manifest', () => {
  it('covers every product with an approved thumbnail', () => {
    const missing = PRODUCTS.filter((p) => !thumbnailFor(p.slug)).map((p) => p.slug)
    expect(missing).toEqual([])
    expect(coverage().thumbnails).toBe(PRODUCTS.length)
  })

  it('gives every product at least one detail view', () => {
    const missing = PRODUCTS.filter((p) => detailViewsFor(p.slug).length === 0).map((p) => p.slug)
    expect(missing).toEqual([])
  })

  it('only publishes approved assets', () => {
    for (const asset of MANIFEST) {
      if (asset.approvalStatus === 'approved') continue
      expect(publishedAssetsFor(asset.productId).map((a) => a.id)).not.toContain(asset.id)
    }
  })

  it('references files that exist, with the recorded byte size', () => {
    for (const asset of MANIFEST) {
      const abs = path.join(PUBLIC, asset.path)
      expect(existsSync(abs), `${asset.path} should exist`).toBe(true)
      expect(readFileSync(abs).byteLength, `${asset.path} byte size`).toBe(asset.bytes)
    }
  })

  it('has no orphaned files on disk', () => {
    const referenced = new Set(MANIFEST.map((a) => path.basename(a.path)))
    const onDisk = readdirSync(path.join(PUBLIC, 'catalogue'))
    const orphans = onDisk.filter((f) => !referenced.has(f))
    expect(orphans).toEqual([])
  })

  it('never serves the same bytes for two different products', () => {
    const seen = new Map<string, string>()
    for (const asset of MANIFEST) {
      const digest = readFileSync(path.join(PUBLIC, asset.path)).toString('base64')
      const key = `${asset.productId}/${asset.role}`
      const prior = seen.get(digest)
      expect(prior, `${key} duplicates ${prior}`).toBeUndefined()
      seen.set(digest, key)
    }
  })

  it('declares dimensions that match the SVG viewBox', () => {
    for (const asset of MANIFEST.filter((a) => a.format === 'svg')) {
      const svg = readFileSync(path.join(PUBLIC, asset.path), 'utf8')
      const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/)
      expect(viewBox, `${asset.path} viewBox`).toBeTruthy()
      expect(Number(viewBox![1])).toBe(asset.width)
      expect(Number(viewBox![2])).toBe(asset.height)
    }
  })

  it('is well-formed XML with no unescaped ampersands', () => {
    for (const asset of MANIFEST) {
      const svg = readFileSync(path.join(PUBLIC, asset.path), 'utf8')
      // An unescaped & is the exact defect that silently broke five assets.
      const bad = svg.match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/)
      expect(bad, `${asset.path} has a raw ampersand`).toBeNull()
      expect(svg.trimEnd().endsWith('</svg>'), `${asset.path} is truncated`).toBe(true)
    }
  })

  it('carries meaningful alt text that does not claim to be a photograph', () => {
    for (const asset of MANIFEST) {
      const alt = asset.alt.toLowerCase()
      expect(asset.alt.length, `${asset.id} alt too short`).toBeGreaterThan(40)
      expect(alt, `${asset.id} must name itself an illustration`).toContain('illustration')
      // The alt must actively disclaim being a photo, not merely avoid the word.
      expect(alt, `${asset.id} must state it is not a photograph`).toContain('not a photograph')
    }
  })

  it('records a licence basis and verification date for every asset', () => {
    expect(RIGHTS.length).toBe(MANIFEST.length)
    for (const right of RIGHTS) {
      expect(right.licence.length, `${right.id} licence`).toBeGreaterThan(20)
      expect(right.creator.length, `${right.id} creator`).toBeGreaterThan(5)
      expect(right.verifiedAt, `${right.id} verifiedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      if (right.source === 'stock' || right.source === 'commissioned') {
        // Third-party assets must carry provenance, or they cannot be approved.
        expect(right.sourceUrl, `${right.id} needs a source URL`).toBeTruthy()
        expect(right.retrievedAt, `${right.id} needs a retrieval date`).toBeTruthy()
      }
    }
  })

  it('uses only original, generated assets', () => {
    const external = RIGHTS.filter((r) => r.source !== 'generated-vector' && r.source !== 'generated-render')
    expect(external.map((r) => r.id)).toEqual([])
  })

  it('keeps the rights register in step with the runtime manifest', () => {
    const manifestIds = new Set(MANIFEST.map((a) => a.id))
    const rightsIds = new Set(RIGHTS.map((r) => r.id))
    expect([...manifestIds].filter((id) => !rightsIds.has(id))).toEqual([])
    expect([...rightsIds].filter((id) => !manifestIds.has(id))).toEqual([])
    for (const asset of MANIFEST) {
      const right = RIGHTS.find((r) => r.id === asset.id)!
      expect(right.approvalStatus, `${asset.id} approval mismatch`).toBe(asset.approvalStatus)
      expect(right.path).toBe(asset.path)
    }
  })
})
