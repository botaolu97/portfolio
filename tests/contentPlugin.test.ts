import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
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
