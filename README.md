# Mubu

A personal infinite canvas for mind maps, notes, media and **live front-end demos**.
You edit locally; everyone else sees a read-only static site.

## Use it

```bash
npm install
npm run dev        # edit mode at http://127.0.0.1:5173
npm start          # both: editor (5173) and the view-only preview (4173); Ctrl-C stops both
```

- **Add things:** drag from the left palette (a **Label** is transparent text in Fasthand and other fonts; Note is first: a yellow sticky with five colors), add a **Code** block (syntax highlighting for 17 languages, MATLAB included), drop files onto the canvas, or paste an image (PNG, JPG, SVG file, or SVG markup) with ⌘V.
  - Images and SVGs become image nodes. Video files become video nodes.
  - HTML/CSS/JS files dropped together become one **demo**. To keep subfolders, add a Demo from the palette and use "Folder" in the inspector.
- **Web pages:** add a **Web page** from the palette and paste a link on the card (or in the inspector). The editor fetches the page's title, icon and share image (or a screenshot) once and saves them with the canvas (or choose your own preview image in the inspector); visitors click the card to open the page in a new tab. In the editor, ↗ opens it and double-click changes the address.
- **Demos** run in a sandboxed iframe and are interactive right away. Drag or select one by its title bar.
- **Canvas:** scroll to pan, pinch or ⌘-scroll to zoom, drag on empty space to box-select, Space + drag to pan, Shift- or ⌘-click to add to a selection.
- **Links in text:** type or paste a web address; it turns into the page's icon and title, and opens in a new tab.
- **Text and notes:** double-click to edit; ⌘1–4 sizes, ⌘T checkboxes, ⌘L bullets, ⇧⌘E highlight, ⌘B/I/U, ⇧⌘X strike, ⌘⌫ clear, Tab / ⇧Tab indent (full table in `DESIGN.md`).
- **Shortcuts:** ⌘Z undo (no redo), ⌘C / ⌘V copy/paste, ⌘D duplicate, ⌘A select all, Delete removes.
- **Connectors:** select one to set its style, animation, arrow direction (end, start, both, none, or Flip), colors (light and dark), thickness and label size; "Apply to all connectors" gives every connector on the canvas, and every new one, that look.
- **Canvases:** the panel on the left lists every canvas as a snapshot of where you last left it; click one to switch, or (in edit mode) "+ New canvas"; double-click a name to rename it; drag canvases (or Alt+↑/↓) to reorder them. The tab on the panel's edge tucks it away to a sliver and brings it back. The first canvas is the one visitors land on. Each canvas reopens at its last view, for visitors too. Snapshots are taken automatically by the dev server after you edit (into `public/content/thumbs/`, committed with the rest).
- **Delete a canvas:** `npm run delete-canvas -- "Exact canvas name"` (or its slug). The name must match exactly; uploaded files stay.
- Changes autosave to `public/content/` (maps, uploaded assets and demos), so everything lives in git.

## Videos

Big screen recordings (100 MB+) are too heavy to commit; compress them first (macOS, no ffmpeg needed):

1. Put the videos (mp4, mov or m4v) in `videos/` at the repo root. The folder is git-ignored.
2. Run `npm run encode-videos`. Each one is written to `videos/encoded/<name>.mp4`: H.264 at about
   1.7 Mbps for a 1080p recording (scaled with the picture size), at most 1920px wide, AAC audio,
   and fast start so it plays before it has fully downloaded. Videos already encoded are skipped.
3. Upload the encoded file through a Video node's inspector (or drop it on the canvas).

Options: `--kbps 2500` for sharper (bigger) files, `--max-width 1280` for smaller ones, `--force` to
encode again. A 109 MB, 88-second recording came out at 19 MB with text that looks the same at
100%. For long walkthroughs, an unlisted YouTube or Vimeo link is lighter still.

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
| `src/nodes/`                  | One component per node type (text, shape, image, video, demo, web page)     |
| `src/editor/`                 | Palette, inspector, autosave, highlighter — dev only, left out of the build |
| `design/tokens.json`          | Design tokens (DTCG): the source of truth for UI values; see `DESIGN.md`    |
| `src/store/`                  | Map schema (zod), migrations, zustand store with undo history               |
| `vite-plugin-mubu-content.ts` | Dev-only endpoints that write into `public/content/`                        |

To change the map format, bump `MAP_VERSION` in `src/store/schema.ts` and add a step in
`src/store/migrate.ts` so existing maps keep loading.
