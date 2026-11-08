/**
 * Snapshot mode (`?snapshot` in the address, before the #): the dev server opens canvases this way in
 * a headless browser to take the pictures shown in the canvas panel. Only the canvas is drawn, at
 * its saved view, with no editor, panel or controls, and nothing is saved.
 */
export const SNAPSHOT = new URLSearchParams(window.location.search).has('snapshot');
