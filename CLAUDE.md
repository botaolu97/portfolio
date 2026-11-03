# Mubu

Personal canvas editor for maps and live front-end demos. See `README.md` for commands and
layout, and `DESIGN.md` before changing any UI.

## Rules

- **Push canvas content with design and code changes.** Whenever you commit and push design or
  code changes, also include everything new or changed under `public/content/` (maps, uploaded
  assets, demos), so the published site matches what's on the local canvas. Don't leave map edits
  behind as separate, uncommitted changes. Before committing, check them for anything that looks
  sensitive or accidental (for example personal documents or IDs in uploaded images) and ask
  first if something does.
- Design values come from `design/tokens.json`; run `npm run tokens` after editing it and never
  hand-edit `src/ui/tokens.css`, `src/ui/tokens.ts` or the generated tables in `DESIGN.md`.
- Demos keep their own styles; Mubu tokens never apply inside them.
- Deploys happen by pushing to `main` (the Deploy workflow builds the view-only site for GitHub
  Pages). Push from the user's terminal; this shell has no GitHub credentials.
