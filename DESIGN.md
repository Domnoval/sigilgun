# The first Studio 137 instrument shell

The first ten seconds should be playable. The drawing is the main event; a visitor
should not have to understand the engine to enjoy it.

## Direction

Michael asked for a simple, tactile, game-console wrapper. This takes the readable
controls and invitation to play from a handheld console, using Studio X37's own
colors and hand-drawn symbol library. The shell has no side handles or grips at
any viewport; the artwork gets the available stage width.

The brand palette is bone #E8DFCE, void #0A0907, panel #14110C, copper #36B9A2,
magenta #FF2E7E, phosphor #63D98F, and signal #DF7A1F. Syne carries the interface;
IBM Plex Mono is reserved for small document/status information.
Fonts are bundled locally with their licenses.

The newer console direction deliberately uses softer corners and physical
controls than the broader brand's industrial panels. Shading and pointer response
give controls depth. The shell never tilts, grades or filters the artwork.
The drawing remains Canvas 2D; the shell does not add a WebGL dependency.

## Anatomy

- **Header:** instrument name, UV light, Project, Print, Export.
- **Stage:** a stable document fitted inside a responsive console without side
  handles or grips.
- **Quick actions:** Undo, Redo, Burst, Help. Compact controls sit below the stage
  in a footer row on phones, Fold/tablets, and desktop.
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

For the next instrument, reuse the header/stage/quick-action footer/dock/dialog
pattern and visual tokens. Keep the shell free of side handles by default at
every screen size, with the artwork as the main event. Write a small adapter
around that instrument's capabilities. Preserve its
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

## Brush feedback and optional depth

The pointer carries a translucent, ink-colored footprint sized in document units.
When one symbol is selected, its silhouette sits inside that footprint. It is
approximate: scatter and rotation remain part of the brush. Fields that place
marks away from the pointer use an explicit placement indicator instead.
Pointer feedback is a DOM overlay, excluded from the document and every export.

Distance-based sampling makes the gesture consistent across device event rates.
It preserves brush randomness rather than replacing it with a rigid uniform line.

Each layer can cast a shadow onto content beneath it. Shadow is off by default;
distance, softness and strength are opt-in controls inside Layers. The same
document settings drive the on-screen composition, project file and exports.

## The blacklight reveal

The UV light is a persistent, plainly labeled switch. Reactive ink is a material
selected in Ink, independent of whether the lamp is currently on. A mark remembers
its own material. This lets a maker build a quieter daylight composition with a
second fluorescent layer of meaning revealed by the light.

The ordinary interface retains its bone/void palette. Turning on UV dims the room
and adds a new functional lamp color (#B29AFF) and atmosphere (#24133D); these colors
belong to the blacklight state. Reactive swatches use the established phosphor,
magenta, copper, signal and bone colors. Syne and the existing controls stay intact.
No flashing, constant pulsing, full-screen filter, or extra floating toolbar.

The renderer changes the selected lighting for both the canvas and its exports.
UI state communicates ink material, lamp state and exported appearance separately.
