import type { BoardOption, Dims, PanelSpec, StructureSpec } from '../types'

const BOARD_CORRUGATED: BoardOption[] = [
  { id: 'b-flute', label: '3-ply B-flute', thickness: 3, material: 'corrugated', spec: '≈3 mm · 3-ply' },
  { id: 'e-flute', label: '3-ply E-flute', thickness: 1.5, material: 'corrugated', spec: '≈1.5 mm · 3-ply' },
  { id: 'bc-flute', label: '5-ply BC-flute', thickness: 6, material: 'corrugated', spec: '≈6 mm · 5-ply' },
]

const BOARD_CARTON: BoardOption[] = [
  { id: '300gsm', label: '300 GSM coated board', thickness: 0.42, material: 'board-white', spec: '0.42 mm' },
  { id: '350gsm', label: '350 GSM coated board', thickness: 0.5, material: 'board-white', spec: '0.50 mm' },
  { id: 'fbb-kraft', label: '280 GSM kraft board', thickness: 0.4, material: 'board-natural', spec: '0.40 mm' },
]

const BOARD_RIGID: BoardOption[] = [
  { id: '1500gsm', label: '1500 GSM greyboard', thickness: 1.8, material: 'greyboard', spec: '1.8 mm + 157 GSM wrap' },
  { id: '2000gsm', label: '2000 GSM greyboard', thickness: 2.4, material: 'greyboard', spec: '2.4 mm + 157 GSM wrap' },
]

const BOARD_TELESCOPIC: BoardOption[] = [
  { id: '1200gsm', label: '1200 GSM greyboard', thickness: 1.5, material: 'greyboard', spec: '1.5 mm' },
  { id: '1500gsm', label: '1500 GSM greyboard', thickness: 1.8, material: 'greyboard', spec: '1.8 mm' },
]

export const POUCH_BOARDS: BoardOption[] = [
  { id: 'pet-al-pe', label: 'PET / AL / PE barrier', thickness: 0.14, material: 'film-metalised', spec: '4-layer · 140 µm' },
  { id: 'mono-pe', label: 'Recyclable mono-PE', thickness: 0.12, material: 'film', spec: 'mono-PE · 120 µm' },
  { id: 'kraft-pe', label: 'Kraft / PE', thickness: 0.13, material: 'kraft', spec: 'kraft laminate · 130 µm' },
]

const L = (minL: number, maxL: number, minW: number, maxW: number, minH: number, maxH: number) => ({
  minL, maxL, minW, maxW, minH, maxH, step: 1,
})

let seq = 0
function panel(p: Partial<PanelSpec> & Pick<PanelSpec, 'id' | 'label' | 'part'>): PanelSpec {
  seq += 1
  return {
    attach: null,
    material: 'corrugated',
    thickness: 3,
    foldClosed: 0,
    foldOpen: 0,
    openOrder: 0,
    printSurface: 'outer',
    ...p,
  } as PanelSpec
}

/* ------------------------------------------------------------------ */
/* 1. Roll-end tuck mailer                                             */
/* ------------------------------------------------------------------ */

export const mailerSpec: StructureSpec = {
  id: 'mailer',
  name: 'Roll-end tuck mailer',
  family: 'Corrugated & mailers',
  klass: 'fold',
  version: '1.0.0',
  tagline: 'E-commerce mailer that folds from one corrugated blank',
  description:
    'One-piece roll-end mailer: the lid wraps over the front and the tuck flap locks inside. Drawn from a single blank, so it ships flat and assembles without glue.',
  defaults: { l: 240, w: 180, h: 90 },
  limits: L(80, 700, 60, 500, 30, 400),
  boards: BOARD_CORRUGATED,
  closureTolerance: 8,
  status: 'validated-geometry',
  parts: [
    { id: 'blank', label: 'Mailer blank', info: 'One-piece die-cut blank, no glue', explodeDir: [0, 0, 1], explodeDist: 0 },
    { id: 'lid', label: 'Lid + tuck', info: 'Roll-end lid with front tuck lock', explodeDir: [0, -1, 0.35], explodeDist: 90, delay: 0.15 },
  ],
  limitations: [
    'Flute direction and board crush at the crease are not modelled.',
    'Tuck friction and lock strength require a physical sample.',
    'Corner clearances are geometric only — no material compression simulation.',
  ],
  panels: [],
}

function buildMailer(d: Dims, b: BoardOption): PanelSpec[] {
  const { l: Ln, w: W, h: H } = d
  const t = b.thickness
  const tuck = Math.min(30, Math.max(18, H * 0.4))
  const dust = Math.min(34, Math.max(22, W * 0.35))
  const common = { material: b.material, thickness: t }
  return [
    panel({ id: 'bottom', label: 'Base panel', part: 'blank', attach: null, width: Ln, height: W, ...common, note: 'Root panel of the blank' }),
    panel({
      id: 'back', label: 'Back wall', part: 'blank',
      attach: { parent: 'bottom', edge: 'top', width: Ln, height: H },
      foldClosed: 90, foldOpen: 90, ...common,
    }),
    panel({
      id: 'lid', label: 'Lid', part: 'lid',
      attach: { parent: 'back', edge: 'top', width: Ln, height: W },
      foldClosed: 90, foldOpen: -18, openOrder: 1, ...common,
    }),
    panel({
      id: 'tuck', label: 'Tuck flap', part: 'lid',
      attach: { parent: 'lid', edge: 'top', width: Ln, height: tuck },
      foldClosed: 90, foldOpen: 0, openOrder: 2, inset: t, ...common,
    }),
    panel({
      id: 'front', label: 'Front wall', part: 'blank',
      attach: { parent: 'bottom', edge: 'bottom', width: Ln, height: H },
      foldClosed: 90, foldOpen: 90, ...common,
    }),
    panel({
      id: 'endL', label: 'Left end wall', part: 'blank',
      attach: { parent: 'bottom', edge: 'left', width: W, height: H },
      foldClosed: 90, foldOpen: 90, ...common,
    }),
    panel({
      id: 'endR', label: 'Right end wall', part: 'blank',
      attach: { parent: 'bottom', edge: 'right', width: W, height: H },
      foldClosed: 90, foldOpen: 90, ...common,
    }),
    panel({
      id: 'dustL', label: 'Left dust flap', part: 'lid',
      attach: { parent: 'lid', edge: 'left', width: W, height: dust },
      foldClosed: 90, foldOpen: 0, openOrder: 2, inset: t, ...common,
    }),
    panel({
      id: 'dustR', label: 'Right dust flap', part: 'lid',
      attach: { parent: 'lid', edge: 'right', width: W, height: dust },
      foldClosed: 90, foldOpen: 0, openOrder: 2, inset: t, ...common,
    }),
  ]
}

mailerSpec.panels = buildMailer(mailerSpec.defaults, BOARD_CORRUGATED[0])

mailerSpec.panelBuilder = buildMailer

/* ------------------------------------------------------------------ */
/* 2. Straight-tuck-end folding carton                                 */
/* ------------------------------------------------------------------ */

const STE_SHEET_ROT: [number, number, number] = [-90, 0, 0]

function buildSTE(d: Dims, b: BoardOption): PanelSpec[] {
  const { l: Ln, w: W, h: H } = d
  const t = b.thickness
  const common = { material: b.material, thickness: t }
  return [
    panel({
      id: 'front', label: 'Front panel', part: 'body', attach: null, width: Ln, height: H, ...common,
      poseClosed: { pos: [0, 0, 0], rot: STE_SHEET_ROT },
      poseOpen: { pos: [0, 0, 0], rot: STE_SHEET_ROT },
      note: 'Root panel — the carton blank is printed this way up',
    }),
    panel({
      id: 'right', label: 'Right side panel', part: 'body',
      attach: { parent: 'front', edge: 'right', width: H, height: W },
      foldClosed: 90, foldOpen: 90, ...common,
    }),
    panel({
      id: 'back', label: 'Back panel', part: 'body',
      attach: { parent: 'right', edge: 'top', width: H, height: Ln },
      foldClosed: 90, foldOpen: 90, ...common,
    }),
    panel({
      id: 'left', label: 'Left side panel', part: 'body',
      attach: { parent: 'back', edge: 'top', width: H, height: W },
      foldClosed: 90, foldOpen: 90, ...common,
    }),
    panel({
      id: 'glue', label: 'Glue tab', part: 'body',
      attach: { parent: 'left', edge: 'top', width: H, height: 12 },
      foldClosed: 90, foldOpen: 90, inset: t, ...common,
      note: 'Bonds inside the front panel — the carton ships glued and flat',
    }),
    panel({
      id: 'lid', label: 'Top lid', part: 'lid',
      attach: { parent: 'front', edge: 'top', width: Ln, height: W },
      foldClosed: 90, foldOpen: -112, openOrder: 1, ...common,
    }),
    panel({
      id: 'topTuck', label: 'Top tuck', part: 'lid',
      attach: { parent: 'lid', edge: 'top', width: Ln, height: 18 },
      foldClosed: 90, foldOpen: 75, openOrder: 2, inset: t, ...common,
    }),
    panel({
      id: 'bottom', label: 'Bottom closure', part: 'body',
      attach: { parent: 'front', edge: 'bottom', width: Ln, height: W },
      foldClosed: 90, foldOpen: 90, ...common,
    }),
    panel({
      id: 'bottomTuck', label: 'Bottom tuck', part: 'body',
      attach: { parent: 'bottom', edge: 'top', width: Ln, height: 16 },
      foldClosed: 90, foldOpen: 90, inset: t, ...common,
    }),
  ]
}

export const steSpec: StructureSpec = {
  id: 'ste-carton',
  name: 'Straight-tuck-end carton',
  family: 'Folding cartons',
  klass: 'fold',
  version: '1.0.0',
  tagline: 'Retail carton with glued side seam and tuck closures',
  description:
    'The standard retail folding carton: four panels wrapped around a glued seam, with straight tuck closures top and bottom. Ships glued and flat, pops open at the packer.',
  defaults: { l: 120, w: 60, h: 180 },
  limits: L(40, 500, 25, 400, 40, 600),
  boards: BOARD_CARTON,
  closureTolerance: 4,
  status: 'validated-geometry',
  parts: [
    { id: 'body', label: 'Carton body', info: 'Wrap + glue tab + bottom closure', explodeDir: [0, 0, -1], explodeDist: 0 },
    { id: 'lid', label: 'Tuck lid', info: 'Tuck-top closure', explodeDir: [0, 0, 1], explodeDist: 110, delay: 0.2 },
  ],
  limitations: [
    'Glue seam is shown closed — adhesive bond and cure are not modelled.',
    'Dust flaps are not drawn on this template version.',
    'Crease cracking on heavy coated board is not predicted.',
  ],
  panels: [],
}

steSpec.panelBuilder = buildSTE
steSpec.panels = buildSTE(steSpec.defaults, BOARD_CARTON[0])

/* ------------------------------------------------------------------ */
/* 3. Collapsible magnetic rigid box                                   */
/* ------------------------------------------------------------------ */

function buildRigid(d: Dims, b: BoardOption): PanelSpec[] {
  const { l: Ln, w: W, h: H } = d
  const t = b.thickness
  const wrap = { material: 'wrapskin' as const, thickness: t }
  const board = { material: 'greyboard' as const, thickness: t }
  const skirt = Math.min(H * 0.45, 70)
  return [
    panel({ id: 'base', label: 'Base board', part: 'base', attach: null, width: Ln, height: W, ...board }),
    panel({
      id: 'wallBack', label: 'Back wall', part: 'walls',
      attach: { parent: 'base', edge: 'top', width: Ln, height: H },
      foldClosed: 90, foldOpen: 90, ...wrap,
    }),
    panel({
      id: 'wallFront', label: 'Front wall', part: 'walls',
      attach: { parent: 'base', edge: 'bottom', width: Ln, height: H },
      foldClosed: 90, foldOpen: 90, ...wrap,
    }),
    panel({
      id: 'wallLeft', label: 'Left wall', part: 'walls',
      attach: { parent: 'base', edge: 'left', width: W, height: H },
      foldClosed: 90, foldOpen: 90, ...wrap,
    }),
    panel({
      id: 'wallRight', label: 'Right wall', part: 'walls',
      attach: { parent: 'base', edge: 'right', width: W, height: H },
      foldClosed: 90, foldOpen: 90, ...wrap,
    }),
    panel({
      id: 'lid', label: 'Lid board', part: 'lid',
      attach: { parent: 'wallBack', edge: 'top', width: Ln, height: W },
      foldClosed: 90, foldOpen: -105, openOrder: 1, ...board,
    }),
    panel({
      id: 'lidFront', label: 'Lid front skirt', part: 'lid',
      attach: { parent: 'lid', edge: 'top', width: Ln, height: skirt },
      foldClosed: 90, foldOpen: 90, openOrder: 2, inset: t, ...wrap,
    }),
    panel({
      id: 'lidLeft', label: 'Lid left skirt', part: 'lid',
      attach: { parent: 'lid', edge: 'left', width: W - 2 * t, height: skirt },
      foldClosed: 90, foldOpen: 90, openOrder: 2, inset: t, ...wrap,
    }),
    panel({
      id: 'lidRight', label: 'Lid right skirt', part: 'lid',
      attach: { parent: 'lid', edge: 'right', width: W - 2 * t, height: skirt },
      foldClosed: 90, foldOpen: 90, openOrder: 2, inset: t, ...wrap,
    }),
  ]
}


export const rigidSpec: StructureSpec = {
  id: 'rigid-magnetic',
  name: 'Collapsible magnetic rigid box',
  family: 'Rigid & luxury boxes',
  klass: 'fold',
  version: '1.0.0',
  tagline: 'Luxury rigid box that ships flat and snaps shut on magnets',
  description:
    'Greyboard walls wrapped in printed art paper, V-grooved so the whole box collapses flat and erects on site. Concealed magnets in the lid skirt hold it closed.',
  defaults: { l: 250, w: 200, h: 80 },
  limits: L(80, 450, 70, 400, 40, 200),
  boards: BOARD_RIGID,
  closureTolerance: 8,
  status: 'validated-geometry',
  parts: [
    { id: 'base', label: 'Base board', info: 'Greyboard base with wrap', explodeDir: [0, 0, -1], explodeDist: 70 },
    { id: 'walls', label: 'Walls', info: '4 V-grooved walls, wrapped', explodeDir: [0, 0, -0.25], explodeDist: 30, delay: 0.1 },
    { id: 'lid', label: 'Lid', info: 'Lid board with wrap and skirt', explodeDir: [0, 0, 1], explodeDist: 110, delay: 0.05 },
    { id: 'trim', label: 'Ribbon', info: 'Satin ribbon pull', explodeDir: [0, -1, 0.5], explodeDist: 60, delay: 0.3 },
  ],
  limitations: [
    'V-groove fold geometry is simplified to a hinge — the 90° cutaway is not drawn.',
    'Wrap paper stretch around corners is not simulated.',
    'Magnets and ribbon are illustrative in the exploded view, not a production drawing.',
    'Collapse-flat behaviour is geometric only; the wrap memory and crease life need a physical sample.',
  ],
  panels: [],
}

rigidSpec.panelBuilder = buildRigid
rigidSpec.panels = buildRigid(rigidSpec.defaults, BOARD_RIGID[0])

/* ------------------------------------------------------------------ */
/* 4. Telescopic two-piece box                                         */
/* ------------------------------------------------------------------ */

function buildTelescopic(d: Dims, b: BoardOption): PanelSpec[] {
  const { l: Ln, w: W, h: H } = d
  const t = b.thickness
  const lidSkirt = Math.max(30, H * 0.5)
  const baseH = Math.max(20, H - lidSkirt * 0.55)
  const common = { material: b.material, thickness: t }
  const lidZ = H - t
  return [
    panel({ id: 'baseBottom', label: 'Base panel', part: 'base', attach: null, width: Ln, height: W, ...common }),
    panel({
      id: 'baseBack', label: 'Base back wall', part: 'base',
      attach: { parent: 'baseBottom', edge: 'top', width: Ln, height: baseH },
      foldClosed: 90, foldOpen: 90, ...common,
    }),
    panel({
      id: 'baseFront', label: 'Base front wall', part: 'base',
      attach: { parent: 'baseBottom', edge: 'bottom', width: Ln, height: baseH },
      foldClosed: 90, foldOpen: 90, ...common,
    }),
    panel({
      id: 'baseLeft', label: 'Base left wall', part: 'base',
      attach: { parent: 'baseBottom', edge: 'left', width: W, height: baseH },
      foldClosed: 90, foldOpen: 90, ...common,
    }),
    panel({
      id: 'baseRight', label: 'Base right wall', part: 'base',
      attach: { parent: 'baseBottom', edge: 'right', width: W, height: baseH },
      foldClosed: 90, foldOpen: 90, ...common,
    }),
    panel({
      id: 'lidTop', label: 'Lid panel', part: 'lid',
      attach: null, width: Ln, height: W, ...common,
      sheetOrigin: { x: Ln + 80, y: 0 },
      poseClosed: { pos: [0, 0, lidZ], rot: [0, 0, 0] },
      poseOpen: { pos: [0, 40, lidZ + 110], rot: [0, 0, 0] },
      note: 'Second blank — the lid is a separate board',
    }),
    panel({
      id: 'lidBack', label: 'Lid back skirt', part: 'lid',
      attach: { parent: 'lidTop', edge: 'top', width: Ln, height: lidSkirt },
      foldClosed: -90, foldOpen: -90, inset: t, ...common,
    }),
    panel({
      id: 'lidFront', label: 'Lid front skirt', part: 'lid',
      attach: { parent: 'lidTop', edge: 'bottom', width: Ln, height: lidSkirt },
      foldClosed: -90, foldOpen: -90, inset: t, ...common,
    }),
    panel({
      id: 'lidLeft', label: 'Lid left skirt', part: 'lid',
      attach: { parent: 'lidTop', edge: 'left', width: W - 2 * t, height: lidSkirt },
      foldClosed: -90, foldOpen: -90, inset: t, ...common,
    }),
    panel({
      id: 'lidRight', label: 'Lid right skirt', part: 'lid',
      attach: { parent: 'lidTop', edge: 'right', width: W - 2 * t, height: lidSkirt },
      foldClosed: -90, foldOpen: -90, inset: t, ...common,
    }),
  ]
}

export const telescopicSpec: StructureSpec = {
  id: 'telescopic',
  name: 'Telescopic two-piece box',
  family: 'Rigid & luxury boxes',
  klass: 'fold',
  version: '1.0.0',
  tagline: 'Lid-over-base gift box from two separate blanks',
  description:
    'Two independent blanks: a shallow base tray and a deeper lid that slides down over it. The classic gift and apparel box, and the cheapest rigid format to tool.',
  defaults: { l: 300, w: 220, h: 110 },
  limits: L(80, 600, 80, 450, 30, 300),
  boards: BOARD_TELESCOPIC,
  closureTolerance: 6,
  status: 'validated-geometry',
  parts: [
    { id: 'base', label: 'Base tray', info: 'Bottom board + 4 walls', explodeDir: [0, 0, -1], explodeDist: 40 },
    { id: 'lid', label: 'Lid', info: 'Top board + 4 skirt walls', explodeDir: [0, 0, 1], explodeDist: 140, delay: 0.1 },
  ],
  limitations: [
    'Lid–base clearance is nominal; the real fit depends on wrap thickness and humidity.',
    'Two blanks are laid out side by side — sheet imposition is not optimised.',
  ],
  panels: [],
}
telescopicSpec.panelBuilder = buildTelescopic
telescopicSpec.panels = buildTelescopic(telescopicSpec.defaults, BOARD_TELESCOPIC[0])

/** structure id → blank builder (panels depend on dimensions and board) */
export const BLANK_BUILDERS: Record<string, (d: Dims, b: BoardOption) => PanelSpec[]> = {
  mailer: buildMailer,
  'ste-carton': buildSTE,
  'rigid-magnetic': buildRigid,
  telescopic: buildTelescopic,
}

export { buildMailer, buildSTE, buildRigid, buildTelescopic }
