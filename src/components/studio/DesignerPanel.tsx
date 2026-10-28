import { useState } from 'react'
import { ArrowDown, ArrowUp, Shapes, Trash2, Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Field, Pill } from '@/components/site/ui'
import { cn } from '@/lib/cn'
import {
  BACKGROUNDS,
  PATTERNS,
  SHAPES,
  TEXT_COLOURS,
  newLayerId,
  type Align,
  type DesignLayer,
  type PatternId,
  type ShapeId,
} from '@/lib/designer/compose'

export type DesignPanelInfo = { id: string; label: string }

function layerName(layer: DesignLayer): string {
  if (layer.type === 'background') return 'Background'
  if (layer.type === 'text') return layer.text.trim() ? `Text — ${layer.text.trim().slice(0, 18)}` : 'Text'
  return `Shape — ${SHAPES[layer.shape]?.label ?? layer.shape}`
}

export function DesignerPanel({
  panels,
  panelId,
  onPanel,
  layers,
  onChange,
}: {
  panels: DesignPanelInfo[]
  panelId: string | null
  onPanel: (id: string) => void
  layers: DesignLayer[]
  onChange: (next: DesignLayer[]) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)

  const active = layers.find((l) => l.id === selected) ?? null

  function update(id: string, patch: Partial<DesignLayer>) {
    onChange(layers.map((l) => (l.id === id ? ({ ...l, ...patch } as DesignLayer) : l)))
  }

  function add(layer: DesignLayer) {
    onChange([...layers, layer])
    setSelected(layer.id)
  }

  function move(id: string, delta: number) {
    const i = layers.findIndex((l) => l.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= layers.length) return
    const next = [...layers]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  function remove(id: string) {
    onChange(layers.filter((l) => l.id !== id))
    if (selected === id) setSelected(null)
  }

  const background = layers.find((l) => l.type === 'background') as
    | Extract<DesignLayer, { type: 'background' }>
    | undefined

  return (
    <div className="space-y-4">
      <div>
        <Field label="Design on panel">
          <Select value={panelId ?? ''} onValueChange={onPanel}>
            <SelectTrigger className="h-9 text-[13px]" aria-label="Design panel">
              <span>{panels.find((p) => p.id === panelId)?.label ?? 'Select a panel'}</span>
            </SelectTrigger>
            <SelectContent>
              {panels.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
          Background
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BACKGROUNDS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Background ${c}`}
              onClick={() =>
                background
                  ? update(background.id, { color: c } as Partial<DesignLayer>)
                  : add({
                      id: newLayerId('bg'),
                      type: 'background',
                      color: c,
                      pattern: 'none',
                      patternColor: '#201d1a',
                    })
              }
              className={cn(
                'h-7 w-7 rounded-full border transition',
                background?.color === c
                  ? 'border-[var(--ink)] ring-2 ring-[var(--ink)]/25'
                  : 'border-black/15 hover:scale-105',
              )}
              style={{ background: c }}
            />
          ))}
        </div>

        <div className="mt-2">
          <Select
            value={background?.pattern ?? 'none'}
            onValueChange={(v) => {
              if (background) update(background.id, { pattern: v as PatternId } as Partial<DesignLayer>)
              else
                add({
                  id: newLayerId('bg'),
                  type: 'background',
                  color: '#ffffff',
                  pattern: v as PatternId,
                  patternColor: '#201d1a',
                })
            }}
          >
            <SelectTrigger className="h-9 text-[13px]" aria-label="Background pattern">
              <span>{PATTERNS[(background?.pattern ?? 'none') as PatternId]}</span>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PATTERNS) as PatternId[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PATTERNS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
          Add to design
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[12px]"
            onClick={() =>
              add({
                id: newLayerId('tx'),
                type: 'text',
                text: 'Your brand',
                size: 0.1,
                color: '#201d1a',
                align: 'center',
                weight: 600,
                x: 0.5,
                y: 0.35,
              })
            }
          >
            <Type className="mr-1 h-3.5 w-3.5" aria-hidden />
            Text
          </Button>
          {(Object.keys(SHAPES) as ShapeId[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant="outline"
              className="h-8 text-[12px]"
              aria-label={`Add ${SHAPES[s].label}`}
              onClick={() =>
                add({
                  id: newLayerId('sh'),
                  type: 'shape',
                  shape: s,
                  color: '#201d1a',
                  x: 0.5,
                  y: 0.6,
                  scale: 0.16,
                })
              }
            >
              <Shapes className="mr-1 h-3.5 w-3.5" aria-hidden />
              {SHAPES[s].label}
            </Button>
          ))}
        </div>
      </div>

      {layers.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            Layers <span className="font-normal normal-case tracking-normal">(top of list = front)</span>
          </p>
          <ul className="space-y-1">
            {[...layers].reverse().map((l) => (
              <li
                key={l.id}
                className={cn(
                  'flex items-center gap-1 rounded-md border px-2 py-1 text-[12px]',
                  selected === l.id ? 'border-[var(--ink)]/40 bg-[var(--paper)]' : 'border-black/10',
                )}
              >
                <button
                  type="button"
                  className="flex-1 truncate text-left"
                  onClick={() => setSelected(l.id)}
                >
                  {layerName(l)}
                </button>
                <button type="button" aria-label="Bring forward" onClick={() => move(l.id, 1)} className="p-1">
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button type="button" aria-label="Send backward" onClick={() => move(l.id, -1)} className="p-1">
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button type="button" aria-label="Delete layer" onClick={() => remove(l.id)} className="p-1">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {active && active.type === 'text' && (
        <div className="space-y-2 rounded-md border border-black/10 p-2">
          <Field label="Text">
            <Input
              value={active.text}
              onChange={(e) => update(active.id, { text: e.target.value } as Partial<DesignLayer>)}
              className="h-8 text-[12px]"
              aria-label="Layer text"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size" hint={`${Math.round(active.size * 100)}%`}>
              <input
                type="range"
                min={2}
                max={40}
                value={Math.round(active.size * 100)}
                onChange={(e) =>
                  update(active.id, { size: Number(e.target.value) / 100 } as Partial<DesignLayer>)
                }
                className="w-full"
                aria-label="Text size"
              />
            </Field>
            <Field label="Align">
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as Align[]).map((a) => (
                  <Pill
                    key={a}
                    active={active.align === a}
                    onClick={() => update(active.id, { align: a } as Partial<DesignLayer>)}
                  >
                    {a}
                  </Pill>
                ))}
              </div>
            </Field>
          </div>
          <Field label="Colour">
            <div className="flex flex-wrap gap-1.5">
              {TEXT_COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Text colour ${c}`}
                  onClick={() => update(active.id, { color: c } as Partial<DesignLayer>)}
                  className={cn(
                    'h-6 w-6 rounded-full border',
                    active.color === c ? 'ring-2 ring-[var(--ink)]/40' : 'border-black/15',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
        </div>
      )}

      {active && active.type === 'shape' && (
        <div className="space-y-2 rounded-md border border-black/10 p-2">
          <Field label="Size" hint={`${Math.round(active.scale * 100)}%`}>
            <input
              type="range"
              min={4}
              max={50}
              value={Math.round(active.scale * 100)}
              onChange={(e) =>
                update(active.id, { scale: Number(e.target.value) / 100 } as Partial<DesignLayer>)
              }
              className="w-full"
              aria-label="Shape size"
            />
          </Field>
          <Field label="Colour">
            <div className="flex flex-wrap gap-1.5">
              {TEXT_COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Shape colour ${c}`}
                  onClick={() => update(active.id, { color: c } as Partial<DesignLayer>)}
                  className={cn(
                    'h-6 w-6 rounded-full border',
                    active.color === c ? 'ring-2 ring-[var(--ink)]/40' : 'border-black/15',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
        </div>
      )}

      {layers.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-[12px]"
          onClick={() => {
            onChange([])
            setSelected(null)
          }}
        >
          Clear design
        </Button>
      )}
    </div>
  )
}
