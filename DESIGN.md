# Mubu design system

How Mubu's own interface looks and behaves: the editor, the map list and the canvas chrome
around nodes. Read this before changing any UI. The token reference at the end is generated
from the source of truth.

## Scope

- **In scope:** everything Mubu draws itself: the top bar, palette, inspector, buttons, map cards,
  toasts, and the chrome around canvas nodes (outlines, handles, selection tags, the demo title
  bar, text and shape nodes).
- **Out of scope:** the content of demos. Each demo is its own page with its own visual language,
  running in a sandboxed iframe. Demos never import Mubu tokens, and Mubu never styles inside them.

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

- Backgrounds: `--color-canvas` behind everything, `--color-surface` for anything that sits on it
  (cards, panels, inputs), `--color-surface-muted` for hover fills, title bars and placeholders.
- Text: `--color-text` for content, `--color-text-muted` for labels, captions and hints. Use
  `--color-text-on-accent` on accent and danger fills.
- Lines: `--color-border` for every 1px border and divider.
- Status: `--color-danger` only for destructive actions and errors.
- Note colors (`--color-note-*`) are paper colors: they don't change in dark mode, and note text stays dark.

## Typography

System font stack (`--font-family-sans`); no web fonts, so the editor loads instantly.

| Role                    | Size               | Weight                                                 |
| ----------------------- | ------------------ | ------------------------------------------------------ |
| Page title (map list)   | `--font-size-3xl`  | `--font-weight-bold`                                   |
| Card title              | `--font-size-xl`   | `--font-weight-semibold`                               |
| Toolbar map title       | `--font-size-lg`   | `--font-weight-semibold`                               |
| Body, buttons           | `--font-size-base` | regular                                                |
| Inputs                  | `--font-size-md`   | regular                                                |
| Labels, captions, hints | `--font-size-sm`   | regular or `--font-weight-semibold` for section titles |
| Tags and badges         | `--font-size-xs`   | `--font-weight-medium`                                 |

## Spacing and layout

- Use only `--space-*` values for padding, gaps and margins. The names are the pixel values.
- Common rhythms: 6–8 between related controls, 12–14 inside panels, 16 page gutters.
- The top bar is `--size-toolbar` tall; the canvas starts directly below it.
- Floating panels sit `--space-12` from the window edges and `--space-16` below the top bar.

## Shape and elevation

- `--radius-sm` for controls (buttons, inputs, menu items), `--radius-md` for containers (cards,
  panels, nodes), `--radius-full` for pills and circles.
- `--shadow-raised` only for things that float above the canvas (panels, toasts, demo frames,
  cards on hover). Flat things get a border instead.
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
| `primary` | The one main action in a view (e.g. "New map"). Accent fill.       |
| `ghost`   | Toolbar actions like Undo and Redo. No fill or border until hover. |
| `danger`  | Destructive actions. Danger text color, otherwise default.         |

Height `--button-height`, horizontal padding `--button-padding-x`, radius `--button-radius`.
Disabled buttons drop to 45% opacity. In panels, buttons use `--size-control-sm`.

### Top bar (`src/app/TopBar.module.css`)

Fixed above the canvas, solid surface, one border at the bottom. Left: back link
and map title. Right: actions, grouped with a vertical divider.

### Panel: palette and inspector (`src/editor/`)

Floating `--panel-*` containers. The palette lists node types as rows you can drag or click.
The inspector shows the fields of the single selected node or connector, a section title in
small uppercase muted text, and actions at the bottom above a divider.

### Field

A caption in `--font-size-sm` muted text above the control. Controls are `--color-canvas` filled
with a border and `--radius-sm`, 30px tall.

### Map card (`src/app/MapList.tsx`)

Surface card with a border; on hover the border turns accent and the card gains
`--shadow-raised`. A danger "Delete" button appears on hover in edit mode only.

### Toast

Bottom-center, `--toast-bg` with `--toast-text`, `--radius-md`, raised. Disappears after 5 seconds.

### Theme switch (`src/ui/ThemeSwitch.tsx`)

A `--theme-switch-*` pill fixed `--theme-switch-inset` from the bottom-right corner on every page,
in edit and view mode. A sun and a moon sit in the track; the knob slides over the current theme
in `--motion-duration-normal`. It's a native button with `role="switch"` (checked = dark).

The choice sets `data-theme` on `<html>` and is saved in `localStorage` (`mubu.theme`); a small
inline script in `index.html` applies it before first paint. Until the viewer chooses, the
theme follows the system. `npm run tokens` emits each dark value twice: under
`prefers-color-scheme: dark` (skipped when `data-theme="light"`) and under `[data-theme='dark']`.

### Canvas

No on-screen zoom buttons or minimap: the canvas is the whole view. Zoom with pinch or ⌘-scroll,
pan with scroll or by dragging empty space (Space + drag in edit mode).
On canvas pages every zoom gesture (pinch, ⌘-scroll, ⌘+ ⌘− ⌘0) zooms the canvas and never the
browser page, so the top bar, panels and theme switch keep a fixed size (`src/canvas/usePageZoomGuard.ts`). Keep it that way; add
navigation UI only if the gestures stop being enough.

### Canvas node chrome (`src/nodes/NodeChrome.tsx`, `src/canvas/Canvas.module.css`)

| State               | Look                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Hover               | 1px dashed accent outline, 2px outside the node. Both modes.                                                              |
| Selected, edit mode | React Flow resizer (accent line and handles) plus the selection tag.                                                      |
| Selected, view mode | 2px solid `--selection-outline` with a soft accent halo, four corner handles that do nothing, and the selection tag.      |
| Selection tag       | `--selection-badge-bg` pill above the top-left corner: "Type · W × H", `--font-size-xs`. Stays the same size at any zoom. |
| Connection handles  | `--handle-size` accent dots on each side; visible on hover in edit mode, invisible in view mode.                          |

### Node types

- **Note:** a sticky note for quick thoughts. It's the first item in the palette and defaults to
  yellow. It comes in five `--color-note-*` fills (yellow, pink, green, blue, purple), stored by
  name in the map so the palette can change later. Rich text (see below) in `--note-text` at
  `--note-font-size`, `--note-padding` inside, `--note-radius` corners and `--note-shadow` like
  paper. Notes stay light in dark mode. In the inspector the colors are round
  `--note-swatch-size` swatches (native radio buttons); the chosen one gets the accent focus ring.
- **Text:** a surface card with border and `--radius-md`, or a note color, or no background.
- **Shape:** SVG shapes with a constant 2px stroke; labels use `--shape-label`, dark in both modes
  because shape fills are light.
- **Image:** fills the node; rounded with `--radius-sm`.
- **Video:** `--video-backdrop` behind the player. Embeds show a thumbnail with a
  `--video-play-bg` play button until clicked.
- **Demo frame:** surface card with `--shadow-raised`. A `--demo-bar-height` title bar
  (`--demo-bar-bg`) with three dots and the title; it's the drag handle in edit mode. The page
  inside is the demo's own and is not styled by Mubu.

### Rich text (text nodes and notes)

One editor (`src/editor/richTextExtensions.ts`) with the same shortcuts everywhere. Double-click a
text node or note to edit; Esc or clicking the canvas finishes.

| Shortcut | Result | Markdown start |
| --- | --- | --- |
| ⌘1 | Display (`--rich-text-display-size`, bold) | `# ` |
| ⌘2 | Headline (`--rich-text-headline-size`, bold) | `## ` |
| ⌘3 | Subheader (`--rich-text-subheader-size`, semibold) | `### ` |
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
| `--color-canvas` | `#f6f6f4` | `#161615` | Page and canvas background. |
| `--color-canvas-dot` | `#d4d4cf` | `#3a3a37` | Dot grid on the canvas. |
| `--color-surface` | `#ffffff` | `#1f1f1e` | Cards, panels, inputs on the canvas. |
| `--color-surface-muted` | `#f0f0ed` | `#2a2a28` | Hover fills, title bars, placeholders. |
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

#### `motion`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--motion-duration-fast` | `120ms` | — | Hover and focus feedback. |
| `--motion-duration-normal` | `200ms` | — | State changes such as toggles. |
| `--motion-easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | — | Default easing for UI transitions. |

#### `size`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--size-toolbar` | `48px` | — | Height of the top bar; the canvas starts below it. |
| `--size-control` | `32px` | — | Default height of buttons and inputs. |
| `--size-control-sm` | `28px` | — | Compact buttons inside panels. |
| `--size-inspector` | `260px` | — | Inspector panel width. |

#### `z`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--z-node-adornment` | `2` | — | Selection tags and handles above node content. |
| `--z-panel` | `5` | — | Palette and inspector. |
| `--z-toolbar` | `6` | — | Top bar. |
| `--z-overlay` | `10` | — | Drop target overlay. |
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
| `--note-padding` | `var(--space-16) → 16px` | follows alias |  |
| `--note-radius` | `var(--radius-xs) → 2px` | follows alias |  |
| `--note-font-size` | `var(--font-size-lg) → 15px` | follows alias |  |
| `--note-shadow` | `0 1px 2px 0 rgb(0 0 0 / 0.08), 0 6px 14px -4px rgb(0 0 0 / 0.1)` | — | Lifts the note off the canvas like paper. |
| `--note-swatch-size` | `24px` | — | Color swatches in the inspector. |

#### `component.rich-text`

| CSS variable | Value | Dark | Use |
| --- | --- | --- | --- |
| `--rich-text-display-size` | `var(--font-size-3xl) → 28px` | follows alias | ⌘1 or # — Display. |
| `--rich-text-headline-size` | `var(--font-size-2xl) → 20px` | follows alias | ⌘2 or ## — Headline. |
| `--rich-text-subheader-size` | `var(--font-size-xl) → 16px` | follows alias | ⌘3 or ### — Subheader. |
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

<!-- tokens:end -->
