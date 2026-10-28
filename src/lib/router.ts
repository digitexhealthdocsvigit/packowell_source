import { useCallback, useEffect, useState } from 'react'

const listeners = new Set<() => void>()

function currentPath(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

export function goBack(fallback = '/') {
  if (typeof window === 'undefined') return
  if (window.history.length > 1) window.history.back()
  else navigate(fallback)
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (typeof window === 'undefined') return
  if (to === currentPath() && !opts.replace) return
  if (opts.replace) window.history.replaceState({}, '', to)
  else window.history.pushState({}, '', to)
  listeners.forEach((l) => l())
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
}

export function usePathname(): string {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const update = () => setPath(currentPath())
    listeners.add(update)
    window.addEventListener('popstate', update)
    return () => {
      listeners.delete(update)
      window.removeEventListener('popstate', update)
    }
  }, [])
  return path
}

export function useQuery(): URLSearchParams {
  const path = usePathname()
  const [search, setSearch] = useState(() => (typeof window === 'undefined' ? '' : window.location.search))
  useEffect(() => {
    setSearch(window.location.search)
  }, [path])
  return new URLSearchParams(search)
}

export function matchRoute(path: string, pattern: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean)
  const c = path.split('/').filter(Boolean)
  if (p.length !== c.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(c[i])
    else if (p[i] !== c[i]) return null
  }
  return params
}

export function useNavigate() {
  return useCallback((to: string, opts?: { replace?: boolean }) => navigate(to, opts), [])
}
