# Packaging Platform Blueprint — 3D Configurator, Explode/Fold Engine, Order Engine

Status: proposal, pre-build. Nothing implemented yet.
Input: user research pack (Ezpac reverse engineering, schema audit, market analysis).

---

## 1. The one strategic correction

The research is a good *SEO and market* document. It is not a product document. It spends most of its
length on JSON-LD schema and volume-tier pricing, and almost none on the two things that decide whether
a web-to-print packaging store makes money:

1. **The structural engine** — geometry, folds, die-lines, prepress. If the 3D lies about the box, the
   order comes back wrong and the refund eats the margin.
2. **The artwork-to-press pipeline** — upload → bleed/resolution/ink validation → die-line placement →
   proof approval → plate/press. This is where every web-to-print company actually loses money.

So the build order is inverse to the research's emphasis: engine first, schema last (schema is a
half-day of JSON-LD generation once the catalog model exists).

Second correction: Ezpac's 3D is a **textured mesh with a texture swapper**. Upload a logo, it maps onto
a pre-made GLB. That cannot explode, cannot fold, and cannot do arbitrary dimensions — the mesh is fixed.
The differentiator is **parametric geometry**: the box is *computed* from structure + dimensions + board
grade, not downloaded. That single decision gives us explode, fold, any size, any GSM, and a real
exportable die-line — none of which a static GLB can do.

---

## 2. What I can build — the seven engines

### E1. Structural geometry engine (parametric)
Structure definitions (panel graph + crease coordinates) evaluated at runtime from L×W×H + board grade.
Not meshes: **functions**. Consequences:

- Unlimited dimensions (5cm jewellery box → 1.2m shipper) with millimetre control.
- Board thickness changes the whole blank (compensation/crease allowance), so 220gsm carton and
  5-ply corrugated are the same structure with different parameters.
- Live, from the first keystroke. Every dimension edit re-solves folds, clearances and price.

### E2. Fold engine (the "flip/open" feature)
Every panel is a `Group` whose origin sits **on its crease line**, with a rotation angle. Panels chain
(parent → child), so opening the lid drags its tuck flap and dust flaps correctly, and nothing can
detach. Drive it three ways:

- **Scrub** — a 0 → 180° slider ("open it up").
- **Drag** — grab the lid edge in 3D and pull; angle follows the pointer, with a hard stop at the
  structural limit (a tuck flap stops where the paper stops).
- **Snap states** — Closed → Unlatched → Open → Flat blank, animated on a spring.

Bonus that comes free from this design: **morph to 2D die-line**. Fold every crease to 0° and the 3D
flattens onto the print blank, exactly as it will be cut. That is the single most trust-building thing
on the site: "this is the box, this is the flat sheet we print, same object."

### E3. Explode engine (the "show from inside" feature)
Two modes, both animated, both with numbered callouts:

- **Part explode** — rigid boxes, mailers, pouches, displays. Parts separate along their own normal
  (lid up, body down, insert forward, magnet pair out, ribbon out) with layered ordering so nothing
  intersects. Interactive: click a part to isolate, hover for name + spec, toggle ghost/translucent
  outer to see the inner liner.
- **Panel explode** — folding cartons. Panels fan off their crease axes radially, so you see the inside
  of the print surface — which is what the customer actually needs to understand ("does the inside get
  printed?").

Plus an "X-ray" toggle: laminate layers separate for pouches (PET / ink / adhesive / AL / PE), which is
the honest way to sell a barrier pouch. Nobody in the Indian market shows this.

### E4. Print & artwork engine
Upload PNG/JPG/PDF/SVG → per-panel placement on the die-line → UV-mapped onto the 3D in real time →
prepress checks: DPI at final size, bleed (3mm), safe zone, rich black, spot vs CMYK, panel overflow
warnings, missing dieline layers. Then a real PDF proof (die-line + artwork + dimensions + finishing
spec) generated server-side, which is also the production file.

### E5. Pricing engine
Rule chain, not a price list: `sheet area × board rate × (1 + waste) + print setup + plates + finishing
+ insert + packing + freight + margin`, then MOQ tier curve. Every SKU gets a tier matrix
(10/25/50/100/250/500/1000) computed, never hand-typed, so a dimension change reprices the whole ladder
correctly and the JSON-LD tiers are generated from the same numbers the customer was quoted.

### E6. Order & production engine
Quote → order → artwork approval → production stages (prepress / print / die-cut / finish / pack /
dispatch) → invoice with GST → tracking. Manufacturer side: a shop-floor board per job with the
approved die-line and spec sheet attached, so the press gets one PDF, not a WhatsApp thread.

### E7. Discovery layer (the research's part, done properly)
JSON-LD `@graph` with `ProductGroup` + `hasVariant`, `PropertyValueSpecification` bounds,
`AggregateOffer` with nested `UnitPriceSpecification` tiers, `3DModel` + `MediaObject` for the .glb.
Parameterised routes `/boxes/{structure}/{L}x{W}x{H}-{gsm}` with pre-rendered HTML per combination.
Honest caveat in §7 about SSR on this runtime.

---

## 3. What 3D I can actually generate — three tiers, no hand-waving

| Tier | What it is | Covers | Weight | Interactive |
|---|---|---|---|---|
| **T1 Procedural** | Geometry computed in code from structure + dims | 100% of boxes, cartons, rigid, pouches, trays, displays | ~0 (code only) | Full fold + explode + any size |
| **T2 Baked GLB** | I write a Node script (three.js `GLTFExporter`) that emits `.glb` per structure at default size | Same catalog, for SEO `3DModel`, AR, embedding, download | 80–300 KB each, low-poly PBR | Static asset |
| **T3 Renders** | Headless screenshots + image generation | Category tiles, hero shots, spec-sheet images, social | — | Static image |

What I will **not** pretend:

- No photoreal scanned packaging assets. Our look is "clean product visualisation" — correct proportions,
  correct board thickness, real flute on cut edges, believable paper roughness — not a photoshoot.
- No soft-body cloth simulation of a pouch's real wrinkles at 60fps on a ₹12k phone. Faked with
  normal maps + vertex noise; visually convincing, physically approximate.
- `.usdz` for iOS AR Quick Look needs a converter step. Android WebXR I can ship immediately; iOS AR is
  phase 2, and I will not put a "View in your room" button on iOS until it actually works.

---

## 4. Product catalog + exact 3D treatment

Fold = hinged, animated open/close. Explode = parts separate. Inside = interior visible in the exploded
or opened state. Complexity: S / M / L.

### A. Corrugated & mailers

| # | Product | 3D class | Fold | Explode parts | Inside view | Cx |
|---|---|---|---|---|---|---|
| 1 | Roll-end tuck-front mailer | hinged | lid + tuck + 2 dust flaps | lid, body, dust flaps, insert | yes, on open | M |
| 2 | RSC shipper | hinged | 4 top + 4 bottom flaps | 9 panels | yes | S |
| 3 | Literature mailer (flat) | hinged | lid + 3 walls | 6 | yes | S |
| 4 | Die-cut mailer w/ insert | hinged + insert | lid | lid, body, corrugated insert, product ghost | yes, insert lifts out | M |
| 5 | Telescopic two-piece (lid+base) | two rigid trays | lid lifts off | lid, base | yes | S |
| 6 | Corrugated tray / shelf-ready | hinged | 4 walls | 5 | yes | S |
| 7 | Book-wrap / wrap mailer | hinged | wrap + 2 wings | 5 | yes | M |
| 8 | Cake / pastry box w/ window | hinged + PET patch | lid + auto-lock | lid, body, window patch | yes | M |

### B. Folding cartons

| # | Product | 3D class | Fold | Explode parts | Inside view | Cx |
|---|---|---|---|---|---|---|
| 9 | Straight tuck end (STE) | hinged | 1 tuck + 2 dust | 6 | yes | S |
| 10 | Reverse tuck end (RTE) | hinged | 2 tucks + 4 dust | 7 | yes | S |
| 11 | Auto-bottom / crash-lock | hinged, interlocking | 4-panel bottom cinch | 9 | yes, the collapse is the demo | M |
| 12 | Snap-lock bottom | hinged, interlocking | 4 locks | 8 | yes | M |
| 13 | Sleeve + tray | two parts | sleeve slides | sleeve, tray | yes | S |
| 14 | Pillow box | curved crease (bezier hinge) | 2 curved flaps | 3 | yes | M |
| 15 | Gable box w/ handle | hinged | gable + handle fold | 7 | yes | M |
| 16 | Hexagon / six-corner | hinged, radial | 6 walls | 9 | yes | L |
| 17 | Tuck-top w/ window patch | hinged + transparent | lid + tuck | 7 incl. PET | yes, x-ray window | M |
| 18 | Wrap-around sleeve carton | hinged | 4 folds | 6 | yes | M |

### C. Rigid / luxury (highest margin per the research)

| # | Product | 3D class | Fold | Explode parts | Inside view | Cx |
|---|---|---|---|---|---|---|
| 19 | **Collapsible magnetic rigid box** | rigid, V-groove hinged | walls collapse flat ↔ erect | lid, collar, 4 walls, 4 magnets, wrap paper, ribbon | yes — flagship demo | L |
| 20 | Lift-off lid rigid (shoulder/neck) | rigid two-part | lid lifts, reveals neck | lid, neck, base, wrap | yes | M |
| 21 | Book-style rigid w/ magnet | hinged rigid | spine hinge, magnet snap | 5 | yes | M |
| 22 | Drawer / slide-out rigid | two rigid parts | drawer slides out | outer, drawer, ribbon | yes | M |
| 23 | Round / oval hat box | lathe (revolve) | lid lift | lid, base, wrap seam | yes | M |
| 24 | Rigid + EVA/foam insert (cutouts) | rigid + insert solver | lid | + insert with product cavities | yes, product ghost in cavity | M |
| 25 | Ribbon-pull / satin bed rigid | rigid + soft parts | lid | + ribbon, satin bed | yes | M |

### D. Flexible packaging (per the research: the unserved 100–500 MOQ gap)

| # | Product | 3D class | Fold | Explode parts | Inside view | Cx |
|---|---|---|---|---|---|---|
| 26 | Stand-up pouch, ziplock (+gusset) | lofted shell | top folds back, zip opens | front, back, gusset, zip strip, tear notch | x-ray laminate stack | M |
| 27 | Flat-bottom / box pouch | lofted shell | 4-panel base | 5 + laminate layers | yes | M |
| 28 | 3-side-seal pouch | lofted shell | none | 3 | yes | S |
| 29 | Centre-seal pillow bag | lofted shell | none | 3 | yes | S |
| 30 | Spouted pouch | lofted + revolve cap | cap unscrews, spout | 4 | yes | M |
| 31 | Coffee bag w/ one-way valve | lofted + valve part | tin-tie/zip | 5 | x-ray shows valve + foil | M |
| 32 | Rollstock film | revolve roll | unwind animation | roll core, film, laminate | x-ray | S |
| 33 | Shrink sleeve | lofted, wraps a bottle ghost | heat-shrink morph | sleeve, bottle ghost | yes | S |
| 34 | Kraft paper bag / flat pouch | lofted | top fold | 3 | yes | S |

### E. Labels, stickers, tags

| # | Product | 3D class | Fold | Explode parts | Inside view | Cx |
|---|---|---|---|---|---|---|
| 35 | Roll labels | revolve + peel | peel-and-stick animation | roll, label, liner | liner reveal | S |
| 36 | Sheet / kiss-cut stickers | flat sheet | peel one sticker | sheet, die-cut sticker, backing | yes | S |
| 37 | Hang tags | flat + punch hole | none | tag, string, eyelet | back-side print | S |
| 38 | Wristbands / tape | lofted / revolve | none | 2 | — | S |

### F. Retail & display (research vertical 4)

| # | Product | 3D class | Fold | Explode parts | Inside view | Cx |
|---|---|---|---|---|---|---|
| 39 | Roll-up standee | frame + flat graphic | roll-up animation (graphic retracts into cassette) | base, pole, cassette, spring, graphic, top rail | exploded is genuinely impressive here | S |
| 40 | Canopy tent | frame + fabric shells | legs extend | canopy, 4 legs, valance, print panels | yes | M |
| 41 | POSM counter display | hinged + shelves | fold up from flat | 8 + shelves | yes | M |
| 42 | Brochure / card (offset) | 2D proof canvas + fold viz | bi/tri/Z-fold | — | inside spread proof | S |

### G. Protective & accessories

| # | Product | 3D class | Fold | Explode parts | Inside view | Cx |
|---|---|---|---|---|---|---|
| 43 | Bubble mailer | shell + bubble layer | flap opens | outer, bubble layer, flap | x-ray bubbles | S |
| 44 | Poly mailer | shell | flap + adhesive strip | 3 | yes | S |
| 45 | Air column roll | instanced pillows | deflate/inflate | 8 columns | yes | M |
| 46 | Honeycomb wrap | tessellated sheet | stretch morph | 2 | yes | S |
| 47 | Edge protector / corner | extruded profile | none | 2 | — | S |
| 48 | Tissue paper / custom tape / ribbon / silica | flat + revolve | — | 2–3 | — | S |

**Count: 48 SKUs across 7 families, every one of them with a real fold or explode behaviour.**
Realistic phase-1 build: families A, B, C (items 1–25) = the order-taking core.
Phase-2: D + E (flexible + labels). Phase-3: F + G (display, protective).

---

## 5. Inside-view & interaction spec (what the customer actually touches)

- **Three-state control** on every product: `Closed` · `Open` · `Exploded` — one segmented control, spring-animated.
- **Scrub** — a fold slider for cartons that lets them watch the box assemble itself. This sells quality.
- **Click-to-isolate** — tap any part in exploded view: it centres, the rest ghosts, a spec card appears
  (board grade, GSM, print coverage, finishing).
- **X-ray** — transparency toggle revealing wall thickness, flute, laminate stack, insert cavities.
- **Morph to blank** — from Open, "show flat sheet" flattens to the die-line, then back, same camera.
- **Dimension overlay** — arrows + labels with the customer's own numbers, toggled on.
- **Product ghost** — optional transparent object inside, sized by the customer, to prove it fits.
- **Share link** — every state serialised into the URL (`?s=mailer&l=240&w=180&h=90&gsm=300&fin=matte`),
  so a customer can send "this exact box" to their boss and it reopens identically.
- **Spec PDF** — exploded screenshot + dimensions + materials + die-line + approved artwork, one sheet.

---

## 6. What the research missed — the parts that make it a business

1. **Prepress is the product.** Colour accuracy, bleed, PDF/X, ink coverage, plate setup. The order form
   is easy; a machine-ready file is the moat.
2. **Gang-run nesting.** Low-MOQ only works economically if many small orders share a press sheet. That
   needs a sheet-imposition solver — the actual technical unlock behind "from 10 units".
3. **The manufacturer.** Either you own converting capacity or you integrate a partner's job queue.
   Without it, the configurator is a very nice brochure.
4. **Freight & DIM weight** — the reason collapsible rigid boxes matter. Pricing must include volumetric
   freight or quotes lose money on big-but-light cartons.
5. **Sample-first funnel.** A paid sample (₹300–600) converts far better than a 10-unit MOQ order form.
   Design the flow around "order a sample, then the run".
6. **Repeat/reorder.** Packaging is consumable. Reorder-from-artwork is the highest-LTV feature and takes
   one button.
7. **GST, e-way bill, credit terms** for MSME buyers — the boring items that decide whether B2B closes.
8. **Mobile-first on a phone in a warehouse** — dimension inputs, no heavy 3D on 3G. LOD + lazy geometry.

---

## 7. Honest constraints

| Constraint | Reality | Mitigation |
|---|---|---|
| Photorealism | procedural geometry ≠ photoshoot | consistent art direction + a few hero renders |
| iOS AR (USDZ) | needs converter, not native here | ship WebXR Android; iOS in phase 2 |
| SSR / SEO | this runtime serves a client-rendered SPA | JSON-LD + prerendered route shells + sitemap; true SSR needs a Node host — flag before promising rankings |
| Fold graphs | hand-authored per structure, not auto-parsed from any customer die-line | 25 structures authored in phase 1; SVG die-line compiler later |
| Physical accuracy | folds are geometric, not paper physics | authored bend limits + crease compensation; validate against real samples |
| 3D perf on phones | 48 SKUs × high-poly = death | instancing, LOD, texture atlas, geometry cache |

---

## 8. Suggested phases (no code yet)

| Phase | Scope | Outcome |
|---|---|---|
| 0 | Structure spec format, fold-graph notation, board library, brand tokens | the vocabulary the whole app uses |
| 1 | E1+E2+E3 on 6 structures (mailer, STE, rigid magnetic, telescopic, stand-up pouch, roll-up standee) | a demo that already beats Ezpac's 3D |
| 2 | Catalog + E5 pricing + cart + order → DB | it takes orders |
| 3 | E4 artwork upload + prepress checks + proof PDF | it takes *correct* orders |
| 4 | E6 production board + admin | it fulfils |
| 5 | All 48 SKUs, E7 schema + parameterised routes, AR, reorder | it scales |

## 9. Decisions needed before build

1. Brand name + one-line positioning.
2. Which 6 structures lead phase 1 (my default: the six in the table above).
3. Own manufacturing, partner, or marketplace-broker model.
4. Pricing basis: per-unit tiers only, or area-based instant calculator (recommended).
5. Currency/GST: INR + GST, single-country, or export too.
