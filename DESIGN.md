# The first Studio 137 instrument shell

The first ten seconds should be playable. The drawing is the main event; a visitor
should not have to understand the engine to enjoy it.

## Direction

Michael asked for a simple, tactile, game-console wrapper. This takes the readable
controls and invitation to play from a handheld console, using Studio X37's own
colors and hand-drawn symbol library.

The brand palette is bone #E8DFCE, void #0A0907, panel #14110C, copper #36B9A2,
magenta #FF2E7E, phosphor #63D98F, and signal #DF7A1F. Syne carries the interface;
IBM Plex Mono is reserved for small document/status information.
Fonts are bundled locally with their licenses.

The newer console direction deliberately uses softer corners and physical
controls than the broader brand's industrial panels. Shading and pointer response
give controls depth. The artwork itself is never tilted, graded or filtered.
The drawing remains Canvas 2D; the shell does not add a WebGL dependency.

## Anatomy

- **Header:** instrument name, Project, Export.
- **Stage:** a stable document fitted inside a responsive console.
- **Quick actions:** Undo, Redo, Burst, Help. Compact controls sit below the stage
  on phones, and the side grips disappear.
- **Tool dock:** Brush, Symbols, Ink, Structure, Layers.
- **Drawers:** only the chosen tool's controls are visible. Keyboard focus stays
  inside the open dialog and returns to its trigger when closed.
- **Recovery:** a previous browser session can be resumed; project downloads are
  the durable, portable copy.

Fresh phone documents are portrait, fresh larger-screen documents landscape.
Rotating or resizing never changes the document. Project offers landscape,
portrait and square documents, with Undo available after starting a new canvas.

## Reuse without cloning every control

studio.css owns the visual shell, focus states and responsive layout.
studio.js adapts this particular instrument's controls to it. The drawing engine
exposes window.SigilStudio and emits sigil:change.

For the next instrument, reuse the header/stage/dock/dialog pattern and visual
tokens. Write a small adapter around that instrument's capabilities. Preserve its
identity and expose only its essential actions; don't give every instrument a
brush or a layer panel just for consistency.

Do not couple the engine to navigation, TV-channel playback, or a framework.
This pass does not add the instrument to the live television website.

## Next useful additions

1. Curated starting recipes with honest previews, made from Michael's marks.
2. A small export gallery showing what this instrument can actually make.
3. Pan/zoom for detailed work, with a conspicuous fit-to-page reset.
4. A pen-pressure option if testing on actual stylus hardware supports it.

These are future work, not controls that pretend to work in this version.
