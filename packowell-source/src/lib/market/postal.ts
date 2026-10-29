/**
 * Postal-code validation per destination.
 *
 * The old build hard-coded a six-digit Indian PIN, which rejected every
 * international enquiry. A postal code is a *country-specific* format, so the
 * rule travels with the country and the server re-checks it — the client check
 * is convenience only.
 */

export interface PostalRule {
  /** ISO code this rule applies to. */
  country: string
  label: string
  hint: string
  required: boolean
  pattern: RegExp | null
  /** Uppercase-friendly normaliser (strips padding, adds the canonical space). */
  normalise?: (value: string) => string
}

const upper = (v: string) => v.toUpperCase().replace(/\s+/g, ' ').trim()

const RULES: Record<string, Omit<PostalRule, 'country'>> = {
  IN: {
    label: 'PIN code',
    hint: 'Six digits, e.g. 560001.',
    required: true,
    pattern: /^[1-9][0-9]{5}$/,
  },
  US: {
    label: 'ZIP code',
    hint: 'Five digits, or ZIP+4, e.g. 10001 or 10001-1234.',
    required: true,
    pattern: /^\d{5}(-\d{4})?$/,
  },
  GB: {
    label: 'Postcode',
    hint: 'UK postcode, e.g. SW1A 1AA.',
    required: true,
    pattern: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/,
    normalise: (v) => {
      const s = upper(v).replace(/\s+/g, '')
      return s.length > 3 ? `${s.slice(0, -3)} ${s.slice(-3)}` : s
    },
  },
  CA: {
    label: 'Postal code',
    hint: 'Canadian postal code, e.g. K1A 0B1.',
    required: true,
    pattern: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/,
    normalise: (v) => {
      const s = upper(v).replace(/\s+/g, '')
      return s.length === 6 ? `${s.slice(0, 3)} ${s.slice(3)}` : s
    },
  },
  DE: {
    label: 'Postleitzahl',
    hint: 'Five digits, e.g. 10115.',
    required: true,
    pattern: /^\d{5}$/,
  },
  FR: {
    label: 'Code postal',
    hint: 'Five digits, e.g. 75008.',
    required: true,
    pattern: /^\d{5}$/,
  },
  NL: {
    label: 'Postcode',
    hint: 'Four digits and two letters, e.g. 1012 AB.',
    required: true,
    pattern: /^\d{4} ?[A-Z]{2}$/,
    normalise: (v) => upper(v).replace(/^(\d{4})\s?([A-Z]{2})$/, '$1 $2'),
  },
  AU: {
    label: 'Postcode',
    hint: 'Four digits, e.g. 2000.',
    required: true,
    pattern: /^\d{4}$/,
  },
  SG: {
    label: 'Postal code',
    hint: 'Six digits, e.g. 018956.',
    required: true,
    pattern: /^\d{6}$/,
  },
  AE: {
    label: 'P.O. Box or postal code',
    hint: 'Optional — the UAE has no universal postal code; a P.O. Box is enough.',
    required: false,
    // P.O. Box values legitimately contain dots; keep only a sanity length check.
    pattern: /^[A-Z0-9][A-Z0-9 .\-/]{1,39}$/,
  },
  JP: {
    label: 'Postal code',
    hint: 'Seven digits, e.g. 100-0001.',
    required: true,
    pattern: /^\d{3}-?\d{4}$/,
  },
  BR: {
    label: 'CEP',
    hint: 'Eight digits, e.g. 01310-100.',
    required: true,
    pattern: /^\d{5}-?\d{3}$/,
  },
}

const GENERIC: Omit<PostalRule, 'country'> = {
  label: 'Postal code',
  hint: 'Postal or ZIP code for the delivery address.',
  required: true,
  pattern: /^[A-Z0-9][A-Z0-9 -]{2,11}$/i,
}

export function postalRule(country: string): PostalRule {
  const code = (country || '').toUpperCase()
  return { country: code, ...(RULES[code] ?? GENERIC) }
}

export type PostalResult =
  | { ok: true; value: string }
  | { ok: false; message: string }

/**
 * Validate and normalise a postal code. An empty value is only an error when
 * the destination requires one — forcing a code where the country has none is
 * its own kind of wrong answer.
 */
export function validatePostal(country: string, raw: string): PostalResult {
  const rule = postalRule(country)
  const value = (raw ?? '').trim()
  if (!value) {
    if (rule.required) return { ok: false, message: `${rule.label} is required for this destination.` }
    return { ok: true, value: '' }
  }
  if (value.length > 20) return { ok: false, message: `${rule.label} is too long.` }
  const normalised = rule.normalise ? rule.normalise(value) : upper(value)
  if (rule.pattern && !rule.pattern.test(normalised)) {
    return { ok: false, message: `${rule.hint}` }
  }
  return { ok: true, value: normalised }
}
