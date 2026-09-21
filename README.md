# SIGIL GUN — Studio 137

A single-file symbol-spraying canvas. Stamp 291 hand-drawn symbols with a brush,
spin the lenses, walk sacred-geometry fields, paint on layers, and export the
composite as high-res PNG or true vector SVG. Runs entirely client-side — just
open `index.html` in a browser.

## Quick start

Open `index.html` in any modern browser (Chrome / Firefox / Safari). No build,
no server, no dependencies.

## Controls

| Control | What it does |
|---|---|
| **Brushes** | Spray can · wet paint · calligraphy pen · fat marker · fine tip |
| **CHAOS** | 0 = strict no-overlap discipline … 100 = anarchy (overlap, wild rotation, ink variance) |
| **SYMBOL SCALE / CLEARANCE / BRUSH RADIUS / DENSITY / OPACITY** | Core sliders |
| **LENS** | Artist systems — HARING · HIRST · KUSAMA · LEWITT · GIRIH · BASQUIAT |
| **FIELD** | Placement geometry — GOLDEN SPIRAL · MANDALA · DUERER 4×4 · DOMNOVAL · HEX · PERSPECTIVE · ISOMETRIC · RITUAL |
| **INK TEXTURE** | Flat · drip · gloss · neon · chalk |
| **ACCENT / DUOTONE** | Second-ink accents and inner-core color echo |
| **LAYERS** | Add / reorder / hide / opacity / blend (source-over · multiply · screen) |
| **ATLAS NUMBERS** | Prints each symbol's library index beside it |
| **SOURCE SET** | Spray just one set: backpack, pink, concrete, mural, tile, alpha… 15 sets |

### Hotkeys

- `C` clear · `E` high-res PNG · `V` SVG export · `A` atlas toggle · `S` save project · `L` load project

## Export

- **HIGH-RES PNG** — re-renders the composition at 1×/2×/4× scale from the recorded vector stamps (not an upscale), so exports stay crisp.
- **SVG VECTOR** — serializes the full composite as real SVG paths: backdrop, per-layer groups with blend modes, neon/gloss gradients, drip paths, motion rays, atlas index text. Open in Illustrator / Inkscape / Cricut.
- **SAVE PROJECT** — writes a `.sigil.json` containing the entire rig (seed, sliders, lens, field, textures, layers with pixels, anchors). **LOAD PROJECT** restores it.

## Symbol library

291 symbols across 14 hand-drawn sets built from original artwork, all embedded
in `index.html` — no external files needed.

The `backpack/` folder holds the 16-symbol backpack set (PNG + SVG each) that
was folded into the library.

## License

All artwork © Studio 137. All rights reserved.