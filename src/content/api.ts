import { migrateMap } from '../store/migrate';
import {
  type MapDoc,
  type MapIndexEntry,
  mapIndexEntry,
  type Profile,
  profile,
} from '../store/schema';

/** Edit mode exists only on the local dev server; the published build is read-only. */
export const EDITABLE = import.meta.env.DEV;

/** Resolves a stored content path (e.g. "content/assets/x.png") against the deploy base. */
export function asset(src: string): string {
  if (!src || /^(https?:|data:|blob:)/.test(src)) return src;
  return `${import.meta.env.BASE_URL}${src.replace(/^\//, '')}`;
}

async function getJson(url: string): Promise<unknown> {
  // Always revalidate so a fresh deploy (or a local save) shows up on reload.
  const res = await fetch(asset(url), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} loading ${url}`);
  return res.json();
}

export async function fetchMapIndex(): Promise<MapIndexEntry[]> {
  try {
    return mapIndexEntry.array().parse(await getJson('content/maps/index.json'));
  } catch {
    return [];
  }
}

/** The panel's name and intro; null if there's none yet (the panel then shows its defaults). */
export async function fetchProfile(): Promise<Profile | null> {
  try {
    return profile.parse(await getJson('content/profile.json'));
  } catch {
    return null;
  }
}

/** Edit mode: writes content/profile.json. */
export const saveProfile = (next: Profile) => post<Profile>('profile', JSON.stringify(next));

export async function fetchMap(slug: string): Promise<MapDoc> {
  return migrateMap(await getJson(`content/maps/${slug}.json`));
}

async function post<T>(endpoint: string, body: BodyInit, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(
    `${import.meta.env.BASE_URL}__mubu/${endpoint}${query ? `?${query}` : ''}`,
    {
      method: 'POST',
      body,
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export const saveMap = (slug: string, doc: MapDoc) =>
  post<MapIndexEntry[]>('save', JSON.stringify(doc), { slug });

export const deleteMap = (slug: string) => post<MapIndexEntry[]>('delete', '', { slug });

export const uploadFile = (file: File) =>
  post<{ src: string }>('upload', file, { name: file.name });

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Uploads demo files; a folder picker's webkitRelativePath keeps subfolders intact. */
export async function uploadDemo(files: File[]) {
  const payload = await Promise.all(
    files.map(async (f) => ({
      path: f.webkitRelativePath || f.name,
      data: toBase64(await f.arrayBuffer()),
    })),
  );
  return post<{ demoId: string; entry: string }>('demo', JSON.stringify({ files: payload }));
}

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  siteName: string;
  image?: string;
  favicon?: string;
}

/** Edit mode: the dev server reads the page and saves its image and icon as assets. */
/** Edit mode: puts the canvases in this order (the first is where visitors start). */
export const reorderMaps = (slugs: string[]) =>
  post<MapIndexEntry[]>('order', JSON.stringify({ slugs }));

/** Edit mode: the dev server pictures the canvas at its saved view (for the canvas panel). */
export const captureSnapshot = (slug: string, size: { width: number; height: number }) =>
  post<MapIndexEntry[]>('thumb', JSON.stringify(size), { slug });

/** A canvas's snapshot for a theme, cache-busted by when it was taken; undefined if it has none. */
export const snapshotUrl = (entry: MapIndexEntry, theme: 'light' | 'dark') =>
  entry.thumbAt ? asset(`content/thumbs/${entry.slug}-${theme}.jpg?v=${entry.thumbAt}`) : undefined;

export const fetchLinkPreview = (url: string, options: { iconOnly?: boolean } = {}) =>
  post<LinkPreview>('link', JSON.stringify({ url, ...options }));
