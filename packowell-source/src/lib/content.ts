export interface Service {
  slug: 'printing' | 'branding' | 'displays'
  name: string
  eyebrow: string
  headline: string
  intro: string
  items: { name: string; detail: string; quoteOnly?: boolean }[]
  process: { step: string; detail: string }[]
  specNotes: string[]
  faqs: { q: string; a: string }[]
}

export const SERVICES: Service[] = [
  {
    slug: 'printing',
    name: 'Commercial printing',
    eyebrow: 'Printing',
    headline: 'Offset and digital print, specified properly the first time',
    intro:
      'Commercial print fails in the details: the wrong board weight for a fold, a 300 DPI logo scaled to A2, a brochure that will not close after folding. We spec the stock, the imposition and the finishing before a plate is made.',
    items: [
      { name: 'Business cards', detail: '300–450 GSM, single or duplex, spot UV and foil on request.' },
      { name: 'Flyers & leaflets', detail: 'A4/A5/A6, 130–170 GSM art paper or 90 GSM maplitho.' },
      { name: 'Brochures & folded leaflets', detail: 'Bi-fold, tri-fold and Z-fold; the fold dictates the panel widths, not the other way round.' },
      { name: 'Catalogues & booklets', detail: 'Saddle-stitched or perfect-bound, quoted per page count and run.' },
      { name: 'Letterheads & envelopes', detail: 'Corporate stationery on 100 GSM bond, run-matched across items.' },
      { name: 'Presentation folders', detail: 'Die-cut pockets, laminated, with business-card slits.' },
      { name: 'Posters', detail: 'A3 to A0 offset, or large-format where the run is short.' },
      { name: 'Certificates, invitations, calendars', detail: 'Quoted per job — stock and finishing vary too much for a fixed list.' },
    ],
    process: [
      { step: 'Specification', detail: 'Stock, size, colours, finishing and quantity locked into one sheet.' },
      { step: 'Prepress', detail: 'Bleed, resolution and colour checked against the final size, not against a thumbnail.' },
      { step: 'Proof', detail: 'A soft proof for layout, and a hard proof where colour is critical.' },
      { step: 'Print & finish', detail: 'Imposition, print, then lamination, folding, stitching or die-cutting.' },
    ],
    specNotes: [
      'Fold panels are not equal: the panel that folds inward is 2–3 mm narrower so the piece closes flat.',
      'Image resolution has to be judged at final print size — a 300 DPI image placed at 200% is a 150 DPI image.',
      'Rich black and 4-colour black are different things; text should never be built in 4 colours.',
    ],
    faqs: [
      { q: 'Can I print a short run?', a: 'Yes — short runs go digital. Above a few hundred pieces offset usually works out cheaper per unit, and we will say so rather than let you overpay.' },
      { q: 'Do you match Pantone?', a: 'Spot colour is quoted per job. On uncoated stock an exact match is not physically guaranteed and we will tell you which colours are at risk before printing.' },
    ],
  },
  {
    slug: 'branding',
    name: 'Branding & design',
    eyebrow: 'Branding & design',
    headline: 'Identity, packaging artwork and prepress — built for production',
    intro:
      'Most design files arrive unbuildable: artwork that ignores the die-line, logos in raster, fonts not outlined. We design for the substrate and the process, so the approved proof is also the production file.',
    items: [
      { name: 'Logo design', detail: 'Primary mark, responsive variants, and the mono version that actually gets used.' },
      { name: 'Brand identity', detail: 'Palette, type system, tone and layout rules.' },
      { name: 'Brand guidelines', detail: 'A short, usable document — not a 90-page PDF nobody opens.' },
      { name: 'Packaging & label design', detail: 'Designed directly on the dieline, with panel-safe artwork.' },
      { name: 'Dieline adaptation', detail: 'Existing artwork mapped to a new structure without breaking panels.' },
      { name: 'Product mockups', detail: 'Rendered from the real structure, not a flat photo composite.' },
      { name: 'Catalogue & collateral', detail: 'Grid, hierarchy and print-ready export.' },
      { name: 'Prepress support', detail: 'Bleed, trapping, overprint, image resolution, font and layer cleanup.' },
    ],
    process: [
      { step: 'Brief', detail: 'Product, shelf context, competitor set and the constraint that matters most.' },
      { step: 'Structure first', detail: 'We agree the box before the artwork — artwork on an unconfirmed dieline is rework.' },
      { step: 'Design & proof', detail: 'Design on the actual panel layout, then a rendered and printed proof.' },
      { step: 'Handover', detail: 'Print-ready files plus the editable source, with fonts and images linked.' },
    ],
    specNotes: [
      'Packaging artwork needs bleed and a safe zone; the safe zone is dictated by the die-line, not by taste.',
      'A logo that only works in positive on white will fail on kraft board — the mono version is designed first.',
      'Text under about 6 pt on coated stock fills in at press. It is a print limit, not a design preference.',
    ],
    faqs: [
      { q: 'Do you design if the printing goes elsewhere?', a: 'Yes. We hand over print-ready files with the dieline and specification attached.' },
      { q: 'Who owns the artwork?', a: 'Ownership transfers on final payment, in writing, in the engagement letter. Until then it is a licence to use for the agreed purpose.' },
    ],
  },
  {
    slug: 'displays',
    name: 'Displays & standees',
    eyebrow: 'Displays & standees',
    headline: 'Retail displays that are engineered, not just printed',
    intro:
      'A display is a structure under load: it has to stand up, hold product, survive a shop floor and ship flat enough to be affordable. Substrate and joint choice matter more than the graphic.',
    items: [
      { name: 'Life-size standees & cutouts', detail: 'Foam board or corrugated, contour cut, with an easel back.', quoteOnly: true },
      { name: 'Roll-up standees', detail: 'Aluminium base, spring cassette, anti-curl media.' },
      { name: 'Counter-top POSM', detail: 'Folds up from a flat blank; shelf loads checked before print.' },
      { name: 'Floor-standing displays', detail: 'Corrugated or metal frame, engineered for the load.', quoteOnly: true },
      { name: 'Shelf talkers & strips', detail: 'Small format, usually printed on board or vinyl.' },
      { name: 'Canopy tents & flags', detail: 'Dye-sublimated fabric on a pop-up frame.' },
      { name: 'Backdrops & wall graphics', detail: 'Tension fabric or self-adhesive vinyl, site-measured.', quoteOnly: true },
      { name: 'Custom 3D promotional units', detail: 'Designed and prototyped per project.', quoteOnly: true },
    ],
    process: [
      { step: 'Site and load', detail: 'Where it stands, what it carries, and who assembles it.' },
      { step: 'Structure', detail: 'Substrate, joints and pack-down volume decided together.' },
      { step: 'Prototype', detail: 'A white sample for fit and load before artwork is committed.' },
      { step: 'Print & assemble', detail: 'Print, cut, assemble, and pack for transport without damage.' },
    ],
    specNotes: [
      'Load-bearing displays need an engineering review — we will route it for qualified review rather than estimate a safe load.',
      'Corrugated displays are usually shipped flat and assembled on site; the assembly time is a real cost, not a detail.',
      'Outdoor fabric work needs wind rating and fire certification confirmed before the job is quoted.',
    ],
    faqs: [
      { q: 'Can you match a retail chain compliance sheet?', a: 'Yes — send it first. Retailer specs (height, footprint, fire rating) override design preference.' },
      { q: 'Do you handle character standees?', a: 'Only with written confirmation that the customer holds the likeness rights.' },
    ],
  },
]

export interface Industry {
  slug: string
  name: string
  short: string
  intro: string
  pains: string[]
  makes: string[]
  specNotes: string[]
  products: string[]
}

export const INDUSTRIES: Industry[] = [
  {
    slug: 'food-beverage',
    name: 'Food & beverage',
    short: 'Barrier formats, food-contact clarity and shelf-ready packs.',
    intro:
      'Food packaging is the least forgiving category: the wrong laminate shortens shelf life, and an unverified food-contact claim is a legal problem, not a marketing one.',
    pains: ['Shelf life set by the barrier film, not by the design', 'Small batches versus huge gravure minimums', 'Retailer shelf-ready requirements'],
    makes: ['Stand-up and flat-bottom pouches', 'Coffee bags with valves', 'Folding cartons with windows', 'Labels and shrink sleeves'],
    specNotes: [
      'Barrier performance (WVTR/OTR) comes from the laminate datasheet — we will not publish a shelf-life claim without it.',
      'Food-contact suitability must be confirmed per substrate and per use (fatty, acidic, hot-fill) with the supplier.',
      'Fill weight decides gusset depth, not the other way round.',
    ],
    products: ['stand-up-pouch', 'coffee-bag-valve', 'window-pastry-box', 'roll-labels'],
  },
  {
    slug: 'cosmetics-skincare',
    name: 'Cosmetics & skincare',
    short: 'Rigid formats, soft-touch finishes and label precision on curved surfaces.',
    intro:
      'In beauty, the pack is most of the perceived value — and the two things that ruin it are scuffed soft-touch lamination and labels that lift on a curved bottle.',
    pains: ['Curved-surface label lift and wrinkle', 'Foil and soft-touch wear during transit', 'Small batches with premium expectations'],
    makes: ['Collapsible magnetic rigid boxes', 'Telescopic gift boxes', 'Labels on PP or clear stock', 'Cartons with foil and emboss'],
    specNotes: [
      'Soft-touch lamination scuffs visibly; it needs an outer carton or a slip sheet in transit.',
      'On small-diameter bottles, a thinner PP label conforms better than paper — specify by container radius.',
      'Foil on uncoated board sits differently than on coated board; proof on the actual stock.',
    ],
    products: ['rigid-magnetic-box', 'ste-carton', 'roll-labels', 'telescopic-two-piece'],
  },
  {
    slug: 'apparel-fashion',
    name: 'Apparel & fashion',
    short: 'Mailers, tissue and tags that survive a courier and photograph well.',
    intro:
      'Apparel packaging is judged in the unboxing photo. It also has to survive a courier network without corner crush, which is a corrugated decision before it is a design decision.',
    pains: ['Corner crush in transit', 'Returns needing a re-sealable pack', 'Brand consistency across SKUs'],
    makes: ['Roll-end tuck mailers', 'Book-wrap mailers', 'Hang tags and tissue', 'Poly mailers for soft goods'],
    specNotes: [
      'E-flute prints far better than B-flute; B-flute survives drops better. Choose by which failure costs more.',
      'A mailer that is 5 mm too deep costs freight on every order — internal size should be measured with the product packed.',
      'Tissue weight below 17 GSM tears on fold; it is not a place to save money.',
    ],
    products: ['roll-end-mailer', 'book-wrap-mailer', 'hang-tags', 'tissue-tape-ribbon'],
  },
  {
    slug: 'textile-home',
    name: 'Textile & home furnishing',
    short: 'Sample cards, swatch folders and presentation kits.',
    intro:
      'Textile buyers judge in person, with a swatch in hand. The packaging has to present the material honestly and survive being opened a hundred times.',
    pains: ['Swatch attachment failing after handling', 'Large flat kits that ship poorly', 'Colour accuracy across dye lots'],
    makes: ['Fabric sample cards', 'Swatch folders', 'Presentation rigid boxes', 'Printed headers and belly bands'],
    specNotes: [
      'Swatches glued with the wrong adhesive bleed through on light fabrics — specify a neutral, fabric-safe adhesive.',
      'Folder spines need to be scored for the real filled thickness, not the empty board thickness.',
      'Dye-lot variation means the printed colour reference should be a physical swatch, not a CMYK value.',
    ],
    products: ['rigid-lift-off', 'hang-tags', 'wrap-sleeve', 'literature-mailer'],
  },
  {
    slug: 'ecommerce-d2c',
    name: 'E-commerce & D2C',
    short: 'Low minimums, fast turnaround, damage-proof dispatch.',
    intro:
      'D2C brands need packaging in the hundreds, not the tens of thousands — and they need it to arrive intact. Low-MOQ economics come from sharing press sheets, so format standardisation matters.',
    pains: ['Minimum order quantities that exceed demand', 'Damage claims from single-wall shippers', 'Reordering mid-season'],
    makes: ['Roll-end mailers', 'Die-cut mailers with inserts', 'Poly and bubble mailers', 'Stickers and tissue'],
    specNotes: [
      'A 3-ply B-flute mailer is fine to about 5 kg; above that move to 5-ply or reduce the span.',
      'Insert cavities should be cut to the physical product — centimetre dimensions are not enough.',
      'Standardising on two box sizes usually beats optimising each SKU.',
    ],
    products: ['roll-end-mailer', 'die-cut-mailer-insert', 'sheet-stickers', 'poly-mailer'],
  },
  {
    slug: 'electronics-accessories',
    name: 'Electronics & accessories',
    short: 'Insert engineering, ESD awareness and retail-ready presentation.',
    intro:
      'Electronics packaging is protection engineering. The graphic is the last thing to design, because the insert determines whether the product arrives working.',
    pains: ['Drop damage to connectors and screens', 'Insert tooling cost at low volume', 'Retail and e-commerce packs diverging'],
    makes: ['Rigid boxes with foam inserts', 'Die-cut mailers with pulp inserts', 'Cartons with window patches', 'Labels and seals'],
    specNotes: [
      'Static-sensitive parts need ESD-safe foam — standard EVA can carry a charge.',
      'Drop testing is the only proof of protection; we will ask for the test, not assume it.',
      'Foam cavity clearance of about 0.5 mm per side usually holds without rattling.',
    ],
    products: ['rigid-foam-insert', 'die-cut-mailer-insert', 'window-patch-carton', 'roll-labels'],
  },
  {
    slug: 'retail-fmcg',
    name: 'Retail & FMCG',
    short: 'Shelf-ready trays, POSM and display compliance.',
    intro:
      'Retail is a compliance environment. Height, footprint, fire rating and shelf-ready requirements are set by the retailer before any design starts.',
    pains: ['Retailer compliance sheets', 'Display damage in store', 'Version control across regions'],
    makes: ['Shelf-ready trays', 'Counter-top POSM', 'Shelf talkers', 'Cartons at volume'],
    specNotes: [
      'Shelf-ready trays must be tested with the real product load, not an estimate.',
      'Floor displays need an engineering review for load and stability.',
      'Regional artwork variants need a versioning convention before the first print run, not after.',
    ],
    products: ['shelf-ready-tray', 'posm-counter', 'floor-display', 'ste-carton'],
  },
  {
    slug: 'corporate-gifting',
    name: 'Corporate gifting',
    short: 'Rigid presentation boxes, inserts and personalisation.',
    intro:
      'Gifting runs are small, dated and unforgiving: the box has to arrive before the event, and every unit is seen by someone senior.',
    pains: ['Fixed event dates', 'Small runs with premium finish', 'Personalisation per unit'],
    makes: ['Telescopic boxes', 'Magnetic rigid boxes with inserts', 'Sleeves and belly bands', 'Printed cards'],
    specNotes: [
      'Foil and emboss add tooling and lead time — book them before the event date, not after design approval.',
      'Per-unit personalisation means variable data printing; it changes the whole production route.',
      'Pre-assembled rigid boxes ship with large empty volume; factor freight into the landed cost.',
    ],
    products: ['telescopic-two-piece', 'rigid-magnetic-box', 'rigid-foam-insert', 'wrap-sleeve'],
  },
  {
    slug: 'events-exhibitions',
    name: 'Events & exhibitions',
    short: 'Roll-ups, backdrops and standees that travel without damage.',
    intro:
      'Event hardware is judged on the third use, not the first. Cheap cassettes curl, and fabric backdrops that do not tension look tired immediately.',
    pains: ['Re-use and transport damage', 'Setup time on site', 'Late artwork changes'],
    makes: ['Roll-up standees', 'Canopy tents', 'Fabric backdrops', 'Life-size cutouts'],
    specNotes: [
      'Anti-curl PET blockout is worth the extra cost for graphics that will be rolled repeatedly.',
      'Fabric backdrops need the frame specification before artwork is sized.',
      'Late artwork changes are usually a same-week digital job, not an offset job.',
    ],
    products: ['roll-up-standee', 'canopy-tent', 'fabric-backdrop', 'life-size-standee'],
  },
  {
    slug: 'agencies',
    name: 'Advertising & marketing agencies',
    short: 'White-label production with reliable specs and deadlines.',
    intro:
      'Agencies need a production partner who will flag an unbuildable file before the client approves it, and who can repeat a job months later without drift.',
    pains: ['Client-approved files that cannot be printed', 'Repeat jobs drifting in colour', 'Multiple SKUs, one deadline'],
    makes: ['Packaging of every family', 'Display and POSM', 'Commercial print', 'Dieline adaptation'],
    specNotes: [
      'We check bleed, resolution and colour build against the die-line before quoting, not after.',
      'Repeat jobs are printed to the retained approved proof, not to the client PDF.',
      'White-label supply is available — the agency stays the client-facing brand.',
    ],
    products: ['ste-carton', 'roll-up-standee', 'roll-labels', 'rigid-magnetic-box'],
  },
  {
    slug: 'manufacturers-exporters',
    name: 'Manufacturers & exporters',
    short: 'Transit packaging, export marking and load-tested cartons.',
    intro:
      'Export packaging is a specification exercise: board grade, stacking strength, humidity and marking requirements all come from the shipment, not from preference.',
    pains: ['Transit damage over long routes', 'Humidity weakening corrugated', 'Export marking and documentation'],
    makes: ['RSC shippers', 'Edge and corner protection', 'Air-column cushioning', 'Pallet-ready cartons'],
    specNotes: [
      'Corrugated loses a large part of its strength at high humidity — long sea routes need a higher grade.',
      'Stacking strength is a function of board grade and box dimensions; it needs a calculation, not a guess.',
      'Export marking requirements vary by destination and should be confirmed per shipment.',
    ],
    products: ['rsc-shipper', 'edge-protector', 'air-column', 'honeycomb-wrap'],
  },
  {
    slug: 'startups',
    name: 'Startups & emerging brands',
    short: 'First packaging run, without committing to thousands of units.',
    intro:
      'The first run is usually wrong in some way, and the goal is to make that cheap. Standard structures, small quantities and honest material advice beat a bespoke box you cannot afford to reprint.',
    pains: ['MOQs above real demand', 'Cash tied up in packaging stock', 'Rebranding after the first run'],
    makes: ['Mailers and cartons at low quantity', 'Stickers and labels', 'Printed tape and tissue', 'Simple rigid formats'],
    specNotes: [
      'Printing stickers and applying them to a plain box is the cheapest route to a branded first run.',
      'Standard structures have no tooling cost; bespoke die shapes do.',
      'Plan the second SKU before the first run — format consistency saves money later.',
    ],
    products: ['roll-end-mailer', 'sheet-stickers', 'ste-carton', 'tissue-tape-ribbon'],
  },
]

export interface Resource {
  slug: string
  title: string
  category: string
  readMinutes: number
  summary: string
  sections: { heading: string; body: string }[]
}

export const RESOURCES: Resource[] = [
  {
    slug: 'board-grades-and-gsm',
    title: 'Board grades, GSM and flute: what actually changes',
    category: 'Materials',
    readMinutes: 6,
    summary:
      'GSM tells you weight, not strength. Flute profile and ply decide how a box performs in transit, and print quality depends on the liner, not the flute.',
    sections: [
      {
        heading: 'GSM is a weight, not a performance rating',
        body: 'Grams per square metre measures the paper or board weight per unit area. Two boards at the same GSM can behave completely differently depending on fibre, coating and construction. For folding cartons, GSM is a reasonable proxy for stiffness. For corrugated, it is not — the flute profile carries the strength.',
      },
      {
        heading: 'Flute profiles',
        body: 'B-flute is roughly 3 mm and is the workhorse for mailers and shippers: good crush resistance, coarse print surface. E-flute is roughly 1.5 mm, prints far better and is the right choice for retail-facing corrugated. BC double-wall at roughly 6 mm is for heavy or stacked loads. The trade-off is always print quality versus protection versus freight volume.',
      },
      {
        heading: 'What we ask before recommending a grade',
        body: 'What is inside, how heavy, how far it travels, how it is stacked, and whether it is retail-facing. Without those five answers a board recommendation is a guess, and guessing wrong shows up as damage claims.',
      },
    ],
  },
  {
    slug: 'artwork-file-preparation',
    title: 'Artwork files that print first time',
    category: 'Prepress',
    readMinutes: 7,
    summary:
      'Bleed, safe area, resolution at final size, font handling and colour build. The five things that cause most reprints, and the checks that catch them.',
    sections: [
      {
        heading: 'Bleed and safe area are not the same margin',
        body: 'Bleed is the extra image beyond the trim line so a cutting tolerance does not leave a white edge — usually 3 mm. Safe area is the space inside the trim where text must stay so it is not clipped by the die or lost in a fold. On packaging, the safe area follows the die-line and the fold, so it is never a uniform margin.',
      },
      {
        heading: 'Resolution is only meaningful at final size',
        body: 'A 300 DPI image used at 200% of its natural size is effectively 150 DPI. Preflight has to compare pixel dimensions with placed dimensions, which is why a thumbnail always looks fine and a printed sheet does not.',
      },
      {
        heading: 'Fonts, blacks and overprint',
        body: 'Outline or embed fonts; do not rely on the supplier having the family. Keep body text in a single black rather than a four-colour build, which registration error turns fuzzy. Check overprint settings on dark overlays, where a missing overprint produces a white hairline.',
      },
      {
        heading: 'Die-lines are not decoration',
        body: 'The dieline layer must be a separate spot colour and registered exactly to the trim. Artwork built without the actual dieline is rework even when it looks correct on screen.',
      },
    ],
  },
  {
    slug: 'rigid-vs-folding',
    title: 'Rigid or folding carton: how to choose',
    category: 'Structures',
    readMinutes: 5,
    summary:
      'Rigid boxes cost more, ship with more air and feel far more expensive. The decision is usually about freight and storage, not about print.',
    sections: [
      {
        heading: 'What a rigid box actually is',
        body: 'Greyboard — typically 1200 to 2000 GSM — wrapped in printed art paper. Because the print is on a separate wrap, there are no fold lines through the artwork, which is what gives the format its flat, premium surface.',
      },
      {
        heading: 'The hidden cost is air',
        body: 'A pre-assembled rigid box is mostly empty volume. Freight is charged on volumetric weight, and storage costs money per cubic metre. Collapsible rigid construction — V-grooved walls, wrapped hinges, magnets — removes most of that, at the cost of more hand assembly.',
      },
      {
        heading: 'When folding wins',
        body: 'Anything that ships glued and flat, at volume, where the pack is discarded after opening. A well-printed 350 GSM carton with a soft-touch laminate reads as premium on shelf and costs a fraction of a rigid.',
      },
    ],
  },
  {
    slug: 'low-moq-economics',
    title: 'Why low minimums are hard, and how they are made possible',
    category: 'Manufacturing',
    readMinutes: 6,
    summary:
      'Setup costs are fixed: plates, dies, cylinders, make-ready. Low MOQ does not remove them, it amortises them across shared press sheets.',
    sections: [
      {
        heading: 'The fixed costs',
        body: 'A cutting die, a set of offset plates and a gravure cylinder all cost the same whether you print 100 or 100,000. On flexible packaging, cylinder cost per colour is the reason traditional pouches start at five figures.',
      },
      {
        heading: 'Gang runs',
        body: 'The way around it is to share a sheet: many small jobs imposed together, later cut apart. Digital presses remove the plate cost entirely but have a higher click cost per sheet, which is why digital wins below a threshold and offset wins above it.',
      },
      {
        heading: 'What this means for your first order',
        body: 'Standard structures with no bespoke die are dramatically cheaper at low quantity than custom shapes. If the first run is a test, standardise the structure and put the brand on a sticker or a printed sleeve.',
      },
    ],
  },
  {
    slug: 'packaging-for-transit',
    title: 'Designing for transit instead of for the photo',
    category: 'Protection',
    readMinutes: 5,
    summary:
      'Corner crush, void fill and stacking strength decide whether the unboxing happens at all. A test beats an opinion.',
    sections: [
      {
        heading: 'The three failure modes',
        body: 'Corner crush from drops and handling; abrasion from movement inside the box; and compression from stacking in a warehouse. Each one is fixed by a different decision — corner protection, insert fit and board grade respectively.',
      },
      {
        heading: 'Fit beats padding',
        body: 'A product that cannot move needs very little void fill. A product rattling inside a well-padded box still scuffs. Cut the insert to the product and the packaging gets cheaper as well as better.',
      },
      {
        heading: 'Test it',
        body: 'A drop test from the height your courier actually handles is the only real proof. Simulation and opinion are not substitutes, and we will say so.',
      },
    ],
  },
]

export const FAQS = [
  {
    q: 'Can I order packaging online right now?',
    a: 'Not yet. The 3D studio, specification and quote request are live; ordering and payment are deliberately switched off until rates, artwork approval and delivery terms are confirmed. Anything you configure can be sent as a full specification for quotation.',
  },
  {
    q: 'What is the minimum order quantity?',
    a: 'It depends on the structure and the process, and we do not publish a number we have not confirmed with production. The quote response states the MOQ for your specific configuration.',
  },
  {
    q: 'Is the 3D model accurate enough to approve a box from?',
    a: 'The geometry is generated from the structural specification, so dimensions, panel layout and the dieline agree with each other. It does not model board crush, crease cracking or magnet pull. Physical samples remain the approval step.',
  },
  {
    q: 'Do you manufacture in-house?',
    a: 'Manufacturing is currently delivered through qualified production partners. We do not claim in-house presses until that is confirmed and stated on this site.',
  },
  {
    q: 'Can I get a sample before ordering?',
    a: 'Yes — a sample request routes to the same quote workflow with the sample quantity and your specification attached. Sample charges, if any, are confirmed in the quote.',
  },
  {
    q: 'How is artwork handled?',
    a: 'Artwork is collected with the job, checked against the die-line and the final print size, and approved as a proof before production. A 3D preview is not an approval proof.',
  },
  {
    q: 'Do you export?',
    a: 'Export enquiries are accepted and collected with destination, currency and delivery requirements. We do not promise international fulfilment until logistics and duties are confirmed for the specific job.',
  },
]
