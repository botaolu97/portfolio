import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEMO_BRIDGE,
  decodeEntities,
  injectDemoBridge,
  injectDemoBridgeInto,
  normalizeUrl,
  parseLinkMeta,
  resolveDemoEntry,
  safeRelativePath,
  saveDemo,
  stripCommonRoot,
  writeMapIndex,
} from '../vite-plugin-mubu-content';

describe('safeRelativePath', () => {
  it('accepts normal relative paths', () => {
    expect(safeRelativePath('js/app.js')).toBe('js/app.js');
    expect(safeRelativePath('folder\\style.css')).toBe('folder/style.css');
  });

  it('rejects traversal and odd characters', () => {
    expect(safeRelativePath('../etc/passwd')).toBeNull();
    expect(safeRelativePath('a/../../b')).toBeNull();
    expect(safeRelativePath('')).toBeNull();
    expect(safeRelativePath('bad<name>.js')).toBeNull();
  });
});

describe('demo helpers', () => {
  it('strips a folder shared by every file', () => {
    expect(stripCommonRoot(['demo/index.html', 'demo/js/app.js'])).toEqual([
      'index.html',
      'js/app.js',
    ]);
    expect(stripCommonRoot(['index.html', 'demo/app.js'])).toEqual(['index.html', 'demo/app.js']);
  });

  it('prefers index.html, then any html, then generates one', () => {
    expect(resolveDemoEntry(['a.html', 'index.html'])).toEqual({ entry: 'index.html' });
    expect(resolveDemoEntry(['page.html', 'x.css'])).toEqual({ entry: 'page.html' });
    const generated = resolveDemoEntry(['style.css', 'app.js']);
    expect(generated.entry).toBe('index.html');
    expect(generated.generated).toContain('href="style.css"');
    expect(generated.generated).toContain('src="app.js"');
  });
});

describe('content writes', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mubu-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('saves demo files under a fresh id', async () => {
    const b64 = (s: string) => Buffer.from(s).toString('base64');
    const { demoId, entry } = await saveDemo(dir, [
      { path: 'card/style.css', data: b64('body{}') },
      { path: 'card/app.js', data: b64('console.log(1)') },
    ]);
    expect(demoId).toMatch(/^d-[0-9a-f]{8}$/);
    expect(entry).toBe('index.html');
    expect(await readFile(path.join(dir, demoId, 'style.css'), 'utf8')).toBe('body{}');
    expect(await readFile(path.join(dir, demoId, 'index.html'), 'utf8')).toContain('app.js');
  });

  it('refuses demo paths that escape the folder', async () => {
    await expect(saveDemo(dir, [{ path: '../x.js', data: '' }])).rejects.toThrow();
  });

  it('keeps canvases in a stable order, adding new ones at the bottom', async () => {
    await writeFile(path.join(dir, 'b.json'), JSON.stringify({ title: 'B' }));
    await writeFile(path.join(dir, 'a.json'), JSON.stringify({ title: 'A' }));
    await writeFile(
      path.join(dir, 'index.json'),
      JSON.stringify([{ slug: 'b' }, { slug: 'a' }, { slug: 'gone' }]),
    );
    expect((await writeMapIndex(dir)).map((e) => e.slug)).toEqual(['b', 'a']);
    await new Promise((r) => setTimeout(r, 10));
    await writeFile(path.join(dir, 'c.json'), JSON.stringify({ title: 'C' }));
    await writeFile(path.join(dir, 'a.json'), JSON.stringify({ title: 'A edited' }));
    expect((await writeMapIndex(dir)).map((e) => e.slug)).toEqual(['b', 'a', 'c']);
  });

  it('indexes maps by title', async () => {
    await writeFile(path.join(dir, 'one.json'), JSON.stringify({ title: 'First' }));
    await writeFile(path.join(dir, 'broken.json'), '{');
    const entries = await writeMapIndex(dir);
    expect(entries.map((e) => [e.slug, e.title]).sort()).toEqual([
      ['broken', 'broken'],
      ['one', 'First'],
    ]);
    expect(JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8'))).toHaveLength(2);
  });
});

describe('demo bridge', () => {
  it('goes at the start of <head>, once', () => {
    const html = '<!doctype html><html><head><title>x</title></head><body></body></html>';
    const once = injectDemoBridge(html);
    expect(once.indexOf('data-mubu-bridge')).toBeGreaterThan(once.indexOf('<head>'));
    expect(once.indexOf('data-mubu-bridge')).toBeLessThan(once.indexOf('<title>'));
    expect(injectDemoBridge(once)).toBe(once);
  });

  it('contains swipes and forwards both pinch styles', () => {
    expect(DEMO_BRIDGE).toContain('overscroll-behavior: none');
    expect(DEMO_BRIDGE).toContain("type: 'zoom'");
    expect(DEMO_BRIDGE).toContain("type: 'zoom-scale'");
    expect(DEMO_BRIDGE).toContain("addEventListener('gesturechange'");
  });

  it('is prepended to pages without a <head>', () => {
    expect(injectDemoBridge('<button>Hi</button>')).toMatch(
      /^<script data-mubu-bridge>[\s\S]*<button>Hi<\/button>$/,
    );
  });

  it('is added to every built demo page', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mubu-demos-'));
    await mkdir(path.join(dir, 'd-1', 'pages'), { recursive: true });
    await writeFile(path.join(dir, 'd-1', 'index.html'), '<head></head>');
    await writeFile(path.join(dir, 'd-1', 'pages', 'two.html'), '<p>two</p>');
    await writeFile(path.join(dir, 'd-1', 'app.js'), 'console.log(1)');
    expect(await injectDemoBridgeInto(dir)).toBe(2);
    expect(await readFile(path.join(dir, 'd-1', 'pages', 'two.html'), 'utf8')).toContain(
      'data-mubu-bridge',
    );
    expect(await readFile(path.join(dir, 'd-1', 'app.js'), 'utf8')).toBe('console.log(1)');
    expect(await injectDemoBridgeInto(dir)).toBe(0);
    await rm(dir, { recursive: true, force: true });
  });
});

describe('link previews', () => {
  it('normalizes addresses and refuses anything but http(s)', () => {
    expect(normalizeUrl('example.com/a b')).toBe('https://example.com/a%20b');
    expect(normalizeUrl(' http://example.com ')).toBe('http://example.com/');
    expect(normalizeUrl('localhost:3000')).toBe('https://localhost:3000/');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('ftp://example.com')).toBeNull();
    expect(normalizeUrl('not a url')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
  });

  it('decodes HTML entities', () => {
    expect(decodeEntities('Tom &amp; Jerry &#8212; &#x27;hi&#x27; &bogus;')).toBe(
      "Tom & Jerry — 'hi' &bogus;",
    );
  });

  it('reads Open Graph data, falling back to the title tag', () => {
    const html = `<!doctype html><html><head>
      <title>Plain &amp; simple</title>
      <meta property="og:title" content="OG title">
      <meta name='description' content='A  page
        about things'>
      <meta property="og:site_name" content="Example">
      <meta property="og:image" content="/img/share.png">
      <link rel="icon" href="/favicon-16.png" sizes="16x16">
      <link rel="apple-touch-icon" href="https://cdn.example.com/touch.png">
      <link rel="icon" type="image/svg+xml" href="icon.svg">
    </head><body><meta property="og:title" content="ignored"></body></html>`;
    expect(parseLinkMeta(html, 'https://example.com/blog/post')).toEqual({
      title: 'OG title',
      description: 'A page about things',
      siteName: 'Example',
      imageUrl: 'https://example.com/img/share.png',
      iconUrls: [
        'https://example.com/blog/icon.svg',
        'https://cdn.example.com/touch.png',
        'https://example.com/favicon-16.png',
        'https://example.com/favicon.ico',
      ],
    });
    expect(parseLinkMeta('<title>Only &lt;this&gt;</title>', 'https://a.dev/').title).toBe(
      'Only <this>',
    );
  });

  it('ignores non-http image and icon links', () => {
    const meta = parseLinkMeta(
      '<meta property="og:image" content="javascript:alert(1)"><link rel="icon" href="data:image/png;base64,AA">',
      'https://a.dev/',
    );
    expect(meta.imageUrl).toBeUndefined();
    expect(meta.iconUrls).toEqual(['https://a.dev/favicon.ico']);
  });
});
