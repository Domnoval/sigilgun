# Build queue — September 22, 2026

The Studio X37 master checklist records these as A015–A017 in
television-vercel/LAUNCH-PLAN.json. Print preparation is now implemented locally;
paid ordering, real reactive printing and the guide film are not enabled.

## A015 — Order this as a print

- [x] Print action beside Export; actual composition in a wall preview.
- [x] Freeze the composition on entry; isolated renderer preserves editor/history/
  recovery. Daylight/UV appearance, whole-artwork/centered-crop layout.
- [x] Three shape-appropriate sizes for vector art, fewer/smaller for limited raster
  detail. Full-size PNG with output limits and a portable editable print plan.
- [ ] Next: create a dedicated custom-sigil product and allowlisted paper variants
  in Shopify; obtain exact Printful variant mappings and current production costs.
  Do not reuse X004/X009/X328 painting variants.
- Price from actual production, packaging, shipping and payment costs plus the
  studio margin. Do not infer a percentage or promise a price yet.
- Connect the studio Shopify checkout to a verified fulfillment provider. Confirm
  paid orders server-side; prevent duplicate fulfillment, expose order status and
  handle failed jobs/refunds. Test before enabling customer orders.
- Standard printing reproduces the UV-looking image. Physically reactive ink is
  the separate A016 track below.
- Store immutable artwork/hash and job record server-side before checkout. Cart
  carries opaque design ID. Add verified Shopify paid webhook, durable job dedupe,
  Printful submission/status and operational failure/refund handling.
- Existing TV tools/studio-orders has useful HMAC/idempotency/state-machine code,
  but its loopback SQLite server is not a deployable fulfillment service. Its
  trusted local import route must not become a public paid-order webhook.
- No proof or supplier purchase is authorized. Purchasing UI remains off until the
  full payment/fulfillment route is validated. See docs/PRINT-ROOM.md.

## A016 — Actual blacklight-reactive printing

- Research suppliers of fluorescent or invisible reactive pigments. UV curing
  alone does not mean the finished print fluoresces under a blacklight.
- Record custom artwork support, substrates, dimensions, minimums, pricing,
  delivery, pigment/separation requirements and individual fulfillment capability.
- Research is authorized now. Supplier selection, sample orders and production
  integration remain later decisions. Do not place an order as part of research.
- Keep findings and direct source links in docs/UV-PRINT-SOURCING.md.

## A017 — “Here, let me help you”

- Optional guided entry for visitors unfamiliar with the television website.
- After the visitor clicks, the screen goes black and powers into a calm beach
  from their first-person perspective. A guide, possibly a flamingo, walks ahead,
  occasionally turns back and speaks directly to the viewer through the screen.
- Explain channels, artwork, instruments, commissions and the gift shop in the
  studio's welcoming, odd, conversational voice.
- Include captions, mute, pause, replay and an obvious exit back to the previous
  channel. Respect reduced motion and keep ordinary navigation immediately usable.
- Coordinate with the existing Wait, What? welcome and A014 sound-check work.
  The first treatment/script is now in docs/FLAMINGO-GUIDE.md. Next is a consistent
  character reference and one beach/turn-back shot, then the optional overlay.
  No footage generated or live welcome replaced in the print-room slice.
