# Creator print room — first working slice

September 22, 2026. Michael said to start building the future. Start with the
creator print path; keep the optional flamingo welcome as the next separate slice.

## What this slice does

Print, beside Export, opens a room with the visitor's actual composition on a wall.
Capture the project on entry. An isolated renderer uses the same painting engine;
changing print lighting or fit never changes the drawing, history, or recovery.
Offer three proportion-appropriate paper sizes, whole-artwork fit by default,
optional centered crop, and daylight/UV appearance. Preview the exact paper layout.
Download the resulting PNG at a stated resolution and a portable print plan.

The initial paper families are 12×16 / 18×24 / 30×40, 12×18 / 20×30 / 24×36,
8×10 / 16×20 / 20×24, and 12×12 / 18×18 / 24×24. The last 4:5-family size
has a slightly different ratio, shown explicitly as margins or centered crop.
Orient paper to match the drawing; select the closest
supported family. All nonmatching ratios default to fit with visible white margins.
Source: [Printful Enhanced Matte Paper Poster](https://www.printful.com/custom/wall-art/posters/enhanced-matte-paper-poster-in),
checked September 22. Sizes are planning choices, not merchant variants or quotes.

Vector marks render afresh. Raster imports retain their real resolution; report
effective pixels per inch instead of claiming enlargement creates detail. Bound
output to 40 megapixels and 8,000 pixels per edge for browser memory. Render at up
to 300 pixels per inch. Output dimensions, not PNG metadata, define intended size.
Ordinary paper only reproduces the UV *appearance*. Reactive ink is A016.

## Commerce boundary

Do not display invented prices, repurpose a painting's Shopify variant, send an
order to a supplier, or label a download a purchase. This release is a working
print preparation preview. Checkout stays unavailable until a separate custom
print product, real costs, durable file storage and paid-order routing exist.

Next implementation: immutable artwork upload + digest; allowlisted paper SKU;
Shopify cart line carrying opaque print-job ID; verified paid webhook; durable
idempotent job; Printful recipient/file mapping; status/tracking and failure/refund
handling. Orders must use stored artwork and server-side catalog/price facts,
never arbitrary client prices, supplier IDs or file URLs. Verify the whole path
before enabling purchase. A proof purchase remains unauthorized.

## Acceptance

- Entry captures the composition; later edits and renderer recovery never alter it.
- Same fit math drives preview and output; crop visibly loses edges, fit does not.
- Standard and UV previews are independently rendered, not CSS color filters.
- Raster warnings use decoded source dimensions; low quality is not called sharp.
- Desktop, narrow phone and Fold layouts work; dialog exits, restores focus, and
  respects reduced motion. Render failure leaves the drawing and retry available.
- Download output contains no editor guides, shell, wall, frame or cursor.
- Automated tests cover snapshot preservation, dimensions/fit, preview/output
  parity, recovery isolation, resource limits and responsive controls.
