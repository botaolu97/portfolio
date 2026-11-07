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
 *   POST /__mubu/link            body: { url }          → page title, icon and image (saved as assets)
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
  // Canvases keep a stable order (1..n, top to bottom): existing ones keep their place, new ones go
  // to the bottom (oldest first). Editing a canvas never reorders it.
  const previous: string[] = await readFile(path.join(mapsDir, 'index.json'), 'utf8')
    .then((raw) => (JSON.parse(raw) as { slug: string }[]).map((e) => e.slug))
    .catch(() => []);
  const rank = (slug: string) => {
    const i = previous.indexOf(slug);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  entries.sort((a, b) => rank(a.slug) - rank(b.slug) || a.updatedAt.localeCompare(b.updatedAt));
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

/** Saves bytes as public/content/assets/<hash><ext> (same content, same file) and returns its path. */
export async function saveAsset(assetsDir: string, body: Buffer, ext: string): Promise<string> {
  const clean = ext.toLowerCase().replace(/[^.a-z0-9]/g, '');
  const file = `${createHash('sha256').update(body).digest('hex').slice(0, 16)}${clean}`;
  await mkdir(assetsDir, { recursive: true });
  const target = path.join(assetsDir, file);
  if (!existsSync(target)) await writeFile(target, body);
  return `content/assets/${file}`;
}

/* ---------- Link previews ---------- */

export interface LinkMeta {
  title: string;
  description: string;
  siteName: string;
  /** Absolute URL of the page's preview image (Open Graph / Twitter card), if any. */
  imageUrl?: string;
  /** Absolute icon URLs, best first; /favicon.ico is always the last resort. */
  iconUrls: string[];
}

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  siteName: string;
  image?: string;
  favicon?: string;
}

/** Accepts "example.com/x" or a full URL; returns a normalized http(s) URL or null. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return url.href;
  } catch {
    return null;
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  middot: '·',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of tag.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

const clean = (text: string | undefined, max: number) =>
  (text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Reads title, description, site name, preview image and icons from a page's <head>. */
export function parseLinkMeta(html: string, pageUrl: string): LinkMeta {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd > 0 ? html.slice(0, headEnd) : html;
  const meta: Record<string, string> = {};
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = parseAttributes(tag);
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase();
    if (key && a.content && !(key in meta)) meta[key] = a.content;
  }
  const resolve = (href: string | undefined) => {
    if (!href) return undefined;
    try {
      const url = new URL(href, pageUrl);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
    } catch {
      return undefined;
    }
  };

  const icons: { href: string; rank: number }[] = [];
  for (const [tag] of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = parseAttributes(tag);
    const rel = (a.rel ?? '').toLowerCase().split(/\s+/);
    const href = resolve(a.href);
    if (!href || !rel.some((r) => r === 'icon' || r.startsWith('apple-touch-icon'))) continue;
    // Bigger is better (the fallback card shows it large); SVG scales; apple-touch-icons are 180px.
    const size = Math.max(
      0,
      ...(a.sizes ?? '').split(/\s+/).map((s) => Number.parseInt(s, 10) || 0),
    );
    const rank =
      a.type === 'image/svg+xml' || href.endsWith('.svg')
        ? 1000
        : size || (rel.includes('icon') ? 16 : 180);
    icons.push({ href, rank });
  }
  icons.sort((x, y) => y.rank - x.rank);
  const fallbackIcon = resolve('/favicon.ico');

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  return {
    title: clean(meta['og:title'] ?? meta['twitter:title'] ?? decodeEntities(titleTag ?? ''), 300),
    description: clean(
      meta['og:description'] ?? meta['twitter:description'] ?? meta.description,
      500,
    ),
    siteName: clean(meta['og:site_name'] ?? meta['application-name'], 100),
    imageUrl: resolve(
      meta['og:image:secure_url'] ??
        meta['og:image'] ??
        meta['og:image:url'] ??
        meta['twitter:image'] ??
        meta['twitter:image:src'],
    ),
    iconUrls: [...new Set([...icons.map((i) => i.href), ...(fallbackIcon ? [fallbackIcon] : [])])],
  };
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const IMAGE_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
};

/** GETs a URL with a timeout and a size cap; returns null on any failure. */
async function fetchLimited(url: string, maxBytes: number, accept: string) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'en' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok || !res.body) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > maxBytes) break;
      chunks.push(chunk);
    }
    return {
      url: res.url || url,
      type: (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase(),
      body: Buffer.concat(chunks),
      complete: size <= maxBytes,
    };
  } catch {
    return null;
  }
}

/** Downloads an image into the assets folder; null unless it really is an image. */
async function downloadImage(assetsDir: string, url: string, maxBytes: number) {
  const res = await fetchLimited(
    url,
    maxBytes,
    'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8',
  );
  if (!res?.complete || res.body.length === 0) return null;
  let ext = IMAGE_EXT[res.type];
  // Some servers send icons as octet-stream or text/plain.
  if (
    !ext &&
    /\.ico(\?|$)/i.test(res.url) &&
    res.body.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))
  ) {
    ext = '.ico';
  }
  if (!ext) return null;
  return saveAsset(assetsDir, res.body, ext);
}

/**
 * A screenshot of the page's first screen, for pages with no preview image. Uses the Chromium that
 * Playwright installs for the e2e tests; returns null if it isn't available or the page won't load.
 */
async function screenshot(url: string): Promise<Buffer | null> {
  let browser: { close(): Promise<void> } | undefined;
  try {
    const { chromium } = await import('@playwright/test');
    const b = await chromium.launch();
    browser = b;
    const page = await b.newPage({ viewport: { width: 1280, height: 800 }, userAgent: USER_AGENT });
    // A page that fails to load (no such host, an error status) would screenshot an error page.
    const response = await page
      .goto(url, { waitUntil: 'load', timeout: 15_000 })
      .catch((err) => (/Timeout/i.test(String(err)) ? undefined : null));
    if (response === null || (response && response.status() >= 400)) return null;
    await page.waitForTimeout(800);
    return await page.screenshot({ type: 'jpeg', quality: 80 });
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function fetchLinkPreview(
  assetsDir: string,
  input: string,
  /** Only the title and icon (links inside text): skips the preview image and screenshot. */
  iconOnly = false,
): Promise<LinkPreview> {
  const url = normalizeUrl(input);
  if (!url) throw new HttpError(400, 'Enter a web address (http or https)');
  const page = await fetchLimited(
    url,
    2 * 1024 * 1024,
    'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
  );
  const html = page && /html|xml/.test(page.type) ? page.body.toString('utf8') : '';
  const meta = parseLinkMeta(html, page?.url ?? url);

  let favicon: string | undefined;
  for (const icon of meta.iconUrls.slice(0, 4)) {
    favicon = (await downloadImage(assetsDir, icon, 1024 * 1024)) ?? undefined;
    if (favicon) break;
  }
  let image =
    meta.imageUrl && !iconOnly
      ? ((await downloadImage(assetsDir, meta.imageUrl, 10 * 1024 * 1024)) ?? undefined)
      : undefined;
  if (!image && !iconOnly) {
    const shot = await screenshot(url);
    if (shot) image = await saveAsset(assetsDir, shot, '.jpg');
  }
  return {
    url,
    title: meta.title,
    description: meta.description,
    siteName: meta.siteName,
    image,
    favicon,
  };
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
  '.ico': 'image/x-icon',
};

/**
 * Serves public/content directly instead of through Vite's public-dir handler, which only
 * knows about files that existed (or were watched) at startup and would miss fresh uploads.
 */
/**
 * A tiny script Mubu adds to every demo page (dev server and build). Pinch / ⌘-scroll and
 * ⌘ + = − 0 inside a sandboxed demo would otherwise zoom the whole browser page, and Mubu's
 * page can't see that input. The bridge stops the browser zoom and asks Mubu to zoom the
 * canvas instead (see src/canvas/usePageZoomGuard.ts). It also stops swipes inside the demo from
 * chaining out to the browser's back/forward gesture (overscroll-behavior). It draws nothing.
 */
export const DEMO_BRIDGE = `<script data-mubu-bridge>(() => {
  const send = (msg) => parent.postMessage({ source: 'mubu-demo', ...msg }, '*');
  // Keep swipes inside the demo: no scroll chaining, no browser back/forward swipe.
  const style = document.createElement('style');
  style.textContent = 'html, body { overscroll-behavior: none; }';
  document.head ? document.head.prepend(style) : document.documentElement.prepend(style);
  // Chrome/Firefox report a pinch as ctrl + wheel.
  let lastWheelZoom = -Infinity;
  addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    lastWheelZoom = performance.now();
    send({ type: 'zoom', deltaY: e.deltaY, clientX: e.clientX, clientY: e.clientY });
  }, { passive: false, capture: true });
  // Safari reports it as gesture events (scale since the gesture began); skip if wheel already did.
  let lastScale = 1;
  addEventListener('gesturestart', (e) => { e.preventDefault(); lastScale = 1; }, { passive: false });
  addEventListener('gesturechange', (e) => {
    e.preventDefault();
    const factor = e.scale / lastScale;
    lastScale = e.scale;
    if (performance.now() - lastWheelZoom < 150) return;
    send({ type: 'zoom-scale', factor, clientX: e.clientX, clientY: e.clientY });
  }, { passive: false });
  addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
  addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || !['=', '+', '-', '_', '0'].includes(e.key)) return;
    e.preventDefault();
    send({ type: 'zoom-key', key: e.key });
  }, true);
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
              const src = await saveAsset(dirs.assets, body, path.extname(name));
              return sendJson(res, 200, { src });
            }
            case '/__mubu/demo': {
              const { files } = JSON.parse((await readBody(req)).toString('utf8')) as {
                files: DemoFile[];
              };
              if (!Array.isArray(files)) throw new HttpError(400, 'Expected { files: [] }');
              return sendJson(res, 200, await saveDemo(dirs.demos, files));
            }
            case '/__mubu/link': {
              const { url: link, iconOnly } = JSON.parse(
                (await readBody(req)).toString('utf8'),
              ) as { url?: unknown; iconOnly?: unknown };
              if (typeof link !== 'string') throw new HttpError(400, 'Expected { url }');
              return sendJson(
                res,
                200,
                await fetchLinkPreview(dirs.assets, link, iconOnly === true),
              );
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
