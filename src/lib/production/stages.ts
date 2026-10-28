/**
 * The twelve-stage production workflow.
 *
 * Ordered on purpose: `stageIndex` is the only thing that decides what "later"
 * means, so a stage cannot be skipped by sending a different string to the API.
 */

export const STAGES = [
  { id: 'quote-accepted', label: 'Quote accepted', short: 'Accepted' },
  { id: 'specs-confirmed', label: 'Specifications confirmed', short: 'Specs' },
  { id: 'artwork-awaiting-approval', label: 'Artwork and proof awaiting customer approval', short: 'Proof' },
  { id: 'artwork-approved', label: 'Artwork approved', short: 'Approved' },
  { id: 'production-file-ready', label: 'Production file prepared and checked', short: 'File ready' },
  { id: 'printing', label: 'Printing', short: 'Printing' },
  { id: 'die-cutting', label: 'Die-cutting or structural conversion', short: 'Die-cut' },
  { id: 'finishing', label: 'Finishing and assembly', short: 'Finishing' },
  { id: 'quality-inspection', label: 'Quality inspection', short: 'Inspection' },
  { id: 'packed', label: 'Packed and ready for dispatch', short: 'Packed' },
  { id: 'dispatched', label: 'Dispatched', short: 'Dispatched' },
  { id: 'delivered', label: 'Delivered or closed', short: 'Delivered' },
] as const

export type StageId = (typeof STAGES)[number]['id']

export const STAGE_IDS = STAGES.map((s) => s.id) as StageId[]

/** The first stage that requires a complete, approved production file. */
export const PRODUCTION_GATE_STAGE: StageId = 'production-file-ready'

export const stageIndex = (id: string): number => STAGE_IDS.indexOf(id as StageId)

export const stageLabel = (id: string): string =>
  STAGES.find((s) => s.id === id)?.label ?? id

export const isValidStage = (id: string): id is StageId => STAGE_IDS.includes(id as StageId)

export const nextStage = (id: string): StageId | null => {
  const i = stageIndex(id)
  if (i < 0 || i >= STAGES.length - 1) return null
  return STAGE_IDS[i + 1]
}

/** True once a stage needs a signed-off production file to be legitimate. */
export const requiresProductionGate = (id: string): boolean => {
  const i = stageIndex(id)
  return i >= stageIndex(PRODUCTION_GATE_STAGE)
}

/** Stages at or before this one are pre-press; after it, the job is on the floor. */
export const isPrePress = (id: string): boolean => stageIndex(id) < stageIndex(PRODUCTION_GATE_STAGE)
