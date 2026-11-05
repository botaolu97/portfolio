# Mubu design system

How Mubu's own interface looks and behaves: the editor, the canvas switcher and the canvas chrome
around nodes. Read this before changing any UI. The token reference at the end is generated
from the source of truth.

## Scope

- **In scope:** everything Mubu draws itself: the canvas switcher, theme switch, palette, inspector, buttons,
  toasts, and the chrome around canvas nodes (outlines, handles, selection tags, the demo title
  bar, text and shape nodes).
- **Out of scope:** the content of demos. Each demo is its own page with its own visual language,
  running in a sandboxed iframe. Demos never import Mubu tokens, and Mubu never styles inside them.
  (The only thing Mubu adds to a demo page is the invisible zoom bridge described under Canvas.)

## Source of truth

| What                                                                                  | Where                                                                           | Edited by hand? |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------- |
| Token values (colors, type, spacing, radius, shadow, motion, sizes, component tokens) | `design/tokens.json` ([DTCG 2025.10](https://www.designtokens.org/tr/2025.10/)) | Yes             |
| CSS custom properties                                                                 | `src/ui/tokens.css`                                                             | No, generated   |
| Values for code that stores tokens as data                                            | `src/ui/tokens.ts`                                                              | No, generated   |
| Token reference tables in this file                                                   | `DESIGN.md` (between the markers)                                               | No, generated   |
| Intent, rules and component guidance                                                  | `DESIGN.md` (everything else)                                                   | Yes             |

After editing `design/tokens.json`, run `npm run tokens`. `npm test` fails if the generated files
are stale, and if a CSS module uses a raw color instead of a token.

Tokens come in three tiers:

1. **`palette.*`**: primitive colors. Never referenced by components and not emitted as CSS.
2. **Semantic** (`color.*`, `font.*`, `space.*`, `radius.*`, `shadow.*`, `motion.*`, `size.*`, `z.*`):
   roles, with dark-mode values where they differ.
3. **`component.*`**: per-component tokens that alias semantic ones, emitted without the prefix
   (`component.button.bg` → `--button-bg`). Restyle one component by changing its tokens.

## Principles

1. **The canvas is the hero.** Chrome is quiet, neutral and out of the way: thin borders, soft
   shadows only on floating things, no decoration that competes with what's on the map.
2. **One accent.** `--color-accent` means "this is interactive, selected or focused". Don't use it
   for decoration, and don't introduce a second brand color.
3. **Same system in light and dark.** Every semantic color has a dark value. Design both at once.
   The theme follows the system until the viewer flips the theme switch.
4. **Show editability, even when read-only.** Hover and selection states look the same on the
   published site as in the editor, so visitors can see what could be edited.
5. **Small, dense, calm.** 14px base text, 32px controls, short 120–200ms transitions.

## Color

- Backgrounds: `--color-canvas` behind everything (a detective-board tan, `#D9C9B8`, in light mode;
  the dot grid is a darker tan), `--color-surface` for anything that sits on it
  (cards, panels, inputs), `--color-surface-muted` for hover fills, title bars and placeholders.
- Text: `--color-text` for content, `--color-text-muted` for labels, captions and hints. Use
  `--color-text-on-accent` on accent and danger fills.
- Lines: `--color-border` for every 1px border and divider.
- Status: `--color-danger` only for destructive actions and errors.
- Note colors (`--color-note-*`) are paper colors: they don't change in dark mode, and note text stays dark.

## Typography

System font stack (`--font-family-sans`) for the interface; the only web fonts are the bundled
label fonts (Fasthand, Caveat, Handjet, Instrument Serif).

| Role                    | Size               | Weight                                                 |
| ----------------------- | ------------------ | ------------------------------------------------------ |
| Canvas switcher name    | `--font-size-base` | `--font-weight-semibold`                               |
| Body, buttons           | `--font-size-base` | regular                                                |
| Inputs                  | `--font-size-md`   | regular                                                |
| Labels, captions, hints | `--font-size-sm`   | regular or `--font-weight-semibold` for section titles |
| Tags and badges         | `--font-size-xs`   | `--font-weight-medium`                                 |

## Spacing and layout

- Use only `--space-*` values for padding, gaps and margins. The names are the pixel values.
- Common rhythms: 6–8 between related controls, 12–14 inside panels, 16 page gutters.
- There is no top bar: the canvas fills the window. Everything else floats above it, `--space-16`
  from the window edges: palette (top-left), inspector (top-right), canvas switcher (bottom-left),
  theme switch (bottom-right).

## Shape and elevation

- `--radius-sm` for controls (buttons, inputs, menu items), `--radius-md` for containers (cards,
  panels, nodes), `--radius-full` for pills and circles.
- `--shadow-raised` for things that float above the canvas (panels, toasts, the switcher).
- Every box on the canvas gets the very light `--node-shadow` (`--shadow-subtle`): text boxes,
  code blocks, images, videos, demos and web pages; shapes get a matching outline-following drop shadow
  (`--node-shape-shadow`). Notes and stack prints keep their own paper shadows; text boxes with no
  background get none.
- Stacking order uses `--z-*` tokens, never raw numbers.

## Motion

- `--motion-duration-fast` for hover and focus feedback, `--motion-duration-normal` for state
  changes, both with `--motion-easing-standard`.
- Never animate layout on the canvas; React Flow positions nodes directly.

## Components

### Button (`src/ui/Button.tsx`)

| Variant   | Use                                                                |
| --------- | ------------------------------------------------------------------ |
| default   | Most actions: surface fill, border, hover to `--button-bg-hover`.  |
| `primary` | The one main action in a view. Accent fill.                         |
| `ghost`   | Quiet actions. No fill or border until hover.                       |
| `danger`  | Destructive actions. Danger text color, otherwise default.         |

Height `--button-height`, horizontal padding `--button-padding-x`, radius `--button-radius`.
Disabled buttons drop to 45% opacity. In panels, buttons use `--size-control-sm`.

### Canvas switcher (`src/app/CanvasSwitcher.tsx`)

A `--panel-*` pill fixed `--switcher-inset` from the bottom-left corner, on every page and in both
modes. Closed, it shows the open canvas's name (truncated at `--switcher-max-width`) and a
chevron; in edit mode a small dot before the name shows autosave (muted while saving, danger on
failure, hidden when saved). Open, a `--switcher-menu-width` menu rises above it: a "Canvases"
heading, every canvas with a check on the current one, and, in edit mode only, "New canvas"
(name it inline, Enter to create). Arrow keys move through the menu, Esc or a click outside closes
it. Canvases aren't deleted from the UI; use `npm run delete-canvas -- "Exact name"`.

The site root opens the "welcome" canvas (or the first one); there is no separate list page.

Canvases have a stable order, 1 to n from top to bottom, which the menu shows: existing ones keep
their place and new ones go to the bottom (editing never reorders). Switching slides by that order
in `--motion-duration-slide` with `--motion-easing-slide`: going further down the list, the current
canvas moves up and out while the next one rises from below; going back, both slide down. Only the
canvas layer moves — palette, inspector, switcher and theme switch stay put. While moving, both
canvases cast `--canvas-slide-shadow`, so they read as separate sheets rather than one canvas
scrolling. The leaving canvas is
a static snapshot (only one canvas can be live), with demos and videos shown as plain blocks.
Reduced motion switches instantly. In the editor, a save still waiting when you switch is written
first.

### Panel: palette and inspector (`src/editor/`)

Floating `--panel-*` containers. The palette lists node types as rows you can drag or click.
The inspector shows the fields of the single selected node or connector, a section title in
small uppercase muted text, and actions at the bottom above a divider.

### Field

A caption in `--font-size-sm` muted text above the control. Controls are `--color-field` filled
with a border and `--radius-sm`, 30px tall.

### Toast

Bottom-center, `--toast-bg` with `--toast-text`, `--radius-md`, raised. Disappears after 5 seconds.

### Theme switch (`src/ui/ThemeSwitch.tsx`)

A `--theme-switch-*` pill fixed `--theme-switch-inset` from the bottom-right corner on every page,
in edit and view mode. A sun and a moon sit in the track; the knob slides over the current theme
in `--motion-duration-normal`. It's a native button with `role="switch"` (checked = dark).

Flipping it reveals the new theme as an ellipse growing from the bottom-right corner until it
fills the screen (`--motion-duration-theme`, `--motion-easing-theme`: slow at first, then faster).
It's a view transition: the old page is a frozen snapshot and the new theme shows through the
growing clip, so nothing re-colors mid-way. Instant where view transitions aren't supported, with
reduced motion, and when the theme follows a system change.

The choice sets `data-theme` on `<html>` and is saved in `localStorage` (`mubu.theme`); a small
inline script in `index.html` applies it before first paint. Until the viewer chooses, the
theme follows the system. `npm run tokens` emits each dark value twice: under
`prefers-color-scheme: dark` (skipped when `data-theme="light"`) and under `[data-theme='dark']`.

### Canvas

No on-screen zoom buttons or minimap: the canvas is the whole view. Zoom with pinch or ⌘-scroll,
pan with scroll or by dragging empty space (Space + drag in edit mode).
On canvas pages every zoom gesture (pinch, ⌘-scroll, ⌘+ ⌘− ⌘0) zooms the canvas and never the
browser page, so the panels, canvas switcher and theme switch keep a fixed size
(`src/canvas/usePageZoomGuard.ts`). That includes gestures over code blocks and inside live demos;
pinches zoom around the pointer. For demos, Mubu adds an invisible bridge script to each demo page
when serving it (dev server and build, never the source files) that stops the browser zoom and
asks the canvas to zoom instead. Chrome and Firefox report a trackpad pinch as ctrl + wheel and
Safari as gesture events; both are handled, and a pinch reported both ways only zooms once. Demo
URLs carry the build id (`?v=…`), so a new deploy never shows a cached demo without the bridge.

Two-finger swipes never become the browser's back/forward gesture or a page bounce:
`overscroll-behavior` is `none` on the page and inside demos (set by the bridge) and `contain` on
scrollable areas (code blocks, inspector, switcher menu). Keep it that way; add
navigation UI only if the gestures stop being enough.

### Hover lift (view mode)

Interactive boxes — text nodes, videos, demos, web pages and stacks — grow to `--hover-lift-scale` (2%) on
hover in `--motion-duration-fast`, so visitors can tell they respond to a click. Only the box's
content scales (React Flow positions the node itself). Notes, shapes and images don't lift, and
nothing lifts in the editor. A text box the reader has just zoomed back into stays at its normal
size until the pointer leaves, and the reader always measures the box unlifted, so the zoom lands
on its real size. No lift with reduced motion.

### Connectors

Each connector can have its own color (hex, `#rrggbb`) and thickness (0.5–12px), set in its
inspector with a color picker plus hex field and a slider plus number; "Use default look" clears
both. Unset, they use `--connector-color` and `--connector-width`. The arrowhead takes the line's
color and grows with its thickness.

### Canvas node chrome (`src/nodes/NodeChrome.tsx`, `src/canvas/Canvas.module.css`)

| State               | Look                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Hover               | 1px dashed accent outline, 2px outside the node. Both modes.                                                              |
| Selected, edit mode | React Flow resizer (accent line and handles) plus the selection tag.                                                      |
| Selected, view mode | 2px solid `--selection-outline` with a soft accent halo, four corner handles that do nothing, and the selection tag.      |
| Selection tag       | `--selection-badge-bg` pill above the top-left corner: "Type · W × H", `--font-size-xs`. Stays the same size at any zoom. |
| Connection handles  | `--handle-size` accent dots on each side; visible on hover in edit mode, invisible in view mode.                          |

### Node types

- **Label:** text with no box or background (`--label-color`, `--label-padding`), sized to its
  content, so it has no resize handles; change its size instead. Fonts: Fasthand (default),
  Caveat, Handjet, Instrument Serif, Sans, Serif, Mono (`--font-family-*`); Fasthand, Caveat,
  Handjet and Instrument Serif are bundled with the app (Fontsource), not loaded from Google.
  Instrument Serif has only a regular weight, so heavier weights are synthesized. Size 8–240px (default 32), weight Regular/Medium/
  Semibold/Bold (400–700). Double-click to type (plain text; Enter adds a line, Esc finishes).
- **Note:** a sticky note for quick thoughts. It's the first item in the palette and defaults to
  yellow. It comes in five `--color-note-*` fills (yellow, pink, green, blue, purple), stored by
  name in the map so the palette can change later. Rich text (see below) in `--note-text` at
  `--note-font-size`, `--note-padding` inside, `--note-radius` corners and `--note-shadow` like
  paper. Notes stay light in dark mode. In the inspector the colors are round
  `--note-swatch-size` swatches (native radio buttons); the chosen one gets the accent focus ring.
  Notes can be rotated (`rotation`, -180° to 180°): only the paper turns, while the resize and
  connection handles stay on the unrotated box. In the editor a selected note shows a
  `--rotate-handle-*` dot `--rotate-handle-offset` above it on a short stem: drag to rotate, Shift
  snaps to 15°, double-click straightens; focused, arrow keys turn 1° (15° with Shift) and Home
  straightens. The inspector has a Rotation field and Straighten.
- **Text:** a surface card with border and `--radius-md`, or a note color, or no background.
  Padding is `--text-box-padding` (10%) of the box's width on top, left and right, and none at the
  bottom: long text runs to the edge and is clipped, with no scrollbar. Visitors click it to open
  the full-screen reader (below). Notes don't do this; they keep their own padding and scroll.
- **Shape:** SVG shapes (rectangle, rounded, ellipse, diamond, triangle, hexagon, right-pointing block arrow) with a constant 2px stroke; they rotate like notes (drag the dot above a selected shape, Shift snaps to 15°, or set degrees in the inspector), and only the drawing and label turn, not the resize and connection handles; labels use `--shape-label`, dark in both modes
  because shape fills are light.
- **Image:** fills the node; rounded with `--radius-sm`.
- **Video:** `--video-backdrop` behind the player. Embeds show a thumbnail with a
  `--video-play-bg` play button until clicked.
  The player fills the box and keeps its own drags (seeking), so in the editor a
  `--video-drag-strip-height` strip along the top, shaded from `--video-drag-strip-shade` with grip
  dots, is the handle for moving the node; it shows on hover or selection, clear of the controls.
- **Demo frame:** surface card with `--shadow-raised`. A `--demo-bar-height` title bar
  (`--demo-bar-bg`) with three dots and the title; it's the drag handle in edit mode. The page
  inside is the demo's own and is not styled by Mubu.

### Web page (`src/nodes/LinkNode.tsx`)

A `--link-*` card that previews a web page: the page's share image on top (`object-fit: cover`,
anchored to the top) over `--link-image-bg`, then a `--link-padding` text area with the favicon
(`--link-favicon-size`) and domain in `--link-meta-size` muted text, the title (semibold
`--link-title-size`, two lines at most) and the description (muted, two lines at most). The image
area takes whatever height is left, so resizing the card trims the image, never the text. When the
page has no share image, the dev server saves a screenshot of its first screen instead (through
Playwright's Chromium). With neither an image nor a title, the whole card is the fallback: the
site's icon at `--link-fallback-icon-size` (or its initial on a muted tile) above the domain.

Everything is fetched once, in the editor, by the dev server (`POST /__mubu/link`): the image and
icon are saved under `public/content/assets/` and the text in the map, so the published site makes
no requests to the linked site until a visitor clicks. Only `http:` and `https:` links are ever
rendered as links.

- **View mode:** the card is a link: a click opens the page in a new tab
  (`target="_blank" rel="noopener noreferrer"`). It gets the hover lift and pointer cursor.
- **Edit mode:** a click selects and a drag moves it, like any node. A `--link-open-size` ↗ button,
  `--link-open-inset` from the top-right corner, shows on hover or selection and opens the page.
  Double-click the card (or use the inspector's Web address field) to change the address; a new
  card starts with the address field. Enter fetches the preview, Esc cancels. The inspector can
  also override the title, choose a preview image of your own (uploaded like any image; Refresh
  preview goes back to the fetched one), refresh the preview or remove the image.

### Code block (`src/nodes/CodeNode.tsx`)

A `--code-*` card: a `--code-bar-height` title bar (file name in mono, or the language) with a
Copy button that works for visitors too, then the code in `--font-family-mono` at
`--code-font-size` / `--code-line-height`, optional `--code-line-number` gutter. Double-click to
edit as plain text (Tab indents, Esc finishes). Long lines wrap by default ("Wrap long lines" in
the inspector turns it off for that block): wrapped rows hang 2 characters past the line's own
indentation and keep one line number per source line. Copy always copies the original lines.

Syntax colors are the one place Mubu doesn't use its own tokens: they come from Shiki's GitHub
light and dark themes. The editor highlights the code (`src/editor/highlight.ts`, grammars load per
language) and stores HTML in which every token carries both colors, so the published site needs
no highlighter and the colors follow the theme switch.

### Full-screen reader (`src/nodes/TextReader.tsx`)

Clicking a text node (view mode; in the editor, double-click or "Edit full screen" in the inspector)
zooms the box
up to fill the window in `--motion-duration-zoom`. The text keeps exactly the box's layout and is
scaled to `--reader-width-ratio` (a third) of the window's width (at least `--reader-min-width` on
narrow windows, never wider than the window minus `--reader-gutter`), starting `--reader-top` from
the top. Long text scrolls with the overlay scrollbar (`src/ui/OverlayScrollbar.tsx`): a
`--scrollbar-*` thumb with no track, `--scrollbar-inset` from the right, top and bottom edges, that
fades in while scrolling and out `--scrollbar-hide-delay` after scrolling stops (it can be dragged).
Visitors' text selection is a subtle gray (`--reader-selection`).
The box's background grows with it: background and text share one frame that grows from the box's
rectangle and clips the text, so the zoom is continuous and the text is never re-wrapped. Opening deselects the box
and the hover outline stays off until the pointer leaves, so the reader lands at exactly the box's
size. The canvas switcher fades out with the zoom in and back in with the zoom out;
the theme switch stays (`--z-theme-switch`). A Back pill sits `--reader-inset` from the top-left;
Back or Esc zooms back out, landing the visible top of the text back in the box, in
`--motion-duration-zoom-out` with `--motion-easing-zoom-out`. Both directions scale on a log
scale (equal ratios per frame) about a fixed point, for the text and the background alike: the
background changes size far more than the text (window to box vs. a third of the window to box),
and interpolating pixels linearly would cram its visible shrink into the last frames, after the
text has settled, which reads as a second shrink. Both move by transform only (the background
frame scales to the box; the text's transform undoes that scale), so they run on the GPU in the
same frames: a clip-path runs on Chrome's main thread and falls behind the text when it's busy.
Respects reduced motion (no animation).

In the editor this is where text nodes are edited (they aren't edited inside the box on the
canvas): once the zoom lands, the static text swaps for the editor in exactly the same layout,
edits save as you type, and Back or Esc swaps back and zooms down.

### Stack (`src/nodes/StackNode.tsx`)

Select two or more images in the editor and a floating mini toolbar (`src/editor/SelectionToolbar.tsx`)
appears above them, styled like the switcher pill; "Stack N images" turns them into one stack
node. The pile draws each image as a print: `--stack-frame-width` white `--stack-frame` border,
`--stack-radius`, `--stack-shadow`, centred and tilted by its depth (top nearly straight, the
ones below fanning out by a few degrees), with a `--stack-badge-*` count pill in the corner.
Prints stay white in dark mode, like paper.

Visitors click a stack to spread it: a `--stack-viewer-backdrop` layer blurred by
`--stack-viewer-blur` covers the canvas and the images lie flat on top in a row (up to 3) or a
near-square grid that always fits the window. Clicking outside an image or pressing Esc stacks
them again. In the editor, double-click previews it; right-click (or the inspector) unstacks,
laying the images out side by side where the stack was; connectors come back with them.

### Rich text (text nodes and notes)

One editor (`src/editor/richTextExtensions.ts`) with the same shortcuts everywhere. Text nodes are
edited in the full-screen reader; notes inside the note (double-click, Esc or a canvas click to
finish). Pressing Enter on an empty line keeps an empty paragraph, which shows as a blank line.

**Text size.** Each text node and note has a size, S / M / L / XL (M is the default), picked in
the inspector with a segmented control. It multiplies the node's base size by
`--rich-text-scale-sm|md|lg|xl`, and headings are relative to it, so a large note keeps its
proportions.

| Shortcut | Result | Markdown start |
| --- | --- | --- |
| ⌘1 | Display (`--rich-text-display-scale` × text size, bold) | `# ` |
| ⌘2 | Headline (`--rich-text-headline-scale` × text size, bold) | `## ` |
| ⌘3 | Subheader (`--rich-text-subheader-scale` × text size, semibold) | `### ` |
| ⌘4 | Normal text | |
| ⌘T | Checkbox list; checked items fade and strike through | `[ ] ` |
| ⌘L | Bullet list | `- ` |
| ⇧⌘E | Highlight marker (`--rich-text-highlight`) | |
| ⌘B / ⌘I / ⌘U | Bold / italic / underline | |
| ⇧⌘X | Strikethrough | |
| ⌘⌫ | Clear styling (marks and block type) | |

Browsers keep some shortcuts for themselves: Chrome always opens a new tab on ⌘T, so use `[ ] `
there; ⌘⌥1–3 also set headings. Rendered (not editing), checkboxes show their state but can't be
toggled.

## Accessibility

- Focus: every focusable element gets a 2px `--color-accent` outline with a 2px offset
  (`:focus-visible` in `src/ui/base.css`).
- Contrast: body text on surfaces meets WCAG AA in both modes. Muted text is for secondary
  information only.
- Every control has a visible label or an `aria-label`; icon-only buttons need a `title`.

## Do and don't

- **Do** add a token to `design/tokens.json` before using a new value in CSS.
- **Do** add a component token when a component needs a value that differs from the semantic one.
- **Don't** write hex or rgb colors in CSS modules. The test suite rejects them.
- **Do** prefix private helper variables with `--_` (e.g. `--_indent`); any other `var(--…)` must be a token.
- **Don't** reference `palette.*` from components; go through a semantic or component token.
- **Don't** style inside demos or share Mubu tokens with them.

## Workflow

- **New value:** add it to the right group in `design/tokens.json` with a `$description`, run
  `npm run tokens`, then use the CSS variable.
- **New component:** build it in `src/ui/` with a CSS module that uses only tokens. Add
  `component.<name>.*` tokens if it needs its own knobs, and document it under Components above.
- **Dark mode:** add `"$extensions": { "app.mubu.modes": { "dark": … } }` to the token.

## Token reference

<!-- tokens:start -->

_Generated from `design/tokens.json` by `npm run tokens`. Edit the JSON, not this section._

#### `color`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--color-canvas` | `#d9c9b8` | `#161615` | Page and canvas background (a detective-board tan in light mode). |
| `--color-canvas-dot` | `#bfa98f` | `#3a3a37` | Dot grid on the canvas. |
| `--color-surface` | `#ffffff` | `#1f1f1e` | Cards, panels, inputs on the canvas. |
| `--color-surface-muted` | `#f0f0ed` | `#2a2a28` | Hover fills, title bars, placeholders. |
| `--color-field` | `#f6f6f4` | `#161615` | Inside text inputs, selects and segmented controls. |
| `--color-border` | `#e2e2dd` | `#353532` | Default 1px borders and dividers. |
| `--color-text` | `#1c1c1a` | `#ececea` | Primary text. |
| `--color-text-muted` | `#6b6b66` | `#9a9a94` | Secondary text, labels, hints. |
| `--color-text-on-accent` | `#ffffff` | — | Text on accent or danger fills. |
| `--color-accent` | `#4f6bed` | `#7d93f5` | Primary actions, selection, focus. |
| `--color-accent-soft` | `#e8ecfd` | `#2a3156` | Tinted backgrounds behind accent content. |
| `--color-danger` | `#d4483b` | `#ef6a5d` | Destructive actions and errors. |
| `--color-note-yellow` | `#ffef9f` | — | Default note color. |
| `--color-note-pink` | `#ffd6e2` | — |  |
| `--color-note-green` | `#c8f0d0` | — |  |
| `--color-note-blue` | `#cfe4ff` | — |  |
| `--color-note-purple` | `#e2d8ff` | — |  |

#### `font`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--font-family-sans` | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | — | Interface text. |
| `--font-family-mono` | `ui-monospace, "SF Mono", Menlo, monospace` | — | Code and numbers that must align. |
| `--font-family-serif` | `ui-serif, Georgia, "Times New Roman", serif` | — | Label font option. |
| `--font-family-fasthand` | `Fasthand, cursive` | — | Label font option (default); bundled with @fontsource/fasthand. |
| `--font-family-caveat` | `"Caveat Variable", cursive` | — | Label font option; bundled with @fontsource-variable/caveat. |
| `--font-family-handjet` | `"Handjet Variable", monospace` | — | Label font option: a dot-matrix display face; bundled with @fontsource-variable/handjet (weights 100–900). |
| `--font-family-instrument-serif` | `"Instrument Serif", ui-serif, Georgia, serif` | — | Label font option: a condensed display serif; bundled with @fontsource/instrument-serif (regular weight only, so heavier weights are synthesized). |
| `--font-size-xs` | `11px` | — | Tags and badges. |
| `--font-size-sm` | `12px` | — | Labels, hints, field captions. |
| `--font-size-md` | `13px` | — | Form inputs. |
| `--font-size-base` | `14px` | — | Body text and buttons. |
| `--font-size-lg` | `15px` | — | Toolbar title. |
| `--font-size-xl` | `16px` | — | Card titles. |
| `--font-size-2xl` | `20px` | — | Section headings. |
| `--font-size-3xl` | `28px` | — | Page title. |
| `--font-weight-regular` | `400` | — |  |
| `--font-weight-medium` | `500` | — |  |
| `--font-weight-semibold` | `600` | — |  |
| `--font-weight-bold` | `700` | — |  |
| `--font-line-height-tight` | `1` | — | Single-line controls. |
| `--font-line-height-snug` | `1.4` | — | Hints and short paragraphs. |
| `--font-line-height-normal` | `1.5` | — | Body text. |

#### `space`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--space-2` | `2px` | — |  |
| `--space-4` | `4px` | — |  |
| `--space-6` | `6px` | — |  |
| `--space-8` | `8px` | — |  |
| `--space-10` | `10px` | — |  |
| `--space-12` | `12px` | — |  |
| `--space-14` | `14px` | — |  |
| `--space-16` | `16px` | — |  |
| `--space-20` | `20px` | — |  |
| `--space-24` | `24px` | — |  |
| `--space-32` | `32px` | — |  |
| `--space-48` | `48px` | — |  |
| `--space-56` | `56px` | — |  |
| `--space-80` | `80px` | — |  |

#### `radius`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--radius-xs` | `2px` | — | Handles and tiny marks. |
| `--radius-sm` | `5px` | — | Buttons, inputs, menu items. |
| `--radius-md` | `8px` | — | Cards, panels, nodes. |
| `--radius-lg` | `12px` | — | Large media controls. |
| `--radius-full` | `999px` | — | Pills and circles. |

#### `shadow`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--shadow-raised` | `0 1px 2px 0 rgb(0 0 0 / 0.06), 0 4px 16px 0 rgb(0 0 0 / 0.06)` | `0 1px 2px 0 rgb(0 0 0 / 0.3), 0 4px 16px 0 rgb(0 0 0 / 0.3)` | Floating panels, cards on hover, demo frames. |
| `--shadow-subtle` | `0 1px 2px 0 rgb(0 0 0 / 0.04), 0 2px 8px 0 rgb(0 0 0 / 0.05)` | `0 1px 2px 0 rgb(0 0 0 / 0.25), 0 2px 8px 0 rgb(0 0 0 / 0.22)` | A very light lift for boxes on the canvas. |

#### `motion`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--motion-duration-fast` | `120ms` | — | Hover and focus feedback. |
| `--motion-duration-normal` | `200ms` | — | State changes such as toggles. |
| `--motion-duration-zoom` | `380ms` | — | Zooming a text box into and out of the reader. |
| `--motion-duration-zoom-out` | `320ms` | — | Zooming a text box back out of the reader: a little quicker than zooming in. |
| `--motion-duration-theme` | `540ms` | — | Switching between light and dark: the new theme grows as an ellipse from the bottom-right corner. With the browser's ~60 ms snapshot before it starts, the whole switch takes about 600 ms. |
| `--motion-duration-slide` | `640ms` | — | Sliding from one canvas to the next. |
| `--motion-easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | — | Default easing for UI transitions. |
| `--motion-easing-theme` | `cubic-bezier(0.5, 0, 0.85, 0.35)` | — | The theme ellipse starts slowly and speeds up until it fills the screen. |
| `--motion-easing-zoom-out` | `cubic-bezier(0.3, 0, 0.15, 1)` | — | Zooming back out of the reader: starts right away and settles onto the box, with a shorter tail than the standard curve. |
| `--motion-easing-slide` | `cubic-bezier(0.65, 0, 0.35, 1)` | — | Symmetric ease for two canvases moving together. |

#### `size`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--size-control` | `32px` | — | Default height of buttons and inputs. |
| `--size-control-sm` | `28px` | — | Compact buttons inside panels. |
| `--size-inspector` | `260px` | — | Inspector panel width. |

#### `z`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--z-node-adornment` | `2` | — | Selection tags and handles above node content. |
| `--z-panel` | `5` | — | Palette and inspector. |
| `--z-controls` | `6` | — | Floating controls: canvas switcher and theme switch. |
| `--z-overlay` | `10` | — | Drop target overlay. |
| `--z-viewer` | `15` | — | Spread-out stack view and its backdrop, above controls. |
| `--z-theme-switch` | `16` | — | Theme switch: above the reader and stack viewer. |
| `--z-toast` | `20` | — | Error toasts. |

#### `component.button`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--button-height` | `var(--size-control) → 32px` | follows alias |  |
| `--button-padding-x` | `var(--space-12) → 12px` | follows alias |  |
| `--button-radius` | `var(--radius-sm) → 5px` | follows alias |  |
| `--button-bg` | `var(--color-surface) → #ffffff` | follows alias |  |
| `--button-bg-hover` | `var(--color-surface-muted) → #f0f0ed` | follows alias |  |
| `--button-border` | `var(--color-border) → #e2e2dd` | follows alias |  |
| `--button-primary-bg` | `var(--color-accent) → #4f6bed` | follows alias |  |
| `--button-primary-text` | `var(--color-text-on-accent) → #ffffff` | follows alias |  |

#### `component.panel`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--panel-bg` | `var(--color-surface) → #ffffff` | follows alias |  |
| `--panel-border` | `var(--color-border) → #e2e2dd` | follows alias |  |
| `--panel-radius` | `var(--radius-md) → 8px` | follows alias |  |
| `--panel-shadow` | `var(--shadow-raised) → 0 1px 2px 0 rgb(0 0 0 / 0.06), 0 4px 16px 0 rgb(0 0 0 / 0.06)` | follows alias |  |

#### `component.selection`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--selection-outline` | `var(--color-accent) → #4f6bed` | follows alias | Selected node outline and corner handles. |
| `--selection-badge-bg` | `var(--color-accent) → #4f6bed` | follows alias |  |
| `--selection-badge-text` | `var(--color-text-on-accent) → #ffffff` | follows alias |  |

#### `component.handle`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--handle-size` | `10px` | — | Connection handles on node edges. |
| `--handle-color` | `var(--color-accent) → #4f6bed` | follows alias |  |

#### `component.demo`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--demo-bar-height` | `32px` | — | Title bar of a demo frame; also the drag handle. |
| `--demo-bar-bg` | `var(--color-surface-muted) → #f0f0ed` | follows alias |  |
| `--demo-page-bg` | `#ffffff` | — | Behind the demo iframe, before the page paints. |

#### `component.shape`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--shape-label` | `#1c1c1a` | — | Shape labels sit on light fills, so they stay dark in both modes. |

#### `component.video`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--video-backdrop` | `#000000` | — |  |
| `--video-play-bg` | `rgb(0 0 0 / 0.7)` | — |  |
| `--video-play-bg-hover` | `#ee3333` | — |  |
| `--video-play-icon` | `#ffffff` | — |  |
| `--video-drag-strip-height` | `28px` | — | Edit mode: the strip along the top of a video that moves the node. |
| `--video-drag-strip-shade` | `rgb(0 0 0 / 0.45)` | — | Top of the strip's shade, fading to transparent. |

#### `component.toast`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--toast-bg` | `var(--color-danger) → #d4483b` | follows alias |  |
| `--toast-text` | `var(--color-text-on-accent) → #ffffff` | follows alias |  |

#### `component.note`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--note-text` | `#1c1c1a` | — | Note text; dark in both modes because note fills are light. |
| `--note-placeholder` | `#6b6b66` | — |  |
| `--note-padding` | `var(--space-8) → 8px` | follows alias | Space inside a note on every side. |
| `--note-radius` | `var(--radius-xs) → 2px` | follows alias |  |
| `--note-font-size` | `var(--font-size-lg) → 15px` | follows alias |  |
| `--note-shadow` | `0 1px 2px 0 rgb(0 0 0 / 0.08), 0 6px 14px -4px rgb(0 0 0 / 0.1)` | — | Lifts the note off the canvas like paper. |
| `--note-swatch-size` | `24px` | — | Color swatches in the inspector. |

#### `component.rich-text`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--rich-text-display-scale` | `2` | — | ⌘1 or # — Display, relative to the node's text size. |
| `--rich-text-headline-scale` | `1.43` | — | ⌘2 or ## — Headline, relative to the node's text size. |
| `--rich-text-subheader-scale` | `1.15` | — | ⌘3 or ### — Subheader, relative to the node's text size. |
| `--rich-text-scale-sm` | `0.86` | — | Text size S (inspector). |
| `--rich-text-scale-md` | `1` | — | Text size M, the default. |
| `--rich-text-scale-lg` | `1.3` | — | Text size L. |
| `--rich-text-scale-xl` | `1.75` | — | Text size XL. |
| `--rich-text-block-gap` | `var(--space-6) → 6px` | follows alias | Space after paragraphs, headings and lists. |
| `--rich-text-list-indent` | `var(--space-20) → 20px` | follows alias |  |
| `--rich-text-highlight` | `rgb(255 196 0 / 0.45)` | — | ⇧⌘E marker. Translucent amber so it reads on white, dark and every note color. |
| `--rich-text-checkbox` | `var(--color-accent) → #4f6bed` | follows alias |  |

#### `component.theme-switch`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--theme-switch-width` | `52px` | — |  |
| `--theme-switch-height` | `28px` | — |  |
| `--theme-switch-knob` | `22px` | — |  |
| `--theme-switch-inset` | `var(--space-16) → 16px` | follows alias | Distance from the window's bottom and right edges. |
| `--theme-switch-track` | `var(--color-surface-muted) → #f0f0ed` | follows alias |  |
| `--theme-switch-knob-bg` | `var(--color-surface) → #ffffff` | follows alias |  |
| `--theme-switch-icon` | `var(--color-text-muted) → #6b6b66` | follows alias |  |
| `--theme-switch-icon-active` | `var(--color-text) → #1c1c1a` | follows alias |  |

#### `component.code`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--code-bg` | `var(--color-surface) → #ffffff` | follows alias |  |
| `--code-bar-bg` | `var(--color-surface-muted) → #f0f0ed` | follows alias |  |
| `--code-bar-height` | `32px` | — |  |
| `--code-border` | `var(--color-border) → #e2e2dd` | follows alias |  |
| `--code-radius` | `var(--radius-md) → 8px` | follows alias |  |
| `--code-font-size` | `var(--font-size-md) → 13px` | follows alias |  |
| `--code-line-height` | `1.6` | — |  |
| `--code-padding` | `var(--space-12) → 12px` | follows alias |  |
| `--code-line-number` | `var(--color-text-muted) → #6b6b66` | follows alias | Line numbers in the gutter. |

#### `component.switcher`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--switcher-inset` | `var(--space-16) → 16px` | follows alias | Distance from the window's bottom and left edges. |
| `--switcher-height` | `var(--size-control) → 32px` | follows alias |  |
| `--switcher-max-width` | `280px` | — | Longer canvas names are truncated. |
| `--switcher-menu-width` | `260px` | — |  |
| `--switcher-menu-max-height` | `360px` | — |  |
| `--switcher-item-height` | `var(--size-control) → 32px` | follows alias |  |

#### `component.stack`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--stack-frame` | `#ffffff` | — | Print border around each image; stays white in dark mode, like paper. |
| `--stack-frame-width` | `4px` | — |  |
| `--stack-radius` | `var(--radius-xs) → 2px` | follows alias |  |
| `--stack-shadow` | `var(--shadow-raised) → 0 1px 2px 0 rgb(0 0 0 / 0.06), 0 4px 16px 0 rgb(0 0 0 / 0.06)` | follows alias |  |
| `--stack-badge-bg` | `var(--color-text) → #1c1c1a` | follows alias | Image count pill; inverts with the theme. |
| `--stack-badge-text` | `var(--color-surface) → #ffffff` | follows alias |  |

#### `component.stack-viewer`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--stack-viewer-backdrop` | `rgb(20 20 18 / 0.45)` | — |  |
| `--stack-viewer-blur` | `10px` | — |  |
| `--stack-viewer-padding` | `var(--space-48) → 48px` | follows alias |  |
| `--stack-viewer-gap` | `var(--space-24) → 24px` | follows alias |  |

#### `component.text-box`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--text-box-padding` | `0.1` | — | Padding on top, left and right as a share of the text box's width (10%); none at the bottom, where long text is clipped. |

#### `component.reader`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--reader-top` | `72px` | — | Space above the text, below the back button. |
| `--reader-width-ratio` | `0.3333` | — | Text width as a share of the window (a third). |
| `--reader-min-width` | `320px` | — | On narrow windows the text never gets narrower than this (or the window minus the gutters). |
| `--reader-gutter` | `var(--space-24) → 24px` | follows alias | Minimum space beside the text. |
| `--reader-inset` | `var(--space-16) → 16px` | follows alias | Back button distance from the top-left corner. |
| `--reader-selection` | `rgb(28 28 26 / 0.12)` | `rgb(236 236 234 / 0.2)` | Text selection for visitors: a subtle gray. |

#### `component.scrollbar`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--scrollbar-thumb` | `rgb(28 28 26 / 0.28)` | `rgb(236 236 234 / 0.32)` |  |
| `--scrollbar-thumb-hover` | `rgb(28 28 26 / 0.45)` | `rgb(236 236 234 / 0.5)` |  |
| `--scrollbar-width` | `6px` | — |  |
| `--scrollbar-inset` | `var(--space-24) → 24px` | follows alias | Distance from the window's right, top and bottom edges. |
| `--scrollbar-min-thumb` | `40px` | — |  |
| `--scrollbar-hide-delay` | `2000ms` | — | The thumb fades out this long after scrolling stops. |

#### `component.rotate-handle`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--rotate-handle-size` | `12px` | — |  |
| `--rotate-handle-offset` | `28px` | — | Distance from the box's top edge to the handle's centre. |
| `--rotate-handle-color` | `var(--color-accent) → #4f6bed` | follows alias |  |
| `--rotate-handle-fill` | `var(--color-surface) → #ffffff` | follows alias |  |

#### `component.hover-lift`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--hover-lift-scale` | `1.02` | — |  |

#### `component.node`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--node-shadow` | `var(--shadow-subtle) → 0 1px 2px 0 rgb(0 0 0 / 0.04), 0 2px 8px 0 rgb(0 0 0 / 0.05)` | follows alias | Text boxes, code blocks, images, videos and demos (notes and stack prints have their own). |
| `--node-shape-shadow` | `rgb(0 0 0 / 0.08)` | `rgb(0 0 0 / 0.35)` | Shapes use a drop-shadow filter in this color so the shadow follows their outline. |

#### `component.label`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--label-color` | `var(--color-text) → #1c1c1a` | follows alias |  |
| `--label-padding` | `var(--space-4) → 4px` | follows alias | Small inset so the selection outline doesn't touch the letters. |

#### `component.canvas-slide`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--canvas-slide-shadow` | `0 0 24px 0 rgb(0 0 0 / 0.14), 0 0 64px 0 rgb(0 0 0 / 0.12)` | `0 0 24px 0 rgb(0 0 0 / 0.5), 0 0 64px 0 rgb(0 0 0 / 0.45)` |  |

#### `component.connector`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--connector-color` | `#9a9a94` | `#6b6b66` | Default line and arrow color. |
| `--connector-width` | `1.5` | — | Default thickness in px. |

#### `component.link`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--link-bg` | `var(--color-surface) → #ffffff` | follows alias |  |
| `--link-border` | `var(--color-border) → #e2e2dd` | follows alias |  |
| `--link-radius` | `var(--radius-md) → 8px` | follows alias |  |
| `--link-image-bg` | `var(--color-surface-muted) → #f0f0ed` | follows alias | Behind the preview image, and the fallback panel when there is none. |
| `--link-padding` | `var(--space-12) → 12px` | follows alias | Inside the text area below the image. |
| `--link-gap` | `var(--space-4) → 4px` | follows alias | Between the site row, title and description. |
| `--link-title-size` | `var(--font-size-base) → 14px` | follows alias |  |
| `--link-meta-size` | `var(--font-size-sm) → 12px` | follows alias | Site name, domain and description. |
| `--link-favicon-size` | `16px` | — |  |
| `--link-fallback-icon-size` | `40px` | — | The large icon (or initial) on a card with no preview image. |
| `--link-open-size` | `var(--size-control-sm) → 28px` | follows alias | Edit mode: the open-in-new-tab button in the card's corner. |
| `--link-open-inset` | `var(--space-8) → 8px` | follows alias |  |

<!-- tokens:end -->
