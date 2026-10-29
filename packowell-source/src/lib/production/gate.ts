/**
 * The production gate.
 *
 * A job may only enter production when all of these are true, and each failure
 * is reported as its own blocker so the desk knows what is actually missing
 * rather than being told "not ready":
 *
 *   1. the specification has been explicitly confirmed by a person;
 *   2. the artwork/proof has been explicitly approved by a person;
 *   3. an approved proof version exists;
 *   4. a *production* file exists for that same version;
 *   5. that production file is itself approved, by a named person, not "system";
 *   6. its automated prepress check has no unresolved blocking findings.
 *
 * Point 5 is the important one: an automated check passing is assistance, not
 * approval. A file the machine likes but no human signed off is still blocked.
 */
import type { StageId } from './stages'

export interface GateVersion {
  version: number
  role: string
  status: string
  prepressReady: boolean
  prepressErrors: number
  approvedBy?: string | null
}

export interface GateInput {
  stage: string
  specsConfirmed: boolean
  artworkApproved: boolean
  versions: GateVersion[]
}

export interface GateResult {
  /** May the job be marked production-ready / advance past the gate? */
  ok: boolean
  /** Every reason it cannot, in the order a person should fix them. */
  blockers: string[]
  /** The approved proof version the production file must correspond to. */
  proofVersion: number | null
  productionFileVersion: number | null
}

export const isHumanApproval = (by?: string | null): boolean => {
  const name = (by ?? '').trim().toLowerCase()
  return name.length > 0 && name !== 'system' && name !== 'automated'
}

export function evaluateGate(input: GateInput): GateResult {
  const blockers: string[] = []

  if (!input.specsConfirmed) {
    blockers.push('Specifications have not been confirmed.')
  }
  if (!input.artworkApproved) {
    blockers.push('Artwork and proof have not been approved.')
  }

  const proofs = input.versions
    .filter((v) => v.role !== 'production' && v.status === 'approved')
    .sort((a, b) => b.version - a.version)
  const proof = proofs[0] ?? null

  if (!proof) {
    blockers.push('There is no approved proof on this job.')
  }

  let productionFile: GateVersion | null = null
  if (proof) {
    const candidates = input.versions.filter(
      (v) => v.role === 'production' && v.version === proof.version,
    )
    productionFile = candidates.sort((a, b) => b.version - a.version)[0] ?? null
    if (!productionFile) {
      blockers.push(
        `No production file has been attached for approved proof version ${proof.version}.`,
      )
    } else {
      if (productionFile.status !== 'approved') {
        blockers.push(`The production file for version ${proof.version} is not approved.`)
      }
      if (!isHumanApproval(productionFile.approvedBy)) {
        blockers.push('The production file needs approval by a named person, not an automated check.')
      }
      if (!productionFile.prepressReady) {
        blockers.push('The production file has not passed the prepress check.')
      }
      if (productionFile.prepressErrors > 0) {
        blockers.push(
          `The production file has ${productionFile.prepressErrors} unresolved blocking prepress finding${
            productionFile.prepressErrors === 1 ? '' : 's'
          }.`,
        )
      }
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
    proofVersion: proof?.version ?? null,
    productionFileVersion: productionFile?.version ?? null,
  }
}

/** Why a job cannot move into a given stage, if it cannot. */
export function evaluateAdvance(input: GateInput, to: string, needsGate: boolean): string[] {
  if (!needsGate) return []
  return evaluateGate(input).blockers
}

/**
 * What happens to approvals when new artwork arrives.
 *
 * A new version invalidates the previous approval outright: the approved proof
 * and the production file it corresponded to no longer describe what will be
 * printed, so the job must go back to proof approval rather than continue on a
 * stale sign-off.
 */
export function invalidateOnNewArtwork(stage: string): {
  artworkApproved: false
  productionReady: false
  stage: StageId
} {
  return {
    artworkApproved: false,
    productionReady: false,
    stage: 'artwork-awaiting-approval',
  }
}
