import { createHighlighterCore, type HighlighterCore, type ShikiTransformer } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import type { CodeLanguage } from '../store/schema';

/** Grammars load on first use, so the editor only fetches the languages you actually pick. */
const GRAMMARS: Record<Exclude<CodeLanguage, 'text'>, () => Promise<unknown>> = {
  typescript: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  javascript: () => import('@shikijs/langs/javascript'),
  jsx: () => import('@shikijs/langs/jsx'),
  html: () => import('@shikijs/langs/html'),
  css: () => import('@shikijs/langs/css'),
  json: () => import('@shikijs/langs/json'),
  python: () => import('@shikijs/langs/python'),
  bash: () => import('@shikijs/langs/bash'),
  swift: () => import('@shikijs/langs/swift'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  go: () => import('@shikijs/langs/go'),
  rust: () => import('@shikijs/langs/rust'),
  sql: () => import('@shikijs/langs/sql'),
  markdown: () => import('@shikijs/langs/markdown'),
  yaml: () => import('@shikijs/langs/yaml'),
};

let highlighter: Promise<HighlighterCore> | undefined;

/**
 * Tags each line with its leading indentation (`--_indent`, in characters; a tab counts as 2),
 * so wrapped continuation lines can hang under the line's own indentation.
 */
function indentation(code: string): ShikiTransformer {
  const lines = code.split('\n');
  return {
    line(node, line) {
      const lead = /^[\t ]*/.exec(lines[line - 1] ?? '')?.[0] ?? '';
      const width = [...lead].reduce((n, c) => n + (c === '\t' ? 2 : 1), 0);
      if (width > 0) node.properties.style = `--_indent:${width}`;
    },
  };
}

function getHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [import('@shikijs/themes/github-light'), import('@shikijs/themes/github-dark')],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

/**
 * Highlights code into HTML that carries both themes: each token gets `--shiki-light` and
 * `--shiki-dark` custom properties, and CSS picks one to match Mubu's theme. Runs in the
 * editor only; the published site renders the stored HTML.
 */
export async function highlightCode(code: string, language: CodeLanguage): Promise<string> {
  const shiki = await getHighlighter();
  if (language !== 'text' && !shiki.getLoadedLanguages().includes(language)) {
    // biome-ignore lint/suspicious/noExplicitAny: Shiki's grammar module type isn't exported here.
    await shiki.loadLanguage((await GRAMMARS[language]()) as any);
  }
  return shiki.codeToHtml(code, {
    lang: language,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
    transformers: [indentation(code)],
  });
}
