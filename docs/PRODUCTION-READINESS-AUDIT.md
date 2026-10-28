# Production-readiness audit — Kraftline packaging site

Date: 21 October 2026. Auditor: agent session, working in `6abbb0c1-…` (project "Start Implementing Per").
Every result below marked **reproduced** was executed in this session and its output observed.
Results marked **read** come from source inspection only. Anything I could not execute is marked
**NOT VERIFIED** rather than assumed.

Verdict: the application logic holds up — the studio, artwork proof, dieline and enquiry pipeline do
what the site says they do, and the safety-critical claims (no invented prices, no fake PDF preview,
gated customer data) survive adversarial testing. **The deployment is not production-ready**: there
are no backups, no email delivery, the published bundle is a development build, and public hosting on
a Shogo subdomain needs a paid plan. Details in §7.

---

## 1. Requirement table

| # | Requirement | Result | Evidence (reproduced this session) |
|---|---|---|---|
| 1 | Catalogue → 3D customisation flow | **PASS** | `qa.ts`: 15/15 routes render; `/packaging/corrugated-mailers/roll-end-mailer` loads the studio with a live canvas. `qa-checklist.ts` step 1 clicks the catalogue into the studio. |
| 2 | Dimension change + 3D rotation | **PASS** | `qa-checklist.ts` step 2: length 240 → 260, readout `260 × 180 × 90 mm`, canvas frame hash changed, orbit rotation changed the frame. |
| 3 | Transparent PNG upload, replacement, panel placement | **PASS** | `qa-checklist.ts` steps 3–4 (113 dpi at final size, alpha warning, 4 panel chips, replacement removes the old file). `qa-audit-artwork.ts`: 19/19 incl. replace → exactly one image and a different data URL. |
| 4 | Dieline SVG clipping, layer order, panel labels | **PASS** | `tests/dieline-panels.test.ts` (new): 55 assertions over all 6 structures — artwork clipped to its own panel, inside the panel box, aspect preserved, caption suppressed on the artwork panel, no image for an unknown panel. Layer order asserted in `tests/dieline-artwork.test.ts`. |
| 5 | PDF not represented as a rendered preview | **PASS** | `qa-audit-artwork.ts`: uploading a real PDF shows *"A PDF cannot be drawn on the model here…"*, adds **no** `<image>` to the blank, and leaves the 3D frame byte-identical (`639bed52af44 -> 639bed52af44`). The prepress verdict still runs (page boxes, bleed, colour build). |
| 6 | Quote submission, quantity, postal/PIN validation | **PASS** | Six validation cases → 400 with field-level messages, row count unchanged (3 → 3). India PIN still enforced (`PIN code: Six digits, e.g. 560001.`); Germany accepts `80331` and rejects a short code. |
| 7 | Enquiry reference + persistent storage | **PASS** | `POST /api/enquiries` → `KL-…`; duplicate resubmit inside 10 min → same reference, `duplicate: true`, no second row; data survived a real process restart (§4). |
| 8 | `/enquiries` auth, authorisation, status workflow | **PASS** | No token → 401; wrong passcode → 401; 9th attempt → 429; signout → 401; status PATCH persisted and read back. Photos/fields render in `qa-inbox.ts` 28/28. |
| 9 | `/api/artwork/:ref/file` access control | **PASS** | 401 without a token, 200 with one, bytes identical to upload, `nosniff` + `CSP: sandbox` present. A *lead* reference and a guessed `AW-` reference both 401. |
| 10 | All 15 routes, tests, build | **PASS** | `qa.ts` 15/15, no console errors, no exceptions. `bun x vitest run` → **8 files / 190 tests passed** (re-run at 11:38). `tsc --noEmit` → 33 errors, **all 33 inside `src/generated/`** (13 `domain.ts`, 20 across the generated route files; pre-existing, none in application code). Build log `built in 5082ms` after a forced rebuild. |
| 11 | Admin secrets not exposed to browser or logs | **PASS** | Passcode value: 0 occurrences in `dist/`, 0 in `src/`, 0 in `.shogo/logs/*`. No bearer tokens or customer emails in logs. |
| 12 | Passcode strength | **PASS** | 20 chars, 16 distinct, 3 character classes, ≈78 bits, no dictionary/dev-default word, no repeated run. Value not printed here. |
| 13 | Server-side auth on protected routes | **PASS after fix** | `/api/admin/*` was already gated. **The generated CRUD was not** — see D1; now refused (400 `direct_access_disabled`) for `leads`, `artworks`, `users` (all verbs) and for writes to `settings`, `destinations`, `exchange-rates`, `product-markets`. |
| 14 | Artwork not obtainable by guessing references | **PASS after fixes** | File route gated; metadata route now gated too (D5); references now CSPRNG-derived and collision-checked (D6). |
| 15 | Token expiry, invalid creds, repeated failures, revocation | **PASS (partly read)** | 8 h TTL **read** from `ADMIN_TTL_MS`; 401/429/revocation **reproduced**. Restart invalidates every session (reproduced: stale token → 401). Expiry-over-time not waited out (would need 8 h). |
| 16 | Upload validation: content, size, type, filenames | **PASS after fix** | Text file renamed `.png` → `format: unknown`, `ready: false` (magic bytes, not extension). 26 MB → 413. Storage name is server-generated: `../../../etc/passwd.png` was stored as `AW-NKKTY-<ts>` with no traversal. New: 20 uploads/hour per address (D4), verified 21st → 429. |
| 17 | Enquiry/artwork storage private and access-controlled | **PASS after fix** | Rows reachable only through gated routes; files on disk under `.data/artwork` behind a token; path containment check added (D2). `.data/` is **not** in `.gitignore` — see R7. |
| 18 | Error messages do not leak secrets or PII | **PASS** | 400/401/409/413 bodies are plain sentences; no stack traces, no SQL, no paths. Server-side failures log to stdout and return "We could not save that. Please email us directly instead." |
| 19 | Persistence across restart | **PASS** | See §4: lead, specs, FX snapshot, artwork link and file bytes all intact after a genuine process restart (new PID, old token 401). |
| 20 | 3D and dieline agree for every panel | **PASS for geometry** | `tests/dieline-panels.test.ts` covers 37 panels across 4 fold structures; `qa-audit-artwork.ts` confirms panel switching repaints both the blank and the model. **Cannot prove** agreement with a real cutting forme — see §6. |
| 21 | Production environment variables | **FAIL** | Only `ADMIN_PASSCODE` is set by the project; `DATABASE_URL` is injected by the runtime. No `SITE_URL`, no mail credentials, no backup target. |
| 22 | HTTPS | **PASS (platform)** | `https://…preview.shogo.ai` → 200, certificate verifies (`ssl_verify_result 0`). Plain HTTP is *not* redirected to HTTPS at that host (platform-level). |
| 23 | Domain configuration | **FAIL / BLOCKED** | `site.configured = false`; the site shows the DEMO badge by design. No custom domain, no canonical host configured. |
| 24 | Backups | **FAIL (launch blocker)** | No backup tooling in the repo, no scheduled dump, no `prisma/migrations`. The entire business record is one SQLite file on the container's filesystem. |
| 25 | Error logging | **PARTIAL** | API stdout is captured into `.shogo/logs/build.log` (42 lines observed) but only startup lines appear; four `console.error` sites exist; no levels, rotation, or alerting. |
| 26 | Upload limits | **PASS after fix** | 25 MB per file (413 verified); 20 uploads/hour/address (429 verified); JSON fields capped (message 6000, payload 4000). |
| 27 | Email delivery | **FAIL (launch blocker)** | No SMTP/provider configuration and no send code anywhere in the project. A new enquiry is visible only to someone who opens `/enquiries`; the customer receives nothing. The UI does not claim otherwise. |
| 28 | Failure recovery | **PARTIAL** | Restart recovers cleanly and data persists; admin sessions are lost on every restart (by design, documented); no queue or retry for a failed write (the visitor is told to email instead). |
| 29 | Publishing requires a paid plan | **BLOCKED** | This workspace is on the **Free** plan. `publish` to a `*.shogo.one` subdomain needs Pro or higher. Not attempted, so nothing was half-deployed. |

---

## 2. Security audit

| Check | Result | Detail |
|---|---|---|
| Secrets in the browser bundle | PASS | Passcode and token values absent from `dist/`. The string `ADMIN_PASSCODE` appears only as a setup-hint label. |
| Secrets in logs | PASS | 0 matches for the passcode, bearer tokens, or test customer addresses in `.shogo/logs/*`. |
| Passcode strength / not a dev default | PASS | 20 chars, ≈78 bits, no dictionary word. Per-environment; not committed (`.env` is git-ignored). |
| Server-side enforcement | PASS after D1 | Reproduced unauth read **and** write on `/api/leads` before the fix; refused afterwards. |
| Guessing a reference | PASS after D3/D6 | File and metadata routes both require the token; references now come from `randomBytes` and are retried against the table. |
| Token lifecycle | PASS | 8 h TTL; signout deletes the token; restart clears all sessions; malformed `Authorization` headers → 401; ≥8 attempts/min/IP → 429. |
| Upload validation | PASS after D4 | Magic-byte type detection, 25 MB ceiling, server-generated storage names, path containment on read, nosniff + CSP sandbox on the response, per-IP throttle. |
| Private storage | PASS after D1/D2 | `GET /api/leads`, `/api/artworks`, `/api/users` closed; artwork rows creatable only by the upload route. |
| Error message content | PASS | Generic sentences; internals only in server stdout. |

Residual risks I did not fix (see §8): shared single passcode with no per-user identity or audit
trail; rate limits keyed on a spoofable `x-forwarded-for`, whose trust must be arranged at the edge.

---

## 3. Reproduced scenarios (before/after)

| Scenario | Before my changes | After |
|---|---|---|
| `GET /api/leads` with no credentials | **200**, full row: name, email, phone, postal code, message | 400 `direct_access_disabled` |
| `PATCH /api/leads/:id` with no credentials | **200**, status changed to `won` | 400 refused |
| `GET /api/artwork/AW-XXXXX` (metadata) | **200**, filename + panel + findings | 401 |
| Studio artwork placement | console: `Maximum update depth exceeded` ×4 | console clean |
| Upload burst from one address | unlimited | 20 accepted, then 429 |
| Artwork reference origin | `Math.random()`, no collision check | `randomBytes`, collision retried |

---

## 4. Persistence and workflow

Procedure: wrote one enquiry with a full specification, an indicative FX snapshot and an attached
artwork (`AW-7CNAL`, placed on the lid at 240×180 mm); set its status to `contacted`; restarted the API
process; re-read everything through the gated routes.

Result (reproduced):

* the process really restarted — new PID, uptime 5 s, and the pre-restart admin token returned 401;
* the enquiry was still there with `status: contacted`, `DE`, `80331`, `EUR`, `2500`,
  `240 × 180 × 90 mm`, `E-flute`, `CMYK offset`, `DAP München, palletised`;
* the FX snapshot was byte-for-byte the same (`INR 2400 @ 0.009389 → EUR 23`, fetched
  `2026-10-21T10:50:37.120Z`);
* the artwork record still pointed at the lead, and the file downloaded with a matching MD5.

Also verified: duplicate submission suppressed (same reference, no second row); six invalid
submissions rejected without writing a row; a destination set to `not-served` → 409 with no row, then
restored to `served`. All audit rows and files were removed afterwards (`/api/enquiries/stats` and
`/api/artwork-stats` both back to 0). No real customer record existed at any point.

**Durability caveat:** this proves the data survives a process restart, not a lost volume. There is
no backup and no migration history — that is a launch blocker, not a code defect.

---

## 5. Artwork and manufacturing accuracy

| Aspect | Evidence | Status |
|---|---|---|
| Image placement identical in proof and blank | `tests/dieline-panels.test.ts`: 55 assertions over all panels of all 4 folded structures (37 panels) — one `<image>`, inside the panel box, aspect within 0.05, caption suppressed, clipped to the panel path | PASS |
| Aspect ratios | 1.5 (fills the panel), 0.25 (letterboxed by height), 4.0 and 3.0 cover | PASS |
| Transparent PNG | placed on model + blank; transparency flagged in the proof; 112.9 dpi refusal at final size | PASS |
| Replacement / multiple panels | one image after replacement; moving to another panel moves the artwork and its label, and repaints the model | PASS |
| SVG export | same `dielineSvg(result, { artwork })` call feeds the download and the on-screen blank; download button present | PASS (export path shares the tested function) |
| Missing artwork | no `<image>`, no `<clipPath>` — asserted per structure | PASS |
| PDF | never drawn; explicit message; verdict still produced | PASS |

Four stages, kept separate on purpose:

1. **Interactive visual preview** — WebGL, indicative. Says "not a textured model".
2. **Artwork proof** — a real file checked against the real panel: resolution at final size, bleed,
   colour build, proportions, panel mismatch. A *check*, not an approval.
3. **Human-approved prepress file** — **does not exist yet**. Nothing in the product produces or
   stores a signed-off PDF/X; the proof only flags problems.
4. **Final production approval** — out of scope, requires a cutting forme and a press check.

What software here **cannot** confirm: cut/fold geometry against a real forme, die-line correctness
for the press, safe areas (no safe-area overlay is drawn), gutters, trapping, overprint, or output-file
requirements (no PDF/X is produced). The UI says all of this — "Concept — not for production", "not a
production file until a template has been signed off".

---

## 6. Defects

### Fixed in this audit (each verified after the change)

| ID | Sev | Defect | Fix | Files |
|---|---|---|---|---|
| D1 | **Critical** | SDK-generated CRUD published every enquiry (`/api/leads`) and allowed unauthenticated PATCH/DELETE; `/api/users` readable; config writes open | Deny set in the generated, regeneration-safe hooks: leads/artworks/users refused for all verbs; config collections refuse writes, keep public reads | `src/lib/api-guard.ts` (new), `src/generated/{lead,artwork,user,setting,exchange-rate,destination,product-market}.hooks.ts` |
| D2 | High | An artwork row could be inserted with an arbitrary `storedAs`, turning the file route into an arbitrary-file read | Closed by D1 (no public artwork writes); added resolved-path containment check in the file route | `custom-routes.ts` |
| D3 | Medium | React update loop in the studio (`Maximum update depth exceeded`, reproduced 4×) from an unstable `onPlacement` prop in an effect's dependency list | `useCallback` in the parent + last-payload guard inside the effect | `src/components/studio/Studio.tsx`, `ArtworkPreview.tsx` → `ArtworkProof.tsx` |
| D4 | Medium | Unauthenticated, unlimited 25 MB uploads → trivial disk exhaustion | 20 uploads/hour per address (in-memory, documented as edge-dependent) | `custom-routes.ts` |
| D5 | Low | `GET /api/artwork/:ref` returned filename/panel/findings to anyone; references are enumerable | Token required | `custom-routes.ts` |
| D6 | Low | References from `Math.random()`; artwork references never checked for collisions (could serve the wrong customer's file) | CSPRNG + unbiased draw + collision retry; `AW-` collision check added | `custom-routes.ts` |
| D7 | Low | User-supplied bytes served inline with the client-supplied `content-type` | `X-Content-Type-Options: nosniff` + `Content-Security-Policy: default-src 'none'; sandbox` | `custom-routes.ts` |
| D8 | Low | Assembly structures (pouch, standee) showed "the model is still starting" when artwork could never apply | Explicit "formed shell" message | `src/components/studio/ArtworkProof.tsx` — **not in the served bundle**, see R1a |
| — | — | No test covered artwork placement on *every* panel | Added parameterised test (55 assertions) | `tests/dieline-panels.test.ts` (new) |

Verification after the fixes: `vitest` 8 files / 190 tests; `tsc` 0 errors outside generated code;
`qa.ts` 15/15 routes; `qa-checklist.ts` clean console; `qa-audit-artwork.ts` 19/19; `qa-inbox.ts`
28/28; `qa-market.ts` 38/38.

### Open defects and gaps (not fixed — reasons given)

| ID | Sev | Finding | Why not fixed / what to do |
|---|---|---|---|
| R1 | Low (was Medium) | The **served preview** bundle is a development build: `jsxDEV` in every chunk, React dev runtime, unminified 839 KB main bundle + 82 KB studio chunk, `/app/workspace/...` paths embedded | **Not a source defect.** `package.json` says `"build": "vite build"` and `vite.config.ts` already sets `minify: 'esbuild'`; a production build would be minified and jsxDEV-free. The preview manager evidently builds with the development mode, so this reflects *how the preview is produced*, not how the site would be deployed. I could not verify the publish pipeline's build because publishing is blocked on plan (R11). **Check on a real deploy:** `grep -c jsxDEV dist/assets/index-*.js` must print `0`. |
| R1a | — | **Resolved / was wrongly reported.** Earlier I recorded the assembly-structure message (D8) as absent from the running bundle because I grepped only `index-*.js`. The studio is code-split: the live chunk `dist/assets/Studio-DDeps5fK.js` (11:39:21, referenced by `index-C5mLLT6h.js`) **does** contain it. No action needed. | — |
| R2 | **High** | No backups, no migration history (`prisma/migrations` absent; schema applied with `db push`) | Launch blocker. Add a nightly `sqlite3 .backup` (or move to Postgres with PITR), store off-volume, and switch to `prisma migrate` with committed migrations. |
| R3 | **High** | No email delivery — neither the business nor the customer is notified | Launch blocker for real operations. Add a provider, a "new enquiry" notice to the desk and an acknowledgement to the customer, both logged. |
| R4 | Medium | Admin sessions are per-process memory; any restart signs everyone out and there is no session list or per-user revocation | Acceptable for a single-operator inbox; move to a signed session table if more than one person needs access. |
| R5 | Medium | Rate limits key on the first `x-forwarded-for` hop, which a client can spoof | Configure the edge to strip inbound `XFF`; otherwise move limits to the proxy. |
| R6 | Medium | One shared passcode, no accounts, no audit trail of who changed a status | Fine for one desk; needed before delegating access. |
| R7 | — | **Fixed.** `.data/` (customer artwork) was not ignored and the project auto-commits | Added `.data/` to `.gitignore`; `git check-ignore -v .data/artwork` now matches. `prisma/dev.db` was already ignored via `.git/info/exclude` (local only — worth moving into `.gitignore` so a clone inherits it). |
| R8 | Low | Artwork files are never expired or deleted | Add a retention job; enquiries reference artwork that may be months old. |
| R9 | Low | `/api/settings`, `/api/exchange-rates`, `/api/destinations`, `/api/product-markets` are publicly readable | Commercial config, not personal data, and the site already publishes it via `/api/market`. Documented, not a defect. |
| R10 | Low | No HTTP→HTTPS redirect at the preview host | Platform-level; configure at the edge when a real domain is attached. |
| R11 | Info | Publishing to `*.shogo.one` needs a paid plan (workspace is Free) | Not attempted. Upgrade, or host elsewhere. |
| R12 | Info | Cut/fold geometry, safe areas, trapping and PDF/X are not validated or produced | Out of scope for the current "concept" positioning; the UI says so. Required before the site promises print-ready output. |

### Defect severity summary

Fixed: **Critical 1 · High 1 · Medium 3 · Low 4**, each re-verified after the change.
Open: **High 2** (R2 backups, R3 email — both operational, not logic) · **Medium 4** · **Low 4** ·
**Info 2**. One earlier finding (R1a) was **withdrawn** after re-checking: I had grepped only the main
bundle and missed the code-split studio chunk.

---

## 7. Production readiness

| Item | State |
|---|---|
| Environment variables | Only `ADMIN_PASSCODE` is project-owned; `DATABASE_URL` injected by the runtime; no `SITE_URL`, mail or backup configuration |
| HTTPS | Works on the platform host, valid certificate; no HSTS/redirect control in-app |
| Domain | `site.configured = false` → DEMO badge; no domain attached |
| Backups | **None** |
| Error logging | stdout captured into `build.log`; no levels, rotation or alerting |
| Upload limits | 25 MB/file, 20/hour/address, JSON fields capped |
| Email | **Not configured** |
| Failure recovery | Restart is clean and data persists; sessions intentionally drop; a failed write tells the visitor to email instead |
| Build output | The **preview** serves a development bundle (`jsxDEV`, unminified, 839 KB main + 82 KB studio chunk). Source and config are production-ready, so this is a property of how the preview is built (R1) — verify on the real deploy |
| Publishing | Requires Pro plan; not attempted on this Free workspace |

---

## 8. Recommended order of work

1. ~~Add `.data/` to `.gitignore`~~ — **done in this audit** (R7). Also move `prisma/dev.db` from
   `.git/info/exclude` into `.gitignore` so a clone inherits the rule.
2. Decide storage: Postgres + migrations + nightly backup, or accept single-file SQLite with a
   snapshot cron and a documented restore test.
3. Wire transactional email: desk notification on `POST /api/enquiries`, acknowledgement to the
   visitor, both logged against the reference.
4. Confirm the deploy pipeline builds in **production** mode (`grep -c jsxDEV dist/assets/index-*.js`
   must be `0`) — the preview's bundle is a dev build, so this is unverified until a real deploy.
5. Edge configuration: strip inbound `XFF`, enforce HTTPS, set rate limits at the proxy.
6. If more than one person needs the inbox: replace the shared passcode with accounts and an audit
   log of status changes.
7. Artwork retention policy and an explicit "send us the press file" hand-off, which is the only way
   the fourth stage (production approval) can start.

---

## 9. Commands used

```bash
bun x vitest run                                   # 8 files, 190 tests passed
bun x tsc --noEmit                                 # 33 errors, all in src/generated (pre-existing)
curl -s -X POST http://localhost:8080/preview/rebuild   # 200, built in 5082ms
tail -2 .shogo/logs/build.log                      # built in 5082ms
bun run .tmp/qa.ts                                 # 15/15 routes, no console errors
bun run .tmp/qa-checklist.ts                       # catalogue→studio, dims+rotation, PNG, replace, blank
bun run .tmp/qa-audit-artwork.ts                   # 19/19 — PDF honesty, aspect, replacement, panel move, removal
bun run .tmp/qa-inbox.ts                           # 28/28 — inbox fields, artwork, status workflow
bun run .tmp/qa-market.ts                          # 38/38 — market selector, postal, refusal, admin
curl -s localhost:3101/api/leads                   # 400 direct_access_disabled (was 200 with PII)
curl -s -X PATCH localhost:3101/api/leads/1 -d '{"status":"won"}'   # 400 refused (was 200)
curl -s -X POST localhost:3101/api/settings        # 400 writes refused, 200 on GET (public config)
curl -s localhost:3101/api/artworks                # 400
curl -s localhost:3101/api/users                   # 400
curl -s localhost:3101/api/artwork/<AW>/file       # 401 without token, 200 identical bytes with
curl -s localhost:3101/api/artwork/<AW>            # 401 without token (metadata)
curl -s localhost:3101/api/admin/enquiries         # 401 without token
curl -s -X POST localhost:3101/api/artwork -F file=@26MB  # 413
curl -s -X POST localhost:3101/api/artwork … ×21   # 20 × 201, then 429
curl -s -X POST localhost:3101/api/enquiries -d '{}'  # 400 "Unknown enquiry type.", no row
curl -s -X POST localhost:3101/api/enquiries -d '{…pincode:"12"}'  # 400 field-level PIN error, no row
curl -s localhost:3101/api/enquiries/stats         # {"total":0,"quotes":0} — no audit residue
grep -c jsxDEV dist/assets/*.js                    # 4 / 1 / 1 → preview is a dev build (R1)
grep -o 'Studio-[A-Za-z0-9_-]*\.js' dist/assets/index-C5mLLT6h.js   # code-split studio chunk (R1a)
env DATABASE_URL="file:$PWD/prisma/dev.db" bun run .tmp/audit-cleanup.ts   # 0 rows, 0 files left
```
