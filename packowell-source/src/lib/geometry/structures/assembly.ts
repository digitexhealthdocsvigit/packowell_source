import * as THREE from 'three'
import type { BoardOption, BuildCtx, BuiltPart, StructureSpec } from '../types'

/* ------------------------------------------------------------------ */
/* geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/** A flexible panel with a cylindrical bulge and a tapered neck. */
export function membranePanel(
  w: number,
  h: number,
  bulge: number,
  opts: { taper?: number; segX?: number; segY?: number } = {},
): THREE.BufferGeometry {
  const nx = opts.segX ?? 22
  const ny = opts.segY ?? 16
  const taper = opts.taper ?? 0.14
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []

  for (let j = 0; j <= ny; j++) {
    const v = j / ny
    const y = v * h
    const tw = 1 - taper * Math.max(0, (v - 0.7) / 0.3)
    for (let i = 0; i <= nx; i++) {
      const u = i / nx
      const x = (u - 0.5) * w * tw
      const edge = Math.min(1, (1 - v) / 0.16) * Math.min(1, v / 0.07)
      const z = bulge * Math.cos(Math.PI * (u - 0.5)) * edge
      pos.push(x, y, z)
      uv.push(u, v)
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i
      const b = a + 1
      const c = a + nx + 1
      const d = c + 1
      idx.push(a, b, d, a, d, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d)
}

/* ------------------------------------------------------------------ */
/* 5. Stand-up pouch                                                   */
/* ------------------------------------------------------------------ */

export const POUCH_BOARD: BoardOption = {
  id: 'pet-al-pe',
  label: 'PET / AL / PE barrier',
  thickness: 0.14,
  material: 'film-metalised',
  spec: '4-layer · 140 µm',
}

function buildPouch(ctx: BuildCtx): BuiltPart[] {
  const { l: L, h: H } = ctx.dims
  const depth = Math.max(30, Math.min(120, ctx.dims.w * 0.38))
  const sealH = Math.max(18, H * 0.12)
  const bodyH = H
  const zipY = bodyH * 0.92
  const bulge = depth * 0.32

  const front = membranePanel(L, bodyH, bulge)
  const back = membranePanel(L, bodyH, bulge)
  back.rotateY(Math.PI)
  back.translate(0, 0, 0)

  const gusset = new THREE.BufferGeometry()
  {
    const w = L * 0.86
    const d = depth
    const pts = new Float32Array([
      -w / 2, 0, d / 2, w / 2, 0, d / 2, w / 2, depth * 0.10, 0,
      -w / 2, 0, d / 2, w / 2, depth * 0.10, 0, -w / 2, depth * 0.10, 0,
      -w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, depth * 0.10, 0,
      -w / 2, 0, -d / 2, w / 2, depth * 0.10, 0, -w / 2, depth * 0.10, 0,
    ])
    gusset.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    gusset.computeVertexNormals()
  }

  const sealW = L * 0.07
  const zip = box(L * 0.94, Math.max(6, sealH * 0.5), depth * 0.55)
  const tear = box(L * 0.94, 1.2, depth * 0.58)

  return [
    {
      id: 'front',
      label: 'Front panel',
      part: 'front',
      material: 'film-metalised',
      geometry: front,
      pose: { pos: [0, 0, depth * 0.18], rot: [0, 0, 0] },
      poseOpen: { pos: [0, 0, depth * 0.55], rot: [-11, 0, 0] },
      info: 'Printed front web',
    },
    {
      id: 'back',
      label: 'Back panel',
      part: 'back',
      material: 'film-metalised',
      geometry: back,
      pose: { pos: [0, 0, -depth * 0.18], rot: [0, 0, 0] },
      poseOpen: { pos: [0, 0, -depth * 0.55], rot: [11, 0, 0] },
      info: 'Reverse web — usually unprinted or 1-colour',
    },
    {
      id: 'gusset',
      label: 'Bottom gusset',
      part: 'gusset',
      material: 'film',
      geometry: gusset,
      pose: { pos: [0, 0, 0], rot: [0, 0, 0] },
      info: 'W-fold that lets the pouch stand',
    },
    {
      id: 'zip',
      label: 'Ziplock profile',
      part: 'zip',
      material: 'film',
      geometry: zip,
      pose: { pos: [0, zipY, 0], rot: [0, 0, 0] },
      poseOpen: { pos: [0, zipY + 6, 0], rot: [0, 0, 0] },
      info: 'Press-to-close profile, welded into the seal',
    },
    {
      id: 'tear',
      label: 'Tear notch',
      part: 'zip',
      material: 'film-metalised',
      geometry: tear,
      pose: { pos: [0, zipY - Math.max(10, sealH * 0.7), 0], rot: [0, 0, 0] },
      info: 'Laser tear line above the zip',
    },
    {
      id: 'sealL',
      label: 'Left fin seal',
      part: 'seals',
      material: 'film',
      geometry: box(sealW, bodyH, 1.2),
      pose: { pos: [-L / 2 + sealW / 2, bodyH / 2, 0], rot: [0, 0, 0] },
      info: 'Fin seal width',
    },
    {
      id: 'sealR',
      label: 'Right fin seal',
      part: 'seals',
      material: 'film',
      geometry: box(sealW, bodyH, 1.2),
      pose: { pos: [L / 2 - sealW / 2, bodyH / 2, 0], rot: [0, 0, 0] },
      info: 'Fin seal width',
    },
  ]
}

export const pouchSpec: StructureSpec = {
  id: 'pouch',
  name: 'Stand-up ziplock pouch',
  family: 'Flexible packaging',
  klass: 'assembly',
  version: '1.0.0',
  tagline: 'Barrier pouch that stands, reseals and shows its laminate',
  description:
    'Stand-up pouch with a bottom gusset, press-to-close zip and laser tear line. The shell is a formed membrane, not a fold — pulled apart in the exploded view to show the front, back, gusset and seal zones.',
  defaults: { l: 140, w: 90, h: 210 },
  limits: { minL: 60, maxL: 400, minW: 30, maxW: 200, minH: 80, maxH: 500, step: 1 },
  boards: [POUCH_BOARD],
  closureTolerance: 12,
  status: 'validated-geometry',
  parts: [
    { id: 'front', label: 'Front web', info: 'Printed front panel', explodeDir: [0, 0, 1], explodeDist: 110 },
    { id: 'back', label: 'Back web', info: 'Reverse panel', explodeDir: [0, 0, -1], explodeDist: 110 },
    { id: 'gusset', label: 'Gusset', info: 'W-fold base', explodeDir: [0, -1, 0], explodeDist: 90, delay: 0.2 },
    { id: 'zip', label: 'Zip + tear', info: 'Closure hardware', explodeDir: [0, 1, 0], explodeDist: 120, delay: 0.1 },
    { id: 'seals', label: 'Fin seals', info: 'Side seal zones', explodeDir: [0, 0, 0], explodeDist: 0 },
  ],
  limitations: [
    'Laminate is a single visual shell — the 4 physical layers are not separated.',
    'Wrinkle formation and fill volume are not simulated.',
    'Barrier performance (WVTR / OTR) is a material datasheet question, not a geometry output.',
  ],
  panels: [],
  build: buildPouch,
}

/* ------------------------------------------------------------------ */
/* 6. Roll-up standee                                                  */
/* ------------------------------------------------------------------ */

function buildRollup(ctx: BuildCtx): BuiltPart[] {
  const { l: L, h: H } = ctx.dims
  const depth = Math.max(180, Math.min(400, ctx.dims.w))
  const baseH = 55
  const cassetteH = 85
  const cassetteD = 95
  const railH = 22
  const cassetteTop = baseH + cassetteH
  const graphicH = Math.max(200, H - cassetteTop - railH)

  const base = box(L + 70, baseH, depth)
  const cassette = box(L + 20, cassetteH, cassetteD)
  const rail = box(L + 10, railH, railH + 8)
  const poleLen = graphicH + railH
  const pole = new THREE.CylinderGeometry(7, 7, poleLen, 16)
  const poleSleeve = new THREE.CylinderGeometry(10, 10, poleLen * 0.55, 16)

  const graphic = membranePanel(L, graphicH, 14, { taper: 0, segX: 10, segY: 10 })

  return [
    {
      id: 'base',
      label: 'Base plate',
      part: 'base',
      material: 'metal',
      geometry: base,
      pose: { pos: [0, baseH / 2, 0], rot: [0, 0, 0] },
      info: 'Aluminium base with levelling feet',
    },
    {
      id: 'cassette',
      label: 'Cassette',
      part: 'cassette',
      material: 'metal',
      geometry: cassette,
      pose: { pos: [0, baseH + cassetteH / 2, -depth / 2 + cassetteD / 2 + 10], rot: [0, 0, 0] },
      info: 'Spring cassette that retracts the graphic',
    },
    {
      id: 'poleL',
      label: 'Left pole',
      part: 'poles',
      material: 'metal',
      geometry: pole,
      pose: { pos: [-L / 2 + 30, cassetteTop + poleLen / 2, -depth / 2 + cassetteD / 2 + 10], rot: [0, 0, 0] },
      poseOpen: { pos: [-L / 2 + 30, cassetteTop + poleLen / 2, -depth / 2 + cassetteD / 2 + 10], rot: [0, 0, 0], scale: [1, 1, 1] },
      info: 'Telescopic aluminium pole',
    },
    {
      id: 'poleR',
      label: 'Right pole',
      part: 'poles',
      material: 'metal',
      geometry: poleSleeve,
      pose: { pos: [L / 2 - 30, cassetteTop + poleLen * 0.275, -depth / 2 + cassetteD / 2 + 10], rot: [0, 0, 0] },
      info: 'Pole sleeve',
    },
    {
      id: 'graphic',
      label: 'Printed graphic',
      part: 'graphic',
      material: 'board-white',
      geometry: graphic,
      pose: { pos: [0, cassetteTop, -depth / 2 + cassetteD / 2 + 24], rot: [0, 0, 0], scale: [1, 1, 1] },
      poseOpen: { pos: [0, cassetteTop, -depth / 2 + cassetteD / 2 + 24], rot: [0, 0, 0], scale: [1, 1, 1] },
      info: 'Anti-curl PET blockout, 510 GSM',
    },
    {
      id: 'rail',
      label: 'Top rail',
      part: 'rail',
      material: 'metal',
      geometry: rail,
      pose: { pos: [0, cassetteTop + graphicH, -depth / 2 + cassetteD / 2 + 24], rot: [0, 0, 0] },
      poseOpen: { pos: [0, cassetteTop + graphicH, -depth / 2 + cassetteD / 2 + 24], rot: [0, 0, 0] },
      info: 'Snap-fit top rail that clamps the graphic',
    },
  ]
}

export const rollupSpec: StructureSpec = {
  id: 'rollup',
  name: 'Roll-up standee',
  family: 'Displays & standees',
  klass: 'assembly',
  version: '1.0.0',
  tagline: 'Retractable banner that unpacks itself in seconds',
  description:
    'Aluminium base, spring cassette, telescopic pole and a printed graphic on anti-curl media. The exploded view separates every hardware part so a buyer can see what they are actually paying for.',
  defaults: { l: 850, w: 250, h: 2000 },
  limits: { minL: 300, maxL: 1500, minW: 180, maxW: 400, minH: 600, maxH: 3000, step: 10 },
  boards: [{ id: 'pet-blockout', label: 'Anti-curl PET blockout', thickness: 0.5, material: 'board-white', spec: '510 GSM' }],
  closureTolerance: 20,
  status: 'validated-geometry',
  parts: [
    { id: 'base', label: 'Base', info: 'Aluminium base plate', explodeDir: [0, -1, 0], explodeDist: 120 },
    { id: 'cassette', label: 'Cassette', info: 'Spring return mechanism', explodeDir: [0, 0, -1], explodeDist: 140, delay: 0.1 },
    { id: 'poles', label: 'Poles', info: 'Telescopic aluminium', explodeDir: [0, 0, 0], explodeDist: 0 },
    { id: 'graphic', label: 'Graphic', info: 'Printed banner', explodeDir: [0, 0, 1], explodeDist: 200, delay: 0.2 },
    { id: 'rail', label: 'Top rail', info: 'Snap-fit clamp', explodeDir: [0, 1, 0], explodeDist: 160, delay: 0.3 },
  ],
  limitations: [
    'Height is shown fixed; the telescopic pole is not animated in this version.',
    'Spring tension, wind stability and anti-curl behaviour are not modelled.',
  ],
  panels: [],
  build: buildRollup,
}
