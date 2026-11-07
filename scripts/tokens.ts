/**
 * Builds Mubu's interface tokens from design/tokens.json (DTCG 2025.10):
 *   src/ui/tokens.css   CSS custom properties, with a dark-mode block
 *   src/ui/tokens.ts    resolved light values for code that stores colors as data
 *   DESIGN.md           the token reference between the tokens:start/end markers
 *
 *   node scripts/tokens.ts           write the outputs
 *   node scripts/tokens.ts --check   fail if any output is out of date
 *
 * Conventions on top of DTCG:
 *   - The top-level `palette` group holds primitives and is not emitted; semantic tokens alias it.
 *   - `component.button.bg` is emitted as `--button-bg` (the `component` prefix is dropped).
 *   - Dark values live in `$extensions["app.mubu.modes"].dark`. They apply when the system is dark
 *     (unless <html data-theme="light">) or when <html data-theme="dark">.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type TokenType =
  | 'color'
  | 'dimension'
  | 'duration'
  | 'fontFamily'
  | 'fontWeight'
  | 'number'
  | 'cubicBezier'
  | 'shadow';

interface Token {
  path: string[];
  type: TokenType;
  value: unknown;
  dark?: unknown;
  description?: string;
}

interface Color {
  colorSpace: 'srgb';
  components: [number, number, number];
  alpha?: number;
  hex?: string;
}

interface Measure {
  value: number;
  unit: string;
}

interface ShadowLayer {
  color: Color | string;
  offsetX: Measure | string;
  offsetY: Measure | string;
  blur: Measure | string;
  spread: Measure | string;
}

const MODES_KEY = 'app.mubu.modes';
const PRIMITIVE_GROUP = 'palette';
const COMPONENT_GROUP = 'component';
const DOCS_START = '<!-- tokens:start -->';
const DOCS_END = '<!-- tokens:end -->';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Flattens the token tree, carrying each group's `$type` down to its tokens. */
export function collectTokens(tree: Record<string, unknown>): Token[] {
  const out: Token[] = [];
  const walk = (node: Record<string, unknown>, at: string[], inherited?: TokenType) => {
    const type = (node.$type as TokenType | undefined) ?? inherited;
    if ('$value' in node) {
      if (!type) throw new Error(`Token ${at.join('.')} has no $type`);
      const modes = isObject(node.$extensions) ? node.$extensions[MODES_KEY] : undefined;
      out.push({
        path: at,
        type,
        value: node.$value,
        dark: isObject(modes) ? modes.dark : undefined,
        description: typeof node.$description === 'string' ? node.$description : undefined,
      });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (!key.startsWith('$') && isObject(child)) walk(child, [...at, key], type);
    }
  };
  walk(tree, []);
  return out;
}

/** Follows `{group.token}` aliases (including inside shadow layers) to concrete values. */
export function createResolver(tokens: Token[]) {
  const byPath = new Map(tokens.map((t) => [t.path.join('.'), t]));
  const resolve = (value: unknown, seen: string[] = []): unknown => {
    if (typeof value === 'string' && /^\{[^}]+\}$/.test(value)) {
      const ref = value.slice(1, -1);
      if (seen.includes(ref)) throw new Error(`Alias cycle: ${[...seen, ref].join(' → ')}`);
      const target = byPath.get(ref);
      if (!target) throw new Error(`Unknown alias ${value}`);
      return resolve(target.value, [...seen, ref]);
    }
    if (Array.isArray(value)) return value.map((v) => resolve(v, seen));
    if (isObject(value) && !('colorSpace' in value) && !('unit' in value)) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, seen)]));
    }
    return value;
  };
  return resolve;
}

const hex2 = (n: number) =>
  Math.round(n * 255)
    .toString(16)
    .padStart(2, '0');

function colorToCss(color: Color): string {
  const hex = color.hex ?? `#${color.components.map(hex2).join('')}`;
  if (color.alpha === undefined || color.alpha === 1) return hex;
  const [r, g, b] = color.components.map((n) => Math.round(n * 255));
  return `rgb(${r} ${g} ${b} / ${color.alpha})`;
}

const measureToCss = (m: Measure) => `${m.value}${m.value === 0 ? '' : m.unit}`;

const fontFamilyToCss = (v: string | string[]) =>
  (Array.isArray(v) ? v : [v]).map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(', ');

export function toCss(type: TokenType, value: unknown): string {
  switch (type) {
    case 'color':
      return colorToCss(value as Color);
    case 'dimension':
    case 'duration':
      return measureToCss(value as Measure);
    case 'fontFamily':
      return fontFamilyToCss(value as string | string[]);
    case 'fontWeight':
    case 'number':
      return String(value);
    case 'cubicBezier':
      return `cubic-bezier(${(value as number[]).join(', ')})`;
    case 'shadow': {
      const layers = (Array.isArray(value) ? value : [value]) as ShadowLayer[];
      return layers
        .map((l) =>
          [l.offsetX, l.offsetY, l.blur, l.spread]
            .map((m) => measureToCss(m as Measure))
            .concat(colorToCss(l.color as Color))
            .join(' '),
        )
        .join(', ');
    }
  }
}

const emitted = (t: Token) => t.path[0] !== PRIMITIVE_GROUP;

export const cssName = (t: Token) =>
  `--${(t.path[0] === COMPONENT_GROUP ? t.path.slice(1) : t.path).join('-')}`;

export function build(tree: Record<string, unknown>) {
  const tokens = collectTokens(tree);
  const resolve = createResolver(tokens);
  const byPath = new Map(tokens.map((t) => [t.path.join('.'), t]));
  // An alias to another emitted token stays a var() reference, so it follows that token into
  // dark mode; aliases to palette primitives are resolved to their value.
  const cssValue = (t: Token, value: unknown) => {
    const target = typeof value === 'string' ? byPath.get(value.slice(1, -1)) : undefined;
    if (target && emitted(target)) return `var(${cssName(target)})`;
    return toCss(t.type, resolve(value));
  };
  const rows = tokens.filter(emitted).map((t) => ({
    token: t,
    name: cssName(t),
    light: cssValue(t, t.value),
    dark: t.dark === undefined ? undefined : cssValue(t, t.dark),
    resolved: toCss(t.type, resolve(t.value)),
  }));

  const darkRows = rows.filter((r) => r.dark !== undefined);
  const banner = '/* Generated from design/tokens.json by `npm run tokens`. Do not edit. */';
  const css = [
    banner,
    '',
    ':root {',
    ...rows.map((r) => `  ${r.name}: ${r.light};`),
    '}',
    '',
    // Dark follows the system unless the theme switch set data-theme on <html>.
    '@media (prefers-color-scheme: dark) {',
    "  :root:not([data-theme='light']) {",
    ...darkRows.map((r) => `    ${r.name}: ${r.dark};`),
    '  }',
    '}',
    '',
    ":root[data-theme='dark'] {",
    ...darkRows.map((r) => `  ${r.name}: ${r.dark};`),
    '}',
    '',
  ].join('\n');

  const ts = [
    '// Generated from design/tokens.json by `npm run tokens`. Do not edit.',
    '// Light-mode values, for code that stores a token as data (e.g. a note color in a map).',
    '',
    'export const tokenValues = {',
    ...rows.map((r) => `  '${r.token.path.join('.')}': ${JSON.stringify(r.resolved)},`),
    '} as const;',
    '',
    '// Dark-mode values, for tokens that have one (resolved, like tokenValues).',
    'export const tokenDarkValues: Partial<Record<keyof typeof tokenValues, string>> = {',
    ...darkRows.map(
      (r) =>
        `  '${r.token.path.join('.')}': ${JSON.stringify(toCss(r.token.type, resolve(r.token.dark)))},`,
    ),
    '};',
    '',
  ].join('\n');

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key =
      r.token.path[0] === COMPONENT_GROUP ? `component.${r.token.path[1]}` : r.token.path[0];
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const cell = (s: string) => s.replaceAll('|', '\\|');
  const docs = [
    DOCS_START,
    '',
    '_Generated from `design/tokens.json` by `npm run tokens`. Edit the JSON, not this section._',
    '',
    ...[...groups].flatMap(([group, list]) => [
      `#### \`${group}\``,
      '',
      '| CSS variable | Value | Dark | Use |',
      '| --- | --- | --- | --- |',
      ...list.map((r) => {
        const value = r.light === r.resolved ? r.light : `${r.light} → ${r.resolved}`;
        const dark = r.dark
          ? `\`${cell(r.dark)}\``
          : r.light.startsWith('var(')
            ? 'follows alias'
            : '—';
        return `| \`${r.name}\` | \`${cell(value)}\` | ${dark} | ${cell(r.token.description ?? '')} |`;
      }),
      '',
    ]),
    DOCS_END,
  ].join('\n');

  return { css, ts, docs, count: rows.length };
}

export function spliceDocs(markdown: string, docs: string): string {
  const start = markdown.indexOf(DOCS_START);
  const end = markdown.indexOf(DOCS_END);
  if (start === -1 || end === -1) throw new Error(`DESIGN.md needs ${DOCS_START} and ${DOCS_END}`);
  return markdown.slice(0, start) + docs + markdown.slice(end + DOCS_END.length);
}

const root = path.resolve(import.meta.dirname, '..');
export const paths = {
  source: path.join(root, 'design/tokens.json'),
  css: path.join(root, 'src/ui/tokens.css'),
  ts: path.join(root, 'src/ui/tokens.ts'),
  docs: path.join(root, 'DESIGN.md'),
};

export function outputs() {
  const result = build(JSON.parse(readFileSync(paths.source, 'utf8')));
  const design = spliceDocs(readFileSync(paths.docs, 'utf8'), result.docs);
  return {
    count: result.count,
    files: [
      [paths.css, result.css],
      [paths.ts, result.ts],
      [paths.docs, design],
    ] as const,
  };
}

if (import.meta.main) {
  const check = process.argv.includes('--check');
  const { count, files } = outputs();
  const stale = files.filter(([file, content]) => {
    let current = '';
    try {
      current = readFileSync(file, 'utf8');
    } catch {}
    return current !== content;
  });
  if (check) {
    if (stale.length > 0) {
      console.error(
        `Out of date: ${stale.map(([f]) => path.relative(root, f)).join(', ')}. Run npm run tokens.`,
      );
      process.exit(1);
    }
    console.log(`Tokens up to date (${count} tokens).`);
  } else {
    for (const [file, content] of stale) writeFileSync(file, content);
    console.log(`Built ${count} tokens; updated ${stale.length} file(s).`);
  }
}
