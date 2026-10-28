import { useEffect, useMemo } from 'react'

/**
 * Inject a JSON-LD graph into <head>, replacing any previous node with the same id.
 * The serialised string is the effect dependency so a fresh object identity on every
 * render cannot cause a re-injection loop.
 */
export function useJsonLdSchema(id: string, schema: Record<string, unknown> | null): void {
  const serialised = useMemo(() => (schema ? JSON.stringify(schema) : ''), [schema])

  useEffect(() => {
    const existing = document.getElementById(id) as HTMLScriptElement | null

    if (!serialised) {
      existing?.remove()
      return
    }

    const el = existing ?? document.createElement('script')
    el.id = id
    el.type = 'application/ld+json'
    el.textContent = serialised
    if (!existing) document.head.appendChild(el)
  }, [id, serialised])
}
