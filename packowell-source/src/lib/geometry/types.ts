import type { BufferGeometry } from 'three'

/** All lengths are millimetres. All angles are degrees. */
export type Vec2 = { x: number; y: number }
export type Vec3 = [number, number, number]

export type Edge = 'top' | 'right' | 'bottom' | 'left'

export type MaterialKey =
  | 'corrugated'
  | 'kraft'
  | 'board-white'
  | 'board-natural'
  | 'greyboard'
  | 'wrapskin'
  | 'film'
  | 'film-metalised'
  | 'metal'
  | 'acetate'
  | 'magnet'
  | 'ribbon'
  | 'foam'

export interface MaterialDef {
  key: MaterialKey
  label: string
  /** base colour, sRGB hex */
  color: string
  roughness: number
  metalness: number
  opacity: number
  /** edge colour on cut faces — corrugated flutes, greyboard cores, etc. */
  edge: string
}

export const MATERIALS: Record<MaterialKey, MaterialDef> = {
  corrugated: { key: 'corrugated', label: 'Corrugated board', color: '#c8a97e', roughness: 0.92, metalness: 0, opacity: 1, edge: '#9c7b4f' },
  kraft: { key: 'kraft', label: 'Kraft paper', color: '#c19a6b', roughness: 0.9, metalness: 0, opacity: 1, edge: '#a37f52' },
  'board-white': { key: 'board-white', label: 'Coated white board', color: '#f6f3ec', roughness: 0.55, metalness: 0, opacity: 1, edge: '#e6e1d6' },
  'board-natural': { key: 'board-natural', label: 'Natural board', color: '#dfd3c0', roughness: 0.7, metalness: 0, opacity: 1, edge: '#c8b9a2' },
  greyboard: { key: 'greyboard', label: 'Greyboard 1.5–2 mm', color: '#8b8b8b', roughness: 0.95, metalness: 0, opacity: 1, edge: '#6f6f6f' },
  wrapskin: { key: 'wrapskin', label: 'Wrapped art paper', color: '#2f2b28', roughness: 0.45, metalness: 0, opacity: 1, edge: '#d8d2c6' },
  film: { key: 'film', label: 'PET/PE laminate', color: '#e9eef1', roughness: 0.25, metalness: 0.05, opacity: 0.92, edge: '#cfd8dd' },
  'film-metalised': { key: 'film-metalised', label: 'Metalised AL barrier', color: '#d5dbe0', roughness: 0.18, metalness: 0.65, opacity: 0.96, edge: '#b9c3ca' },
  metal: { key: 'metal', label: 'Aluminium', color: '#b8bec4', roughness: 0.35, metalness: 0.85, opacity: 1, edge: '#8d9399' },
  acetate: { key: 'acetate', label: 'PET window film', color: '#e6f2f5', roughness: 0.1, metalness: 0, opacity: 0.28, edge: '#cfe4ea' },
  magnet: { key: 'magnet', label: 'Neodymium magnet', color: '#4a4a4a', roughness: 0.6, metalness: 0.7, opacity: 1, edge: '#333333' },
  ribbon: { key: 'ribbon', label: 'Satin ribbon', color: '#b08d57', roughness: 0.6, metalness: 0.05, opacity: 1, edge: '#90713f' },
  foam: { key: 'foam', label: 'EVA foam insert', color: '#2b2b2b', roughness: 1, metalness: 0, opacity: 1, edge: '#1c1c1c' },
}

export interface Dims {
  /** internal length along X (mm) */
  l: number
  /** internal width along Y (mm) */
  w: number
  /** internal height along Z (mm) */
  h: number
}

export interface DimLimits {
  minL: number
  maxL: number
  minW: number
  maxW: number
  minH: number
  maxH: number
  /** snapped increment in mm, e.g. 1 */
  step: number
}

export interface BoardOption {
  id: string
  label: string
  /** total calliper in mm */
  thickness: number
  material: MaterialKey
  /** gsm / flute description shown in the UI */
  spec: string
  note?: string
}

/** A part = a separable group used by the explode view. */
export interface PartSpec {
  id: string
  label: string
  info: string
  /** world-space explode direction (normalised in code) */
  explodeDir: Vec3
  /** mm of travel at explode = 1 */
  explodeDist: number
  /** 0..1 stagger so parts leave in sequence */
  delay?: number
}

export interface Pose {
  pos: Vec3
  /** euler in degrees, applied XYZ */
  rot: Vec3
  /** uniform scale, default 1 — used by assemblies that unfurl (roll-up graphic) */
  scale?: Vec3
}

export interface AttachSpec {
  parent: string
  edge: Edge
  /** extent along the hinge, mm */
  width: number
  /** extent away from the hinge, mm */
  height: number
  /** 0..1 position along the parent's edge; default 0.5 (centred) */
  along?: number
  /** body sits over the parent instead of away from it */
  inside?: boolean
}

export interface PanelSpec {
  id: string
  label: string
  /** part this panel belongs to (explode grouping) */
  part: string
  attach: AttachSpec | null
  /** root only */
  width?: number
  height?: number
  /** root only: where this blank sits in the dieline sheet layout */
  sheetOrigin?: Vec2
  /** root only: assembled pose, interpolated closed → open */
  poseClosed?: Pose
  poseOpen?: Pose
  material: MaterialKey
  /** panel calliper in mm */
  thickness: number
  /**
   * Fold angle in degrees, relative to the parent panel's plane.
   * Positive folds toward the sheet's +Z (the "up" side of the blank),
   * regardless of which edge the panel hangs off.
   */
  foldClosed: number
  foldOpen: number
  /** opening sequence, 0 = first */
  openOrder?: number
  /**
   * Offset along the panel's own normal, in mm, applied after folding. A tuck
   * or dust flap that closes against a wall sits one board thickness inside it,
   * not coplanar with it — coplanar faces z-fight and read as a hole.
   */
  inset?: number
  /** extra outward fan in the explode view, degrees */
  fan?: number
  /** print surface shown in the artwork preview */
  printSurface?: 'outer' | 'inner' | 'none'
  note?: string
}

export interface StructureSpec {
  id: string
  name: string
  family: string
  klass: 'fold' | 'assembly'
  version: string
  tagline: string
  description: string
  defaults: Dims
  limits: DimLimits
  boards: BoardOption[]
  panels: PanelSpec[]
  parts: PartSpec[]
  limitations: string[]
  /** how far the closed assembly is allowed to deviate from nominal, mm */
  closureTolerance: number
  status: 'concept-preview' | 'validated-geometry'
  /** fold class: panels generated from the live dimensions */
  panelBuilder?: (dims: Dims, board: BoardOption) => PanelSpec[]
  /** assembly class: explicit part meshes */
  build?: (ctx: BuildCtx) => BuiltPart[]
}

export interface BuildCtx {
  dims: Dims
  board: BoardOption
}

export interface BuiltPart {
  id: string
  label: string
  part: string
  material: MaterialKey
  geometry: BufferGeometry
  pose: Pose
  poseOpen?: Pose
  info: string
}

export interface ResolvedPanel {
  spec: PanelSpec
  parentId: string | null
  dir: 1 | -1
  /** local frame origin in sheet coords */
  origin: Vec2
  ax: Vec2
  ay: Vec2
  width: number
  height: number
  /** polygon in sheet (flat blank) coordinates */
  polygon: Vec2[]
  hinge: [Vec2, Vec2] | null
  depth: number
}

export interface Box3Like {
  min: Vec3
  max: Vec3
}

export interface BuildResult {
  panels: ResolvedPanel[]
  parts: BuiltPart[]
  blank: Box3Like
  warnings: string[]
}
