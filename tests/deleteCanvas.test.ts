import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteCanvas } from '../scripts/delete-canvas';

describe('deleteCanvas', () => {
  let root: string;
  const maps = () => path.join(root, 'public', 'content', 'maps');
  const write = (slug: string, title: string) =>
    writeFile(path.join(maps(), `${slug}.json`), JSON.stringify({ title }));

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'mubu-delete-'));
    await mkdir(maps(), { recursive: true });
    await write('roadmap', 'Roadmap');
    await write('ideas', 'Ideas');
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  it('deletes by exact title and updates the index', async () => {
    const { deleted, remaining } = await deleteCanvas(root, 'Roadmap');
    expect(deleted.slug).toBe('roadmap');
    expect(existsSync(path.join(maps(), 'roadmap.json'))).toBe(false);
    expect(remaining.map((m) => m.slug)).toEqual(['ideas']);
  });

  it('deletes by slug', async () => {
    await deleteCanvas(root, 'ideas');
    expect(existsSync(path.join(maps(), 'ideas.json'))).toBe(false);
  });

  it('refuses names that are not an exact match', async () => {
    await expect(deleteCanvas(root, 'roadmap ')).rejects.toThrow(/No canvas is named exactly/);
    await expect(deleteCanvas(root, 'ROADMAP')).rejects.toThrow(/"Roadmap"/);
    expect(existsSync(path.join(maps(), 'roadmap.json'))).toBe(true);
  });

  it('asks for the slug when two canvases share a title', async () => {
    await write('roadmap-2', 'Roadmap');
    await expect(deleteCanvas(root, 'Roadmap')).rejects.toThrow(
      /roadmap, roadmap-2|roadmap-2, roadmap/,
    );
  });
});
