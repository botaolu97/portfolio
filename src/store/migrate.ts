import { MAP_VERSION, type MapDoc, mapDoc } from './schema';

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * migrations[n] upgrades a version-n document to version n+1.
 * When the schema changes: bump MAP_VERSION and add the step here.
 */
const migrations: Record<number, Migration> = {};

export function migrateMap(input: unknown): MapDoc {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Map file is not an object');
  }
  let raw = input as Record<string, unknown>;
  let version = typeof raw.version === 'number' ? raw.version : 0;
  if (version > MAP_VERSION) {
    throw new Error(`Map version ${version} is newer than this app (${MAP_VERSION})`);
  }
  while (version < MAP_VERSION) {
    const step = migrations[version];
    if (!step) throw new Error(`No migration from map version ${version}`);
    raw = { ...step(raw), version: version + 1 };
    version += 1;
  }
  return mapDoc.parse(raw);
}
