import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createPanelGeometry, buildStructure } from '../src/lib/geometry/build'
import { mailerSpec, steSpec, rigidSpec, telescopicSpec } from '../src/lib/geometry/structures'
import type { StructureSpec } from '../src/lib/geometry/types'

const FOLD: StructureSpec[] = [mailerSpec, steSpec, rigidSpec, telescopicSpec]

describe('panel UVs', () => {
  it.each(FOLD.map((s) => [s.id, s] as const))(
    'maps artwork edge-to-edge on every panel of %s',
    (_id, spec) => {
      const result = buildStructure(spec, spec.defaults, spec.boards[0])
      expect(result.panels.length).toBeGreaterThan(0)

      for (const panel of result.panels) {
        const geo = createPanelGeometry(panel)
        const uv = geo.getAttribute('uv')
        const pos = geo.getAttribute('position')
        const index = geo.getIndex()
        expect(uv).toBeTruthy()
        if (!uv) continue

        // Cap faces are material group 0. Their UVs must span the whole face.
        const capVerts = new Set<number>()
        for (const g of geo.groups) {
          if (g.materialIndex !== 0) continue
          for (let i = g.start; i < g.start + g.count; i++) capVerts.add(index ? index.getX(i) : i)
        }
        expect(capVerts.size).toBeGreaterThan(0)

        let minU = Infinity
        let maxU = -Infinity
        let minV = Infinity
        let maxV = -Infinity
        for (const vi of capVerts) {
          minU = Math.min(minU, uv.getX(vi))
          maxU = Math.max(maxU, uv.getX(vi))
          minV = Math.min(minV, uv.getY(vi))
          maxV = Math.max(maxV, uv.getY(vi))
          // Position and UV must stay in step, or the texture shears.
          expect(pos.getX(vi)).toBeGreaterThanOrEqual(-1e-6)
        }

        expect(minU).toBeCloseTo(0, 5)
        expect(maxU).toBeCloseTo(1, 5)
        expect(minV).toBeCloseTo(0, 5)
        expect(maxV).toBeCloseTo(1, 5)
        geo.dispose()
      }
    },
  )

  it('keeps UVs stable when a dimension changes', () => {
    const small = buildStructure(mailerSpec, { ...mailerSpec.defaults }, mailerSpec.boards[0])
    const large = buildStructure(
      mailerSpec,
      { ...mailerSpec.defaults, l: 320, w: 240, h: 120 },
      mailerSpec.boards[0],
    )
    const uvRange = (r: typeof small) => {
      const p = r.panels[0]
      const geo = createPanelGeometry(p)
      const uv = geo.getAttribute('uv')!
      const index = geo.getIndex()
      let min = Infinity
      let max = -Infinity
      // Cap faces only: side walls intentionally keep world UVs.
      for (const g of geo.groups) {
        if (g.materialIndex !== 0) continue
        for (let i = g.start; i < g.start + g.count; i++) {
          const u = uv.getX(index ? index.getX(i) : i)
          min = Math.min(min, u)
          max = Math.max(max, u)
        }
      }
      geo.dispose()
      return [min, max]
    }
    // World-space UVs would scale with the box; normalised UVs do not.
    expect(uvRange(small)).toEqual(uvRange(large))
  })
})
