import { useState } from 'react'
import { Ruler } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Field, Pill } from '@/components/site/ui'
import { fromMm, toMm, UNIT_LABEL, type LengthUnit } from '@/lib/geometry/units'

export type Axis = 'l' | 'w' | 'h'
export type Dims = Record<Axis, number>

const AXES: Axis[] = ['l', 'w', 'h']
const AXIS_LABEL: Record<Axis, string> = { l: 'Length', w: 'Width', h: 'Height' }

/** Common carton sizes, in millimetres (the canonical internal unit). */
const PRESETS: { id: string; label: string; dims: Dims }[] = [
  { id: '100x100x50', label: '100 × 100 × 50', dims: { l: 100, w: 100, h: 50 } },
  { id: '150x100x50', label: '150 × 100 × 50', dims: { l: 150, w: 100, h: 50 } },
  { id: '200x150x80', label: '200 × 150 × 80', dims: { l: 200, w: 150, h: 80 } },
  { id: '240x180x90', label: '240 × 180 × 90', dims: { l: 240, w: 180, h: 90 } },
  { id: '300x200x100', label: '300 × 200 × 100', dims: { l: 300, w: 200, h: 100 } },
  { id: '400x300x150', label: '400 × 300 × 150', dims: { l: 400, w: 300, h: 150 } },
]

const CUSTOM = 'custom'

function display(mm: number, unit: LengthUnit): number {
  const v = fromMm(mm, unit)
  const decimals = unit === 'in' ? 2 : unit === 'cm' ? 1 : 0
  return Number(v.toFixed(decimals))
}

/**
 * Dimension entry with an explicit working unit and preset sizes.
 * Values cross this boundary as millimetres in both directions.
 */
export function SizePicker({
  dims,
  unit,
  onUnit,
  onChange,
}: {
  dims: Dims
  unit: LengthUnit
  onUnit: (u: LengthUnit) => void
  onChange: (axis: Axis, mm: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<Axis, string>>({ l: '', w: '', h: '' })

  const matched = PRESETS.find(
    (p) => p.dims.l === Math.round(dims.l) && p.dims.w === Math.round(dims.w) && p.dims.h === Math.round(dims.h),
  )

  function pickPreset(id: string) {
    if (id === CUSTOM) {
      setDraft({
        l: String(display(dims.l, unit)),
        w: String(display(dims.w, unit)),
        h: String(display(dims.h, unit)),
      })
      setOpen(true)
      return
    }
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    AXES.forEach((axis) => onChange(axis, preset.dims[axis]))
  }

  function applyCustom() {
    AXES.forEach((axis) => {
      const raw = Number(draft[axis])
      if (Number.isFinite(raw) && raw > 0) onChange(axis, toMm(raw, unit))
    })
    setOpen(false)
  }

  const invalid = AXES.some((axis) => {
    const raw = Number(draft[axis])
    return !Number.isFinite(raw) || raw <= 0
  })

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
          <Ruler className="h-3.5 w-3.5" aria-hidden />
          Size
        </span>
        <div className="flex items-center gap-1" role="group" aria-label="Dimension unit">
          {(['mm', 'cm', 'in'] as LengthUnit[]).map((u) => (
            <Pill key={u} active={u === unit} onClick={() => onUnit(u)}>
              {UNIT_LABEL[u]}
            </Pill>
          ))}
        </div>
      </div>

      <Select value={matched?.id ?? CUSTOM} onValueChange={pickPreset}>
        <SelectTrigger className="h-9 text-[13px]" aria-label="Preset size">
          <span>{matched ? `${matched.label} mm` : 'Custom size'}</span>
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label} mm
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM}>Custom size…</SelectItem>
        </SelectContent>
      </Select>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {AXES.map((axis) => (
          <Field key={axis} label={AXIS_LABEL[axis]} hint={UNIT_LABEL[unit]}>
            <Input
              type="number"
              value={display(dims[axis], unit)}
              min={0}
              step={unit === 'in' ? 0.01 : unit === 'cm' ? 0.1 : 1}
              onChange={(e) => onChange(axis, toMm(Number(e.target.value), unit))}
              className="h-9 text-[13px]"
            />
          </Field>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom size</DialogTitle>
            <DialogDescription>
              Enter the internal dimensions in {UNIT_LABEL[unit]}. Board thickness is added to the outside
              when the blank is calculated.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2">
            {AXES.map((axis) => (
              <Field key={axis} label={AXIS_LABEL[axis]} hint={UNIT_LABEL[unit]}>
                <Input
                  type="number"
                  min={0}
                  step={unit === 'in' ? 0.01 : unit === 'cm' ? 0.1 : 1}
                  value={draft[axis]}
                  onChange={(e) => setDraft((d) => ({ ...d, [axis]: e.target.value }))}
                />
              </Field>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Discard
            </Button>
            <Button onClick={applyCustom} disabled={invalid}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
