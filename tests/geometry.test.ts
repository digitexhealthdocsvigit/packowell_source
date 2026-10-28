import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  assembleMatrices,
  assembledBounds,
  buildStructure,
  geometryWorldBounds,
  maxOpenOrderFromResolved,
  panelGeometry,
  validateDims,
} from '../src/lib/geometry/build'
import { polygonArea } from '../src/lib/geometry/blank'
import { dielineSvg, blankStats } from '../src/lib/geometry/dieline'
import {
  mailerSpec,
  steSpec,
  rigidSpec,
  telescopicSpec,
  pouchSpec,
  rollupSpec,
} from '../src/lib/geometry/structures'
import { fromMm, toMm } from '../src/lib/geometry/units'
import type { StructureSpec } from '../src/lib/geometry/types'

const FOLD_STRUCTURES: StructureSpec[] = [mailerSpec, steSpec, rigidSpec, telescopicSpec]

function sizeOf(b: { min: [number, number, number]; max: [number, number, number] }) {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] as [number, number, number]
}

describe('units', () => {
  it('converts mm → cm → mm and mm → in → mm without drift', () => {
    for (const v of [1, 12.5, 240, 1000]) {
      expect(toMm(fromMm(v, 'cm'), 'cm')).toBeCloseTo(v, 9)
      expect(toMm(fromMm(v, 'in'), 'in')).toBeCloseTo(v, 9)
    }
    expect(toMm(1, 'in')).toBeCloseTo(25.4, 9)
  })
})

describe.each(FOLD_STRUCTURES)('$name — structural closure', (spec) => {
  const dims = spec.defaults
  const board = spec.boards[0]
  const result = buildStructure(spec, dims, board)

  it('builds panels for the default configuration', () => {
    expect(result.panels.length).toBeGreaterThan(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('closes to the nominal internal dimensions (within board calliper)', () => {
    const size = sizeOf(assembledBounds(result, spec, 0))
    expect(Math.abs(size[0] - dims.l)).toBeLessThanOrEqual(spec.closureTolerance)
    expect(Math.abs(size[1] - dims.w)).toBeLessThanOrEqual(spec.closureTolerance)
    expect(Math.abs(size[2] - dims.h)).toBeLessThanOrEqual(spec.closureTolerance)
  })

  // Two panels sharing an identical slab on one axis put two faces on the same
  // plane, and the renderer then picks between them per pixel: the visible
  // symptom is a dark patch that reads as a hole in the box. Flaps that close
  // against a wall carry `inset` so they sit a board thickness inside it.
  it('has no two panels coplanar in the closed state', () => {
    const mats = assembleMatrices(result.panels, 0, maxOpenOrderFromResolved(result.panels))
    const boxes = result.panels.map((p) => ({
      id: p.spec.id,
      b: geometryWorldBounds(panelGeometry(p), mats.get(p.spec.id)!),
    }))
    const clashes: string[] = []
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        for (let k = 0; k < 3; k++) {
          const same =
            Math.abs(boxes[i].b.min[k] - boxes[j].b.min[k]) < 0.25 &&
            Math.abs(boxes[i].b.max[k] - boxes[j].b.max[k]) < 0.25
          if (!same) continue
          const overlap = [0, 1, 2]
            .filter((m) => m !== k)
            .map((m) => Math.min(boxes[i].b.max[m], boxes[j].b.max[m]) - Math.max(boxes[i].b.min[m], boxes[j].b.min[m]))
          if (overlap.every((v) => v > 2)) clashes.push(`${boxes[i].id} ∥ ${boxes[j].id} on ${'xyz'[k]}`)
        }
      }
    }
    expect(clashes).toEqual([])
  })

  it('flattens to a single plane with every panel coplanar', () => {
    const mats = assembleMatrices(result.panels, 0, maxOpenOrderFromResolved(result.panels), true)
    for (const p of result.panels) {
      const b = geometryWorldBounds(panelGeometry(p), mats.get(p.spec.id)!)
      expect(Math.max(Math.abs(b.min[2]), Math.abs(b.max[2]))).toBeLessThanOrEqual(p.spec.thickness + 0.001)
    }
  })

  it('keeps every hinge connected after folding', () => {
    const mats = assembleMatrices(result.panels, 0, maxOpenOrderFromResolved(result.panels), false)
    const byId = new Map(result.panels.map((p) => [p.spec.id, p]))
    for (const p of result.panels) {
      if (!p.parentId || !p.hinge) continue
      const parent = byId.get(p.parentId)!
      const childWorld = mats.get(p.spec.id)!
      const parentWorld = mats.get(p.parentId)!
      const d = { x: p.origin.x - parent.origin.x, y: p.origin.y - parent.origin.y }
      const s = d.x * parent.ax.x + d.y * parent.ax.y
      const t = d.x * parent.ay.x + d.y * parent.ay.y
      const childOrigin = new THREE.Vector3(0, 0, 0).applyMatrix4(childWorld)
      const hingeInParent = new THREE.Vector3(s, t, 0).applyMatrix4(parentWorld)
      // A flap carrying `inset` sits a board thickness off its own fold line, so
      // its origin is displaced from the hinge by at most that inset — along the
      // panel normal only, never sideways along the hinge.
      expect(childOrigin.distanceTo(hingeInParent)).toBeLessThanOrEqual((p.spec.inset ?? 0) + 1e-6)
    }
  })

  it('produces finite geometry for every panel', () => {
    const mats = assembleMatrices(result.panels, 0.5, maxOpenOrderFromResolved(result.panels), false)
    for (const p of result.panels) {
      const b = geometryWorldBounds(panelGeometry(p), mats.get(p.spec.id)!)
      for (const v of [...b.min, ...b.max]) expect(Number.isFinite(v)).toBe(true)
      expect(p.width).toBeGreaterThan(0)
      expect(p.height).toBeGreaterThan(0)
    }
  })

  it('grows when the length grows', () => {
    const bigger = buildStructure(spec, { ...dims, l: dims.l + 50 }, board)
    const a = sizeOf(assembledBounds(result, spec, 0))[0]
    const b = sizeOf(assembledBounds(bigger, spec, 0))[0]
    expect(Math.abs(b - a - 50)).toBeLessThan(spec.closureTolerance)
  })

  it('rejects dimensions outside the validated envelope', () => {
    const issues = validateDims(spec, { l: 5, w: 5, h: 5 }, board)
    expect(issues.length).toBeGreaterThan(0)
    const broken = buildStructure(spec, { l: 5, w: 5, h: 5 }, board)
    expect(broken.panels).toHaveLength(0)
    expect(broken.warnings.length).toBeGreaterThan(0)
  })

  it('accounts for the blank area as the sum of panel areas', () => {
    const stats = blankStats(result.panels)
    const manual = result.panels.reduce((s, p) => s + polygonArea(p.polygon), 0)
    expect(stats.areaMm2).toBeCloseTo(manual, 6)
    expect(stats.panelCount).toBe(result.panels.length)
  })

  it('exports a dieline with one cut path per panel', () => {
    const svg = dielineSvg(result)
    expect(svg.startsWith('<svg')).toBe(true)
    // Fill and outline are separate layers, so count the cut outlines.
    expect((svg.match(/fill="none" stroke=/g) ?? []).length).toBe(result.panels.length)
  })
})

describe('mailer blank accounting', () => {
  it('matches the hand-computed blank area', () => {
    const d = mailerSpec.defaults
    const board = mailerSpec.boards[0]
    const result = buildStructure(mailerSpec, d, board)
    const tuck = Math.min(30, Math.max(18, d.h * 0.4))
    const dust = Math.min(34, Math.max(22, d.w * 0.35))
    const expected = d.l * d.w * 2 + d.l * d.h * 2 + d.w * d.h * 2 + d.l * tuck + d.w * dust * 2
    expect(blankStats(result.panels).areaMm2).toBeCloseTo(expected, 3)
  })
})

describe('telescopic box', () => {
  it('is built from two separate blanks', () => {
    const result = buildStructure(telescopicSpec, telescopicSpec.defaults, telescopicSpec.boards[0])
    const roots = result.panels.filter((p) => p.parentId === null)
    expect(roots).toHaveLength(2)
    const ids = roots.map((r) => r.spec.id)
    expect(ids).toContain('baseBottom')
    expect(ids).toContain('lidTop')
  })

  it('lifts the lid clear when opened', () => {
    const r = buildStructure(telescopicSpec, telescopicSpec.defaults, telescopicSpec.boards[0])
    const closed = sizeOf(assembledBounds(r, telescopicSpec, 0))[2]
    const open = sizeOf(assembledBounds(r, telescopicSpec, 1))[2]
    expect(open).toBeGreaterThan(closed + 80)
  })
})

describe('rigid magnetic box', () => {
  it('keeps the lid inside the closed envelope', () => {
    const d = rigidSpec.defaults
    const r = buildStructure(rigidSpec, d, rigidSpec.boards[0])
    const b = assembledBounds(r, rigidSpec, 0)
    expect(b.max[2]).toBeLessThan(d.h + 6)
    expect(b.max[1]).toBeLessThan(d.w + 6)
  })

  it('swings the lid clear when opened', () => {
    const d = rigidSpec.defaults
    const r = buildStructure(rigidSpec, d, rigidSpec.boards[0])
    const open = sizeOf(assembledBounds(r, rigidSpec, 1))
    expect(open[1]).toBeGreaterThan(d.w + 80)
  })
})

describe('flexible pouch', () => {
  it('builds a formed shell with separable parts', () => {
    const r = buildStructure(pouchSpec, pouchSpec.defaults, pouchSpec.boards[0])
    expect(r.parts.length).toBeGreaterThanOrEqual(6)
    expect(r.panels).toHaveLength(0)
    const ids = r.parts.map((p) => p.id)
    expect(ids).toContain('front')
    expect(ids).toContain('gusset')
    expect(ids).toContain('zip')
  })

  it('runs the full printed height of the pouch', () => {
    const d = pouchSpec.defaults
    const r = buildStructure(pouchSpec, d, pouchSpec.boards[0])
    const front = r.parts.find((p) => p.id === 'front')!
    front.geometry.computeBoundingBox()
    expect(front.geometry.boundingBox!.max.y).toBeCloseTo(d.h, 1)
  })
})

describe('roll-up standee', () => {
  it('separates hardware into parts', () => {
    const r = buildStructure(rollupSpec, rollupSpec.defaults, rollupSpec.boards[0])
    const ids = r.parts.map((p) => p.id)
    ;['base', 'cassette', 'graphic', 'rail'].forEach((id) => expect(ids).toContain(id))
  })
})

describe('spec hygiene', () => {
  const all = [mailerSpec, steSpec, rigidSpec, telescopicSpec, pouchSpec, rollupSpec]
  it('every structure declares version, limitations and a status', () => {
    for (const s of all) {
      expect(s.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(s.limitations.length).toBeGreaterThan(0)
      expect(['concept-preview', 'validated-geometry']).toContain(s.status)
    }
  })
  it('every panel belongs to a declared part', () => {
    for (const s of all) {
      const parts = new Set(s.parts.map((p) => p.id))
      for (const p of s.panels) expect(parts.has(p.part)).toBe(true)
    }
  })
  it('default dimensions sit inside their own limits', () => {
    for (const s of all) {
      const d = s.defaults
      expect(d.l).toBeGreaterThanOrEqual(s.limits.minL)
      expect(d.l).toBeLessThanOrEqual(s.limits.maxL)
      expect(d.w).toBeGreaterThanOrEqual(s.limits.minW)
      expect(d.w).toBeLessThanOrEqual(s.limits.maxW)
      expect(d.h).toBeGreaterThanOrEqual(s.limits.minH)
      expect(d.h).toBeLessThanOrEqual(s.limits.maxH)
    }
  })
})
