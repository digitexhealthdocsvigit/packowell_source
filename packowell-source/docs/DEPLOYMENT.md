# Deploying Packowell

## What this project actually is

Two pieces, served from one origin in the Shogo runtime:

| Piece | What it is | Where |
|---|---|---|
| Frontend | Vite + React SPA, builds to `dist/` | static files |
| Backend | Hono API (`server.tsx` + `custom-routes.ts`), Prisma + **SQLite file** | `/api/*` |

The frontend is genuinely static and deploys anywhere. The backend is **not** serverless-friendly as-is.

## The blocker to understand before choosing a host

`prisma/dev.db` is a single SQLite file. Three features write to it at request time:

- `POST /api/enquiries` — customer enquiries
- `POST /api/artwork` — uploaded artwork, written to the local filesystem
- `/enquiries`, `/admin/jobs`, `/admin/markets` — the business inbox and job board

On a serverless host (Vercel, Netlify Functions) the filesystem is **ephemeral**. A SQLite file and uploaded artwork are lost on every deploy and every cold start. The site would look fine and silently lose enquiries.

## Vercel

**Works:** the SPA. Build `npm run build`, output `dist`.
**Does not work:** `/api/*`. There is no `vercel.json`, no `api/` function directory, and no handler wrapping the Hono app, so every enquiry, upload and admin screen returns 404.

To run the API on Vercel you must either:

1. Move the database to hosted Postgres (Vercel Postgres / Neon) and switch the Prisma provider from `sqlite` to `postgresql`, and store artwork in object storage (S3/R2/Vercel Blob) instead of `.data/`; or
2. Deploy the API to a container host with a persistent disk — Railway, Fly.io, Render — and point the frontend's `/api` at it.

Option 2 is the smaller change.

## Shogo hosting

Publishing to `{subdomain}.shogo.one` requires the Pro plan. On Free, the preview URL is the live app and is not permanent.

## Environment variables

`.env` is deliberately **excluded** from the source archive. It contains `ADMIN_PASSCODE`. Set it yourself on the host:

```
ADMIN_PASSCODE=<strong passcode, not the development default>
```

Rotate it if it was ever shared in plain text.

## Not implemented

- Payment collection (no provider configured)
- Transactional email (no SMTP wired) — enquiries are visible only inside `/enquiries`
- Automated backups
- Automated tax, duty or shipping calculation

Do not advertise these as working.
