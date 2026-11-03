# Mubu

A personal infinite canvas for mind maps, notes, media and **live front-end demos**.
You edit locally; everyone else sees a read-only static site.

## Use it

```bash
npm install
npm run dev        # edit mode at http://127.0.0.1:5173
```

- **Add things:** drag from the left palette (Note is first: a yellow sticky with five colors), add a **Code** block (syntax highlighting for 16 languages), drop files onto the canvas, or paste an image (PNG, JPG, SVG file, or SVG markup) with ⌘V.
  - Images and SVGs become image nodes. Video files become video nodes.
  - HTML/CSS/JS files dropped together become one **demo**. To keep subfolders, add a Demo from the palette and use "Folder" in the inspector.
- **Demos** run in a sandboxed iframe and are interactive right away. Drag or select one by its title bar.
- **Canvas:** scroll to pan, pinch or ⌘-scroll to zoom, drag on empty space to box-select, Space + drag to pan.
- **Text and notes:** double-click to edit; ⌘1–4 sizes, ⌘T checkboxes, ⌘L bullets, ⇧⌘E highlight, ⌘B/I/U, ⇧⌘X strike, ⌘⌫ clear (full table in `DESIGN.md`).
- **Shortcuts:** ⌘Z undo (no redo), ⌘C / ⌘V copy/paste, ⌘D duplicate, ⌘A select all, Delete removes.
- **Canvases:** the switcher in the bottom-left shows the current canvas; click it to switch, or (in edit mode) to create a new one. The site root opens the welcome canvas.
- **Delete a canvas:** `npm run delete-canvas -- "Exact canvas name"` (or its slug). The name must match exactly; uploaded files stay.
- Changes autosave to `public/content/` (maps, uploaded assets and demos), so everything lives in git.

## Publish

Commit `public/content/` and push to `main`. The `Deploy` workflow lints, tests, builds the
view-only site and deploys it to GitHub Pages. One-time setup: in the repo's
**Settings → Pages**, set **Source** to **GitHub Actions**.

`npm run build && npm run preview` shows the published version locally.

## Develop

```bash
npm run tokens     # regenerate src/ui/tokens.css (+ .ts, DESIGN.md tables) from design/tokens.json
npm run check      # lint + typecheck + unit tests + build
npm run e2e        # Playwright: edit mode (dev server) and view mode (preview build)
```

| Path                          | What                                                                        |
| ----------------------------- | --------------------------------------------------------------------------- |
| `src/canvas/`                 | React Flow canvas, file drops, shortcuts                                    |
| `src/nodes/`                  | One component per node type (text, shape, image, video, demo)               |
| `src/editor/`                 | Palette, inspector, autosave, highlighter — dev only, left out of the build |
| `design/tokens.json`          | Design tokens (DTCG): the source of truth for UI values; see `DESIGN.md`    |
| `src/store/`                  | Map schema (zod), migrations, zustand store with undo history               |
| `vite-plugin-mubu-content.ts` | Dev-only endpoints that write into `public/content/`                        |

To change the map format, bump `MAP_VERSION` in `src/store/schema.ts` and add a step in
`src/store/migrate.ts` so existing maps keep loading.
