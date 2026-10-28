/**
 * Designer composition.
 *
 * Layers are planned into absolute draw operations by `planComposition`, which is
 * pure and therefore unit-testable without a DOM. `executePlan` is the only part
 * that touches a canvas. That split is deliberate: layer order, positioning and
 * clipping are the things that break, and they are exactly what the tests assert.
 *
 * Coordinates on a layer are normalised (0..1) against the panel, so a design
 * survives a change of dimensions or of panel.
 */

export type ShapeId = 'recycle' | 'leaf' | 'fragile' | 'this-way-up' | 'warning'
export type PatternId = 'none' | 'kraft' | 'diagonal' | 'dots' | 'grid' | 'motif'
export type Align = 'left' | 'center' | 'right'

export type DesignLayer =
  | {
      id: string
      type: 'background'
      color: string
      pattern: PatternId
      patternColor: string
    }
  | {
      id: string
      type: 'text'
      text: string
      size: number
      color: string
      align: Align
      weight: number
      x: number
      y: number
    }
  | {
      id: string
      type: 'shape'
      shape: ShapeId
      color: string
      x: number
      y: number
      scale: number
    }

export type DrawOp =
  | { kind: 'background'; color: string; pattern: PatternId; patternColor: string }
  | {
      kind: 'text'
      text: string
      x: number
      y: number
      px: number
      color: string
      align: Align
      weight: number
    }
  | { kind: 'shape'; path: string; x: number; y: number; size: number; color: string }

/** Each path is authored in a 0..100 box and scaled at execute time. */
export const SHAPES: Record<ShapeId, { label: string; path: string }> = {
  recycle: {
    label: 'Recycling',
    path: 'M50 6 L68 38 L57 38 L66 56 L44 56 L44 46 L56 46 L51 38 L32 38 Z',
  },
  leaf: {
    label: 'Eco leaf',
    path: 'M50 92 C16 72 12 40 24 18 C52 22 84 34 88 62 C90 80 72 90 50 92 Z',
  },
  fragile: {
    label: 'Fragile',
    path: 'M38 10 L38 44 L24 44 L50 80 L76 44 L62 44 L62 10 Z',
  },
  'this-way-up': {
    label: 'This way up',
    path: 'M50 8 L22 40 L38 40 L38 92 L62 92 L62 40 L78 40 Z',
  },
  warning: {
    label: 'Warning',
    path: 'M50 8 L94 90 L6 90 Z',
  },
}

export const PATTERNS: Record<PatternId, string> = {
  none: 'None',
  kraft: 'Kraft grain',
  diagonal: 'Diagonal lines',
  dots: 'Dot grid',
  grid: 'Fine grid',
  motif: 'Minimal motifs',
}

export const BACKGROUNDS = [
  '#ffffff',
  '#f8f6f2',
  '#c7ad83',
  '#c98224',
  '#201d1a',
  '#e8efe6',
  '#e6eaf1',
]

export const TEXT_COLOURS = ['#201d1a', '#c98224', '#c7ad83', '#ffffff', '#1f5f4b']

let counter = 0
export function newLayerId(prefix = 'l'): string {
  counter += 1
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/**
 * Turn layers into absolute draw operations for a canvas of `width` × `height`.
 *
 * Order is preserved exactly as given (index 0 draws first / sits at the back),
 * which is what the layer list in the UI reorders. Backgrounds are hoisted to the
 * back regardless of position, because a background drawn on top of a logo is
 * always a mistake rather than an intent.
 */
export function planComposition(layers: DesignLayer[], width: number, height: number): DrawOp[] {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))

  const backgrounds = layers.filter((l): l is Extract<DesignLayer, { type: 'background' }> => l.type === 'background')
  const rest = layers.filter((l) => l.type !== 'background')

  const ops: DrawOp[] = []

  const bg = backgrounds[backgrounds.length - 1]
  if (bg) {
    ops.push({ kind: 'background', color: bg.color, pattern: bg.pattern, patternColor: bg.patternColor })
  }

  for (const layer of rest) {
    if (layer.type === 'text') {
      const text = layer.text.trim()
      if (!text) continue
      const px = Math.max(4, Math.round(clamp01(layer.size) * h))
      ops.push({
        kind: 'text',
        text,
        x: Math.round(clamp01(layer.x) * w),
        y: Math.round(clamp01(layer.y) * h),
        px,
        color: layer.color,
        align: layer.align,
        weight: Math.min(900, Math.max(100, layer.weight)),
      })
    } else if (layer.type === 'shape') {
      const meta = SHAPES[layer.shape]
      if (!meta) continue
      const size = Math.max(4, Math.round(Math.max(0.02, layer.scale) * h))
      ops.push({
        kind: 'shape',
        path: meta.path,
        x: Math.round(clamp01(layer.x) * w),
        y: Math.round(clamp01(layer.y) * h),
        size,
        color: layer.color,
      })
    }
  }

  return ops
}

/** Draw a planned composition onto a 2D context. Browser only. */
export function executePlan(
  ctx: CanvasRenderingContext2D,
  ops: DrawOp[],
  width: number,
  height: number,
): void {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  for (const op of ops) {
    if (op.kind === 'background') {
      ctx.fillStyle = op.color
      ctx.fillRect(0, 0, w, h)
      drawPattern(ctx, op.pattern, op.patternColor, w, h)
      continue
    }

    if (op.kind === 'text') {
      ctx.save()
      ctx.fillStyle = op.color
      ctx.font = `${op.weight} ${op.px}px Inter, system-ui, sans-serif`
      ctx.textAlign = op.align === 'center' ? 'center' : op.align === 'right' ? 'right' : 'left'
      ctx.textBaseline = 'middle'
      const maxWidth = op.align === 'center' ? w * 0.92 : w - op.x - 8
      ctx.fillText(op.text, op.x, op.y, Math.max(8, maxWidth))
      ctx.restore()
      continue
    }

    if (op.kind === 'shape') {
      const path = new Path2D(op.path)
      const s = op.size / 100
      ctx.save()
      ctx.translate(op.x - op.size / 2, op.y - op.size / 2)
      ctx.scale(s, s)
      ctx.fillStyle = op.color
      ctx.fill(path)
      ctx.restore()
    }
  }
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  pattern: PatternId,
  colour: string,
  w: number,
  h: number,
): void {
  if (pattern === 'none' || !pattern) return
  ctx.save()
  ctx.strokeStyle = colour
  ctx.fillStyle = colour

  if (pattern === 'diagonal') {
    ctx.globalAlpha = 0.22
    ctx.lineWidth = Math.max(1, w * 0.006)
    const step = Math.max(10, w * 0.09)
    for (let x = -h; x < w + h; x += step) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + h, h)
      ctx.stroke()
    }
  } else if (pattern === 'dots') {
    ctx.globalAlpha = 0.3
    const step = Math.max(8, w * 0.06)
    const r = Math.max(0.8, step * 0.12)
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else if (pattern === 'grid') {
    ctx.globalAlpha = 0.18
    ctx.lineWidth = 1
    const step = Math.max(10, w * 0.08)
    for (let x = 0; x < w; x += step) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
  } else if (pattern === 'motif') {
    ctx.globalAlpha = 0.14
    const step = Math.max(14, w * 0.13)
    const s = step * 0.42
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        ctx.beginPath()
        ctx.moveTo(x, y - s)
        ctx.lineTo(x + s, y)
        ctx.lineTo(x, y + s)
        ctx.lineTo(x - s, y)
        ctx.closePath()
        ctx.fill()
      }
    }
  } else if (pattern === 'kraft') {
    ctx.globalAlpha = 0.12
    for (let i = 0; i < Math.round((w * h) / 260); i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      ctx.fillRect(x, y, 1.4, Math.max(2, h * 0.012))
    }
  }

  ctx.restore()
}

/**
 * Composite a design to a PNG data URL, sized to the panel's own aspect.
 * Returns null when there is nothing to draw or no canvas is available.
 */
export function composeToDataUrl(
  layers: DesignLayer[],
  panel: { width: number; height: number },
  maxPx = 1024,
): string | null {
  const ratio = panel.width > 0 && panel.height > 0 ? panel.width / panel.height : 1
  const w = ratio >= 1 ? maxPx : Math.round(maxPx * ratio)
  const h = ratio >= 1 ? Math.round(maxPx / ratio) : maxPx

  const ops = planComposition(layers, w, h)
  if (ops.length === 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  executePlan(ctx, ops, w, h)
  return canvas.toDataURL('image/png')
}
