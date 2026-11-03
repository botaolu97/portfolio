import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { build, collectTokens, createResolver, outputs, toCss } from '../scripts/tokens';

const tree = JSON.parse(readFileSync(path.resolve('design/tokens.json'), 'utf8'));

describe('design tokens', () => {
  it('resolves every alias and typed value', () => {
    const tokens = collectTokens(tree);
    const resolve = createResolver(tokens);
    for (const t of tokens) {
      expect(() => toCss(t.type, resolve(t.value)), t.path.join('.')).not.toThrow();
      if (t.dark !== undefined) expect(() => toCss(t.type, resolve(t.dark))).not.toThrow();
    }
  });

  it('keeps aliases between emitted tokens live, so they follow dark mode', () => {
    const { css } = build(tree);
    expect(css).toContain('--button-bg: var(--color-surface);');
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)[\s\S]*--color-surface: #1f1f1e;/);
    expect(css).toMatch(/:root\[data-theme='dark'\] \{[\s\S]*--color-surface: #1f1f1e;/);
    expect(css).toContain(":root:not([data-theme='light'])");
  });

  it('does not emit palette primitives', () => {
    expect(build(tree).css).not.toContain('--palette-');
  });

  it('generated files are up to date (run `npm run tokens`)', () => {
    for (const [file, content] of outputs().files) {
      expect(readFileSync(file, 'utf8'), path.relative('.', file)).toBe(content);
    }
  });

  it('CSS modules use tokens, not raw colors or undefined variables', () => {
    const files = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', 'src'],
      {
        encoding: 'utf8',
      },
    )
      .split('\n')
      .filter((f) => f.endsWith('.module.css') || f === 'src/ui/base.css');
    const defined = new Set(build(tree).css.match(/--[a-z0-9-]+(?=:)/g));
    for (const file of files) {
      const css = readFileSync(file, 'utf8');
      expect(css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g), `raw color in ${file}`).toBeNull();
      for (const [, name] of css.matchAll(/var\((--[a-z0-9-]+)/g)) {
        expect(defined.has(name), `${name} in ${file} is not a token`).toBe(true);
      }
    }
  });
});
