# Mubu

A personal infinite canvas for mind maps, notes, media and **live front-end demos**.
You edit locally; everyone else sees a read-only static site.

## Use it

```bash
npm install
npm run dev        # edit mode at http://127.0.0.1:5173
```

- **Add things:** drag from the left palette (Note is first: a yellow sticky with five colors), drop files onto the canvas, or paste an image (PNG, JPG, SVG file, or SVG markup) with ⌘V.
  - Images and SVGs become image nodes. Video files become video nodes.
  - HTML/CSS/JS files dropped together become one **demo**. Use "Upload demo folder" to keep subfolders.
- **Demos** run in a sandboxed iframe and are interactive right away. Drag or select one by its title bar.
- **Canvas:** scroll to pan, pinch or ⌘-scroll to zoom, drag on empty space to box-select, Space + drag to pan.
- **Shortcuts:** ⌘Z / ⇧⌘Z undo/redo, ⌘C / ⌘V copy/paste, ⌘D duplicate, ⌘A select all, Delete removes.
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

| Path                          | What                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| `src/canvas/`                 | React Flow canvas, file drops, shortcuts                                 |
| `src/nodes/`                  | One component per node type (text, shape, image, video, demo)            |
| `src/editor/`                 | Toolbar, palette, inspector, autosave — dev only, left out of the build  |
| `design/tokens.json`          | Design tokens (DTCG): the source of truth for UI values; see `DESIGN.md` |
| `src/store/`                  | Map schema (zod), migrations, zustand store with undo history            |
| `vite-plugin-mubu-content.ts` | Dev-only endpoints that write into `public/content/`                     |

To change the map format, bump `MAP_VERSION` in `src/store/schema.ts` and add a step in
`src/store/migrate.ts` so existing maps keep loading.
