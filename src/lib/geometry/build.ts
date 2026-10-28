import * as THREE from 'three'
import { resolvePanels } from './blank'
import type {
  BoardOption,
  BuildResult,
  Dims,
  PanelSpec,
  ResolvedPanel,
  StructureSpec,
  Vec3,
} from './types'

const DEG = Math.PI / 180

/** Opening stagger: panels with openOrder 0 move first. */
export function panelFold(spec: PanelSpec, open: number, maxOrder: number): number {
  const order = spec.openOrder ?? 0
  const norm = maxOrder > 0 ? order / maxOrder : 0
  const start = norm * 0.55
  const t = clamp01((open - start) / Math.max(0.0001, 1 - start))
  const eased = t * t * (3 - 2 * t)
  return spec.foldClosed + (spec.foldOpen - spec.foldClosed) * eased
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function maxOpenOrder(specs: PanelSpec[]): number {
  return specs.reduce((m, s) => Math.max(m, s.openOrder ?? 0), 0)
}

const tmpV = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()
const tmpS = new THREE.Vector3(1, 1, 1)

export function poseMatrix(pos: Vec3, rot: Vec3, scale?: Vec3): THREE.Matrix4 {
  tmpE.set(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG, 'XYZ')
  tmpQ.setFromEuler(tmpE)
  tmpV.set(pos[0], pos[1], pos[2])
  if (scale) tmpS.set(scale[0], scale[1], scale[2])
  else tmpS.set(1, 1, 1)
  return new THREE.Matrix4().compose(tmpV, tmpQ, tmpS)
}

export function lerpPose(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/**
 * World matrices for every panel at a given open amount.
 * Panels are independent meshes whose matrix is set directly, so a broken
 * parent-child chain shows up immediately as a detached panel.
 */
export function assembleMatrices(
  resolved: ResolvedPanel[],
  open: number,
  maxOrder: number,
  flat = false,
): Map<string, THREE.Matrix4> {
  const out = new Map<string, THREE.Matrix4>()
  const byId = new Map(resolved.map((p) => [p.spec.id, p]))

  const compute = (p: ResolvedPanel): THREE.Matrix4 => {
    const cached = out.get(p.spec.id)
    if (cached) return cached

    let world: THREE.Matrix4
    if (!p.parentId) {
      if (flat) {
        world = new THREE.Matrix4()
        out.set(p.spec.id, world)
        return world
      }
      const closed = p.spec.poseClosed ?? { pos: [0, 0, 0] as Vec3, rot: [0, 0, 0] as Vec3 }
      const openPose = p.spec.poseOpen ?? closed
      const t = flat ? 0 : clamp01(open)
      const pos = lerpPose(closed.pos, openPose.pos, t)
      const rot = lerpPose(closed.rot, openPose.rot, t)
      const scale =
        closed.scale || openPose.scale
          ? lerpPose(closed.scale ?? [1, 1, 1], openPose.scale ?? [1, 1, 1], t)
          : undefined
      world = poseMatrix(pos as Vec3, rot as Vec3, scale as Vec3 | undefined)
    } else {
      const parent = byId.get(p.parentId)
      if (!parent) throw new Error(`Missing parent ${p.parentId}`)
      const parentWorld = compute(parent)

      const d = { x: p.origin.x - parent.origin.x, y: p.origin.y - parent.origin.y }
      const s = d.x * parent.ax.x + d.y * parent.ax.y
      const t = d.x * parent.ay.x + d.y * parent.ay.y
      const xLocal = { x: p.ax.x * parent.ax.x + p.ax.y * parent.ax.y, y: p.ax.x * parent.ay.x + p.ax.y * parent.ay.y }
      const angleZ = Math.atan2(xLocal.y, xLocal.x)

      const fold = (flat ? 0 : panelFold(p.spec, open, maxOrder)) * p.dir * DEG

      world = new THREE.Matrix4()
        .makeTranslation(s, t, 0)
        .multiply(new THREE.Matrix4().makeRotationZ(angleZ))
        .multiply(new THREE.Matrix4().makeRotationX(fold))
        // Along the panel's own normal, so a flap that lands against a wall
        // stops one board thickness short of it instead of sharing its plane.
        .multiply(new THREE.Matrix4().makeTranslation(0, 0, flat ? 0 : (p.spec.inset ?? 0)))
        .premultiply(parentWorld)
    }

    out.set(p.spec.id, world)
    return world
  }

  for (const p of resolved) compute(p)
  return out
}

const geometryCache = new Map<string, THREE.BufferGeometry>()

/** Uncached panel blank — the viewer owns and disposes these. */
export function createPanelGeometry(p: ResolvedPanel): THREE.BufferGeometry {
  const t = p.spec.thickness
  const pts: [number, number][] = [
    [0, 0],
    [p.width, 0],
    [p.width, p.dir * p.height],
    [0, p.dir * p.height],
  ]
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: t,
    bevelEnabled: false,
    curveSegments: 1,
  })
  geo.translate(0, 0, -t / 2)
  geo.computeVertexNormals()
  // A printed panel is worth UVs that run across the whole face: artwork is
  // addressed per panel, so 0..1 must mean "edge to edge of this panel".
  // ExtrudeGeometry's default generator emits world-space UVs, which tiles the
  // image once per millimetre and drifts as soon as a dimension changes.
  normaliseFaceUvs(geo, p.width, p.dir * p.height)
  geo.computeBoundingBox()
  return geo
}

const CAP_MATERIAL = 0

/** Remap cap-face UVs to 0..1 across the face. Side faces keep world UVs. */
function normaliseFaceUvs(geo: THREE.BufferGeometry, width: number, height: number) {
  const pos = geo.getAttribute('position')
  const uv = geo.getAttribute('uv')
  if (!pos || !uv) return

  const minY = Math.min(0, height)
  const spanX = width || 1
  const spanY = Math.abs(height) || 1
  const flipV = height < 0

  // ExtrudeGeometry is non-indexed, so groups address vertices directly. The
  // indexed path is kept for any custom geometry that goes through here.
  const index = geo.getIndex()
  const seen = new Set<number>()
  for (const group of geo.groups) {
    if (group.materialIndex !== CAP_MATERIAL) continue
    const end = group.start + group.count
    for (let i = group.start; i < end; i++) {
      const vi = index ? index.getX(i) : i
      if (seen.has(vi)) continue
      seen.add(vi)
      const u = pos.getX(vi) / spanX
      const v = (pos.getY(vi) - minY) / spanY
      uv.setXY(vi, u, flipV ? 1 - v : v)
    }
  }
  uv.needsUpdate = true
}

/** Cached variant used by tests and one-off measurements. */
export function panelGeometry(p: ResolvedPanel): THREE.BufferGeometry {
  const key = `${p.spec.id}|${p.width.toFixed(3)}|${p.height.toFixed(3)}|${p.dir}|${p.spec.thickness}`
  const hit = geometryCache.get(key)
  if (hit) return hit
  const geo = createPanelGeometry(p)
  geo.userData.shared = true
  geometryCache.set(key, geo)
  return geo
}

export function clearGeometryCache() {
  for (const g of geometryCache.values()) g.dispose()
  geometryCache.clear()
}

export function geometryWorldBounds(
  geo: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
): { min: Vec3; max: Vec3 } {
  if (!geo.boundingBox) geo.computeBoundingBox()
  const bb = geo.boundingBox!
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  const v = new THREE.Vector3()
  for (let i = 0; i < 8; i++) {
    v.set(
      i & 1 ? bb.max.x : bb.min.x,
      i & 2 ? bb.max.y : bb.min.y,
      i & 4 ? bb.max.z : bb.min.z,
    )
    v.applyMatrix4(matrix)
    min[0] = Math.min(min[0], v.x)
    min[1] = Math.min(min[1], v.y)
    min[2] = Math.min(min[2], v.z)
    max[0] = Math.max(max[0], v.x)
    max[1] = Math.max(max[1], v.y)
    max[2] = Math.max(max[2], v.z)
  }
  return { min, max }
}

export function unionBounds(list: { min: Vec3; max: Vec3 }[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const b of list) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.min[i])
      max[i] = Math.max(max[i], b.max[i])
    }
  }
  return { min, max }
}

export interface ValidateOptions {
  dims: Dims
  board: BoardOption
}

export interface ValidationIssue {
  field: 'l' | 'w' | 'h' | 'board' | 'general'
  message: string
}

export function validateDims(spec: StructureSpec, dims: Dims, board?: BoardOption): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { limits } = spec
  const check = (field: 'l' | 'w' | 'h', value: number, min: number, max: number, label: string) => {
    if (!Number.isFinite(value)) {
      issues.push({ field, message: `${label} must be a number` })
      return
    }
    if (value < min) issues.push({ field, message: `${label} must be at least ${min} mm` })
    if (value > max) issues.push({ field, message: `${label} must not exceed ${max} mm` })
  }
  check('l', dims.l, limits.minL, limits.maxL, 'Length')
  check('w', dims.w, limits.minW, limits.maxW, 'Width')
  check('h', dims.h, limits.minH, limits.maxH, 'Height')

  if (board && spec.klass === 'fold') {
    const minEdge = Math.min(dims.l, dims.w, dims.h)
    if (minEdge <= board.thickness * 4) {
      issues.push({
        field: 'board',
        message: `Smallest dimension is ${minEdge} mm — too tight for ${board.thickness} mm board (needs more than ${board.thickness * 4} mm to fold without crushing the corner).`,
      })
    }
  }
  return issues
}

export function buildStructure(
  spec: StructureSpec,
  dims: Dims,
  board: BoardOption,
): BuildResult {
  const warnings: string[] = []
  const issues = validateDims(spec, dims, board)
  if (issues.length) {
    return {
      panels: [],
      parts: [],
      blank: { min: [0, 0, 0], max: [0, 0, 0] },
      warnings: issues.map((i) => i.message),
    }
  }

  if (spec.klass === 'assembly') {
    const parts = spec.build ? spec.build({ dims, board }) : []
    const bounds = parts.map((p) => {
      if (!p.geometry.boundingBox) p.geometry.computeBoundingBox()
      return geometryWorldBounds(p.geometry, poseMatrix(p.pose.pos, p.pose.rot))
    })
    const u = unionBounds(bounds)
    return {
      panels: [],
      parts,
      blank: { min: u.min, max: u.max },
      warnings,
    }
  }

  const specs = spec.panelBuilder ? spec.panelBuilder(dims, board) : spec.panels
  const panels = resolvePanels(specs)
  if (panels.length === 0) warnings.push('No panels generated for this configuration.')
  return { panels, parts: [], blank: blankBounds(panels), warnings }
}

export function maxOpenOrderFromResolved(panels: ResolvedPanel[]): number {
  return panels.reduce((m, p) => Math.max(m, p.spec.openOrder ?? 0), 0)
}

export function blankBounds(panels: ResolvedPanel[]): { min: Vec3; max: Vec3 } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of panels) {
    for (const pt of p.polygon) {
      minX = Math.min(minX, pt.x)
      minY = Math.min(minY, pt.y)
      maxX = Math.max(maxX, pt.x)
      maxY = Math.max(maxY, pt.y)
    }
  }
  return { min: [minX, minY, 0], max: [maxX, maxY, 0] }
}

/** World-space bounds of the assembled structure at a given open amount. */
export function assembledBounds(
  result: BuildResult,
  spec: StructureSpec,
  open: number,
): { min: Vec3; max: Vec3 } {
  if (spec.klass === 'assembly') {
    return unionBounds(
      result.parts.map((p) => {
        const pose = p.poseOpen && open > 0
          ? { pos: lerpPose(p.pose.pos, p.poseOpen.pos, open), rot: lerpPose(p.pose.rot, p.poseOpen.rot, open) }
          : p.pose
        return geometryWorldBounds(p.geometry, poseMatrix(pose.pos as Vec3, pose.rot as Vec3))
      }),
    )
  }
  const mats = assembleMatrices(result.panels, open, maxOpenOrderFromResolved(result.panels))
  return unionBounds(
    result.panels.map((p) => geometryWorldBounds(panelGeometry(p), mats.get(p.spec.id)!)),
  )
}
