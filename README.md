# Portfolio workspace

A local editor for a portfolio published as read-only snapshots through Git/GitHub.

## Current milestone: foundation

The sidebar and main area support creating, opening, renaming, and deleting mood-board and document files. File records survive reloads in IndexedDB. Canvas and document surfaces are explicitly marked placeholders: content editing is the next milestone.

The previous static portfolio has been removed from this branch as requested. It remains recoverable in the repository history.

## Run locally

Requires Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Keep this origin and port consistent: browser drafts are scoped to the origin. Clearing site data, changing browser profiles, or switching devices will not preserve those drafts. Backup/import arrives before content editing is relied on for important work.

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`npm run build` writes a foundation preview to `dist/`. It is currently an editor preview, **not** the public viewer. No deployment workflow is included yet.

## Module boundaries

- `src/files`: shared file types, validation, repository interface, and workspace operations.
- `src/persistence`: IndexedDB adapter; UI components do not access the database directly.
- `src/navigation`: sidebar and file navigation.
- `src/app`: routing, overview, and file-management dialogs.
- `src/editors`: lazy-loaded surfaces, ready for the board and document features.
- `src/ui`: reusable primitives and visual tokens, with component-scoped CSS Modules.

File URLs use `#/files/<stable-id>` for static hosting compatibility. A local draft URL is meaningful only in the browser where that draft exists; public URLs arrive with snapshots. IDs remain unchanged by renaming, and names may repeat. Schema version 1 reserves separate board and document content formats; editor milestones will refine those schemas.

## Git workflow

Work on feature branches and review each milestone before merging. GitHub Actions runs type checks, persistence tests, a production build, and browser tests. No app action commits or pushes automatically.

## Next milestones

1. Review the foundation and its navigation/file lifecycle.
2. Mood-board editing using React Flow, including images, connections, and undo/redo.
3. Tiptap document editing, robust autosave, asset storage, and draft backup/import.
4. Snapshot selection and a localhost-only Node helper writing a versioned `portfolio/` manifest, file JSON, and content-addressed uploads. Validate and stage snapshots before replacing the previous one. Leave external links as URLs.
5. A separate read-only public build, snapshot restoration, Figma alignment, performance measurement, and GitHub Pages deployment from committed snapshots.

The public build must exclude local persistence, edit controls, and the snapshot helper. No cloud sync, accounts, or comments are planned for this version. Local drafts must not become public until explicitly included in a prepared snapshot.
