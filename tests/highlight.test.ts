import { describe, expect, it } from 'vitest';
import { highlightCode } from '../src/editor/highlight';

describe('highlightCode', () => {
  it('emits both light and dark colors for each token', async () => {
    const html = await highlightCode('const answer = 42;', 'typescript');
    expect(html).toContain('class="shiki');
    expect(html).toMatch(/--shiki-light:#[0-9a-f]{6}/i);
    expect(html).toMatch(/--shiki-dark:#[0-9a-f]{6}/i);
  });

  it('escapes code so it renders as text', async () => {
    const html = await highlightCode('<script>alert(1)</script>', 'html');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&#x3C;');
  });

  it('tags lines with their indentation for hanging wraps', async () => {
    const html = await highlightCode('if (a) {\n    go();\n\tdone();\n}', 'javascript');
    expect(html).toContain('style="--_indent:4"');
    expect(html).toContain('style="--_indent:2"');
    expect(html.match(/--_indent/g)).toHaveLength(2);
  });

  it('handles plain text and languages loaded on demand', async () => {
    expect(await highlightCode('just words', 'text')).toContain('just words');
    expect(await highlightCode('def f(): pass', 'python')).toContain('--shiki-light');
  });
});
