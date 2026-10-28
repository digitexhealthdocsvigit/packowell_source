import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { navigate } from '@/lib/router'

export function Section({
  children,
  className,
  id,
  tone = 'paper',
}: {
  children: ReactNode
  className?: string
  id?: string
  tone?: 'paper' | 'alt' | 'ink'
}) {
  return (
    <section
      id={id}
      className={cn(
        'px-4 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-20',
        tone === 'alt' && 'bg-[var(--paper-2)]',
        tone === 'ink' && 'bg-[var(--ink)] text-[#f6f2ec]',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--kraft-dark)]',
        className,
      )}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--kraft)]" />
      {children}
    </div>
  )
}

export function H2({
  children,
  className,
  as: Tag = 'h2',
}: {
  children: ReactNode
  className?: string
  /** Page-level titles must render as h1 — one per page, for structure and SEO. */
  as?: 'h1' | 'h2'
}) {
  return (
    <Tag className={cn('font-display text-3xl leading-[1.1] sm:text-4xl', className)}>{children}</Tag>
  )
}

export function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-soft)]', className)}>
      {children}
    </p>
  )
}

export function Card({
  children,
  className,
  as = 'div',
  onClick,
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'button'
  onClick?: () => void
}) {
  const cls = cn(
    'rounded-2xl border border-[var(--line)] bg-white/80 backdrop-blur-sm transition',
    className,
  )
  if (as === 'button') {
    return (
      <button type="button" onClick={onClick} className={cn(cls, 'text-left hover:border-[var(--kraft)]/60')}>
        {children}
      </button>
    )
  }
  return <div className={cls}>{children}</div>
}

export function Pill({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  const Comp = onClick ? 'button' : 'span'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
        active
          ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
          : 'border-[var(--line)] bg-white/70 text-[var(--ink-soft)] hover:border-[var(--ink)]/40',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </Comp>
  )
}

export function LinkButton({
  to,
  children,
  variant = 'primary',
  className,
  onClick,
}: {
  to?: string
  children: ReactNode
  variant?: 'primary' | 'outline' | 'ghost'
  className?: string
  onClick?: () => void
}) {
  const cls = cn(
    'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition',
    variant === 'primary' && 'bg-[var(--ink)] text-[#faf8f5] hover:bg-[var(--kraft-dark)]',
    variant === 'outline' && 'border border-[var(--ink)]/20 bg-transparent hover:border-[var(--ink)]/50',
    variant === 'ghost' && 'px-2 py-1 text-[var(--ink)] underline-offset-4 hover:underline',
    className,
  )
  return (
    <button
      type="button"
      className={cls}
      onClick={() => {
        onClick?.()
        if (to) navigate(to)
      }}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  required,
  className,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  required?: boolean
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-medium text-[var(--ink)]">
        {label}
        {required && <span className="text-[var(--kraft-dark)]">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[12px] text-[var(--ink-soft)]">{hint}</span>}
      {error && <span className="mt-1 block text-[12px] font-medium text-red-700">{error}</span>}
    </label>
  )
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'ok'
  title?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-[13px] leading-relaxed',
        tone === 'info' && 'border-[var(--line)] bg-[var(--paper-2)] text-[var(--ink-soft)]',
        tone === 'warn' && 'border-amber-300/70 bg-amber-50 text-amber-950',
        tone === 'ok' && 'border-emerald-300/70 bg-emerald-50 text-emerald-950',
      )}
    >
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      {children}
    </div>
  )
}

export function SpecRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] py-2 last:border-0">
      <dt className="text-[12px] uppercase tracking-wide text-[var(--ink-soft)]">{k}</dt>
      <dd className="text-right text-[13px] font-medium">{v}</dd>
    </div>
  )
}
