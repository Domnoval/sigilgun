# SIGIL GUN — Studio 137

A playable symbol-painting instrument built from Michael's hand-drawn artwork.
294 symbols across 15 collections, five brushes, geometry fields, layers, PNG
and SVG export. The console shell keeps the drawing central and opens deeper
controls when you want them.

## Run

Serve this folder with a static HTTP server, including index.html, studio.js,
print-room.js, studio.css and assets. No build or runtime dependencies are required.
An HTTP origin supports local recovery and the isolated Print Room renderer.

The Node dependencies are only for development tests.

## Play

- Drag with a mouse, finger or pen to draw.
- **Brush** changes the touch, size, density and chaos.
- **Symbols** opens a visual, searchable cabinet. Select one mark or mix a collection.
- **Ink** changes future marks and the background without deleting existing work.
- **UV** switches between daylight and blacklight. Choose reactive pigments in Ink
  to paint marks that reveal their glow under UV. Standard pigments stay separate.
- **Structure** exposes artist systems, placement fields and repeatable seeds.
- **Layers** separates, hides, blends, reorders or clears parts of the composition.
  Each layer can optionally cast a shadow, with distance, softness and strength.
  Shadows default off and are included in project saves, PNG and SVG exports.
- **Burst** generates a composition with the current settings. Undo takes it back.
- **Project** saves/opens projects, resumes a browser session and starts a new canvas.
- **Export** downloads PNG, SVG or an editable project.
- **Print** opens a physical-size preview and full-resolution file download.

On phones, controls live in sheets and the drawing uses the width of the screen.
New phone documents start portrait (900 × 1200); larger screens start landscape
(1200 × 900). Document dimensions remain fixed across resizing and rotation.
Landscape, portrait and square options are also available in Project.

## Keeping your work

Undo and redo retain the last 30 actions in memory, including strokes, clearing,
layer edits, document changes and project loads. History does not survive a reload.
The latest document is saved locally after edits; a Resume action appears when a
previous session is available. Browser storage is best effort and may be full or
disabled. Download a project file for a durable copy or to move to another device.

Version 2 .sigil.json files retain dimensions, vector marks, per-mark colors and
effects, layer identities, settings and generator state. Version 1 projects remain
supported: their embedded raster artwork sits below any new vector marks.
The original version did not store vector marks, so those cannot be recovered
from an old save.

## Export

**PNG:** 1×, 2× or 4×, subject to an export-size limit. New vector marks are
rendered at the target resolution. Legacy raster artwork is preserved and scaled.
Field guides are editing aids and are excluded from exports.

**SVG:** visible layers in their current order, vector paths for new marks, and
embedded images for legacy raster layers. Blend modes and filters can render
slightly differently in different vector editors. PNG is the rendered reference.

## Keyboard

Ctrl/Command Z: Undo. Ctrl/Command Shift Z or Ctrl Y: Redo.
S: Save project. L: Open project. E: PNG. V: SVG. A: Burst. C: Clear (undoable).
Drawing shortcuts are disabled while typing in inputs, selects and editable text.
All dialogs support Escape and return focus to their opener.

## Brush feel

A translucent footprint follows the mouse or hovering pen, matching brush reach,
mark size and ink. A single selected symbol appears inside it. On touch screens the
preview appears during contact. Scatter and randomized rotation still vary each
actual mark; the footprint indicates approximate reach, not an exact next stamp.
Geometry fields show a placement indicator instead, since they choose their own
positions. The preview is an interface overlay and never enters artwork exports.

Stroke sampling follows distance traveled, rather than the number of pointer
events sent by a device. Slow and fast movement along the same path therefore
produce consistent spacing while preserving the selected scatter and Chaos.

## Blacklight inks

Ink offers five UV-reactive pigments and a switch for making a custom ink reactive.
Selecting a standard swatch returns to standard ink. Material is stored with each
mark, so changing ink never changes the material of marks already painted.
The UV button stays available above the canvas, including on phones; the Ink panel
also has a light switch for previewing pigment choices.

Daylight shows a quieter pigment. Under UV, reactive marks gain a bright core and
colored bloom against a darkened canvas. This is a digital blacklight simulation.
Ordinary marks do not acquire fluorescence just because they use the same color.
Switching the light preserves mark positions, layer order and random state.

Project files preserve both ink materials and the light setting. PNG and SVG
export the currently selected appearance; the Export panel says which one.
Switch off UV to export daylight. Physical fluorescent printing requires a
specialist ink and supplier; a standard print only reproduces the rendered look.

## Print room preview

Print captures the current composition and opens it in a separate rendering
workspace. Pick a paper size, daylight or UV appearance, and whole-artwork fit or
centered crop. These choices do not alter your drawing or its recovery copy.
The wall is an illustration; the image on the paper uses the actual output layout.

New vector artwork gets three suggested paper sizes. Imported raster artwork gets
up to three smaller choices based on a 150-PPI detail floor; if none meet it, the
smallest option remains available with a warning. Enlarging a bitmap does not add
detail. Rendered output is up to 300 PPI, bounded by 40 megapixels and 8,000 pixels
per edge. The file name and print plan state its dimensions and resolution.

Save print file downloads a PNG rendered by the same engine without guides, wall
or editor. Save print plan downloads the captured editable project plus paper,
lighting and fit choices. The plan is a handoff document, not a paid order. Use
Project → Open project to recover its editable art and chosen light. Reopening
Print starts a fresh paper/fit selection; the saved choices remain in the plan.

**Purchasing is not enabled.** Dedicated Shopify custom-print variants, pricing,
immutable file storage and verified paid-order fulfillment remain to connect.
See [the implementation contract](docs/PRINT-ROOM.md) and [TODO.md](TODO.md).
The optional beach-guide treatment is in [docs/FLAMINGO-GUIDE.md](docs/FLAMINGO-GUIDE.md).

## Development checks

Install test dependencies with npm ci, then npx playwright install chromium.
Run npm test. Tests start their own local server and run actual browser drawing,
project round-trips, exports, layers, undo/redo, recovery and responsive checks.

An existing Playwright installation/browser can be selected with the
SIGILGUN_PLAYWRIGHT and SIGILGUN_CHROMIUM environment variables.

See DESIGN.md for the shell's design rules and how to adapt it to another
instrument. The rendering engine exposes window.SigilStudio and a sigil:change
event. The shell lives in studio.js and studio.css.

## Artwork and fonts

All artwork © Studio 137. All rights reserved.
The backpack folder retains the source PNG/SVG set included in the symbol library.
Syne and IBM Plex Mono are bundled under the SIL Open Font License; license files
are in assets/fonts.
