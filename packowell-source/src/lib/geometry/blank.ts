import type { Edge, PanelSpec, ResolvedPanel, Vec2 } from './types'

const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
const mul = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y
/** +90° rotation: keeps the (ax, ay) basis right-handed so +Z is always "up" */
const perp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x })
const unit = (a: Vec2): Vec2 => {
  const len = Math.hypot(a.x, a.y)
  return len === 0 ? { x: 1, y: 0 } : { x: a.x / len, y: a.y / len }
}

export const localToSheet = (p: ResolvedPanel, u: number, v: number): Vec2 =>
  add(p.origin, add(mul(p.ax, u), mul(p.ay, v)))

/**
 * Resolves a panel tree into flat-blank coordinates.
 *
 * Every panel is expressed in its own frame: origin on the crease start, ax
 * along the crease, ay = perp(ax) so the basis is always right-handed. The
 * panel body occupies u in [0,width], v in [0, dir*height].
 */
export function resolvePanels(specs: PanelSpec[]): ResolvedPanel[] {
  const byId = new Map(specs.map((s) => [s.id, s]))
  const resolved = new Map<string, ResolvedPanel>()
  const out: ResolvedPanel[] = []

  const resolve = (spec: PanelSpec, guard: Set<string>): ResolvedPanel => {
    const cached = resolved.get(spec.id)
    if (cached) return cached
    if (guard.has(spec.id)) throw new Error(`Cyclic panel attachment at "${spec.id}"`)
    guard.add(spec.id)

    let panel: ResolvedPanel

    if (!spec.attach) {
      const width = spec.width ?? 0
      const height = spec.height ?? 0
      if (width <= 0 || height <= 0) {
        throw new Error(`Root panel "${spec.id}" needs a positive width and height`)
      }
      const origin = spec.sheetOrigin ?? { x: 0, y: 0 }
      const ax = { x: 1, y: 0 }
      const ay = { x: 0, y: 1 }
      const polygon = [
        { ...origin },
        add(origin, mul(ax, width)),
        add(origin, add(mul(ax, width), mul(ay, height))),
        add(origin, mul(ay, height)),
      ]
      panel = {
        spec,
        parentId: null,
        dir: 1,
        origin,
        ax,
        ay,
        width,
        height,
        polygon,
        hinge: null,
        depth: 0,
      }
    } else {
      const parentSpec = byId.get(spec.attach.parent)
      if (!parentSpec) {
        throw new Error(`Panel "${spec.id}" attaches to unknown parent "${spec.attach.parent}"`)
      }
      const parent = resolve(parentSpec, guard)
      const { edge, width, height, along = 0.5, inside = false } = spec.attach
      if (width <= 0 || height <= 0) {
        throw new Error(`Panel "${spec.id}" needs a positive width and height`)
      }

      // The parent body spans v in [0, dir*height]; its far edge is at v = dir*height.
      const farV = parent.dir * parent.height
      let edgeStart: Vec2
      let edgeDir: Vec2
      let away: Vec2

      switch (edge) {
        case 'top':
          edgeStart = localToSheet(parent, 0, farV)
          edgeDir = parent.ax
          away = mul(parent.ay, parent.dir)
          break
        case 'bottom':
          edgeStart = localToSheet(parent, 0, 0)
          edgeDir = parent.ax
          away = mul(parent.ay, -parent.dir)
          break
        case 'left':
          edgeStart = localToSheet(parent, 0, 0)
          edgeDir = mul(parent.ay, parent.dir)
          away = mul(parent.ax, -1)
          break
        case 'right':
          edgeStart = localToSheet(parent, parent.width, 0)
          edgeDir = mul(parent.ay, parent.dir)
          away = parent.ax
          break
        default:
          throw new Error(`Unknown edge "${edge}" on panel "${spec.id}"`)
      }

      if (inside) away = mul(away, -1)

      const edgeLength = edge === 'top' || edge === 'bottom' ? parent.width : heightOf(parent)
      const offset = (edgeLength - width) * along
      const d = unit(edgeDir)
      const origin = add(edgeStart, mul(d, offset))

      const ax = d
      const ay = perp(ax)
      const dir: 1 | -1 = dot(away, ay) >= 0 ? 1 : -1

      const polygon = [
        { ...origin },
        add(origin, mul(ax, width)),
        add(origin, add(mul(ax, width), mul(ay, dir * height))),
        add(origin, mul(ay, dir * height)),
      ]

      panel = {
        spec,
        parentId: parent.spec.id,
        dir,
        origin,
        ax,
        ay,
        width,
        height,
        polygon,
        hinge: [origin, add(origin, mul(ax, width))],
        depth: parent.depth + 1,
      }
    }

    guard.delete(spec.id)
    resolved.set(spec.id, panel)
    out.push(panel)
    return panel
  }

  for (const spec of specs) resolve(spec, new Set())
  return out
}

function heightOf(p: ResolvedPanel): number {
  // edge length of a left/right edge = the parent's height
  return p.height
}

export function polygonArea(poly: Vec2[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length
    a += poly[i].x * poly[j].y - poly[j].x * poly[i].y
  }
  return Math.abs(a / 2)
}

export function polygonBounds(polys: Vec2[][]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const poly of polys) {
    for (const pt of poly) {
      if (pt.x < minX) minX = pt.x
      if (pt.y < minY) minY = pt.y
      if (pt.x > maxX) maxX = pt.x
      if (pt.y > maxY) maxY = pt.y
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

export function edgeMidpoint(p: ResolvedPanel, edge: Edge): Vec2 {
  const farV = p.dir * p.height
  switch (edge) {
    case 'top':
      return localToSheet(p, p.width / 2, farV)
    case 'bottom':
      return localToSheet(p, p.width / 2, 0)
    case 'left':
      return localToSheet(p, 0, farV / 2)
    case 'right':
      return localToSheet(p, p.width, farV / 2)
  }
}
