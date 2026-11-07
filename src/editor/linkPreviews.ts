import { type Editor, Extension } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import type { Mark, Node as PmNode } from '@tiptap/pm/model';
import { fetchLinkPreview } from '../content/api';
import { safeHref } from '../nodes/linkPreview';
import { faviconStyle } from '../nodes/richLinks';

/**
 * Links in rich text remember their page's icon (`favicon`, a saved asset) and whether the page
 * was looked up (`previewed`, so it's looked up once).
 */
export const PreviewLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      favicon: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-favicon'),
        renderHTML: (attrs) =>
          attrs.favicon
            ? { 'data-favicon': attrs.favicon, style: faviconStyle(attrs.favicon) }
            : {},
      },
      previewed: {
        default: false,
        parseHTML: (el) => el.hasAttribute('data-previewed'),
        renderHTML: (attrs) => (attrs.previewed ? { 'data-previewed': '' } : {}),
      },
    };
  },
});

/** "https://www.example.com/a/" and "example.com/a" are the same link written out. */
const bare = (s: string) =>
  s
    .trim()
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase();

/** The link's text is just its address (typed or pasted), not words someone chose. */
export const isAddressText = (text: string, href: string) => bare(text) === bare(href);

type Range = { from: number; to: number; mark: Mark };

/** Stretches of text carrying a link to `href` that hasn't been looked up yet. */
function unpreviewed(doc: PmNode, href?: string): Range[] {
  const ranges: Range[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === 'link');
    if (!mark || mark.attrs.previewed || (href && mark.attrs.href !== href)) return;
    const last = ranges.at(-1);
    if (last && last.to === pos && last.mark.attrs.href === mark.attrs.href)
      last.to += node.nodeSize;
    else ranges.push({ from: pos, to: pos + node.nodeSize, mark });
  });
  return ranges;
}

const pending = new Set<string>();

/** Looks up new links' pages (dev server), then shows each as its page's icon and title. */
function lookUp(editor: Editor) {
  for (const { mark } of unpreviewed(editor.state.doc)) {
    const href = mark.attrs.href as string;
    if (pending.has(href)) continue;
    if (!safeHref(href)) {
      apply(editor, href, null);
      continue;
    }
    pending.add(href);
    fetchLinkPreview(href, { iconOnly: true })
      .then((preview) => apply(editor, href, preview))
      .catch(() => apply(editor, href, null))
      .finally(() => pending.delete(href));
  }
}

function apply(editor: Editor, href: string, preview: { title: string; favicon?: string } | null) {
  // The editor may have closed meanwhile; the link is looked up again next time it's edited.
  if (editor.isDestroyed) return;
  const { state } = editor;
  const tr = state.tr;
  // From the end, so earlier positions stay valid as text is replaced.
  for (const { from, to, mark } of unpreviewed(state.doc, href).reverse()) {
    const link = mark.type.create({
      ...mark.attrs,
      previewed: true,
      favicon: preview?.favicon ?? null,
    });
    const title = preview?.title.trim();
    if (title && isAddressText(state.doc.textBetween(from, to), href)) {
      const others = (state.doc.nodeAt(from)?.marks ?? []).filter((m) => m !== mark);
      const marks = link.addToSet(others);
      tr.replaceWith(from, to, state.schema.text(title, marks));
    } else {
      tr.removeMark(from, to, mark.type).addMark(from, to, link);
    }
  }
  if (tr.docChanged) editor.view.dispatch(tr);
}

export const LinkPreviews = Extension.create({
  name: 'mubuLinkPreviews',
  onCreate() {
    lookUp(this.editor);
  },
  onUpdate() {
    lookUp(this.editor);
  },
});
