import { describe, expect, it } from 'vitest'
import { evaluateGate, invalidateOnNewArtwork, isHumanApproval, type GateVersion } from '../src/lib/production/gate'
import {
  STAGES,
  nextStage,
  requiresProductionGate,
  stageIndex,
  isValidStage,
  isPrePress,
} from '../src/lib/production/stages'

const proof: GateVersion = {
  version: 1,
  role: 'customer',
  status: 'approved',
  prepressReady: true,
  prepressErrors: 0,
  approvedBy: 'Priya',
}

const productionFile: GateVersion = {
  version: 1,
  role: 'production',
  status: 'approved',
  prepressReady: true,
  prepressErrors: 0,
  approvedBy: 'Arun',
}

const ready = {
  stage: 'production-file-ready',
  specsConfirmed: true,
  artworkApproved: true,
  versions: [proof, productionFile],
}

describe('production gate', () => {
  it('passes only when every condition is met', () => {
    const result = evaluateGate(ready)
    expect(result.ok).toBe(true)
    expect(result.blockers).toEqual([])
    expect(result.proofVersion).toBe(1)
    expect(result.productionFileVersion).toBe(1)
  })

  it('blocks when specifications are unconfirmed', () => {
    const result = evaluateGate({ ...ready, specsConfirmed: false })
    expect(result.ok).toBe(false)
    expect(result.blockers).toContain('Specifications have not been confirmed.')
  })

  it('blocks when artwork is unapproved', () => {
    const result = evaluateGate({ ...ready, artworkApproved: false })
    expect(result.ok).toBe(false)
    expect(result.blockers).toContain('Artwork and proof have not been approved.')
  })

  it('blocks when there is no approved proof', () => {
    const result = evaluateGate({ ...ready, versions: [{ ...proof, status: 'pending' }] })
    expect(result.ok).toBe(false)
    expect(result.blockers).toContain('There is no approved proof on this job.')
  })

  it('blocks when the production file is missing for the approved proof', () => {
    const result = evaluateGate({ ...ready, versions: [proof] })
    expect(result.ok).toBe(false)
    expect(result.blockers.some((b) => b.includes('No production file'))).toBe(true)
    expect(result.productionFileVersion).toBeNull()
  })

  it('blocks when the production file belongs to a different version than the proof', () => {
    const result = evaluateGate({
      ...ready,
      versions: [proof, { ...productionFile, version: 2 }],
    })
    expect(result.ok).toBe(false)
    expect(result.blockers.some((b) => b.includes('No production file'))).toBe(true)
  })

  it('blocks when the production file is not approved', () => {
    const result = evaluateGate({
      ...ready,
      versions: [proof, { ...productionFile, status: 'pending' }],
    })
    expect(result.ok).toBe(false)
    expect(result.blockers.some((b) => b.includes('is not approved'))).toBe(true)
  })

  it('does not accept an automated check as human approval', () => {
    const result = evaluateGate({
      ...ready,
      versions: [proof, { ...productionFile, approvedBy: 'system' }],
    })
    expect(result.ok).toBe(false)
    expect(result.blockers.some((b) => b.includes('named person'))).toBe(true)
  })

  it('blocks when prepress has unresolved blocking findings', () => {
    const result = evaluateGate({
      ...ready,
      versions: [proof, { ...productionFile, prepressErrors: 2 }],
    })
    expect(result.ok).toBe(false)
    expect(result.blockers.some((b) => b.includes('2 unresolved blocking prepress findings'))).toBe(true)
  })

  it('blocks when the production file never passed prepress', () => {
    const result = evaluateGate({
      ...ready,
      versions: [proof, { ...productionFile, prepressReady: false }],
    })
    expect(result.ok).toBe(false)
    expect(result.blockers.some((b) => b.includes('has not passed the prepress check'))).toBe(true)
  })

  it('reports every blocker at once, not just the first', () => {
    const result = evaluateGate({
      stage: 'quote-accepted',
      specsConfirmed: false,
      artworkApproved: false,
      versions: [],
    })
    expect(result.ok).toBe(false)
    expect(result.blockers.length).toBeGreaterThanOrEqual(3)
  })

  it('treats blank and automated approvers as non-human', () => {
    expect(isHumanApproval('Priya')).toBe(true)
    expect(isHumanApproval('system')).toBe(false)
    expect(isHumanApproval('  ')).toBe(false)
    expect(isHumanApproval(null)).toBe(false)
    expect(isHumanApproval(undefined)).toBe(false)
  })

  it('uses the newest approved proof, not the first one', () => {
    const v2: GateVersion = { ...proof, version: 2 }
    const result = evaluateGate({
      ...ready,
      versions: [proof, v2, { ...productionFile, version: 2 }],
    })
    expect(result.ok).toBe(true)
    expect(result.proofVersion).toBe(2)
  })
})

describe('stage workflow', () => {
  it('has exactly the twelve required stages in order', () => {
    expect(STAGES).toHaveLength(12)
    expect(STAGES[0].id).toBe('quote-accepted')
    expect(STAGES[11].id).toBe('delivered')
  })

  it('advances one stage at a time and stops at the end', () => {
    expect(nextStage('quote-accepted')).toBe('specs-confirmed')
    expect(nextStage('packed')).toBe('dispatched')
    expect(nextStage('delivered')).toBeNull()
  })

  it('rejects unknown stages', () => {
    expect(nextStage('nonsense')).toBeNull()
    expect(isValidStage('printing')).toBe(true)
    expect(isValidStage('shipping')).toBe(false)
  })

  it('requires the gate from the production-file stage onward', () => {
    expect(requiresProductionGate('artwork-approved')).toBe(false)
    expect(requiresProductionGate('production-file-ready')).toBe(true)
    expect(requiresProductionGate('printing')).toBe(true)
    expect(requiresProductionGate('delivered')).toBe(true)
  })

  it('classifies pre-press stages correctly', () => {
    expect(isPrePress('artwork-approved')).toBe(true)
    expect(isPrePress('production-file-ready')).toBe(false)
  })

  it('treats stage order as authoritative', () => {
    expect(stageIndex('quote-accepted')).toBeLessThan(stageIndex('delivered'))
    expect(stageIndex('unknown')).toBe(-1)
  })
})

describe('artwork invalidation', () => {
  it('sends an approved job back to proof approval when new artwork arrives', () => {
    const state = invalidateOnNewArtwork('printing')
    expect(state.artworkApproved).toBe(false)
    expect(state.productionReady).toBe(false)
    expect(state.stage).toBe('artwork-awaiting-approval')
  })

  it('leaves the job blocked until the new version is approved', () => {
    const after = invalidateOnNewArtwork('printing')
    const result = evaluateGate({
      stage: after.stage,
      specsConfirmed: true,
      artworkApproved: after.artworkApproved,
      versions: [proof, productionFile],
    })
    expect(result.ok).toBe(false)
    expect(result.blockers).toContain('Artwork and proof have not been approved.')
  })
})
