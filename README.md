# SIGIL GUN — Studio 137

A playable symbol-painting instrument built from Michael's hand-drawn artwork.
294 symbols across 15 collections, five brushes, geometry fields, layers, PNG
and SVG export. The console shell keeps the drawing central and opens deeper
controls when you want them.

## Run

Open index.html in a modern browser with the adjacent studio.js, studio.css and
assets folder in place. No build or runtime dependencies are required. For a
consistent local recovery origin, serve this folder with a static HTTP server.

The Node dependencies are only for development tests.

## Play

- Drag with a mouse, finger or pen to draw.
- **Brush** changes the touch, size, density and chaos.
- **Symbols** opens a visual, searchable cabinet. Select one mark or mix a collection.
- **Ink** changes future marks and the background without deleting existing work.
- **Structure** exposes artist systems, placement fields and repeatable seeds.
- **Layers** separates, hides, blends, reorders or clears parts of the composition.
- **Burst** generates a composition with the current settings. Undo takes it back.
- **Project** saves/opens projects, resumes a browser session and starts a new canvas.
- **Export** downloads PNG, SVG or an editable project.

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
