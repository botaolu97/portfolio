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
      data: { html: '', color: 'yellow' },
    });
    expect(() =>
      migrateMap({ ...valid, nodes: [{ ...note, data: { color: 'orange' } }] }),
    ).toThrow();
  });

  it('migrates v1 plain-text notes to rich text', () => {
    const v1 = {
      version: 1,
      title: 'Old',
      nodes: [
        {
          id: 'n',
          type: 'note',
          position: { x: 0, y: 0 },
          data: { text: 'Buy milk\n\n<b>&', color: 'pink' },
        },
      ],
      edges: [],
    };
    const doc = migrateMap(v1);
    expect(doc.version).toBe(MAP_VERSION);
    expect(doc.nodes[0].data).toEqual({
      html: '<p>Buy milk</p><p></p><p>&lt;b&gt;&amp;</p>',
      color: 'pink',
      size: 'md',
      rotation: 0,
    });
  });

  it('fills code block defaults', () => {
    const code = { id: 'c', type: 'code', position: { x: 0, y: 0 }, data: { code: 'x = 1' } };
    expect(migrateMap({ ...valid, nodes: [code] }).nodes[0].data).toEqual({
      code: 'x = 1',
      language: 'typescript',
      title: '',
      lineNumbers: true,
      wrap: true,
      html: '',
    });
  });

  it('requires at least two images in a stack', () => {
    const item = { id: 'i', src: 'x.png', width: 10, height: 10 };
    const stack = (items: unknown[]) => ({
      ...valid,
      nodes: [{ id: 's', type: 'stack', position: { x: 0, y: 0 }, data: { items } }],
    });
    expect(migrateMap(stack([item, { ...item, id: 'j' }])).nodes[0].data).toMatchObject({
      edges: [],
    });
    expect(() => migrateMap(stack([item]))).toThrow();
  });

  it('gives text nodes and notes a medium text size by default, and rejects unknown sizes', () => {
    const text = { id: 't', type: 'text', position: { x: 0, y: 0 }, data: { html: '<p>x</p>' } };
    const note = { id: 'n', type: 'note', position: { x: 0, y: 0 }, data: { size: 'xl' } };
    const doc = migrateMap({ ...valid, nodes: [text, note] });
    expect(doc.nodes.map((n) => (n.data as { size: string }).size)).toEqual(['md', 'xl']);
    expect(() => migrateMap({ ...valid, nodes: [{ ...note, data: { size: 'huge' } }] })).toThrow();
  });

  it('defaults labels to Fasthand at 32px regular, and validates font, size and weight', () => {
    const label = (data: object) => ({
      ...valid,
      nodes: [{ id: 'l', type: 'label', position: { x: 0, y: 0 }, data }],
    });
    expect(migrateMap(label({ text: 'Hi' })).nodes[0].data).toEqual({
      text: 'Hi',
      font: 'fasthand',
      size: 32,
      weight: 400,
    });
    expect(() => migrateMap(label({ font: 'comic' }))).toThrow();
    expect(() => migrateMap(label({ size: 500 }))).toThrow();
    expect(() => migrateMap(label({ weight: 450 }))).toThrow();
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
