# Build status — Kraftline site & packaging studio

Last verified: 21 Oct 2026. Every claim below is attached to a command that was
actually run and its observed result. Anything unverified is marked as such.

Legend: **PLANNED** · **IMPLEMENTED** (code exists) · **TESTED** (automated test
passes) · **VERIFIED IN RUNTIME** (observed in a browser or over HTTP) ·
**BLOCKED** · **REQUIRES BUSINESS INPUT**.

---

## 1. Geometry engine — IMPLEMENTED · TESTED

Parametric box geometry computed from `structure + L×W×H + board grade`. Panels
are chained parent→child with the origin on the crease, and folding to 0° lands
the panels on the exact 2D die-line (same data, no separate drawing).

| Item | Status | Evidence |
| --- | --- | --- |
| 6 lead structures (mailer, STE carton, rigid magnetic, telescopic, pouch, roll-up) | IMPLEMENTED | `src/lib/geometry/structures/` |
| Panel resolution, 2D blank, edge-walking placement | IMPLEMENTED | `blank.ts` |
| Assembled matrices, pose interpolation, flat mode | IMPLEMENTED | `build.ts` |
| Dieline SVG export | IMPLEMENTED | `dieline.ts` |
| Unit tests | **TESTED** | `bun x vitest run` → **7 files, 135 tests passed** |
| Pricing engine (margin ≠ markup, quote-only when rates unapproved) | IMPLEMENTED · **TESTED** | `src/lib/pricing/engine.ts` + `tests/pricing.test.ts` |

Tests: `tests/geometry.test.ts` (48), `tests/dieline-artwork.test.ts` (5),
`tests/uv.test.ts` (5), `tests/pricing.test.ts` (9), `tests/prepress.test.ts` (19),
`tests/market.test.ts` (30), `tests/fx.test.ts` (19).

## 2. 3D studio — IMPLEMENTED · VERIFIED IN RUNTIME

`/studio` renders a generated model, not a mesh or a photo.

- Fold scrub with structural stop, explode toggle, X-ray view, reset.
- Dimensions and board grade validated before rendering.
- Artwork proof: upload a file, see the prepress findings, put it on the panel (§5).
- Dieline export labelled *concept preview — not approved for production*.
- Opened pre-configured via `/studio?structure=<id>&dims=…&board=…`.

The camera frames the *projected* silhouette of the box rather than a bounding
sphere, so a wide flat mailer fills the preview instead of floating small in it,
and re-frames (keeping the view direction) when a container is measured before
layout settles.

**Verified:** headless Chromium at 1280×1000 — canvas present (651×566), moving
the fold slider changed the rendered frame (screenshot bytes differ), zero
console errors, zero uncaught exceptions. Mobile 390×844 — canvas present, no
horizontal overflow on any of 5 pages checked.

## 3. Site — IMPLEMENTED · VERIFIED IN RUNTIME

15 routes render, each with exactly one `<h1>`, no console errors:

```
/                                   /packaging
/packaging/:family                  /packaging/:family/:product
/industries                         /industries/:industry
/printing  /branding  /displays     /studio
/quote     /sample                  /contact   /about   /portfolio
/resources  /resources/:slug        /privacy  /returns  /refunds
/payment-terms  /terms  /shipping   /artwork-guide
/404 (unknown paths)
```

Content is real: 49 catalogue formats across 7 families, 12 industries with
per-category technical constraints, 5 resource articles, 7 policy pages.

**Verified render (headless Chromium, CDP):** all 15 sampled routes returned
expected H1/H2 text, correct control counts, no errors.

## 4. Enquiry pipeline — IMPLEMENTED · VERIFIED IN RUNTIME

- `POST /api/enquiries` — the single entry point for quote / sample / contact.
  - Allow-lists `kind`, normalises email, rejects short names, requires a
    description when no format is chosen.
  - Honeypot field silently accepted and discarded.
  - Duplicate suppression: same email + kind + format within 10 minutes returns
    the existing reference instead of creating a second row.
  - Returns a human-quotable reference (`KL-XXXXX`).
- Row per enquiry in SQLite (`Lead` model, `leads` table).
- End-to-end: browser form → API → database, reference shown back to the user.

**Verified:** `curl` 201 + reference; duplicate request returned the same
reference; invalid payload → 400 with a message; honeypot → 201 no row. Browser
submit from `/quote` produced `Received. KL-…` on screen. Test rows deleted
afterwards (`/api/enquiries/stats` → `{total: 0, quotes: 0}`).

## 5. Artwork → prepress → proof — IMPLEMENTED · TESTED · VERIFIED IN RUNTIME

The site promised an artwork check in six places before this existed. It now
reads the actual file: format from magic bytes, pixel dimensions, colour build,
page boxes, transparency — judged against the *real panel* from the geometry
engine, not a guessed size.

| Item | Status | Evidence |
| --- | --- | --- |
| Byte-level inspection (PDF, AI, EPS, SVG, PNG, JPEG, TIFF) | IMPLEMENTED · **TESTED** | `src/lib/prepress/inspect.ts`, 8 tests |
| Rule engine: resolution at final size, proportion, bleed, colour, alpha, page count, page size | IMPLEMENTED · **TESTED** | `src/lib/prepress/evaluate.ts`, 11 tests |
| Panel-correct UVs so artwork covers exactly one face | IMPLEMENTED · **TESTED** | `tests/uv.test.ts`, 5 tests |
| Artwork on the model, aspect-correct (`contain` / `cover`) | IMPLEMENTED · **VERIFIED** | viewer `setArtwork` |
| Upload + server-side re-check, stored file, `AW-XXXXX` reference | IMPLEMENTED · **VERIFIED** | `POST /api/artwork` |
| Link an artwork reference to an enquiry | IMPLEMENTED · **VERIFIED** | `artworkRef` → `Artwork.leadId` |
| Artwork carried onto the flat blank and the SVG export | IMPLEMENTED · **TESTED** | 5 tests, same contain/cover maths as the 3D face |

The blank and the export matter most: an exported dieline with no artwork is a
different object from the proof the customer approved. `dielineSvg` now embeds
the placed image clipped to its panel, above the panel fill and below the cut
lines, and drops that panel's label so it does not print over the logo.

Two real defects were found and fixed while building this, both of which would
have shipped silently:

- `createPanelGeometry` claimed to "run UVs across the whole face" but only
  called `computeBoundingBox()`. ExtrudeGeometry's default generator emits
  world-space UVs, so artwork would have tiled once per millimetre. Fixed, and
  the test pins 0..1 on every panel of four structures.
- ExtrudeGeometry is **non-indexed**, so the first remap implementation silently
  did nothing (`getIndex()` returns null). The UV test caught it.

A third was a judgement error, not a crash: the default artwork panel was the
largest face by area, which on a closed mailer is the **base** — invisible. The
QA frame comparison proved the texture was absent, and panel selection now
weights faces a person can actually see.

**Verified:** browser upload of a 2362 × 1417 PNG → `200 dpi at final size`,
`1 blocking / 3 review / 1 pass`, correct 25% proportion error on a file built
for a different panel; frame hash changes when the artwork is toggled on and
restores exactly when toggled back; save returns `AW-…`; the same file at
`POST /api/artwork` returns 201 and `GET /api/artwork/:ref/file` is byte-identical
to the upload; junk bytes named `.png` are rejected as unrecognised; missing
panel size → 400; unknown reference → 404. Mobile 390 × 844: zero horizontal
overflow before and after a file is attached.

## 5b. Enquiry inbox — IMPLEMENTED · VERIFIED IN RUNTIME

The site took enquiries and had nowhere to read them. There is now a business
inbox at `/enquiries` with a passcode gate.

| Item | Status | Evidence |
| --- | --- | --- |
| Delivery PIN code on the quote form, validated both sides | superseded by §5c — postal code per country | short PIN → 400 + inline error, `560001` → 201 |
| Passcode-gated session (`ADMIN_PASSCODE`, timing-safe, rate limited, 8 h token) | IMPLEMENTED · **VERIFIED** | wrong passcode 401, no token 401, token 200 |
| Enquiry detail: specs, payload, contact, quantity, artwork, prepress verdict | IMPLEMENTED · **VERIFIED** | 28-check harness, `.tmp/qa-inbox.ts` |
| Delivery country, postal code, printing and delivery requirements in the detail | IMPLEMENTED · **VERIFIED** | `Germany (DE)` · `80331` · `CMYK offset…` read out of the DOM |
| Quotation currency block: base, converted figure, stored rate, timestamp, "indicative" wording | IMPLEMENTED · **VERIFIED** | `INR 2,400.00 ≈ EUR 23.00`, `1 INR = 0.009389 EUR`, snapshot time |
| A lead with no figure says so instead of showing a currency alone | IMPLEMENTED · **VERIFIED** | "No converted amount is on file" · no rate rendered |
| Artwork files are no longer public | IMPLEMENTED · **VERIFIED** | `GET /api/artwork/:ref/file` → 401 without a token |
| Status workflow (new → contacted → quoted → won/lost) | IMPLEMENTED · **VERIFIED** | clicked `contacted` in the inbox, read back over the API |

The passcode lives in `.env` as `ADMIN_PASSCODE` — server-side only, never in the
bundle. `/enquiries` is disallowed in `robots.txt` and absent from the sitemap.

## 5c. Destination, currency and rate snapshots — IMPLEMENTED · TESTED · VERIFIED

A visitor outside India can state where the packaging is going and which currency
they want to read the figure in. Nothing about it invents a price: the ₹ cost
model is still the only source of a number, and a conversion is always shown as
*derived* and *indicative*.

| Item | Status | Evidence |
| --- | --- | --- |
| 115 countries, each mapped to one of 8 quotation currencies | IMPLEMENTED · **TESTED** | `src/lib/market/countries.ts`, `market.test.ts` |
| Per-country postal rules (Germany 5 digits, UAE allows P.O. Box, …) | IMPLEMENTED · **TESTED** | `src/lib/market/postal.ts` |
| Conversion, rounding, markup, staleness, "indicative" wording | IMPLEMENTED · **TESTED** | `src/lib/market/fx.ts`, `fx.test.ts` (19) |
| Destination policy: `served` / `quote-only` / `not-served` | IMPLEMENTED · **TESTED** | `src/lib/market/policy.ts` |
| Header-based suggestion, never authoritative; a stored choice always wins | IMPLEMENTED · **VERIFIED** | GB accept-language suggests GB, visitor's DE choice survives reload |
| Live rate sync from one provider, manual rates as the fallback | IMPLEMENTED · **VERIFIED** | `POST /admin/market/rates/sync` → `added: 7, source: live`; manual mode with no rate → `412 no-rate`, never a guess |
| Enquiry refuses a destination or product/market pair it cannot serve | IMPLEMENTED · **VERIFIED** | Syria → 409 `destination_not_served`, no row written |
| Rate snapshot stored with the lead (base, rate, converted, timestamp) | IMPLEMENTED · **VERIFIED** | row read back: `AE / AED / INR 2400 / 0.038662 / 93` |
| Admin surface for policy, rates, destinations, product rules | IMPLEMENTED · **VERIFIED** | `/admin/markets`, passcode-gated, 38-check harness |

A converted amount only ever appears when a rate exists, is fresh enough and the
destination is served. When any of those fails the site degrades to "request a
quotation" — there is no code path that presents a made-up figure as a price.

**Verified:** 11-case enquiry matrix over HTTP (each case's stored row checked),
`38/38` browser checks in `.tmp/qa-market.ts` (selector, persistence, German
postal validation, submit, refusal, mobile 390 px, admin), `28/28` in
`.tmp/qa-inbox.ts` (inbox rendering of the market fields), zero console errors
and zero uncaught exceptions in both.

## 5d. Catalogue image library — IMPLEMENTED · TESTED · VERIFIED IN RUNTIME

Every one of the 49 catalogue products has its own image. They are **original
vector illustrations generated in-house** from the same structure description
the studio uses — not photographs, not stock, not AI renders presented as
product shots. The site says so on the page.

| Item | Status | Evidence |
| --- | --- | --- |
| Asset audit (before state) | DONE | `bun run scripts/audit-catalogue-assets.ts` → `docs/CATALOGUE-ASSET-AUDIT.md`, **0/49** thumbnails, exit 1 |
| Illustration generator | IMPLEMENTED | `scripts/generate-catalogue-assets.ts` → `public/catalogue/`, **98 assets** (49 thumbnails + 49 detail views), 126.0 kB total, largest 4.2 kB |
| Rights register | IMPLEMENTED | `src/lib/catalogue-rights.data.ts` — creator, licence, attribution, verification date per asset. Deliberately not imported by any component, so licensing metadata is not shipped to visitors |
| Runtime manifest | IMPLEMENTED | `src/lib/catalogue-assets.ts` — only `approved` records are ever returned to a component |
| Shared image component | IMPLEMENTED | `src/components/site/CatalogueImage.tsx` — WebP source set, intrinsic dimensions (no layout shift), alt text from the manifest, lazy by default |
| Audit (after state) | **TESTED** | exit 0 — **49/49** thumbnails, 49/49 detail views, 98 records, 0 broken references, 0 unapproved assets in use, 0 duplicates |
| Manifest + filesystem invariants | **TESTED** | `tests/catalogue-assets.test.ts` |
| Page rendering | **VERIFIED IN RUNTIME** | CDP: 15/15 checks — every thumbnail decoded (`naturalWidth > 0`), alt text present, no two cards share an image, detail view differs from its hero, no horizontal overflow at 390 px, no console errors |

The 3D studio, artwork upload, die-line, quote and inbox paths are untouched:
the images are additive, and `ModelPreview` still renders the live model.

## 5e. Box geometry — IMPLEMENTED · TESTED · VERIFIED IN RUNTIME

Boxes rendered fragmented, with open ends and floating flaps. The causes were
concrete and are fixed in both renderers.

**Illustrations** (`scripts/generate-catalogue-assets.ts`, 98 assets, 126.0 kB):

| Defect | Cause | Fix |
| --- | --- | --- |
| Box drawn inside-out | `isoBox` shaded the faces at the **far** vertical edge | faces selected at the **near** edge |
| Lid floated off the box | `tuckLid` hinged on a front edge; tuck tab drawn wider than the lid | hinged on the far rim; tab inset and drawn **behind** the lid |
| Second bottom edge under every open box | `openInterior` used `isoZ(-h·inset)`, sinking the floor below the silhouette | rebuilt in normalised box space; floor at `+z` |
| Background sliver at the rim | a vertical face has no thickness where it is cut | `rimBand` — four cut-edge strips at the rim |
| Foam insert outside the box | `isoZ(-h·0.62)` | die-cut sheet with a recessed cavity, drawn inside |
| Round box showed a flat chord | open cylinder had no rim, and the lifted lid was shorter than its own rim ellipse so the body path inverted | rim ellipses added; lid height floored at `2·ry + 16` |
| Dark stripe read as a gap | vertical band flush to the creases | horizontal printed band, inset, with its own outline |

Verified: **0** detail views have any polygon below the box's own bottom edge
(was 3), and all 98 were reviewed on a contact sheet.

**WebGL viewer** (`src/lib/three/viewer.ts`, `src/lib/geometry/`):

| Defect | Cause | Fix |
| --- | --- | --- |
| Dark cavity at the box end — the reported "incomplete" look | tuck and dust flaps sat **exactly coplanar** with the walls they close against; the far wall's back face won the depth test | new `PanelSpec.inset` offsets a flap along its own normal, one board thickness inside the wall |
| Lid skirts interpenetrating the base walls | rigid + telescopic skirts coplanar with the walls | `inset` on all seven skirts; side skirts shortened to `W − 2t` so they tuck between front and back |
| STE glue tab and tuck flaps coplanar | bonded/tucked inside an adjoining panel | `inset` on all three |
| Back faces showing through | `side: THREE.DoubleSide` on closed solids | `FrontSide` |
| Flat silhouette | hemisphere light dominated the key; key near the camera axis | key raised overhead (`300, 880, 400`), ambient rebalanced — top/front/right now measure 180 / 138 / 111 instead of 168 / 155 / 128 |

Regression test: `tests/geometry.test.ts` asserts **no two panels are coplanar**
in the closed state for every fold structure, so this class cannot come back.
Panel AABBs also verified to union to exactly nominal + board thickness.

Known cosmetic residue: the telescopic lid shows a sub-millimetre step where its
skirts meet at the corners, visible only at ~4× zoom. It is a joint detail, not a
gap — the box is closed (`z-max` covered by `lidTop`) and has 0 interpenetrating
panels.

## 5f. Brand identity and logo — IMPLEMENTED · TESTED · VERIFIED IN RUNTIME

The navbar carried a text placeholder (a rounded "P" tile plus the word "Packowell")
and the tab icon still pointed at the old `/kraft.svg`.

**Business data** (`src/lib/site.ts`, single source of truth) now holds the confirmed
registration: `Packowell (Digitex Studio)`, the Bhiwandi registered office, GSTIN
`27AAAPP9753F2ZF`, phone `+91 77159 12764`, WhatsApp `919004962871` (digits, as
`wa.me` expects) and `packowell.com`. Footer, contact page, About page and the
Organization JSON-LD all read from it. `telHref`/`whatsappHref()` derive the
`tel:` and `wa.me` targets so the numbers cannot drift between places.

**Logo assets** — the supplied brand artwork, imported not redrawn
(`scripts/import-logo.py`). The source files are
`files/Packowell_Folded_Ribbon_Logo.png` (2172×724) and
`files/Interlocking_Amber_Ribbon_Emblem.png` (1254×1254). Earlier in this project a
mark was reconstructed from a written description because the artwork had not
reached the workspace; those generated files and their generator have been
**deleted**, so nothing on the site is a stand-in.

| Asset | Content | Size |
| --- | --- | --- |
| `packowell-logo@420w.webp` | full lockup, as used in the navbar | 21 kB |
| `packowell-logo.webp` / `.png` | full lockup at 1400w | 97 kB / 293 kB |
| `packowell-logo@700w.*` | intermediate size | 42 kB / 101 kB |
| `packowell-mark*.{png,webp}` | emblem only, 512w and 256w | 12–171 kB |
| `packowell-icon-64/180/512.png` | emblem on a white plate (favicon, touch, mask) | 3 / 16 / 102 kB |
| `packowell-og.png` | 1200×630 social share card | 58 kB |

Both sources are opaque RGB with a baked background — the lockup on warm cream
`#fdfbf5`, the emblem on white `#fefefe` — so neither drops onto the cream navbar
or the ink footer without a visible rectangle. The import step derives alpha from
each pixel's distance to the measured background colour, then **un-premultiplies**
the colour so antialiased edges carry no white halo onto a tinted ground. Interior
whites (the counter of the "o", the gaps between the ribbons) become real holes,
which is what the artwork intends. The artwork is never redrawn: only trimmed,
de-backgrounded and resized. Trimmed lockup is 1795×567 (aspect 3.166).

Placement: the navbar uses the lockup at **40px** desktop / **32px** mobile. The
footer and the favicon use the emblem on its white plate, because the charcoal
wordmark is illegible on the ink ground — the plate keeps the artwork exactly as
supplied while guaranteeing contrast. The share card is re-rendered from the real
lockup by `scripts/generate-og.py`.

**Defects found while wiring it up:**

| Defect | Cause | Fix |
| --- | --- | --- |
| Logo squashed ~10% on mobile, ~2.5% on desktop | Tailwind preflight sets `img { max-width: 100% }`; the flex item shrank and the cap compressed the width while `h-*` pinned the height | `max-w-none shrink-0` — aspect now measures exactly **3.158** at every width |
| Old placeholder icon still served | `dist/kraft.svg` survived because the build does not empty `outDir` | removed the file and the `index.html` reference; `/kraft.svg` now returns 404 |
| Footer showed a text "P" tile, clashing with the mark | the footer brand block was never updated with the navbar | now the real emblem on its white plate |
| `twitter:card` promised `summary_large_image` with **no `og:image`** — every social share rendered an empty card | the tag was set but no image was ever produced | added `packowell-og.png` (1200×630) plus `og:image` / `og:image:width|height|type|alt` and `twitter:image`, in the static shell **and** in `useSeo` so every route carries it |
| Share card: logo sat centred instead of left | a column flex container stretches its children, and a stretched `img` letterboxes the artwork inside the box | `align-self: flex-start` on the logo |

Mobile height is 32px rather than 40px: at 320px the lockup has ~107px of room
beside the currency selector and a 40px lockup needs 127px. Sizing it to fit keeps
the aspect exact instead of distorting.

Verified in a real browser (`bun .tmp/qa-logo.ts`, 28 checks): the lockup loads
(`naturalWidth` 420×133), renders 40px desktop / 32px mobile, aspect 3.158 at 1280 /
390 / 360 / 320, flush with the content edge, no horizontal overflow at any of those
widths, favicon serves 200 `image/png`, `/kraft.svg` 404, zero console errors.
`bun .tmp/qa-brand.ts` (27 checks) confirms every registered detail renders in the
footer, that the three `tel:` links resolve to `tel:+917715912764` and the four
`wa.me` links to `https://wa.me/919004962871`, and that `og:image` is present,
absolute, 1200×630 and under 100 kB.

## 6. SEO — IMPLEMENTED · PARTIAL

| Item | Status |
| --- | --- |
| Static `<title>`, description, Open Graph, theme-color in `index.html` | IMPLEMENTED · VERIFIED (served HTML) |
| Organization + WebSite JSON-LD in the shell | IMPLEMENTED · VERIFIED |
| Per-page title/description/canonical/JSON-LD at runtime (`useSeo`) | IMPLEMENTED · VERIFIED (titles change per route) |
| Breadcrumb + Product + Service + TechArticle JSON-LD per page | IMPLEMENTED |
| `robots.txt` | IMPLEMENTED · VERIFIED (200) |
| `/api/sitemap.xml` generated from the live catalogue | IMPLEMENTED · VERIFIED — **93 URLs**, host derived from the request |
| True server-side rendering | **BLOCKED** — Vite SPA; crawlers that do not execute JS see only the shell + `<noscript>` copy. Prerendering is the fix, not a meta tag. |

Canonical/`og:url` are deliberately **not** emitted while the domain is a
placeholder — a canonical pointing at `https://[domain]` is worse than none.

## 7. Performance — IMPLEMENTED, one known trade-off

- Vite build minified (the template shipped `minify: false`); three.js split
  into its own chunk; the studio route lazy-loaded; `ModelPreview` loads the
  renderer + geometry builder after paint.
- Entry chunk **930 kB / 218 kB gzip** in the preview build (dev-mode, unminified
  by the preview manager — `jsxDEV` is present). The catalogue manifest adds
  ~156 kB of that; the rights register was split out of the bundle to claw back
  25 kB. A production build is smaller; measure it with
  `grep -c jsxDEV dist/assets/index-*.js` → 0 before quoting a number.; three **565 kB / 143 kB gzip**;
  studio route 47 kB; CSS 55 kB / 9.6 kB.
- **Trade-off:** `structures/assembly.ts` builds `BufferGeometry` for the pouch
  and roll-up, so `three` is still in the eager graph of any page that imports a
  structure spec. Removing it needs an async `panelBuilder` contract — a change
  to a tested engine, deferred rather than rushed.

---

## 8. Production job board — IMPLEMENTED · TESTED · VERIFIED IN RUNTIME

Twelve ordered stages, a gate that cannot be talked past, and artwork versions
that are never edited in place.

| Item | Status | Evidence |
| --- | --- | --- |
| Stage workflow | IMPLEMENTED · **TESTED** | `src/lib/production/stages.ts` — order enforced by index, so a stage cannot be skipped by posting a different string |
| Production gate (pure) | IMPLEMENTED · **TESTED** | `src/lib/production/gate.ts` — 21 tests in `tests/production-gate.test.ts`; each unmet condition is its own named blocker |
| Persistence | IMPLEMENTED | `ProductionJob`, `JobEvent`, `ArtworkVersion`, `QualityCheck` in `prisma/schema.prisma` (SQLite) |
| API | IMPLEMENTED · **VERIFIED** | `custom-routes.ts` — create, list, stats, detail, confirm-specs, advance, artwork upload, approve/reject, file download, QC, dispatch. All `/admin/*` routes require a bearer token |
| End-to-end journey | **TESTED** | `.tmp/qa-jobs.ts` — **59/59** checks from quote-accepted to dispatch, including every refusal |
| Survives a restart | **TESTED** | `.tmp/qa-persistence.ts` — **20/20**; job, stage, versions, hashes, event history and the file on disk all survive a process restart. Session tokens do **not** survive (they live in memory), so staff sign in again — the old token is refused |
| Job board UI | IMPLEMENTED · **VERIFIED IN RUNTIME** | `/admin/jobs` — CDP **31/31**: passcode gate, counters, search, stage filter, detail panel, 12-stage rail, gate blockers read off the screen, confirm-specification clicked through, refusal text shown, 390 px without overflow |

**What the gate actually refuses** (each verified over HTTP, not just in unit
tests):

- advancing to `production-file-ready` with no production file → 409, blocker
  names the missing file;
- advancing with a production file that no one approved → 409;
- approving a file that has blocking prepress findings (e.g. 127 dpi at
  240 × 180 mm) → 409, however much the desk wants it;
- skipping a stage → 400;
- uploading a new proof after approval → the previous approval is withdrawn, the
  old version is marked `superseded`, production readiness is cleared and the job
  returns to the proof stage.

Demo rows: `bun run scripts/seed-demo-jobs.ts` creates four jobs labelled
`Demo — ` under `demo@kraftline.test`; `--clean` removes them and their files.

## REQUIRES BUSINESS INPUT

Nothing below is invented on the site. Each is a visible `[PLACEHOLDER]`.

| # | Needed | Where it appears |
| --- | --- | --- |
| 1 | Registered legal entity name, full address, GSTIN, Udyam | footer, `/contact`, `/about`, invoices |
| 2 | Confirmed domain | `src/lib/site.ts` → `url`, canonical URLs, sitemap line |
| 3 | Email address + phone number | `/contact`, footer, policy pages |
| 4 | Approved rate table (rates, waste %, setup, MOQs) | price only ever appears from a quote until then |
| 5 | Lead times, dispatch and freight terms | `/shipping` |
| 6 | Claim window, retention period, refund %s, jurisdiction | `/returns`, `/privacy`, `/terms`, `/refunds` |
| 7 | Confirmation of in-house vs partner manufacturing | `/about` (currently stated as partners) |
| 8 | Case studies with written client permission | `/portfolio` (0 published) |
| 9 | Legal review of the seven policy pages | all marked draft |
| 10 | Quotation currencies actually offered, who may approve them, and any FX spread to apply | `/admin/markets` — defaults are the 8 major currencies, a policy the desk can change |
| 11 | Which destinations are served, quote-only or refused, and the freight terms behind that | `/admin/markets` destination policy |
| 12 | Which formats can be sent to which market (MOQ, print method, board availability) | `/admin/markets` product × market rules |

## BLOCKED / NOT BUILT

- **Ordering and payment.** Deliberately off: no approved rates, no terms, no
  fulfilment path. The UI says so instead of showing a fake checkout.
- **Shipping cost, duty and tax for a destination.** Not calculated, not quoted,
  not estimated. The destination affects *availability and currency*, nothing
  else. The admin page states this in as many words (`capabilities` block:
  `shippingRates: false`, `taxEngine: false`), and the quote sidebar lists what a
  quotation will not include.
- **Email notifications.** An enquiry is written to the database and readable in
  `/enquiries`; nothing is emailed to the business or to the customer. No mail
  provider is configured and the UI does not claim one.
- **`bun x tsc --noEmit` is not clean** — remaining errors are all inside
  `src/generated/**` (the SDK's generated Prisma/route types, pre-existing).
  `vite build` succeeds and the runtime is unaffected. Not fixed here because
  those files are overwritten by `shogo generate`.
- **`.usdz` / iOS AR export** — not started.
- **True SSR / prerender** — not started (see §6).
- **Artwork drawn on the model is limited to formats a browser can decode**
  (PNG, JPEG, SVG). A PDF is the right file to send and is fully inspected, but
  it cannot be painted onto the 3D face; the UI says so rather than showing a
  blank box. Rendering it needs a PDF rasteriser in the bundle.
- **The prepress check reads the file, not the design.** It cannot see a font
  substituted during export, a spot colour mapped to process, or artwork hidden
  behind another object. It is a filter for the common failures, not a
  replacement for the proof.
- **Photoreal surface materials** — models are generated geometry with plain
  materials by design; not a scan pipeline.

## Commands used for verification

```bash
bun x vitest run                       # 10 files, 227 tests passed
tail .shogo/logs/build.log             # built in ~5s, no errors
bun run .tmp/qa.ts                     # 15 routes: PASS, 0 console errors
bun run .tmp/qa2.ts                    # mobile overflow, form submit, slider
bun run .tmp/qa-artwork.ts             # artwork: findings, on-box frame, save
bun run .tmp/qa-art-mobile.ts          # 390px: 0 overflow with artwork attached
bun run .tmp/qa-checklist.ts           # acceptance items 1–4
bun run .tmp/qa-flat2.ts               # blank carries the artwork (element capture)
bun run .tmp/qa-market.ts              # market: 38/38 — selector, postal, refusal, admin
bun run .tmp/qa-inbox.ts               # inbox: 28/28 — market fields, artwork, status
curl -s localhost:3101/api/market/convert?amount=2400\&currency=EUR  # derived + indicative
curl -s -X POST localhost:3101/api/market/rates/sync -H "authorization: Bearer …"  # added: 7
curl -s localhost:3101/api/enquiries   # 201 + reference; 400 on a malformed pin code
curl -s -X POST localhost:3101/api/artwork -F file=@… -F panelWidthMm=… # 201 + AW- ref
curl -s localhost:3101/api/artwork/AW-XXXXX/file | cmp - upload # identical (with token)
curl -s localhost:8080/api/sitemap.xml # 93 <url> entries
bun run scripts/audit-catalogue-assets.ts  # 49/49 thumbnails, 0 broken refs, exit 0
bun run .tmp/qa-catalogue.ts           # catalogue: 15/15 — decoded, alt, no dupes, 390px
bun run .tmp/qa-jobs.ts                # production journey: 59/59 quote-accepted → dispatch
bun run .tmp/qa-persistence.ts         # restart: 20/20 — rows, versions, hashes, file survive
bun run .tmp/qa-jobboard.ts            # job board UI: 31/31 — gate, filters, refusal, 390px
bun run scripts/seed-demo-jobs.ts      # 4 demo jobs; --clean removes them
python3 scripts/import-logo.py         # supplied artwork → transparent, trimmed PNG/WebP
python3 scripts/generate-og.py         # 1200x630 social card from the real lockup
bun run .tmp/qa-logo.ts                # navbar logo: 28/28 — aspect, 1280/390/360/320, favicon
bun run .tmp/qa-brand.ts               # brand data: 27/27 — footer, tel:, wa.me, og:image
bun x tsc --noEmit                     # 0 errors outside src/generated
```

The QA harnesses live in `.tmp/` and drive headless Chromium over the DevTools
protocol; they are scratch tooling, not part of the product. Each one creates its
own rows/files and removes exactly those on the way out — `qa-inbox.ts` deletes
its leads, its artwork row and the stored file; `qa-market.ts` deletes its leads
and restores the destination policy it changed.
