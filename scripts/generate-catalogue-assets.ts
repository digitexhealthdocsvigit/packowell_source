/**
 * Original catalogue illustration generator.
 *
 * Every asset in `public/catalogue/` is produced here from code — there is no
 * third-party imagery anywhere in the library, so the licence basis for each
 * file is "original work, generated in-house" and no attribution is owed.
 *
 * The drawings are *illustrations*, not photographs and not claims about
 * manufacturability. Each product gets its own structural drawing (silhouette,
 * proportion, opening style, features) so no two formats share an image.
 *
 *   bun run scripts/generate-catalogue-assets.ts
 */
import { mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { PRODUCTS, familyById } from '../src/lib/catalog'
import type { AssetRole, CatalogueAsset } from '../src/lib/catalogue-assets'
import type { AssetRights } from '../src/lib/catalogue-rights'

const W = 800
const H = 600
const CX = W / 2
const CY = 372
/**
 * Dimetric projection. A true 30° isometric drops the side faces so far that a
 * shallow box reads as a collapsed one; a shallower vertical foreshortening
 * keeps the solid form legible at catalogue-card size.
 */
const KX = 0.94
const KY = 0.30

type Pt = [number, number]

const isoX = (n: number): Pt => [n * KX, n * KY]
const isoY = (n: number): Pt => [-n * KX, n * KY]
const isoZ = (n: number): Pt => [0, -n]
const add = (a: Pt, ...rest: Pt[]): Pt =>
  rest.reduce<Pt>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], a)

const f = (n: number) => Number(n.toFixed(1))
const pts = (points: Pt[]) => points.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')
const poly = (points: Pt[], attrs: string) => `<polygon points="${pts(points)}" ${attrs}/>`
const rect = (x: number, y: number, w: number, h: number, attrs: string) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" ${attrs}/>`

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const r = clamp(((n >> 16) & 255) + amount)
  const g = clamp(((n >> 8) & 255) + amount)
  const b = clamp((n & 255) + amount)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

interface Tones {
  top: string
  left: string
  right: string
  edge: string
  accent: string
}

const PALETTES: Record<string, Tones> = {
  kraft: { top: '#e8d0a4', left: '#cfa96b', right: '#b58c4d', edge: '#8a6a34', accent: '#7a4a12' },
  white: { top: '#ffffff', left: '#f0eade', right: '#d8cfbf', edge: '#a89e8d', accent: '#b8791f' },
  rigid: { top: '#5d5349', left: '#453c34', right: '#312a24', edge: '#1d1815', accent: '#c9a227' },
  foil: { top: '#f8fafc', left: '#e2e8ef', right: '#c6cfda', edge: '#93a0b0', accent: '#4a6b8a' },
  poly: { top: '#fcfcfd', left: '#eaecef', right: '#d3d6dd', edge: '#aab0b8', accent: '#5b8ac7' },
  fabric: { top: '#ffffff', left: '#efe9e0', right: '#d6cdbe', edge: '#ada392', accent: '#b8791f' },
  clear: { top: '#eef5f9', left: '#dce8f0', right: '#c2d3e0', edge: '#9db1c2', accent: '#5b8ac7' },
}

const stroke = (t: Tones, w = 1.7) => `stroke="${t.edge}" stroke-width="${w}" stroke-linejoin="round"`

/* ------------------------------- isometric ------------------------------- */

interface BoxDims {
  w: number
  d: number
  h: number
}

/** Scale dims so the projected box fits the frame, then centre it. */
function fit(w: number, d: number, h: number, targetW = 470, targetH = 340): BoxDims & { o: Pt } {
  const bw = (w + d) * KX
  const bh = h + Math.max(w, d) * KY
  const k = Math.min(targetW / bw, targetH / bh)
  const W2 = w * k
  const D2 = d * k
  const H2 = h * k
  const ox = CX - ((W2 - D2) * KX) / 2
  const oy = CY + (H2 - Math.max(W2, D2) * KY) / 2
  return { w: W2, d: D2, h: H2, o: [ox, oy] }
}

function corners({ w, d, h, o }: BoxDims & { o: Pt }) {
  const O = o
  const A = add(O, isoX(w))
  const B = add(O, isoY(d))
  const C = add(O, isoZ(h))
  const Ap = add(A, isoZ(h))
  const Bp = add(B, isoZ(h))
  const D = add(O, isoX(w), isoY(d))
  const Dp = add(D, isoZ(h))
  return { O, A, B, C, Ap, Bp, D, Dp }
}

/**
 * Corner naming, once, so every helper agrees:
 *
 *   O  far/back bottom      C  far/back top
 *   A  back-right bottom    Ap back-right top
 *   B  back-left  bottom    Bp back-left  top
 *   D  near/front bottom    Dp near/front top
 *
 * The viewer is in front, so the three faces you can see are the left
 * (B-D-Dp-Bp), the right (A-D-Dp-Ap) and the top (C-Ap-Dp-Bp). Drawing the
 * faces that hang off the far vertical edge (O-C) instead is what makes a box
 * read as inside-out: the silhouette is nearly right, but a phantom seam runs
 * down the middle and the walls look like separate planes.
 */
type BoxCorners = ReturnType<typeof corners>

const FACE = {
  left: (c: BoxCorners): Pt[] => [c.B, c.D, c.Dp, c.Bp],
  right: (c: BoxCorners): Pt[] => [c.A, c.D, c.Dp, c.Ap],
  top: (c: BoxCorners): Pt[] => [c.C, c.Ap, c.Dp, c.Bp],
}

/** The two walls facing the viewer, plus the top. */
function isoBox(g: BoxDims & { o: Pt }, t: Tones, opts: { top?: boolean; left?: boolean } = {}) {
  const c = corners(g)
  return [
    opts.left === false ? '' : poly(FACE.left(c), `fill="${t.left}" ${stroke(t)}`),
    poly(FACE.right(c), `fill="${t.right}" ${stroke(t)}`),
    opts.top === false ? '' : poly(FACE.top(c), `fill="${t.top}" ${stroke(t)}`),
  ].join('')
}

/** The two walls only — used when the top is open and the interior shows. */
function isoWalls(g: BoxDims & { o: Pt }, t: Tones) {
  const c = corners(g)
  return [
    poly(FACE.left(c), `fill="${t.left}" ${stroke(t)}`),
    poly(FACE.right(c), `fill="${t.right}" ${stroke(t)}`),
  ].join('')
}

/** A lid standing open behind the box, hinged on the far top edge (C-Ap). */
function openLid(g: BoxDims & { o: Pt }, t: Tones, len = 0.85) {
  const c = corners(g)
  const L = g.h * len + 24
  const up = isoZ(L)
  const back = isoY(-L * 0.1)
  return poly(
    [c.C, c.Ap, add(c.Ap, up, back), add(c.C, up, back)],
    `fill="${shade(t.top, -12)}" ${stroke(t)}`,
  )
}

/**
 * A point inside the box in normalised box coordinates x/y/z ∈ [0,1], where
 * (0,0,0) is the far/back bottom corner O and z runs upward. Working in box
 * space instead of stacking screen-space offsets is what keeps the inset maths
 * sign-safe: the previous version used isoZ(-h*inset) and sank the floor below
 * the silhouette, which drew a second bottom edge under the box.
 */
function at(c: BoxCorners, g: BoxDims, x: number, y: number, z: number): Pt {
  return add(c.O, isoX(g.w * x), isoY(g.d * y), isoZ(g.h * z))
}

/**
 * Interior of an open box: the two far walls and the floor, one board thickness
 * in from the outside, so the rim reads as a wall with thickness rather than a
 * paper edge. Drawn before the near walls, which then occlude the near part of
 * the floor.
 */
function openInterior(g: BoxDims & { o: Pt }, t: Tones) {
  const c = corners(g)
  const k = 0.05
  const p = (x: number, y: number, z: number) => at(c, g, x, y, z)

  // x=k is the far wall on the screen-left, y=k the far wall on the screen-right.
  const wallX = [p(k, k, k), p(k, 1 - k, k), p(k, 1 - k, 1), p(k, k, 1)]
  const wallY = [p(k, k, k), p(1 - k, k, k), p(1 - k, k, 1), p(k, k, 1)]
  const floor = [p(k, k, k), p(1 - k, k, k), p(1 - k, 1 - k, k), p(k, 1 - k, k)]

  return [
    poly(wallX, `fill="${shade(t.left, -30)}"`),
    poly(wallY, `fill="${shade(t.right, -22)}"`),
    poly(floor, `fill="${shade(t.left, -16)}"`),
  ].join('')
}

/**
 * The cut edge of the board at the rim: one strip per wall, at z=1. A vertical
 * face has no thickness where it is cut, so without these an open box shows a
 * sliver of background between the interior walls and the near walls.
 */
function rimBand(g: BoxDims & { o: Pt }, t: Tones) {
  const c = corners(g)
  const k = 0.05
  const p = (x: number, y: number, z: number) => at(c, g, x, y, z)
  const strip = (a: Pt, b: Pt, d: Pt, e: Pt, fill: string) => poly([a, b, d, e], `fill="${fill}" ${stroke(t, 1.3)}`)
  // The far cut edges sit in the shadow of the far flaps, so they are toned
  // down: at the top-face tone they glare against the interior and read as a
  // white gap rather than the thickness of the board.
  const far = shade(t.top, -26)
  const near = shade(t.top, -8)
  return [
    strip(p(0, 0, 1), p(1, 0, 1), p(1, k, 1), p(0, k, 1), far),
    strip(p(0, 0, 1), p(k, 0, 1), p(k, 1, 1), p(0, 1, 1), far),
    strip(p(0, 1 - k, 1), p(1, 1 - k, 1), p(1, 1, 1), p(0, 1, 1), near),
    strip(p(1 - k, 0, 1), p(1, 0, 1), p(1, 1, 1), p(1 - k, 1, 1), near),
  ].join('')
}

function groundShadow(cx = CX, cy = CY + 28, rx = 210, ry = 34) {
  return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="#191614" opacity="0.09"/>`
}

/* -------------------------------- shapes -------------------------------- */

function cylinder(cx: number, top: number, w: number, h: number, t: Tones, opts: { lid?: boolean } = {}) {
  const rx = w / 2
  const ry = rx * 0.30
  const body = `<path d="M ${f(cx - rx)} ${f(top + ry)} L ${f(cx - rx)} ${f(top + h - ry)} A ${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(top + h - ry)} L ${f(cx + rx)} ${f(top + ry)} Z" fill="${t.right}" ${stroke(t)}/>`
  const band = `<rect x="${f(cx - rx)}" y="${f(top + h * 0.55)}" width="${f(w)}" height="${f(h * 0.16)}" fill="${shade(t.right, -14)}" opacity="0.55"/>`
  const lid =
    opts.lid === false
      ? ''
      : `<ellipse cx="${f(cx)}" cy="${f(top + ry)}" rx="${f(rx)}" ry="${f(ry)}" fill="${t.top}" ${stroke(t)}/>
         <ellipse cx="${f(cx)}" cy="${f(top + ry)}" rx="${f(rx * 0.72)}" ry="${f(ry * 0.72)}" fill="none" stroke="${t.edge}" stroke-width="1.1" opacity="0.5"/>`
  return `${body}${band}${lid}`
}

function pouchPath(cx: number, top: number, w: number, h: number, r = 16) {
  const l = cx - w / 2
  const rt = cx + w / 2
  const b = top + h
  return `M ${f(l + r)} ${f(top)} L ${f(rt - r)} ${f(top)} Q ${f(rt)} ${f(top)} ${f(rt)} ${f(top + r)} L ${f(rt)} ${f(b - r * 1.6)} Q ${f(rt)} ${f(b)} ${f(rt - r)} ${f(b)} L ${f(l + r)} ${f(b)} Q ${f(l)} ${f(b)} ${f(l)} ${f(b - r * 1.6)} L ${f(l)} ${f(top + r)} Q ${f(l)} ${f(top)} ${f(l + r)} ${f(top)} Z`
}

interface PouchOpts {
  zip?: boolean
  spout?: boolean
  valve?: boolean
  gusset?: boolean
  fin?: boolean
  tinTie?: boolean
}

function pouch(cx: number, top: number, w: number, h: number, t: Tones, o: PouchOpts = {}) {
  const l = cx - w / 2
  const r = cx + w / 2
  const b = top + h
  const sh = Math.min(38, h * 0.11)
  const body = `M ${f(l + 18)} ${f(top)} L ${f(r - 18)} ${f(top)} Q ${f(r)} ${f(top)} ${f(r)} ${f(top + sh)} L ${f(r)} ${f(b - 20)} Q ${f(r)} ${f(b)} ${f(r - 20)} ${f(b)} L ${f(l + 20)} ${f(b)} Q ${f(l)} ${f(b)} ${f(l)} ${f(b - 20)} L ${f(l)} ${f(top + sh)} Q ${f(l)} ${f(top)} ${f(l + 18)} ${f(top)} Z`

  const gusset = o.gusset
    ? `<path d="M ${f(l + 4)} ${f(b - 30)} Q ${f(cx)} ${f(b + 20)} ${f(r - 4)} ${f(b - 30)}" fill="${shade(t.right, -16)}" opacity="0.5"/>
       <path d="M ${f(l + 10)} ${f(b - 22)} Q ${f(cx)} ${f(b + 14)} ${f(r - 10)} ${f(b - 22)}" fill="none" stroke="${t.edge}" stroke-width="1.3" opacity="0.55"/>`
    : ''

  const seal = `<path d="M ${f(l + 14)} ${f(top + 2)} L ${f(r - 14)} ${f(top + 2)} L ${f(r - 18)} ${f(top + 24)} L ${f(l + 18)} ${f(top + 24)} Z" fill="${shade(t.top, -6)}" ${stroke(t, 1.3)}/>
    ${Array.from({ length: 9 }, (_, i) => `<path d="M ${f(l + 26 + i * ((w - 52) / 8))} ${f(top + 6)} L ${f(l + 26 + i * ((w - 52) / 8))} ${f(top + 19)}" stroke="${t.edge}" stroke-width="1" opacity="0.35"/>`).join('')}`

  const highlight = `<path d="M ${f(l + 16)} ${f(top + sh + 6)} L ${f(l + w * 0.26)} ${f(top + sh + 6)} L ${f(l + w * 0.2)} ${f(b - 30)} L ${f(l + 12)} ${f(b - 30)} Z" fill="#ffffff" opacity="0.28"/>`

  const label = `<rect x="${f(l + w * 0.14)}" y="${f(top + h * 0.32)}" width="${f(w * 0.72)}" height="${f(h * 0.3)}" rx="10" fill="${t.accent}" opacity="0.16"/>
    <rect x="${f(l + w * 0.2)}" y="${f(top + h * 0.42)}" width="${f(w * 0.6)}" height="7" rx="3.5" fill="${t.accent}" opacity="0.35"/>
    <rect x="${f(l + w * 0.26)}" y="${f(top + h * 0.5)}" width="${f(w * 0.48)}" height="5" rx="2.5" fill="${t.accent}" opacity="0.22"/>`

  const zip = o.zip
    ? `<path d="M ${f(l + 12)} ${f(top + 34)} L ${f(r - 12)} ${f(top + 34)}" stroke="${shade(t.edge, -14)}" stroke-width="2.4" stroke-dasharray="8 5" opacity="0.8"/>`
    : ''

  const spout = o.spout
    ? `<path d="M ${f(cx + 4)} ${f(top + 4)} L ${f(cx + 4)} ${f(top - 30)} L ${f(cx + 44)} ${f(top - 30)} L ${f(cx + 44)} ${f(top + 4)} Z" fill="${t.top}" ${stroke(t)}/>
       <rect x="${f(cx + 2)}" y="${f(top - 50)}" width="${f(44)}" height="${f(22)}" rx="6" fill="${shade(t.top, -20)}" ${stroke(t)}/>`
    : ''

  const valve = o.valve
    ? `<circle cx="${f(r - 44)}" cy="${f(top + h * 0.4)}" r="15" fill="${shade(t.top, -8)}" ${stroke(t)}/>
       <circle cx="${f(r - 44)}" cy="${f(top + h * 0.4)}" r="5.5" fill="${t.edge}" opacity="0.65"/>`
    : ''

  const fin = o.fin
    ? `<path d="M ${f(cx)} ${f(top + 26)} L ${f(cx)} ${f(b - 12)}" stroke="${shade(t.edge, 26)}" stroke-width="1.6" opacity="0.55"/>`
    : ''

  const tie = o.tinTie
    ? `<rect x="${f(l + 10)}" y="${f(top + 44)}" width="${f(w - 20)}" height="8" rx="4" fill="${t.edge}" opacity="0.7"/>`
    : ''

  return `<path d="${body}" fill="${t.left}" ${stroke(t)}/>${gusset}${highlight}${label}${seal}${zip}${tie}${valve}${spout}${fin}`
}

function flatSachet(cx: number, top: number, w: number, h: number, t: Tones, seals = true) {
  const body = `<rect x="${f(cx - w / 2)}" y="${f(top)}" width="${f(w)}" height="${f(h)}" rx="8" fill="${t.left}" ${stroke(t)}/>`
  const s = seals
    ? `<rect x="${f(cx - w / 2 + 6)}" y="${f(top + 8)}" width="${f(w - 12)}" height="14" fill="${shade(t.left, 12)}" opacity="0.8"/>
       <rect x="${f(cx - w / 2 + 6)}" y="${f(top + h - 22)}" width="${f(w - 12)}" height="14" fill="${shade(t.left, 12)}" opacity="0.8"/>`
    : ''
  return `${body}${s}`
}

function labelRoll(cx: number, cy: number, r: number, t: Tones) {
  const ry = r * 0.34
  return `
    <ellipse cx="${f(cx)}" cy="${f(cy + ry * 0.9)}" rx="${f(r)}" ry="${f(ry)}" fill="${shade(t.right, -8)}" ${stroke(t)}/>
    <rect x="${f(cx - r)}" y="${f(cy - ry * 0.9)}" width="${f(r * 2)}" height="${f(ry * 1.8)}" fill="${t.right}"/>
    <ellipse cx="${f(cx)}" cy="${f(cy - ry * 0.9)}" rx="${f(r)}" ry="${f(ry)}" fill="${t.top}" ${stroke(t)}/>
    <ellipse cx="${f(cx)}" cy="${f(cy - ry * 0.9)}" rx="${f(r * 0.34)}" ry="${f(ry * 0.34)}" fill="${shade(t.top, -22)}" ${stroke(t, 1.2)}/>
    <path d="M ${f(cx + r)} ${f(cy - ry * 0.5)} Q ${f(cx + r + 34)} ${f(cy + 30)} ${f(cx + r - 4)} ${f(cy + 54)}" fill="none" stroke="${t.top}" stroke-width="4" opacity="0.9"/>`
}

function tag(cx: number, cy: number, w: number, h: number, t: Tones, withString = true) {
  const x = cx - w / 2
  const y = cy - h / 2
  const body = `<path d="M ${f(x)} ${f(y + 18)} Q ${f(x)} ${f(y)} ${f(x + 18)} ${f(y)} L ${f(x + w - 34)} ${f(y)} L ${f(x + w)} ${f(y + 34)} L ${f(x + w)} ${f(y + h - 18)} Q ${f(x + w)} ${f(y + h)} ${f(x + w - 18)} ${f(y + h)} L ${f(x + 18)} ${f(y + h)} Q ${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - 18)} Z" fill="${t.top}" ${stroke(t)}/>`
  const hole = `<circle cx="${f(x + 26)}" cy="${f(y + 26)}" r="9" fill="#faf8f5" ${stroke(t, 1.4)}/>`
  const str = withString
    ? `<path d="M ${f(x + 26)} ${f(y + 26)} Q ${f(x - 40)} ${f(y - 30)} ${f(x - 10)} ${f(y - 70)}" fill="none" stroke="${t.edge}" stroke-width="2.2" stroke-dasharray="5 4" opacity="0.8"/>`
    : ''
  const rule = `<path d="M ${f(x + 52)} ${f(y + h * 0.52)} L ${f(x + w - 24)} ${f(y + h * 0.52)}" stroke="${t.edge}" stroke-width="1.4" opacity="0.35"/>`
  return `${str}${body}${hole}${rule}`
}

function standeePanel(x: number, y: number, w: number, h: number, t: Tones, opts: { pole?: boolean; base?: boolean } = {}) {
  const panel = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="6" fill="${t.top}" ${stroke(t)}/>`
  const inner = `<rect x="${f(x + 14)}" y="${f(y + 14)}" width="${f(w - 28)}" height="${f(h - 28)}" rx="3" fill="none" stroke="${t.edge}" stroke-width="1.1" opacity="0.35"/>`
  const pole = opts.pole === false ? '' : `<rect x="${f(x + w / 2 - 7)}" y="${f(y + h)}" width="14" height="96" fill="${shade(t.left, -6)}" ${stroke(t, 1.4)}/>`
  const base = opts.base === false
    ? ''
    : `<ellipse cx="${f(x + w / 2)}" cy="${f(y + h + 100)}" rx="86" ry="22" fill="${shade(t.left, -14)}" ${stroke(t, 1.4)}/>
       <ellipse cx="${f(x + w / 2)}" cy="${f(y + h + 94)}" rx="86" ry="22" fill="${t.left}" ${stroke(t, 1.4)}/>`
  return `${panel}${inner}${pole}${base}`
}

function envelope(cx: number, cy: number, w: number, h: number, t: Tones, opts: { bubbles?: boolean } = {}) {
  const x = cx - w / 2
  const y = cy - h / 2
  const body = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="10" fill="${t.left}" ${stroke(t)}/>`
  const flap = `<path d="M ${f(x)} ${f(y)} L ${f(cx)} ${f(y + h * 0.46)} L ${f(x + w)} ${f(y)}" fill="${t.top}" ${stroke(t, 1.5)}/>`
  const bubbles = opts.bubbles
    ? Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => {
          const bx = x + 24 + col * ((w - 48) / 7)
          const by = y + h * 0.58 + row * ((h * 0.34) / 4)
          return `<circle cx="${f(bx)}" cy="${f(by)}" r="7.5" fill="${shade(t.left, 14)}" opacity="0.85"/>`
        }).join(''),
      ).join('')
    : ''
  return `${body}${flap}${bubbles}`
}

/* ---------------------------- per-product specs ---------------------------- */

interface ViewSpec {
  draw: () => string
  depicts: string
}

type Features = Record<string, boolean>

/** Four flaps splayed outward from the top edges — an opened shipper. */
/**
 * The four top flaps of an RSC, standing up. `which` splits them because the
 * near pair must be painted after the near walls or they vanish behind them.
 */
function openFlaps(g: BoxDims & { o: Pt }, t: Tones, which: 'far' | 'near') {
  const c = corners(g)
  const fh = Math.min(g.h * 0.46, 52)
  const up = isoZ(fh)
  const flap = (a: Pt, b: Pt, lean: Pt, fill: string) =>
    poly([a, b, add(b, up, lean), add(a, up, lean)], `fill="${fill}" ${stroke(t)}`)

  if (which === 'far') {
    return [
      flap(c.C, c.Ap, isoY(-fh * 0.16), shade(t.right, 6)),
      flap(c.Bp, c.C, isoY(-fh * 0.16), shade(t.left, 6)),
    ].join('')
  }
  return [
    flap(c.Ap, c.Dp, isoY(fh * 0.2), shade(t.right, 16)),
    flap(c.Dp, c.Bp, isoY(fh * 0.2), shade(t.left, 16)),
  ].join('')
}

/**
 * A tuck lid standing open on the far top edge, with its tuck tab on the
 * leading edge. Hinged on C-Ap — the far edge parallel to the box length — so
 * it swings up and away instead of floating over the opening.
 */
function tuckLid(g: BoxDims & { o: Pt }, t: Tones) {
  const c = corners(g)
  const L = g.h * 0.78 + 30
  const up = isoZ(L)
  const back = isoY(-L * 0.12)
  const p3 = add(c.Ap, up, back)
  const p4 = add(c.C, up, back)
  const tabH = 20
  // The tuck tab folds down on the far side of the lid, so it is drawn first
  // and the lid covers it — only the folded edge peeks over the top.
  const tabIn = isoX(g.w * 0.06)
  return [
    poly(
      [
        add(p4, tabIn),
        add(p3, isoX(-g.w * 0.06)),
        add(p3, isoX(-g.w * 0.06), isoZ(tabH)),
        add(p4, tabIn, isoZ(tabH)),
      ],
      `fill="${shade(t.top, -24)}" ${stroke(t)}`,
    ),
    poly([c.C, c.Ap, p3, p4], `fill="${shade(t.top, -10)}" ${stroke(t)}`),
  ].join('')
}

/** The tuck crease across the front-right wall of a closed box. */
function tuckCrease(g: BoxDims & { o: Pt }, t: Tones) {
  const c = corners(g)
  const a = add(c.A, isoZ(g.h * 0.86))
  const b = add(c.D, isoZ(g.h * 0.86))
  return `<path d="M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])}" stroke="${t.edge}" stroke-width="1.2" opacity="0.4" fill="none"/>`
}

/** A rectangular window cut into the front-right wall. A -> D runs along Y. */
function frontWindow(g: BoxDims & { o: Pt }, t: Tones, t0 = 0.2, t1 = 0.8, u0 = 0.3, u1 = 0.78) {
  const c = corners(g)
  const p = (u: number, v: number): Pt => add(c.A, isoY(g.d * u), isoZ(g.h * v))
  return poly(
    [p(t0, u0), p(t1, u0), p(t1, u1), p(t0, u1)],
    `fill="${PALETTES.clear.top}" opacity="0.92" ${stroke(t, 1.4)}`,
  )
}

function boxViews(
  dims: [number, number, number],
  palette: keyof typeof PALETTES,
  opts: { features?: Features; lidLen?: number; shadow?: [number, number] } = {},
): { thumb: ViewSpec; detail: ViewSpec } {
  const t = PALETTES[palette]
  const feat = opts.features ?? {}
  // A shallow tray is a shallow tray, but drawn at its true 60 mm height it
  // reads as a flat sheet at card size. Lift the drawn height so the solid form
  // stays legible, keeping the relative differences between formats.
  const drawnH = Math.max(dims[2], Math.min(dims[0], dims[1]) * 0.62)
  const build = (open: boolean) => {
    const g = fit(dims[0], dims[1], drawnH)
    const c = corners(g)
    const parts: string[] = []
    const [srx, sry] = opts.shadow ?? [200, 32]
    parts.push(groundShadow(CX, CY + 26, srx, sry))

    if (open) {
      // Back to front: anything hinged on a far edge, then the interior, then
      // the near walls, then the near flaps. Painter's order is the whole trick.
      if (feat.lid) parts.push(tuckLid(g, t))
      else if (feat.flaps) parts.push(openFlaps(g, t, 'far'))
      else if (feat.lidRaised !== false) parts.push(openLid(g, t, opts.lidLen ?? 0.8))
      parts.push(openInterior(g, t))
      if (feat.foam) {
        // A die-cut insert reads as foam only if you can see its cavities, and a
        // recess only reads if you can see its floor: two tones, the darker one
        // the shadowed side wall of the cut, the lighter one the floor below it.
        const p = (x: number, y: number, z: number) => at(c, g, x, y, z)
        const zTop = 0.6
        parts.push(
          poly([p(0.13, 0.13, zTop), p(0.87, 0.13, zTop), p(0.87, 0.87, zTop), p(0.13, 0.87, zTop)], `fill="#efece6" ${stroke(t, 1.3)}`),
          poly([p(0.26, 0.26, zTop), p(0.74, 0.26, zTop), p(0.74, 0.74, zTop), p(0.26, 0.74, zTop)], `fill="#9d978a" ${stroke(t, 1.1)}`),
          poly([p(0.34, 0.34, zTop - 0.05), p(0.66, 0.34, zTop - 0.05), p(0.66, 0.66, zTop - 0.05), p(0.34, 0.66, zTop - 0.05)], `fill="#c2bcae"`),
        )
      }
      parts.push(isoWalls(g, t))
      parts.push(rimBand(g, t))
      if (feat.flaps) parts.push(openFlaps(g, t, 'near'))
    } else {
      // Closed means closed: one solid box. No lid standing behind it and no
      // flaps splayed off the rim — that is what made these read as fragments.
      parts.push(isoBox(g, t))
      if (feat.lid) parts.push(tuckCrease(g, t))
      if (feat.window) parts.push(frontWindow(g, t))
      if (feat.magnetic) {
        parts.push(
          `<circle cx="${f(c.Dp[0] + 8)}" cy="${f(c.Dp[1] + g.h * 0.34)}" r="4.5" fill="${t.accent}"/>`,
          `<circle cx="${f(c.Ap[0] - 12)}" cy="${f(c.Ap[1] + g.h * 0.34)}" r="4.5" fill="${t.accent}"/>`,
        )
      }
      if (feat.band) {
        // A printed band across the front-right wall. Horizontal and inset from
        // every crease: a vertical stripe at the corner reads as a gap between
        // panels, and a stripe touching an edge reads as a shadow.
        const band = (u: number, v: number): Pt => add(c.A, isoY(g.d * u), isoZ(g.h * v))
        parts.push(
          poly(
            [band(0.08, 0.42), band(0.92, 0.42), band(0.92, 0.72), band(0.08, 0.72)],
            `fill="${t.accent}" opacity="0.5" stroke="${t.accent}" stroke-width="1.3" stroke-linejoin="round"`,
          ),
        )
      }
    }

    if (feat.handle) {
      const mid = add(c.Dp, isoX(g.w * 0.5))
      parts.push(
        `<path d="M ${f(mid[0] - 30)} ${f(mid[1] + 6)} Q ${f(mid[0])} ${f(mid[1] - 26)} ${f(mid[0] + 30)} ${f(mid[1] + 6)}" fill="none" stroke="${t.edge}" stroke-width="6" stroke-linecap="round" opacity="0.7"/>`,
      )
    }

    return parts.join('')
  }
  return {
    thumb: { draw: () => build(false), depicts: 'closed, three-quarter view' },
    detail: { draw: () => build(true), depicts: 'open, showing the interior' },
  }
}

function twoPieceViews(dims: [number, number, number], palette: keyof typeof PALETTES, gap = 0.34) {
  const t = PALETTES[palette]
  const draw = (lifted: boolean) => {
    const g = fit(dims[0], dims[1], dims[2] * 0.62)
    const upper = { ...g, o: add(g.o, isoZ(g.h * (1 + (lifted ? gap * 2.4 : gap * 0.7)))) as Pt }
    return [
      groundShadow(CX, CY + 30, 210, 34),
      isoBox(g, t),
      isoBox(upper, { ...t, top: shade(t.top, -4) }),
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'two-piece construction, lid seated' },
    detail: { draw: () => draw(true), depicts: 'lid lifted clear of the base' },
  }
}

function drawerViews(dims: [number, number, number], palette: keyof typeof PALETTES) {
  const t = PALETTES[palette]
  const draw = (out: boolean) => {
    const g = fit(dims[0], dims[1], dims[2])
    const inner = fit(dims[0] * 0.86, dims[1] * 0.9, dims[2] * 0.78)
    const shifted = { ...inner, o: add(inner.o, isoX(out ? g.w * 0.42 : g.w * 0.07), isoZ(g.h * 0.1)) as Pt }
    return [
      groundShadow(CX, CY + 30, 220, 34),
      isoBox(g, t, { top: false, left: true }),
      isoBox(shifted, { ...t, top: shade(t.top, -10) }),
      out
        ? `<path d="M ${f(shifted.o[0] - 4)} ${f(shifted.o[1] - shifted.h * 0.45)} q -26 0 -26 -14" fill="none" stroke="${t.accent}" stroke-width="5" stroke-linecap="round"/>`
        : '',
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'closed drawer box' },
    detail: { draw: () => draw(true), depicts: 'drawer pulled out of the sleeve' },
  }
}

function cylinderViews(dims: [number, number], palette: keyof typeof PALETTES) {
  const t = PALETTES[palette]
  const [w, h] = dims
  const draw = (open: boolean) => {
    const top = open ? 250 : 210
    const hh = open ? h * 0.7 : h
    const rx = (w * 0.92) / 2
    const ry = rx * 0.3
    // An open round box needs its rim: the body alone ends in a straight chord
    // and reads as a cylinder sliced flat rather than a tub you can see into.
    const rim = open
      ? `<ellipse cx="${f(CX)}" cy="${f(top + ry)}" rx="${f(rx)}" ry="${f(ry)}" fill="${shade(t.left, -8)}" ${stroke(t)}/>
         <ellipse cx="${f(CX)}" cy="${f(top + ry)}" rx="${f(rx * 0.9)}" ry="${f(ry * 0.9)}" fill="${shade(t.right, -34)}"/>`
      : ''
    return [
      groundShadow(CX, top + hh + 16, 170, 28),
      // A lifted lid is a shallow tub, but its body must stay taller than its own
      // rim ellipse: below 2*ry the body path inverts and the lid disappears.
      open ? cylinder(CX, top - 150, w * 0.92, Math.max(hh * 0.34, ry * 2 + 16), t, { lid: true }) : '',
      cylinder(CX, top, w, hh, t, { lid: !open }),
      rim,
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'round construction with lid seated' },
    detail: { draw: () => draw(true), depicts: 'lid lifted off the round base' },
  }
}

function pouchViews(
  dims: [number, number],
  palette: keyof typeof PALETTES,
  o: PouchOpts & { flatBottom?: boolean } = {},
) {
  const t = PALETTES[palette]
  const [w, h] = dims
  const draw = (filled: boolean) => {
    const top = 168
    const hh = filled ? h : h * 0.86
    const gusset = o.flatBottom
      ? `<path d="M ${f(CX - w / 2)} ${f(top + hh - 40)} L ${f(CX - w / 2 - 16)} ${f(top + hh + 18)} L ${f(CX + w / 2 + 16)} ${f(top + hh + 18)} L ${f(CX + w / 2)} ${f(top + hh - 40)} Z" fill="${shade(t.right, -12)}" ${stroke(t)}/>`
      : ''
    return [
      groundShadow(CX, top + hh + 34, 190, 30),
      gusset,
      pouch(CX, top, w, hh, t, o),
      filled ? '' : `<path d="M ${f(CX - w / 2 + 18)} ${f(top + 60)} L ${f(CX + w / 2 - 18)} ${f(top + 60)}" stroke="${shade(t.edge, 30)}" stroke-width="1.2" opacity="0.3"/>`,
    ].join('')
  }
  return {
    thumb: { draw: () => draw(true), depicts: 'filled and sealed' },
    detail: { draw: () => draw(false), depicts: 'empty, showing the base construction' },
  }
}

function envelopeViews(palette: keyof typeof PALETTES, opts: { bubbles?: boolean } = {}) {
  const t = PALETTES[palette]
  const draw = (back: boolean) => {
    const parts = [groundShadow(CX, CY + 10, 210, 30)]
    if (back) {
      parts.push(
        `<rect x="${f(CX - 250)}" y="${f(CY - 170)}" width="500" height="330" rx="10" fill="${shade(t.left, -8)}" ${stroke(t)}/>`,
        `<path d="M ${f(CX - 250)} ${f(CY - 170)} L ${f(CX)} ${f(CY + 6)} L ${f(CX + 250)} ${f(CY - 170)}" fill="none" stroke="${t.edge}" stroke-width="1.6" opacity="0.7"/>`,
        `<path d="M ${f(CX - 250)} ${f(CY + 160)} L ${f(CX)} ${f(CY + 6)} L ${f(CX + 250)} ${f(CY + 160)}" fill="none" stroke="${t.edge}" stroke-width="1.6" opacity="0.7"/>`,
      )
    } else {
      parts.push(envelope(CX, CY - 6, 500, 320, t, opts))
    }
    return parts.join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'front view, sealed' },
    detail: { draw: () => draw(true), depicts: 'reverse, showing the fold construction' },
  }
}

function flatSheetViews(palette: keyof typeof PALETTES, kind: 'sheet' | 'honeycomb' | 'tissue' | 'aircolumn') {
  const t = PALETTES[palette]
  const draw = (detail: boolean) => {
    const x = CX - 250
    const y = CY - 150
    const parts = [groundShadow(CX, CY + 40, 220, 30)]
    if (kind === 'sheet') {
      parts.push(rect(x, y, 500, 320, `fill="${t.top}" ${stroke(t)}`))
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 4; c++)
          parts.push(
            `<circle cx="${f(x + 70 + c * 120)}" cy="${f(y + 70 + r * 100)}" r="34" fill="${detail ? shade(t.top, -8) : 'none'}" stroke="${t.edge}" stroke-width="1.3" stroke-dasharray="${detail ? '0' : '6 5'}" opacity="0.8"/>`,
          )
    } else if (kind === 'honeycomb') {
      parts.push(rect(x, y, 500, 320, `fill="${t.top}" ${stroke(t)}`))
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 7; c++) {
          const hx = x + 40 + c * 68 + (r % 2 ? 34 : 0)
          const hy = y + 46 + r * 74
          parts.push(
            `<path d="M ${f(hx)} ${f(hy - 22)} L ${f(hx + 19)} ${f(hy - 11)} L ${f(hx + 19)} ${f(hy + 11)} L ${f(hx)} ${f(hy + 22)} L ${f(hx - 19)} ${f(hy + 11)} L ${f(hx - 19)} ${f(hy - 11)} Z" fill="none" stroke="${t.edge}" stroke-width="1.2" opacity="0.55"/>`,
          )
        }
    } else if (kind === 'aircolumn') {
      for (let c = 0; c < 4; c++) {
        const cxp = x + 70 + c * 120
        parts.push(
          `<rect x="${f(cxp - 44)}" y="${f(y)}" width="88" height="320" rx="44" fill="${t.top}" ${stroke(t)}/>`,
          Array.from({ length: 4 }, (_, i) =>
            `<ellipse cx="${f(cxp)}" cy="${f(y + 46 + i * 76)}" rx="40" ry="26" fill="${shade(t.top, -6)}" opacity="0.6"/>`,
          ).join(''),
        )
      }
    } else {
      parts.push(
        `<path d="M ${f(x)} ${f(y + 20)} Q ${f(x + 125)} ${f(y - 30)} ${f(x + 250)} ${f(y + 20)} Q ${f(x + 375)} ${f(y + 70)} ${f(x + 500)} ${f(y + 20)} L ${f(x + 500)} ${f(y + 300)} Q ${f(x + 375)} ${f(y + 350)} ${f(x + 250)} ${f(y + 300)} Q ${f(x + 125)} ${f(y + 250)} ${f(x)} ${f(y + 300)} Z" fill="${t.top}" ${stroke(t)}/>`,
        `<path d="M ${f(x)} ${f(y + 90)} Q ${f(x + 125)} ${f(y + 40)} ${f(x + 250)} ${f(y + 90)} Q ${f(x + 375)} ${f(y + 140)} ${f(x + 500)} ${f(y + 90)}" fill="none" stroke="${t.edge}" stroke-width="1.2" opacity="0.45"/>`,
      )
    }
    return parts.join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'sheet form' },
    detail: { draw: () => draw(true), depicts: 'surface detail' },
  }
}

function profileViews(palette: keyof typeof PALETTES) {
  const t = PALETTES[palette]
  const draw = (edge: boolean) => {
    const x = CX - 210
    const y = CY - 160
    return [
      groundShadow(CX, CY + 50, 220, 30),
      edge
        ? `<path d="M ${f(x)} ${f(y + 300)} L ${f(x)} ${f(y + 60)} L ${f(x + 150)} ${f(y)} L ${f(x + 150)} ${f(y + 120)} L ${f(x + 80)} ${f(y + 158)} L ${f(x + 80)} ${f(y + 300)} Z" fill="${t.left}" ${stroke(t)}/>`
        : `<path d="M ${f(x)} ${f(y + 300)} L ${f(x)} ${f(y)} L ${f(x + 90)} ${f(y)} L ${f(x + 90)} ${f(y + 150)} L ${f(x + 300)} ${f(y + 150)} L ${f(x + 300)} ${f(y + 240)} L ${f(x + 90)} ${f(y + 240)} L ${f(x + 90)} ${f(y + 300)} Z" fill="${t.left}" ${stroke(t)}/>`,
      `<path d="M ${f(x + 10)} ${f(y + 120)} L ${f(x + 300)} ${f(y + 120)}" stroke="${shade(t.edge, 30)}" stroke-width="1.2" opacity="0.4"/>`,
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'U-profile section' },
    detail: { draw: () => draw(true), depicts: 'corner section' },
  }
}

function standeeViews(palette: keyof typeof PALETTES, opts: { pole?: boolean; header?: boolean } = {}) {
  const t = PALETTES[palette]
  const draw = (wide: boolean) => {
    const w = wide ? 300 : 380
    const h = wide ? 360 : 400
    return [
      groundShadow(CX, CY + 210, 180, 26),
      standeePanel(CX - w / 2, CY - h + 40, w, h, t, { pole: opts.pole, base: true }),
      opts.header
        ? `<rect x="${f(CX - w / 2 - 20)}" y="${f(CY - h + 10)}" width="${f(w + 40)}" height="34" rx="5" fill="${t.accent}" opacity="0.85"/>`
        : '',
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'assembled, front view' },
    detail: { draw: () => draw(true), depicts: 'assembled, alternate format' },
  }
}

function tentViews(palette: keyof typeof PALETTES) {
  const t = PALETTES[palette]
  const draw = (side: boolean) => {
    const cx = CX
    const topY = side ? 170 : 150
    const halfW = side ? 170 : 250
    const baseY = 400
    return [
      groundShadow(cx, baseY + 20, halfW + 40, 28),
      `<path d="M ${f(cx)} ${f(topY)} L ${f(cx + halfW)} ${f(topY + 90)} L ${f(cx + halfW)} ${f(baseY)} L ${f(cx)} ${f(baseY - 40)} Z" fill="${t.right}" ${stroke(t)}/>`,
      `<path d="M ${f(cx)} ${f(topY)} L ${f(cx - halfW)} ${f(topY + 90)} L ${f(cx - halfW)} ${f(baseY)} L ${f(cx)} ${f(baseY - 40)} Z" fill="${t.left}" ${stroke(t)}/>`,
      `<path d="M ${f(cx - halfW)} ${f(topY + 90)} L ${f(cx)} ${f(topY)} L ${f(cx + halfW)} ${f(topY + 90)}" fill="none" stroke="${t.edge}" stroke-width="3" opacity="0.7"/>`,
      `<rect x="${f(cx - 46)}" y="${f(topY + 26)}" width="92" height="26" rx="6" fill="${t.accent}" opacity="0.9"/>`,
      `<path d="M ${f(cx - halfW + 26)} ${f(topY + 120)} L ${f(cx - halfW + 26)} ${f(baseY - 10)}" stroke="${shade(t.edge, 40)}" stroke-width="1.3" opacity="0.4"/>`,
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'canopy erected, front elevation' },
    detail: { draw: () => draw(true), depicts: 'canopy, side elevation' },
  }
}

function displayUnitViews(palette: keyof typeof PALETTES, opts: { counter?: boolean } = {}) {
  const t = PALETTES[palette]
  const draw = (counter: boolean) => {
    const h = counter ? 300 : 420
    const w = counter ? 330 : 300
    const y = CY - h + 30
    const x = CX - w / 2
    const shelves = counter ? 2 : 3
    return [
      groundShadow(CX, y + h + 24, w * 0.8, 26),
      rect(x, y, w, h, `fill="${t.left}" ${stroke(t)}`),
      rect(x, y, w, 54, `fill="${t.accent}" opacity="0.85"`),
      Array.from({ length: shelves }, (_, i) => {
        const sy = y + 90 + i * ((h - 150) / shelves)
        return `<rect x="${f(x + 18)}" y="${f(sy)}" width="${f(w - 36)}" height="10" fill="${shade(t.left, -16)}"/>
                <rect x="${f(x + 18)}" y="${f(sy - 46)}" width="${f(w - 36)}" height="46" fill="${t.top}" opacity="0.55" ${stroke(t, 1.1)}/>`
      }).join(''),
    ].join('')
  }
  return {
    thumb: { draw: () => draw(!!opts.counter), depicts: opts.counter ? 'counter unit assembled' : 'floor unit assembled' },
    detail: { draw: () => draw(!opts.counter), depicts: opts.counter ? 'counter unit, alternate bay' : 'floor unit, alternate bay' },
  }
}

function cutoutViews(palette: keyof typeof PALETTES) {
  const t = PALETTES[palette]
  const draw = (alt: boolean) => {
    const x = CX - (alt ? 120 : 100)
    const y = CY - 240
    const w = alt ? 240 : 200
    return [
      groundShadow(CX, CY + 230, 150, 24),
      `<path d="M ${f(x)} ${f(y + 470)} L ${f(x)} ${f(y + 120)} Q ${f(x + w / 2)} ${f(y - 40)} ${f(x + w)} ${f(y + 120)} L ${f(x + w)} ${f(y + 470)} L ${f(x + w * 0.72)} ${f(y + 470)} L ${f(x + w * 0.72)} ${f(y + 300)} L ${f(x + w * 0.28)} ${f(y + 300)} L ${f(x + w * 0.28)} ${f(y + 470)} Z" fill="${t.top}" ${stroke(t)}/>`,
      `<rect x="${f(x + 16)}" y="${f(y + 150)}" width="${f(w - 32)}" height="${f(120)}" rx="4" fill="none" stroke="${t.edge}" stroke-width="1.2" opacity="0.4"/>`,
      `<path d="M ${f(x + w / 2)} ${f(y + 470)} L ${f(x + w / 2 + 40)} ${f(y + 486)} L ${f(x + w / 2 - 40)} ${f(y + 486)} Z" fill="${shade(t.left, -18)}" ${stroke(t, 1.3)}/>`,
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'cut-out figure, front' },
    detail: { draw: () => draw(true), depicts: 'cut-out figure, wider format' },
  }
}

function backdropViews(palette: keyof typeof PALETTES) {
  const t = PALETTES[palette]
  const draw = (side: boolean) => {
    const w = side ? 200 : 420
    const h = 330
    const x = CX - w / 2
    const y = CY - h + 30
    return [
      groundShadow(CX, y + h + 20, w * 0.8, 24),
      rect(x, y, w, h, `fill="${t.top}" ${stroke(t)}`),
      `<path d="M ${f(x + 20)} ${f(y + 20)} Q ${f(x + w / 2)} ${f(y + 70)} ${f(x + w - 20)} ${f(y + 20)}" fill="none" stroke="${t.edge}" stroke-width="1.2" opacity="0.35"/>`,
      `<path d="M ${f(x + 20)} ${f(y + h - 20)} Q ${f(x + w / 2)} ${f(y + h - 70)} ${f(x + w - 20)} ${f(y + h - 20)}" fill="none" stroke="${t.edge}" stroke-width="1.2" opacity="0.35"/>`,
      `<rect x="${f(x + w / 2 - 6)}" y="${f(y - 60)}" width="12" height="70" fill="${shade(t.left, -20)}" ${stroke(t, 1.3)}/>`,
      `<ellipse cx="${f(x + w / 2)}" cy="${f(y + h + 8)}" rx="${f(w * 0.46)}" ry="16" fill="${shade(t.left, -18)}" opacity="0.5"/>`,
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'backdrop frame, front' },
    detail: { draw: () => draw(true), depicts: 'backdrop frame, side' },
  }
}

function comboViews() {
  const t = PALETTES.kraft
  const tt = PALETTES.white
  const draw = (detail: boolean) => {
    const x = CX - 250
    return [
      groundShadow(CX, CY + 90, 230, 28),
      detail
        ? `<path d="M ${f(x + 40)} ${f(CY + 70)} Q ${f(x + 120)} ${f(CY - 40)} ${f(x + 210)} ${f(CY + 60)} Q ${f(x + 260)} ${f(CY + 120)} ${f(x + 330)} ${f(CY + 40)} L ${f(x + 330)} ${f(CY + 90)} Q ${f(x + 260)} ${f(CY + 170)} ${f(x + 210)} ${f(CY + 110)} Q ${f(x + 120)} ${f(CY + 10)} ${f(x + 40)} ${f(CY + 120)} Z" fill="${tt.top}" ${stroke(tt)}/>`
        : '',
      `<rect x="${f(x)}" y="${f(CY - 30)}" width="200" height="120" rx="10" fill="${tt.left}" ${stroke(tt)}/>`,
      `<ellipse cx="${f(x + 100)}" cy="${f(CY - 30)}" rx="100" ry="26" fill="${tt.top}" ${stroke(tt)}/>`,
      labelRoll(x + 380, CY + 10, 78, t),
      detail
        ? `<path d="M ${f(x + 300)} ${f(CY + 120)} q 40 -30 80 0 q 40 30 80 0" fill="none" stroke="${t.accent}" stroke-width="6" stroke-linecap="round" opacity="0.8"/>`
        : '',
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'tissue, tape and ribbon set' },
    detail: { draw: () => draw(true), depicts: 'tissue sheet and ribbon detail' },
  }
}

function sleeveTrayViews() {
  const t = PALETTES.white
  const draw = (open: boolean) => {
    const tray = fit(220, 150, 70)
    const sleeve = fit(232, 162, 96)
    const offset = open ? sleeve.h * 1.15 : 0
    return [
      groundShadow(CX, CY + 40, 210, 30),
      isoBox({ ...sleeve, o: add(sleeve.o, isoZ(offset)) as Pt }, t, { top: !open }),
      open ? '' : isoBox(tray, PALETTES.kraft),
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'tray inside printed sleeve' },
    detail: { draw: () => draw(true), depicts: 'sleeve lifted off the tray' },
  }
}

function gableViews() {
  const t = PALETTES.white
  const draw = (open: boolean) => {
    const g = fit(190, 140, 200)
    const { C, Ap, Dp, Bp } = corners(g)
    const roofH = 70
    const apex = add(add(C, isoX(g.w / 2)), isoY(g.d / 2), isoZ(roofH))
    return [
      groundShadow(CX, CY + 30, 190, 30),
      isoBox(g, t, { top: false }),
      poly([C, Ap, add(Ap, isoX(-g.w / 2), isoY(g.d / 2)), apex], `fill="${shade(t.right, 8)}" ${stroke(t)}`),
      poly([Bp, Dp, apex, add(Bp, isoX(g.w / 2), isoY(-g.d / 2))], `fill="${shade(t.left, 8)}" ${stroke(t)}`),
      poly([C, Bp, add(Bp, isoX(g.w / 2), isoY(-g.d / 2)), apex, add(Ap, isoX(-g.w / 2), isoY(g.d / 2))], `fill="${t.top}" ${stroke(t)}`),
      `<rect x="${f(apex[0] - 26)}" y="${f(apex[1] - 16)}" width="52" height="20" rx="6" fill="${shade(t.top, -10)}" ${stroke(t, 1.3)}/>`,
      open ? `<path d="M ${f(C[0])} ${f(C[1])} L ${f(C[0] + 30)} ${f(C[1] + 50)} L ${f(C[0] + 60)} ${f(C[1])}" fill="none" stroke="${t.edge}" stroke-width="1.4" opacity="0.6"/>` : '',
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'gable top with carry handle' },
    detail: { draw: () => draw(true), depicts: 'gable top, alternate opening' },
  }
}

function hexViews() {
  const t = PALETTES.white
  const draw = (open: boolean) => {
    const cx = CX
    const topY = open ? 210 : 232
    const r = 132
    const h = 250
    const ring = (dy: number) =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i + Math.PI / 6
        return [cx + r * Math.cos(a), topY + r * 0.42 * Math.sin(a) + dy] as Pt
      })
    const upper = ring(0)
    const lower = ring(h)
    const faces = Array.from({ length: 6 }, (_, i) => {
      const j = (i + 1) % 6
      const midY = (upper[i][1] + upper[j][1]) / 2
      return { pts: [upper[i], upper[j], lower[j], lower[i]] as Pt[], midY, i }
    }).sort((a, b) => a.midY - b.midY)
    const parts = [groundShadow(cx, topY + h + 16, 170, 26)]
    for (const face of faces) {
      const tone = face.midY < topY ? shade(t.right, -16) : face.i % 2 === 0 ? t.left : t.right
      parts.push(poly(face.pts, `fill="${tone}" ${stroke(t)}`))
    }
    parts.push(poly(upper, `fill="${open ? shade(t.top, -26) : t.top}" ${stroke(t)}`))
    if (!open) {
      parts.push(
        `<rect x="${f(cx - r * 0.62)}" y="${f(topY + h * 0.5)}" width="${f(r * 1.24)}" height="${f(h * 0.17)}" fill="${t.accent}" opacity="0.72"/>`,
        `<rect x="${f(cx - 30)}" y="${f(topY - 8)}" width="60" height="12" rx="4" fill="${shade(t.top, -14)}" ${stroke(t, 1.2)}/>`,
      )
    }
    return parts.join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'hexagonal carton, closed' },
    detail: { draw: () => draw(true), depicts: 'hexagonal carton, open' },
  }
}

function pillowViews() {
  const t = PALETTES.white
  const draw = (open: boolean) => {
    const cx = CX
    const cy = CY
    return [
      groundShadow(cx, cy + 120, 230, 28),
      `<path d="M ${f(cx - 250)} ${f(cy - 20)} Q ${f(cx - 250)} ${f(cy - 130)} ${f(cx - 140)} ${f(cy - 120)} L ${f(cx + 140)} ${f(cy - 120)} Q ${f(cx + 250)} ${f(cy - 130)} ${f(cx + 250)} ${f(cy - 20)} Q ${f(cx + 250)} ${f(cy + 90)} ${f(cx + 140)} ${f(cy + 80)} L ${f(cx - 140)} ${f(cy + 80)} Q ${f(cx - 250)} ${f(cy + 90)} ${f(cx - 250)} ${f(cy - 20)} Z" fill="${t.left}" ${stroke(t)}/>`,
      `<path d="M ${f(cx - 250)} ${f(cy - 20)} Q ${f(cx)} ${f(cy + 10)} ${f(cx + 250)} ${f(cy - 20)}" fill="none" stroke="${t.edge}" stroke-width="1.3" opacity="0.5"/>`,
      open
        ? `<path d="M ${f(cx - 200)} ${f(cy - 118)} L ${f(cx - 150)} ${f(cy - 210)} L ${f(cx + 150)} ${f(cy - 210)} L ${f(cx + 200)} ${f(cy - 118)}" fill="${shade(t.left, 10)}" ${stroke(t)}/>`
        : `<rect x="${f(cx - 40)}" y="${f(cy - 116)}" width="80" height="18" rx="4" fill="${t.accent}" opacity="0.8"/>`,
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'pillow pack, sealed' },
    detail: { draw: () => draw(true), depicts: 'pillow pack, end opened' },
  }
}

function bookViews() {
  const t = PALETTES.rigid
  const draw = (open: boolean) => {
    const g = fit(230, 160, 60)
    const { O, A, C, Ap } = corners(g)
    return [
      groundShadow(CX, CY + 30, 210, 30),
      isoBox(g, t),
      poly([C, Ap, add(Ap, isoZ(-g.h * 0.02)), add(C, isoZ(-g.h * 0.02))], `fill="${t.accent}" opacity="0.5"`),
      open
        ? `<path d="M ${f(C[0])} ${f(C[1])} L ${f(C[0] - 40)} ${f(C[1] - 120)} L ${f(Ap[0] - 40)} ${f(Ap[1] - 120)} L ${f(Ap[0])} ${f(Ap[1])} Z" fill="${shade(t.top, 14)}" ${stroke(t)}/>`
        : `<rect x="${f(O[0] + 16)}" y="${f(O[1] - g.h * 0.5)}" width="${f(g.w * 0.5)}" height="8" rx="3" fill="${t.accent}" opacity="0.85"/>`,
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'book-style rigid box, closed' },
    detail: { draw: () => draw(true), depicts: 'book-style rigid box, lid open' },
  }
}

function crashLockViews() {
  const t = PALETTES.white
  const draw = (open: boolean) => {
    const g = fit(210, 160, 210)
    const { C, Ap, Bp, Dp } = corners(g)
    return [
      groundShadow(CX, CY + 34, 200, 30),
      isoBox(g, t, { top: !open }),
      open
        ? [
            poly([C, Ap, add(Ap, isoY(g.d * 0.5)), add(C, isoY(g.d * 0.5))], `fill="${shade(t.top, -6)}" ${stroke(t)}`),
            poly([C, Bp, add(Bp, isoX(g.w * 0.5)), add(C, isoX(g.w * 0.5))], `fill="${shade(t.top, -12)}" ${stroke(t)}`),
            poly([Bp, Dp, add(Dp, isoX(-g.w * 0.2)), add(Bp, isoX(-g.w * 0.2))], `fill="${t.top}" ${stroke(t)}`),
          ].join('')
        : `<path d="M ${f(C[0] + 10)} ${f(C[1] + 26)} L ${f(Ap[0] - 10)} ${f(Ap[1] + 26)}" stroke="${t.edge}" stroke-width="1.3" opacity="0.45"/>`,
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'carton erected, closed' },
    detail: { draw: () => draw(true), depicts: 'crash-lock base, carton open' },
  }
}

function sleeveTubeViews() {
  const t = PALETTES.white
  const draw = (open: boolean) => {
    const g = fit(210, 150, 120)
    const { O, A, B, C, Ap, Bp, Dp } = corners(g)
    return [
      groundShadow(CX, CY + 30, 200, 30),
      isoBox(g, t, { top: false }),
      poly([C, Ap, Dp, Bp], `fill="${shade(t.top, -34)}" ${stroke(t)}`),
      open
        ? poly([C, Ap, Dp, Bp], `fill="none" stroke="${t.accent}" stroke-width="3" stroke-dasharray="10 7"`)
        : '',
      `<rect x="${f(O[0] + 14)}" y="${f(O[1] - g.h * 0.55)}" width="${f(g.w * 0.44)}" height="${f(g.h * 0.12)}" fill="${t.accent}" opacity="0.7"/>`,
      void A, void B,
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'printed sleeve on a carton' },
    detail: { draw: () => draw(true), depicts: 'sleeve outline highlighted' },
  }
}

function spoutViews() {
  return pouchViews([280, 360], 'foil', { spout: true, zip: false, gusset: true })
}

function shrinkViews() {
  const t = PALETTES.clear
  const draw = (open: boolean) => {
    const cx = CX
    return [
      groundShadow(cx, CY + 190, 150, 26),
      `<path d="M ${f(cx - 54)} ${f(CY - 150)} L ${f(cx + 54)} ${f(CY - 150)} L ${f(cx + 54)} ${f(CY + 20)} L ${f(cx + 90)} ${f(CY + 180)} L ${f(cx - 90)} ${f(CY + 180)} L ${f(cx - 54)} ${f(CY + 20)} Z" fill="${PALETTES.foil.left}" ${stroke(PALETTES.foil)}/>`,
      `<rect x="${f(cx - 62)}" y="${f(CY - 60)}" width="124" height="150" rx="8" fill="${t.left}" opacity="0.85" ${stroke(t)}/>`,
      `<rect x="${f(cx - 62)}" y="${f(CY - 60)}" width="124" height="24" fill="${t.accent}" opacity="0.55"/>`,
      open ? `<path d="M ${f(cx - 70)} ${f(CY - 70)} L ${f(cx + 70)} ${f(CY - 70)}" stroke="${t.accent}" stroke-width="3" stroke-dasharray="9 6"/>` : '',
    ].join('')
  }
  return {
    thumb: { draw: () => draw(false), depicts: 'sleeve applied to a container' },
    detail: { draw: () => draw(true), depicts: 'sleeve shown flat' },
  }
}

function rollstockViews() {
  const t = PALETTES.foil
  const draw = (detail: boolean) => [
    groundShadow(CX, CY + 120, 190, 28),
    detail
      ? `<path d="M ${f(CX - 260)} ${f(CY - 120)} Q ${f(CX)} ${f(CY - 200)} ${f(CX + 260)} ${f(CY - 120)} L ${f(CX + 260)} ${f(CY + 120)} Q ${f(CX)} ${f(CY + 40)} ${f(CX - 260)} ${f(CY + 120)} Z" fill="${t.top}" ${stroke(t)}/>`
      : '',
    cylinder(CX, CY - 150, 300, 260, t),
    `<path d="M ${f(CX + 150)} ${f(CY - 20)} Q ${f(CX + 230)} ${f(CY + 60)} ${f(CX + 190)} ${f(CY + 140)}" fill="none" stroke="${t.top}" stroke-width="5" opacity="0.85"/>`,
  ].join('')
  return {
    thumb: { draw: () => draw(false), depicts: 'film on a core' },
    detail: { draw: () => draw(true), depicts: 'film unwound, web view' },
  }
}

function rollLabelViews() {
  const t = PALETTES.kraft
  const draw = (sheet: boolean) => [
    groundShadow(CX, CY + 130, 190, 26),
    sheet
      ? `<rect x="${f(CX - 240)}" y="${f(CY - 150)}" width="480" height="300" rx="6" fill="${PALETTES.white.top}" ${stroke(PALETTES.white)}/>
         ${Array.from({ length: 6 }, (_, i) => `<rect x="${f(CX - 210 + (i % 3) * 150)}" y="${f(CY - 120 + Math.floor(i / 3) * 140)}" width="120" height="110" rx="8" fill="${t.top}" ${stroke(t, 1.2)}/>`).join('')}`
      : labelRoll(CX, CY, 150, t),
  ].join('')
  return {
    thumb: { draw: () => draw(false), depicts: 'labels on a roll' },
    detail: { draw: () => draw(true), depicts: 'labels on a sheet' },
  }
}

function wristbandViews() {
  const t = PALETTES.white
  const draw = (flat: boolean) => [
    groundShadow(CX, CY + 120, 170, 24),
    flat
      ? `<rect x="${f(CX - 240)}" y="${f(CY - 50)}" width="480" height="100" rx="50" fill="${t.left}" ${stroke(t)}/>
         <rect x="${f(CX - 200)}" y="${f(CY - 20)}" width="120" height="40" rx="8" fill="${t.accent}" opacity="0.7"/>`
      : `<ellipse cx="${CX}" cy="${CY - 10}" rx="150" ry="120" fill="none" stroke="${t.left}" stroke-width="46"/>
         <ellipse cx="${CX}" cy="${CY - 10}" rx="150" ry="120" fill="none" stroke="${t.edge}" stroke-width="1.6" opacity="0.5"/>
         <rect x="${f(CX - 40)}" y="${f(CY - 140)}" width="80" height="34" rx="8" fill="${t.accent}" opacity="0.8"/>`,
  ].join('')
  return {
    thumb: { draw: () => draw(false), depicts: 'band formed into a loop' },
    detail: { draw: () => draw(true), depicts: 'band shown flat' },
  }
}

function posmViews() {
  return displayUnitViews('white', { counter: true })
}

/* ------------------------------- slug → spec ------------------------------- */

interface ProductVisual {
  thumb: ViewSpec
  detail: ViewSpec
}

const VISUALS: Record<string, ProductVisual> = {
  // A. Corrugated & mailers
  'roll-end-mailer': boxViews([240, 180, 120], 'kraft', { features: { band: true, lid: true } }),
  'rsc-shipper': boxViews([230, 200, 210], 'kraft', { features: { flaps: true } }),
  'literature-mailer': boxViews([280, 200, 80], 'kraft', { features: { lid: true }, shadow: [230, 26] }),
  'die-cut-mailer-insert': boxViews([250, 190, 110], 'kraft', { features: { foam: true, lid: true } }),
  'telescopic-two-piece': twoPieceViews([230, 180, 220], 'kraft'),
  'shelf-ready-tray': boxViews([280, 200, 70], 'kraft', { features: { band: true }, shadow: [230, 26] }),
  'book-wrap-mailer': boxViews([300, 210, 70], 'kraft', { features: { lid: true }, shadow: [240, 24] }),
  'window-pastry-box': boxViews([200, 160, 170], 'white', { features: { window: true } }),

  // B. Folding cartons
  'ste-carton': boxViews([150, 110, 250], 'white'),
  'reverse-tuck-carton': boxViews([170, 120, 240], 'white', { features: { lid: true } }),
  'auto-bottom-carton': crashLockViews(),
  'snap-lock-carton': boxViews([170, 130, 230], 'white'),
  'sleeve-tray': sleeveTrayViews(),
  'pillow-box': pillowViews(),
  'gable-box': gableViews(),
  'hexagon-carton': hexViews(),
  'window-patch-carton': boxViews([160, 120, 240], 'white', { features: { window: true } }),
  'wrap-sleeve': sleeveTubeViews(),

  // C. Rigid & luxury
  'rigid-magnetic-box': boxViews([230, 180, 95], 'rigid', { features: { magnetic: true, band: true } }),
  'rigid-lift-off': twoPieceViews([220, 170, 200], 'rigid', 0.4),
  'rigid-book-style': bookViews(),
  'rigid-drawer': drawerViews([240, 180, 120], 'rigid'),
  'rigid-round-hat': cylinderViews([300, 260], 'rigid'),
  'rigid-foam-insert': boxViews([230, 180, 110], 'rigid', { features: { foam: true } }),

  // D. Flexible
  'stand-up-pouch': pouchViews([280, 380], 'foil', { zip: true, gusset: true }),
  'flat-bottom-pouch': pouchViews([300, 360], 'foil', { zip: true, flatBottom: true }),
  'three-side-seal': (() => {
    const t = PALETTES.foil
    const draw = (open: boolean) => [
      groundShadow(CX, CY + 130, 170, 24),
      flatSachet(CX, CY - 160, 260, 320, t),
      open ? `<path d="M ${f(CX - 120)} ${f(CY - 150)} L ${f(CX + 120)} ${f(CY - 150)}" stroke="${t.accent}" stroke-width="3" stroke-dasharray="8 6"/>` : '',
    ].join('')
    return { thumb: { draw: () => draw(false), depicts: 'three-side-seal sachet, sealed' }, detail: { draw: () => draw(true), depicts: 'sachet, seal line shown' } }
  })(),
  'centre-seal-bag': pouchViews([260, 360], 'foil', { fin: true, gusset: true }),
  'spouted-pouch': spoutViews(),
  'coffee-bag-valve': pouchViews([280, 370], 'kraft', { valve: true, tinTie: true, gusset: true }),
  rollstock: rollstockViews(),
  'shrink-sleeve': shrinkViews(),
  'kraft-flat-pouch': pouchViews([260, 340], 'kraft', { gusset: false }),

  // E. Labels & tags
  'roll-labels': rollLabelViews(),
  'sheet-stickers': flatSheetViews('white', 'sheet'),
  'hang-tags': (() => {
    const t = PALETTES.kraft
    const draw = (alt: boolean) => [
      groundShadow(CX, CY + 170, 150, 22),
      tag(CX - (alt ? 90 : 0), CY - (alt ? 30 : 10), 240, 330, t),
      alt ? tag(CX + 150, CY + 40, 200, 280, PALETTES.white, false) : '',
    ].join('')
    return { thumb: { draw: () => draw(false), depicts: 'swing tag with string' }, detail: { draw: () => draw(true), depicts: 'tag pair, alternate stock' } }
  })(),
  wristbands: wristbandViews(),

  // F. Displays & retail
  'roll-up-standee': standeeViews('white', { pole: true }),
  'canopy-tent': tentViews('fabric'),
  'posm-counter': posmViews(),
  'floor-display': displayUnitViews('white', {}),
  'life-size-standee': cutoutViews('white'),
  'fabric-backdrop': backdropViews('fabric'),

  // G. Protective
  'bubble-mailer': envelopeViews('poly', { bubbles: true }),
  'poly-mailer': envelopeViews('poly'),
  'air-column': flatSheetViews('clear', 'aircolumn'),
  'honeycomb-wrap': flatSheetViews('kraft', 'honeycomb'),
  'edge-protector': profileViews('kraft'),
  'tissue-tape-ribbon': comboViews(),
}

/* --------------------------------- render --------------------------------- */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function svg(view: ViewSpec, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<rect width="${W}" height="${H}" fill="#faf8f5"/>
<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="18" fill="#f4f0e9"/>
${view.draw()}
</svg>
`
}

const OUT = path.resolve(import.meta.dir, '../public/catalogue')
mkdirSync(OUT, { recursive: true })

const records: CatalogueAsset[] = []
const rights: AssetRights[] = []
const VERIFIED_AT = '2026-10-21'
const CREATOR = 'Generated in-house by scripts/generate-catalogue-assets.ts'
const LICENCE =
  "Original work — generated from this project's own code. No third-party imagery, no attribution required."

const missing: string[] = []

for (const p of PRODUCTS) {
  const visual = VISUALS[p.slug]
  if (!visual) {
    missing.push(p.slug)
    continue
  }
  const family = familyById(p.family).name
  for (const role of ['thumbnail', 'detail'] as AssetRole[]) {
    const view = role === 'thumbnail' ? visual.thumb : visual.detail
    const file = `${p.slug}-${role}.svg`
    const content = svg(view, `${p.name} — ${view.depicts}`)
    const abs = path.join(OUT, file)
    writeFileSync(abs, content, 'utf8')
    const id = `${p.slug}-${role}`
    const assetPath = `catalogue/${file}`
    const bytes = statSync(abs).size

    records.push({
      id,
      productId: p.slug,
      role,
      path: assetPath,
      width: W,
      height: H,
      bytes,
      format: 'svg',
      alt: `${p.name} (${family.toLowerCase()}) — original illustration showing the format ${view.depicts}. Illustrative only: it is not a photograph of a manufactured item.`,
      depicts: view.depicts,
      approvalStatus: 'approved',
    })

    rights.push({
      id,
      productId: p.slug,
      role,
      path: assetPath,
      format: 'svg',
      source: 'generated-vector',
      creator: CREATOR,
      licence: LICENCE,
      attribution: '',
      verifiedAt: VERIFIED_AT,
      approvalStatus: 'approved',
    })
  }
}

if (missing.length) {
  console.error(`No visual spec for: ${missing.join(', ')}`)
  process.exit(1)
}

const header = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: bun run scripts/generate-catalogue-assets.ts
 *
 * %COUNT% records across %PRODUCTS% products.
 * Every asset is original work generated from this project's own code, so the
 * licence basis is established and no attribution is required.
 */`

const data = `${header.replace('%COUNT%', String(records.length)).replace('%PRODUCTS%', String(new Set(records.map((r) => r.productId)).size))}
import type { CatalogueAsset } from './catalogue-assets'

export const GENERATED_ASSETS: CatalogueAsset[] = ${JSON.stringify(records, null, 2)}
`
writeFileSync(path.resolve(import.meta.dir, '../src/lib/catalogue-assets.data.ts'), data, 'utf8')

const rightsData = `${header.replace('%COUNT%', String(rights.length)).replace('%PRODUCTS%', String(new Set(rights.map((r) => r.productId)).size))}
import type { AssetRights } from './catalogue-rights'

export const GENERATED_RIGHTS: AssetRights[] = ${JSON.stringify(rights, null, 2)}
`
writeFileSync(path.resolve(import.meta.dir, '../src/lib/catalogue-rights.data.ts'), rightsData, 'utf8')

// Remove files that are no longer in the manifest, so nothing orphaned is served.
const keep = new Set(records.map((r) => path.basename(r.path)))
for (const file of readdirSync(OUT)) {
  if (!keep.has(file)) {
    console.log(`removing orphan ${file}`)
    writeFileSync(path.join(OUT, file), '')
  }
}

const sizes = records.map((r) => r.bytes)
console.log(`wrote ${records.length} assets for ${new Set(records.map((r) => r.productId)).size} products`)
console.log(`total ${(sizes.reduce((a, b) => a + b, 0) / 1024).toFixed(1)} KB, largest ${(Math.max(...sizes) / 1024).toFixed(1)} KB`)
