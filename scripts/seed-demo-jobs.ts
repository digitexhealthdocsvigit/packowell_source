/**
 * Seed a few demo jobs so the production board has something to show.
 *
 * These are clearly labelled demo rows (`Demo — …`, `demo@packowell.test`).
 * They exist only to demonstrate the workflow; nothing here is a real order.
 * Re-running is safe: it does nothing if the demo jobs are already present.
 *
 * Remove them with:
 *   bun run scripts/seed-demo-jobs.ts --clean
 *
 *   bun run scripts/seed-demo-jobs.ts
 */
import { existsSync, unlinkSync } from 'node:fs'
import path from 'node:path'

const API = process.env.API_ORIGIN ?? 'http://localhost:3101/api'
const ROOT = path.resolve(import.meta.dir, '..')
const DEMO_EMAIL = 'demo@packowell.test'

const envPasscode =
  (existsSync(path.join(ROOT, '.env'))
    ? (await Bun.file(path.join(ROOT, '.env')).text())
        .split('\n')
        .find((l) => l.startsWith('ADMIN_PASSCODE='))
        ?.slice('ADMIN_PASSCODE='.length)
        .trim()
        .replace(/^["']|["']$/g, '')
    : '') ?? ''
const passcode = process.env.ADMIN_PASSCODE ?? envPasscode
if (!passcode) {
  console.error('ADMIN_PASSCODE is not set (env or .env).')
  process.exit(1)
}

const raw = async (p: string, opts: RequestInit = {}, token?: string) => {
  const headers = new Headers(opts.headers)
  if (token) headers.set('authorization', `Bearer ${token}`)
  const res = await fetch(`${API}${p}`, { ...opts, headers })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

const session = await raw('/admin/session', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ passcode }),
})
const token: string = session.body?.token ?? ''
if (!token) {
  console.error('Could not sign in. Is the API running and the passcode right?')
  process.exit(1)
}
const api = (p: string, opts: RequestInit = {}) => raw(p, opts, token)
const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

/* ------------------------------- clean ------------------------------- */
if (process.argv.includes('--clean')) {
  const list = await api('/admin/jobs')
  const demo = ((list.body?.jobs ?? []) as { reference: string }[]).filter((j) => j.reference)
  const all = await Promise.all(demo.map((j) => api(`/admin/jobs/${j.reference}`)))
  for (const res of all) {
    const job = res.body?.job
    if (!job || job.customerEmail !== DEMO_EMAIL) continue
    for (const v of job.versions ?? []) {
      const file = path.join(ROOT, '.data', 'production', v.storedAs)
      if (existsSync(file)) unlinkSync(file)
    }
  }
  const { PrismaClient } = await import('../src/generated/prisma/client')
  const { PrismaLibSql } = await import('@prisma/adapter-libsql')
  const prisma = new PrismaClient({
    adapter: new PrismaLibSql({ url: `file:${path.join(ROOT, 'prisma', 'dev.db')}` }),
  })
  const { count } = await prisma.productionJob.deleteMany({ where: { customerEmail: DEMO_EMAIL } })
  await prisma.$disconnect()
  console.log(`Removed ${count} demo job(s) and their files.`)
  process.exit(0)
}

/* -------------------------------- seed ------------------------------- */
const existing = await api('/admin/jobs')
const already = ((existing.body?.jobs ?? []) as { customerEmail: string | null }[]).filter(
  (j) => j.customerEmail === DEMO_EMAIL,
)
if (already.length > 0) {
  console.log(`${already.length} demo job(s) already present. Nothing to do.`)
  console.log('Run with --clean to remove them.')
  process.exit(0)
}

/** A plain, valid PNG so the prepress engine has something real to inspect. */
const png = (w: number, h: number, tint: [number, number, number]) => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  const crc = (b: Uint8Array) => {
    let c = 0xffffffff
    for (const x of b) c = table[(c ^ x) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length)
    const view = new DataView(out.buffer)
    view.setUint32(0, data.length)
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
    out.set(data, 8)
    view.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)))
    return out
  }
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w)
  dv.setUint32(4, h)
  ihdr[8] = 8
  ihdr[9] = 2
  const rows = new Uint8Array(h * (1 + w * 3))
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 3)
    for (let x = 0; x < w; x++) {
      const p = row + 1 + x * 3
      rows[p] = tint[0] + ((x + y) % 24)
      rows[p + 1] = tint[1] + ((x * 2) % 24)
      rows[p + 2] = tint[2] + ((y * 2) % 24)
    }
  }
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', Bun.deflateSync(rows)),
    chunk('IEND', new Uint8Array(0)),
  ]
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

const create = async (spec: {
  name: string
  product: string
  slug: string
  quantity: number
  dimensions: string
  material: string
  destination: string
  finishes?: string
  printSpec?: string
}) => {
  const { name, product, slug, ...rest } = spec
  const res = await api(
    '/admin/jobs',
    json({
      ...rest,
      productName: product,
      productSlug: slug,
      customerName: `Demo — ${name}`,
      customerEmail: DEMO_EMAIL,
      by: 'Demo seed',
    }),
  )
  const ref = res.body?.job?.reference as string
  if (!ref) throw new Error(`could not create ${spec.name}: ${JSON.stringify(res.body).slice(0, 200)}`)
  return ref
}

const upload = async (ref: string, role: string, tint: [number, number, number]) => {
  // A production file is the proof re-imposed for the press, so it is a
  // different file with its own hash even when the design is the same.
  const shade: [number, number, number] = role === 'production' ? [tint[0] + 8, tint[1] + 4, tint[2]] : tint
  const form = new FormData()
  form.set('file', new File([png(3000, 2250, shade)], `${role}-${role === 'production' ? 'file' : 'proof'}.png`, { type: 'image/png' }))
  form.set('role', role)
  form.set('panelWidthMm', '240')
  form.set('panelHeightMm', '180')
  form.set('by', 'Demo seed')
  const res = await api(`/admin/jobs/${ref}/artwork`, { method: 'POST', body: form })
  const version = res.body?.version
  if (!version?.id) throw new Error(`upload failed for ${ref}: ${JSON.stringify(res.body).slice(0, 200)}`)
  return version
}

const confirm = (ref: string) => api(`/admin/jobs/${ref}/confirm-specs`, json({ by: 'Priya (desk)' }))
const approve = (ref: string, id: string, by: string) =>
  api(`/admin/jobs/${ref}/versions/${id}/approve`, json({ by }))
const advance = (ref: string, to: string) => api(`/admin/jobs/${ref}/advance`, json({ to, by: 'Priya (desk)' }))

// 1. Just opened — nothing confirmed yet.
const a = await create({
  name: 'Vidarbha Organics',
  product: 'Corrugated shipper',
  slug: 'corrugated-shipper',
  quantity: 500,
  dimensions: '320 x 240 x 200 mm',
  material: 'E-flute kraft',
  destination: 'Nagpur, Maharashtra',
})

// 2. Waiting on a proof decision — the gate is holding it.
const b = await create({
  name: 'Sunrise Foods',
  product: 'Printed carton',
  slug: 'printed-carton',
  quantity: 12000,
  dimensions: '180 x 120 x 60 mm',
  material: 'FBB 350 gsm',
  destination: 'Pune, Maharashtra',
  finishes: 'Matt lamination, spot UV',
  printSpec: '4-colour offset, CMYK',
})
await confirm(b)
await upload(b, 'customer', [200, 90, 60])

// 3. Approved and on press.
const c = await create({
  name: 'Deccan Beverages',
  product: 'Rigid box',
  slug: 'rigid-box',
  quantity: 2400,
  dimensions: '260 x 180 x 90 mm',
  material: 'Greyboard 1200 gsm, wrapped',
  destination: 'Mumbai, Maharashtra',
  finishes: 'Gold foil, magnetic closure',
  printSpec: 'Offset CMYK + 1 spot',
})
await confirm(c)
const cProof = await upload(c, 'customer', [70, 120, 160])
await approve(c, cProof.id, 'Priya (desk)')
const cProd = await upload(c, 'production', [70, 120, 160])
await approve(c, cProd.id, 'Arun (prepress)')
await advance(c, 'production-file-ready')
await advance(c, 'printing')
await advance(c, 'die-cutting')

// 4. Through inspection, with a recorded check.
const d = await create({
  name: 'Konkan Naturals',
  product: 'Labels',
  slug: 'labels',
  quantity: 40000,
  dimensions: '90 x 60 mm',
  material: 'White BOPP, permanent adhesive',
  destination: 'Ratnagiri, Maharashtra',
  printSpec: 'Flexo, 6 colours',
})
await confirm(d)
const dProof = await upload(d, 'customer', [90, 140, 90])
await approve(d, dProof.id, 'Priya (desk)')
const dProd = await upload(d, 'production', [90, 140, 90])
await approve(d, dProd.id, 'Arun (prepress)')
for (const to of ['production-file-ready', 'printing', 'die-cutting', 'finishing', 'quality-inspection']) {
  await advance(d, to)
}
await api(
  `/admin/jobs/${d}/qc`,
  json({ kind: 'inspection', result: 'pass', checkName: 'Colour and die-cut registration', by: 'Meera (QC)' }),
)

console.log(`Seeded 4 demo jobs: ${a}, ${b}, ${c}, ${d}`)
console.log('They are labelled "Demo — " and use demo@packowell.test.')
console.log('Remove them with: bun run scripts/seed-demo-jobs.ts --clean')
