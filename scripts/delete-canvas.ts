/**
 * Deletes a canvas by its exact name (title) or slug, then rebuilds the canvas index.
 *
 *   npm run delete-canvas -- "Exact canvas name"
 *   npm run delete-canvas -- exact-slug
 *
 * The name must match exactly (case and spaces included). Uploaded images, videos and demos stay
 * in public/content, since other canvases may use them; the canvas's snapshots are removed. Commit and push to remove the canvas from
 * the published site.
 */
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { contentPaths, removeThumbs, writeMapIndex } from '../vite-plugin-mubu-content.ts';

export async function deleteCanvas(root: string, name: string) {
  const { maps, thumbs } = contentPaths(root);
  const index = await writeMapIndex(maps);
  const matches = index.filter((m) => m.title === name || m.slug === name);
  if (matches.length === 0) {
    const names = index.map((m) => `  "${m.title}"  (slug: ${m.slug})`).join('\n');
    throw new Error(`No canvas is named exactly "${name}". Canvases:\n${names || '  (none)'}`);
  }
  if (matches.length > 1) {
    const slugs = matches.map((m) => m.slug).join(', ');
    throw new Error(`Several canvases are named "${name}". Use the slug instead: ${slugs}`);
  }
  const [canvas] = matches;
  await rm(path.join(maps, `${canvas.slug}.json`));
  await removeThumbs(thumbs, canvas.slug);
  const remaining = await writeMapIndex(maps);
  return { deleted: canvas, remaining };
}

if (import.meta.main) {
  const name = process.argv.slice(2).join(' ').trim();
  if (!name) {
    console.error('Usage: npm run delete-canvas -- "Exact canvas name"   (or the slug)');
    process.exit(1);
  }
  try {
    const { deleted, remaining } = await deleteCanvas(
      path.resolve(import.meta.dirname, '..'),
      name,
    );
    console.log(`Deleted "${deleted.title}" (public/content/maps/${deleted.slug}.json).`);
    console.log(
      `${remaining.length} canvas(es) left. Commit and push to update the published site.`,
    );
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
