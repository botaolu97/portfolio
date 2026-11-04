import { describe, expect, it } from 'vitest';
import { normalizeAngle } from '../src/nodes/RotateHandle';
import { migrateMap } from '../src/store/migrate';
import { MAP_VERSION } from '../src/store/schema';

describe('note rotation', () => {
  it('wraps angles into -180..180 and rounds to a tenth', () => {
    expect(normalizeAngle(190)).toBe(-170);
    expect(normalizeAngle(-190)).toBe(170);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(12.345)).toBe(12.3);
  });

  it('defaults to straight and rejects out-of-range angles', () => {
    const note = (data: object) => ({
      version: MAP_VERSION,
      title: 'T',
      nodes: [{ id: 'n', type: 'note', position: { x: 0, y: 0 }, data }],
      edges: [],
    });
    expect(migrateMap(note({})).nodes[0].data).toMatchObject({ rotation: 0 });
    expect(migrateMap(note({ rotation: -12 })).nodes[0].data).toMatchObject({ rotation: -12 });
    expect(() => migrateMap(note({ rotation: 200 }))).toThrow();
  });
});
