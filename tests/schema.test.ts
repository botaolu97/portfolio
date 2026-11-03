import { describe, expect, it } from 'vitest';
import { migrateMap } from '../src/store/migrate';
import { MAP_VERSION, slugify } from '../src/store/schema';

const valid = {
  version: MAP_VERSION,
  title: 'Test',
  nodes: [
    {
      id: 'a',
      type: 'shape',
      position: { x: 0, y: 0 },
      data: { shape: 'ellipse', fill: '#fff', stroke: '#000' },
    },
    {
      id: 'b',
      type: 'demo',
      position: { x: 10, y: 10 },
      data: { demoId: 'd-1234' },
    },
  ],
  edges: [{ id: 'e', source: 'a', target: 'b' }],
};

describe('migrateMap', () => {
  it('parses a valid document and fills defaults', () => {
    const doc = migrateMap(valid);
    expect(doc.nodes[0]).toMatchObject({ type: 'shape', data: { label: '' } });
    expect(doc.nodes[1]).toMatchObject({
      data: { entry: 'index.html', device: 'desktop', title: 'Demo' },
    });
  });

  it('defaults a note to yellow and rejects unknown colors', () => {
    const note = { id: 'n', type: 'note', position: { x: 0, y: 0 }, data: {} };
    expect(migrateMap({ ...valid, nodes: [note] }).nodes[0]).toMatchObject({
      data: { text: '', color: 'yellow' },
    });
    expect(() =>
      migrateMap({ ...valid, nodes: [{ ...note, data: { color: 'orange' } }] }),
    ).toThrow();
  });

  it('rejects unknown node types', () => {
    expect(() =>
      migrateMap({ ...valid, nodes: [{ id: 'x', type: 'blob', position: { x: 0, y: 0 } }] }),
    ).toThrow();
  });

  it('rejects documents from a newer app version', () => {
    expect(() => migrateMap({ ...valid, version: MAP_VERSION + 1 })).toThrow(/newer/);
  });

  it('rejects demo ids that could escape the demos folder', () => {
    const bad = structuredClone(valid);
    bad.nodes[1].data = { demoId: '../secrets' } as never;
    expect(() => migrateMap(bad)).toThrow();
  });
});

describe('slugify', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify('Design System — v2!')).toBe('design-system-v2');
    expect(slugify('   ')).toBe('untitled');
  });
});
