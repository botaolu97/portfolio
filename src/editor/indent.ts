import { Extension } from '@tiptap/core';

/** Indent steps a paragraph or heading can take. */
export const MAX_INDENT = 8;
const INDENTABLE = ['paragraph', 'heading'];

/**
 * Tab indents and Shift-Tab outdents, so Tab stays in the text instead of moving focus out of the
 * editor (Esc leaves it). In a list, Tab nests the item (the list's own keymap, which runs first);
 * elsewhere it indents every paragraph and heading in the selection by one step.
 */
export const Indent = Extension.create({
  name: 'mubuIndent',
  // After the list keymaps, so nesting list items wins.
  priority: 50,
  addGlobalAttributes() {
    return [
      {
        types: INDENTABLE,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Math.min(MAX_INDENT, Number(el.getAttribute('data-indent')) || 0),
            renderHTML: (attrs) =>
              attrs.indent
                ? { 'data-indent': attrs.indent, style: `--_text-indent: ${attrs.indent}` }
                : {},
          },
        },
      },
    ];
  },
  addKeyboardShortcuts() {
    const shift = (by: number) => () => {
      const { state, view } = this.editor;
      const { from, to } = state.selection;
      const tr = state.tr;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!INDENTABLE.includes(node.type.name)) return;
        const indent = Math.max(0, Math.min(MAX_INDENT, (node.attrs.indent ?? 0) + by));
        if (indent !== node.attrs.indent)
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
      });
      if (tr.docChanged) view.dispatch(tr);
      // Handled either way: Tab never leaves the editor.
      return true;
    };
    return { Tab: shift(1), 'Shift-Tab': shift(-1) };
  },
});
