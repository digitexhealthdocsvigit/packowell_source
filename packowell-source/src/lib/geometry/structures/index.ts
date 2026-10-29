import { mailerSpec, steSpec, rigidSpec, telescopicSpec, POUCH_BOARDS } from './fold'
import { pouchSpec, rollupSpec, POUCH_BOARD } from './assembly'
import type { StructureSpec } from '../types'

export const STRUCTURES: StructureSpec[] = [
  mailerSpec,
  steSpec,
  rigidSpec,
  telescopicSpec,
  pouchSpec,
  rollupSpec,
]

export const STRUCTURE_BY_ID: Record<string, StructureSpec> = Object.fromEntries(
  STRUCTURES.map((s) => [s.id, s]),
)

export { mailerSpec, steSpec, rigidSpec, telescopicSpec, pouchSpec, rollupSpec }
export { POUCH_BOARDS, POUCH_BOARD }
