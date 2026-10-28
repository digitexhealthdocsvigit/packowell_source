import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import type { StructureSpec } from '@/lib/geometry/types'
import type { PackagingViewer } from '@/lib/three/viewer'

type ViewerModule = typeof import('@/lib/three/viewer')
type BuildModule = typeof import('@/lib/geometry/build')

/**
 * three.js is ~143 kB gzipped and is only needed where a model is actually
 * drawn. Both the renderer and the geometry builder are pulled in after paint,
 * so text-only pages (policies, resources, contact) never fetch it at all.
 */
let modelModules: Promise<[ViewerModule, BuildModule]> | null = null
function loadModelModules() {
  modelModules ??= Promise.all([import('@/lib/three/viewer'), import('@/lib/geometry/build')])
  return modelModules
}

export function ModelPreview({
  spec,
  className,
  open = 0.15,
  explode = 0,
  onReady,
}: {
  spec: StructureSpec
  className?: string
  open?: number
  explode?: number
  onReady?: (v: PackagingViewer | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<PackagingViewer | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let viewer: PackagingViewer | null = null

    loadModelModules()
      .then(([{ PackagingViewer }, { buildStructure }]) => {
        if (cancelled || !ref.current) return
        viewer = new PackagingViewer(ref.current)
        viewerRef.current = viewer
        const result = buildStructure(spec, spec.defaults, spec.boards[0])
        viewer.setModel(spec, result)
        viewer.setState({ open, explode })
        onReady?.(viewer)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      viewer?.dispose()
      viewerRef.current = null
      onReady?.(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec])

  return (
    <div className={cn('relative', className)}>
      <div ref={ref} className="h-full w-full" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center text-[13px] text-[var(--ink-soft)]">
          This browser could not start WebGL, so the 3D preview is unavailable here. The dieline and
          the specification are still available on the product page.
        </div>
      )}
    </div>
  )
}
