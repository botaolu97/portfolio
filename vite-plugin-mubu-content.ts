import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Local editing backend for Mubu. Only runs under `vite dev`:
 *   POST /__mubu/save?slug=…     body: map JSON         → public/content/maps/<slug>.json
 *   POST /__mubu/delete?slug=…                          → removes that map
 *   POST /__mubu/upload?name=…   body: raw file bytes   → public/content/assets/<hash>.<ext>
 *   POST /__mubu/demo            body: { files }        → public/content/demos/<id>/…
 * The production build is a static site that only reads public/content.
 */

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_BODY = 200 * 1024 * 1024;

export interface DemoFile {
  /** Path relative to the demo root, e.g. "index.html" or "js/app.js". */
  path: string;
  /** Base64 file contents. */
  data: string;
}

export function contentPaths(root: string) {
  const content = path.join(root, 'public', 'content');
  return {
    content,
    maps: path.join(content, 'maps'),
    assets: path.join(content, 'assets'),
    demos: path.join(content, 'demos'),
  };
}

/** Normalizes an uploaded relative path; returns null for anything that could escape the folder. */
export function safeRelativePath(input: string): string | null {
  const parts = input.replaceAll('\\', '/').split('/').filter(Boolean);
  if (parts.length === 0) return null;
  for (const part of parts) {
    if (part === '.' || part === '..' || !/^[\w.@ -]+$/.test(part)) return null;
  }
  return parts.join('/');
}

/** Drops a folder name shared by every file (what a directory picker adds). */
export function stripCommonRoot(paths: string[]): string[] {
  const first = paths[0]?.split('/');
  if (!first || first.length < 2 || paths.some((p) => !p.startsWith(`${first[0]}/`))) return paths;
  return paths.map((p) => p.slice(first[0].length + 1));
}

/** Picks the page to load, generating an index.html when only CSS/JS was uploaded. */
export function resolveDemoEntry(paths: string[]): { entry: string; generated?: string } {
  if (paths.includes('index.html')) return { entry: 'index.html' };
  const html = paths.find((p) => p.endsWith('.html'));
  if (html) return { entry: html };
  const css = paths.filter((p) => p.endsWith('.css'));
  const js = paths.filter((p) => p.endsWith('.js') || p.endsWith('.mjs'));
  const generated = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    ...css.map((p) => `<link rel="stylesheet" href="${p}" />`),
    '</head><body>',
    ...js.map((p) => `<script src="${p}"></script>`),
    '</body></html>',
  ].join('\n');
  return { entry: 'index.html', generated };
}

export async function writeMapIndex(mapsDir: string) {
  await mkdir(mapsDir, { recursive: true });
  const files = (await readdir(mapsDir)).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const entries = await Promise.all(
    files.map(async (file) => {
      const full = path.join(mapsDir, file);
      const [raw, info] = await Promise.all([readFile(full, 'utf8'), stat(full)]);
      let title = file.replace(/\.json$/, '');
      try {
        title = JSON.parse(raw).title || title;
      } catch {
        // Keep the filename as the title for a malformed file.
      }
      return { slug: file.replace(/\.json$/, ''), title, updatedAt: info.mtime.toISOString() };
    }),
  );
  entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  await writeFile(path.join(mapsDir, 'index.json'), `${JSON.stringify(entries, null, 2)}\n`);
  return entries;
}

export async function saveDemo(demosDir: string, files: DemoFile[]) {
  const cleaned = files.map((f) => ({ ...f, path: safeRelativePath(f.path) }));
  if (cleaned.length === 0 || cleaned.some((f) => f.path === null)) {
    throw new HttpError(400, 'Invalid demo file path');
  }
  const paths = stripCommonRoot(cleaned.map((f) => f.path as string));
  const demoId = `d-${randomBytes(4).toString('hex')}`;
  const dir = path.join(demosDir, demoId);
  await Promise.all(
    paths.map(async (rel, i) => {
      const target = path.join(dir, rel);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(cleaned[i].data, 'base64'));
    }),
  );
  const { entry, generated } = resolveDemoEntry(paths);
  if (generated) await writeFile(path.join(dir, entry), generated);
  return { demoId, entry };
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Upload too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.ogv': 'video/ogg',
  '.woff2': 'font/woff2',
};

/**
 * Serves public/content directly instead of through Vite's public-dir handler, which only
 * knows about files that existed (or were watched) at startup and would miss fresh uploads.
 */
/**
 * A tiny script Mubu adds to every demo page (dev server and build). Pinch / ⌘-scroll and
 * ⌘ + = − 0 inside a sandboxed demo would otherwise zoom the whole browser page, and Mubu's
 * page can't see that input. The bridge stops the browser zoom and asks Mubu to zoom the
 * canvas instead (see src/canvas/usePageZoomGuard.ts). It draws nothing and touches no styles.
 */
export const DEMO_BRIDGE = `<script data-mubu-bridge>(() => {
  const send = (msg) => parent.postMessage({ source: 'mubu-demo', ...msg }, '*');
  addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    send({ type: 'zoom', deltaY: e.deltaY, clientX: e.clientX, clientY: e.clientY });
  }, { passive: false, capture: true });
  addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || !['=', '+', '-', '_', '0'].includes(e.key)) return;
    e.preventDefault();
    send({ type: 'zoom-key', key: e.key });
  }, true);
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
})();</script>`;

/** Adds the bridge once, at the start of <head> (or of the document if it has none). */
export function injectDemoBridge(html: string): string {
  if (html.includes('data-mubu-bridge')) return html;
  const head = /<head[^>]*>/i.exec(html);
  if (head) return html.replace(head[0], `${head[0]}${DEMO_BRIDGE}`);
  return `${DEMO_BRIDGE}${html}`;
}

/** Injects the bridge into every HTML file under `dir` (the built demos folder). */
export async function injectDemoBridgeInto(dir: string): Promise<number> {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of await readdir(dir, { recursive: true })) {
    if (!/\.html?$/i.test(entry)) continue;
    const file = path.join(dir, entry);
    const html = await readFile(file, 'utf8');
    const injected = injectDemoBridge(html);
    if (injected !== html) {
      await writeFile(file, injected);
      count += 1;
    }
  }
  return count;
}

async function serveContent(root: string, rel: string, res: ServerResponse, next: () => void) {
  const safe = safeRelativePath(decodeURIComponent(rel));
  const file = safe && path.join(root, safe);
  const info = file ? await stat(file).catch(() => null) : null;
  if (!file || !info?.isFile()) return next();
  res.setHeader(
    'Content-Type',
    MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
  );
  res.setHeader('Content-Length', info.size);
  res.setHeader('Cache-Control', 'no-cache');
  // Sandboxed demos have an opaque origin, so module scripts need CORS (GitHub Pages sends this too).
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (safe.startsWith('demos/') && /\.html?$/i.test(file)) {
    const html = injectDemoBridge(await readFile(file, 'utf8'));
    res.setHeader('Content-Length', Buffer.byteLength(html));
    return res.end(html);
  }
  createReadStream(file).pipe(res);
}

function requireSlug(url: URL) {
  const slug = url.searchParams.get('slug') ?? '';
  if (!SLUG_RE.test(slug)) throw new HttpError(400, 'Invalid slug');
  return slug;
}

export function mubuContent(): Plugin {
  let dirs: ReturnType<typeof contentPaths>;
  let outDir: string;

  return {
    name: 'mubu-content',
    configResolved(config) {
      dirs = contentPaths(config.root);
      outDir = config.command === 'build' ? path.resolve(config.root, config.build.outDir) : '';
    },
    async closeBundle() {
      // Vite has copied public/ into the output by now; add the bridge to the built demos.
      if (outDir) await injectDemoBridgeInto(path.join(outDir, 'content', 'demos'));
    },
    async buildStart() {
      await writeMapIndex(dirs.maps);
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const base = server.config.base.replace(/\/$/, '');
        const pathname = url.pathname.startsWith(base)
          ? url.pathname.slice(base.length)
          : url.pathname;

        if (pathname.startsWith('/content/') && req.method === 'GET') {
          return serveContent(dirs.content, pathname.slice('/content/'.length), res, next);
        }
        if (!pathname.startsWith('/__mubu/')) return next();
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });

        try {
          switch (pathname) {
            case '/__mubu/save': {
              const slug = requireSlug(url);
              const doc = JSON.parse((await readBody(req)).toString('utf8'));
              await mkdir(dirs.maps, { recursive: true });
              await writeFile(
                path.join(dirs.maps, `${slug}.json`),
                `${JSON.stringify(doc, null, 2)}\n`,
              );
              return sendJson(res, 200, await writeMapIndex(dirs.maps));
            }
            case '/__mubu/delete': {
              const slug = requireSlug(url);
              await rm(path.join(dirs.maps, `${slug}.json`), { force: true });
              return sendJson(res, 200, await writeMapIndex(dirs.maps));
            }
            case '/__mubu/upload': {
              const name = safeRelativePath(url.searchParams.get('name') ?? '');
              if (!name) throw new HttpError(400, 'Invalid file name');
              const body = await readBody(req);
              const ext = path
                .extname(name)
                .toLowerCase()
                .replace(/[^.a-z0-9]/g, '');
              const file = `${createHash('sha256').update(body).digest('hex').slice(0, 16)}${ext}`;
              await mkdir(dirs.assets, { recursive: true });
              const target = path.join(dirs.assets, file);
              if (!existsSync(target)) await writeFile(target, body);
              return sendJson(res, 200, { src: `content/assets/${file}` });
            }
            case '/__mubu/demo': {
              const { files } = JSON.parse((await readBody(req)).toString('utf8')) as {
                files: DemoFile[];
              };
              if (!Array.isArray(files)) throw new HttpError(400, 'Expected { files: [] }');
              return sendJson(res, 200, await saveDemo(dirs.demos, files));
            }
            default:
              return sendJson(res, 404, { error: 'Unknown endpoint' });
          }
        } catch (error) {
          const status = error instanceof HttpError ? error.status : 500;
          return sendJson(res, status, { error: (error as Error).message });
        }
      });
    },
  };
}
