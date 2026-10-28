/**
 * Canonical internal unit: millimetres. Nothing else is stored.
 * Every conversion happens at the boundary (UI input, exports).
 */

export const MM_PER_INCH = 25.4

export const inchToMm = (inches: number): number => inches * MM_PER_INCH
export const mmToInch = (mm: number): number => mm / MM_PER_INCH
export const cmToMm = (cm: number): number => cm * 10
export const mmToCm = (mm: number): number => mm / 10

export type LengthUnit = 'mm' | 'cm' | 'in'

export const UNIT_LABEL: Record<LengthUnit, string> = { mm: 'mm', cm: 'cm', in: 'in' }

export function toMm(value: number, unit: LengthUnit): number {
  switch (unit) {
    case 'mm':
      return value
    case 'cm':
      return cmToMm(value)
    case 'in':
      return inchToMm(value)
  }
}

export function fromMm(mm: number, unit: LengthUnit): number {
  switch (unit) {
    case 'mm':
      return mm
    case 'cm':
      return mmToCm(mm)
    case 'in':
      return mmToInch(mm)
  }
}

export function roundTo(value: number, step: number): number {
  if (step <= 0) return value
  return Math.round(value / step) * step
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** mm → human string with the unit the user is working in */
export function fmtLength(mm: number, unit: LengthUnit = 'mm'): string {
  const v = fromMm(mm, unit)
  const decimals = unit === 'in' ? 2 : unit === 'cm' ? 1 : 0
  return `${fmtNum(v, decimals)} ${UNIT_LABEL[unit]}`
}

export function fmtInr(n: number): string {
  return `₹${fmtNum(Math.round(n))}`
}
