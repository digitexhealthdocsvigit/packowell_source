import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { detailViewsFor, thumbnailFor, type AssetRecord, type AssetRole } from '@/lib/catalogue-assets'

/**
 * Renders a catalogue asset from the manifest — never a hard-coded path.
 *
 * Only `approved` records are returned by the manifest helpers, so an asset
 * that is blocked or unverified cannot reach the page even if someone adds it
 * to the data file. Intrinsic width/height are always emitted so the reserved
 * space matches the image and the card grid does not shift as assets load.
 */

function pick(slug: string, role: AssetRole, index: number): AssetRecord | undefined {
  if (role === 'thumbnail') return thumbnailFor(slug)
  return detailViewsFor(slug)[index]
}

export function CatalogueImage({
  slug,
  role = 'thumbnail',
  index = 0,
  priority = false,
  className,
  imgClassName,
}: {
  slug: string
  role?: AssetRole
  index?: number
  priority?: boolean
  className?: string
  imgClassName?: string
}) {
  const asset = pick(slug, role, index)

  if (!asset) {
    return (
      <div
        className={cn(
          'flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--paper-2)] text-[11px] text-[var(--ink-soft)]',
          className,
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <ImageOff className="h-3.5 w-3.5" /> No approved image
        </span>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-[var(--paper-2)]', className)}>
      <img
        src={`/${asset.path}`}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        className={cn('h-full w-full object-cover', imgClassName)}
      />
    </div>
  )
}

/** Small, honest label distinguishing an illustration from a live model. */
export function AssetKindBadge({ kind }: { kind: 'illustration' | 'model' }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-white/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--ink-soft)] backdrop-blur-sm">
      {kind === 'model' ? '3D model' : 'Illustration'}
    </span>
  )
}
