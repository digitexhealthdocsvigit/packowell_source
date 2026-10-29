import type { ArtworkMeta } from './inspect'

export type Severity = 'error' | 'warn' | 'info' | 'pass'

export interface Finding {
  id: string
  severity: Severity
  title: string
  detail: string
  /** What the customer should change. Omitted when nothing needs doing. */
  fix?: string
}

export interface PrepressTarget {
  /** Printable face of the panel the artwork is addressed to, in mm. */
  widthMm: number
  heightMm: number
  /** Trim allowance each side. Defaults to 3 mm — the shop default. */
  bleedMm?: number
  /** Minimum effective resolution at final size. */
  minDpi?: number
  process?: 'offset' | 'digital' | 'flexo' | 'large-format'
  /** Panel name, used in messages ("front", "lid"). */
  label?: string
}

export interface PrepressReport {
  findings: Finding[]
  /** Resolved resolution at final size. Null for vector art. */
  effectiveDpi: number | null
  /** True when the file's proportions already include the bleed allowance. */
  includesBleed: boolean
  /** How far the file's proportions are from the target. 0 = exact. */
  aspectDelta: number
  /** Percentage the file must scale to cover the trim area. 100 = fits exactly. */
  scalePct: number
  /** True when nothing blocks the job. Warnings still allow ordering. */
  ready: boolean
  target: Required<Omit<PrepressTarget, 'label'>> & { label: string }
}

const MM_PER_INCH = 25.4
const DEFAULT_BLEED = 3

function round(v: number, dp = 1) {
  const f = 10 ** dp
  return Math.round(v * f) / f
}

function aspectDelta(aW: number, aH: number, bW: number, bH: number): number {
  if (!aW || !aH || !bW || !bH) return 0
  const a = aW / aH
  const b = bW / bH
  return Math.abs(a / b - 1)
}

/**
 * Decides whether a file can go to press for a specific panel.
 *
 * The distinction that matters commercially: `warn` still allows an order,
 * `error` blocks it. Everything below maps to a reason a job has actually
 * failed at a print shop — low resolution at final size, RGB art that shifts
 * when converted, no bleed, or a file built for a different panel.
 */
export function evaluateArtwork(meta: ArtworkMeta, target: PrepressTarget): PrepressReport {
  const process = target.process ?? 'offset'
  const bleed = target.bleedMm ?? DEFAULT_BLEED
  const minDpi = target.minDpi ?? (process === 'large-format' ? 150 : 300)
  const resolved = {
    widthMm: target.widthMm,
    heightMm: target.heightMm,
    bleedMm: bleed,
    minDpi,
    process,
    label: target.label ?? 'this panel',
  }

  const findings: Finding[] = []
  const push = (f: Finding) => findings.push(f)

  if (!meta.bytes) {
    push({
      id: 'empty',
      severity: 'error',
      title: 'The file is empty',
      detail: 'Nothing was received, so there is nothing to check.',
      fix: 'Upload the file again.',
    })
    return { findings, effectiveDpi: null, includesBleed: false, aspectDelta: 0, scalePct: 0, ready: false, target: resolved }
  }

  if (meta.format === 'unknown') {
    push({
      id: 'format',
      severity: 'error',
      title: 'Unrecognised file format',
      detail:
        'The format is read from the file itself, not its extension, and this file is not a PDF, AI, EPS, SVG, PNG, JPEG or TIFF.',
      fix: 'Export a PDF (press quality) from your design application and upload that.',
    })
  } else if (meta.format === 'svg') {
    push({
      id: 'format-svg',
      severity: 'warn',
      title: 'SVG is an editable web format',
      detail:
        'Fonts and effects do not always survive an SVG export, and the press cannot impose it directly. It is fine for a quick proof of position, not for final artwork.',
      fix: 'Send a PDF for production; keep the SVG only for internal review.',
    })
  } else {
    push({
      id: 'format',
      severity: 'pass',
      title: `Format: ${meta.format.toUpperCase()}${meta.version ? ` (${meta.version})` : ''}`,
      detail: meta.vector
        ? 'A vector file scales without losing sharpness — resolution is not the risk here.'
        : 'A raster file carries a fixed pixel grid, so its size at final trim is what decides sharpness.',
    })
  }

  if (meta.bytes > 250 * 1024 * 1024) {
    push({
      id: 'size',
      severity: 'error',
      title: 'File is too large to process',
      detail: `The file is ${round(meta.bytes / 1024 / 1024)} MB. Files above 250 MB cannot be handled by this uploader.`,
      fix: 'Downsample linked images or send a download link through the enquiry form.',
    })
  } else if (meta.bytes > 50 * 1024 * 1024) {
    push({
      id: 'size',
      severity: 'warn',
      title: 'Large file',
      detail: `The file is ${round(meta.bytes / 1024 / 1024)} MB. It will transfer slowly and may hit an email limit downstream.`,
      fix: 'A press-ready PDF of this panel is usually under 20 MB; downsample any 600+ dpi image.',
    })
  }

  // Does the file's proportion already match trim, or trim + bleed?
  const trimDelta = aspectDelta(meta.widthPx ?? meta.mediaBoxMm?.w ?? 0, meta.heightPx ?? meta.mediaBoxMm?.h ?? 0, target.widthMm, target.heightMm)
  const bleedW = target.widthMm + bleed * 2
  const bleedH = target.heightMm + bleed * 2
  const bleedDelta = aspectDelta(meta.widthPx ?? meta.mediaBoxMm?.w ?? 0, meta.heightPx ?? meta.mediaBoxMm?.h ?? 0, bleedW, bleedH)
  const includesBleed = bleedDelta < trimDelta && bleedDelta < 0.01
  const measured = meta.widthPx && meta.heightPx ? { w: meta.widthPx, h: meta.heightPx } : meta.mediaBoxMm
  const aspect = measured ? (includesBleed ? bleedDelta : trimDelta) : 0

  // Resolution at final size — the single most common reason a file is rejected.
  let effectiveDpi: number | null = null
  if (!meta.vector && meta.widthPx && meta.heightPx) {
    const finalW = includesBleed ? bleedW : target.widthMm
    const finalH = includesBleed ? bleedH : target.heightMm
    const dpiX = meta.widthPx / (finalW / MM_PER_INCH)
    const dpiY = meta.heightPx / (finalH / MM_PER_INCH)
    effectiveDpi = round(Math.min(dpiX, dpiY))
    // Compare on the rounded figure: 2362 px across 200 mm is 299.94 dpi, and
    // reporting that as "under 300" would flag almost every correct file.
    const judged = Math.round(effectiveDpi)

    if (judged < minDpi * 0.5) {
      push({
        id: 'resolution',
        severity: 'error',
        title: `${judged} dpi at final size — too low to print`,
        detail: `At ${round(finalW)} × ${round(finalH)} mm this file gives ${Math.round(dpiX)} × ${Math.round(dpiY)} dpi. Below ${Math.round(minDpi * 0.5)} dpi the print shows visible pixels and soft type; it cannot be rescued at press.`,
        fix: `Supply artwork at ${Math.ceil((finalW / MM_PER_INCH) * minDpi)} × ${Math.ceil((finalH / MM_PER_INCH) * minDpi)} pixels, or send the vector original.`,
      })
    } else if (judged < minDpi) {
      push({
        id: 'resolution',
        severity: 'warn',
        title: `${judged} dpi at final size — under the ${minDpi} dpi target`,
        detail: `Fine for large flat colour and big imagery; small type and thin rules will look soft at this size.`,
        fix: `Raise the image to ${Math.ceil((finalW / MM_PER_INCH) * minDpi)} px wide, or keep text as vector.`,
      })
    } else {
      push({
        id: 'resolution',
        severity: 'pass',
        title: `${judged} dpi at final size`,
        detail: `Meets the ${minDpi} dpi threshold for ${process} printing at ${round(finalW)} × ${round(finalH)} mm.`,
      })
    }
  } else if (meta.vector) {
    push({
      id: 'resolution',
      severity: 'pass',
      title: 'Resolution independent',
      detail: 'Vector artwork stays sharp at any size. Check that images placed inside it are high enough resolution.',
    })
  } else if (meta.format !== 'unknown') {
    push({
      id: 'resolution',
      severity: 'warn',
      title: 'Image dimensions could not be read',
      detail: 'This file does not declare usable pixel dimensions, so resolution at final size cannot be confirmed here.',
      fix: 'Send a PDF with an embedded preview, or confirm the pixel size of the original.',
    })
  }

  // Proportion — a mismatch is what silently stretches a logo.
  if (measured) {
    if (aspect > 0.08) {
      push({
        id: 'aspect',
        severity: 'error',
        title: 'Proportions do not match the panel',
        detail: `The file is ${round(aspect * 100)}% off the ${round(target.widthMm)} × ${round(target.heightMm)} mm panel. Filling this panel would visibly distort the artwork.`,
        fix: 'Rebuild the artwork on the dieline exported for this exact structure and size.',
      })
    } else if (aspect > 0.005) {
      push({
        id: 'aspect',
        severity: 'warn',
        title: `Proportions differ by ${round(aspect * 100, 2)}%`,
        detail: 'Small, but it will shift edges by a millimetre or two on a full-bleed panel. Either trim the file or accept a tiny crop.',
        fix: 'Match the file to the panel proportion exactly, allowing for bleed.',
      })
    } else {
      push({
        id: 'aspect',
        severity: 'pass',
        title: 'Proportions match the panel',
        detail: `The file fits ${resolved.label} without distortion.`,
      })
    }
  }

  // Bleed
  if (meta.trimBoxMm && meta.mediaBoxMm) {
    const bleedWmm = (meta.mediaBoxMm.w - meta.trimBoxMm.w) / 2
    const bleedHmm = (meta.mediaBoxMm.h - meta.trimBoxMm.h) / 2
    const actual = round(Math.min(bleedWmm, bleedHmm))
    if (actual >= bleed) {
      push({
        id: 'bleed',
        severity: 'pass',
        title: `Bleed included: ${actual} mm`,
        detail: `TrimBox and MediaBox declare ${actual} mm of bleed, which covers the ${bleed} mm requirement.`,
      })
    } else if (actual > 0.2) {
      push({
        id: 'bleed',
        severity: 'warn',
        title: `Bleed is short: ${actual} mm`,
        detail: `Only ${actual} mm exists outside the trim box; ${bleed} mm is needed so trimming drift does not reveal a white edge.`,
        fix: `Extend the background by ${round(bleed - actual)} mm on every side.`,
      })
    } else {
      push({
        id: 'bleed',
        severity: 'warn',
        title: 'No bleed declared',
        detail: `The file's page equals its trim box, so any artwork reaching the edge will show white when the guillotine drifts by a millimetre.`,
        fix: `Add ${bleed} mm of bleed and keep text ${bleed + 2} mm inside the trim.`,
      })
    }
  } else if (includesBleed) {
    push({
      id: 'bleed',
      severity: 'pass',
      title: `Proportions include the ${bleed} mm bleed`,
      detail: 'The file measures as trim plus bleed, so backgrounds will run to the edge.',
    })
  } else if (meta.format !== 'unknown') {
    push({
      id: 'bleed',
      severity: 'warn',
      title: 'Bleed cannot be confirmed from this file',
      detail: `Nothing in this format declares where the trim sits. If the design has a background that reaches the edge, it needs ${bleed} mm outside that edge.`,
      fix: 'Send a PDF exported with document bleed and crop marks.',
    })
  }

  // Colour
  if (meta.colour === 'cmyk') {
    push({
      id: 'colour',
      severity: 'pass',
      title: 'CMYK artwork',
      detail: 'No RGB-to-CMYK conversion is needed, so colours will print as approved.',
    })
  } else if (meta.colour === 'rgb' && meta.format !== 'svg') {
    push({
      id: 'colour',
      severity: 'warn',
      title: 'RGB artwork',
      detail:
        'Screen colour is wider than ink, so saturated colours shift on conversion — vivid greens, oranges and deep blues move the most, and undetectable in a soft proof on an uncalibrated monitor.',
      fix: 'Convert to CMYK in the design file before sending the final version, or approve a printed proof.',
    })
  } else if (meta.format !== 'unknown') {
    push({
      id: 'colour',
      severity: 'info',
      title: 'Colour build not declared',
      detail: 'The file does not state a colour model, so the prepress desk will confirm it on opening.',
    })
  }

  if (meta.hasAlpha) {
    push({
      id: 'alpha',
      severity: 'warn',
      title: 'Transparency present',
      detail: 'The press has no transparency: it is flattened to the nearest solid colour. Over a coloured background the edges can band or turn white.',
      fix: 'Flatten the file against the final background colour before exporting.',
    })
  }

  if (meta.pageCount && meta.pageCount > 1) {
    push({
      id: 'pages',
      severity: 'warn',
      title: `Multi-page file: ${meta.pageCount} pages`,
      detail: 'Only one page can be imposed, so it must be obvious which one prints.',
      fix: 'Export the printing page as its own single-page PDF.',
    })
  }

  if (meta.mediaBoxMm && meta.format !== 'unknown') {
    const declared = meta.trimBoxMm ?? meta.mediaBoxMm
    const wDelta = Math.abs(declared.w / target.widthMm - 1)
    const hDelta = Math.abs(declared.h / target.heightMm - 1)
    if (Math.max(wDelta, hDelta) > 0.02) {
      push({
        id: 'box',
        severity: 'warn',
        title: 'File page size differs from the panel',
        detail: `The document is ${round(declared.w)} × ${round(declared.h)} mm against a ${round(target.widthMm)} × ${round(target.heightMm)} mm panel${includesBleed ? ' (including bleed)' : ''}. Artwork may be positioned for a different die.`,
        fix: 'Place the artwork on the dieline for this structure and size, then re-export.',
      })
    }
  }

  const order: Record<Severity, number> = { error: 0, warn: 1, info: 2, pass: 3 }
  findings.sort((a, b) => order[a.severity] - order[b.severity])

  const scalePct = effectiveDpi
    ? round((effectiveDpi / minDpi) * 100, 0)
    : 100

  return {
    findings,
    effectiveDpi,
    includesBleed,
    aspectDelta: round(aspect, 4),
    scalePct,
    ready: !findings.some((f) => f.severity === 'error'),
    target: resolved,
  }
}

export function summarise(report: PrepressReport): { errors: number; warnings: number; passes: number } {
  return {
    errors: report.findings.filter((f) => f.severity === 'error').length,
    warnings: report.findings.filter((f) => f.severity === 'warn').length,
    passes: report.findings.filter((f) => f.severity === 'pass').length,
  }
}
