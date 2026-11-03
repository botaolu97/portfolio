import { Extension } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import StarterKit from '@tiptap/starter-kit';

/**
 * Mubu's text shortcuts, shared by text nodes and notes (see DESIGN.md → Rich text).
 * Bold ⌘B, italic ⌘I and underline ⌘U come from StarterKit; Markdown-style starts
 * (#, ##, ###, "- ", "[ ] ") come from the heading and list input rules.
 */
const Shortcuts = Extension.create({
  name: 'mubuShortcuts',
  // Run before the built-in keymaps so ⌘⇧X and ⌘⌫ win over their defaults.
  priority: 1000,
  addKeyboardShortcuts() {
    // Look commands up on each key press: `editor.commands` is bound to the current state.
    const run = () => this.editor.commands;
    return {
      'Mod-1': () => run().setHeading({ level: 1 }),
      'Mod-2': () => run().setHeading({ level: 2 }),
      'Mod-3': () => run().setHeading({ level: 3 }),
      'Mod-4': () => run().setParagraph(),
      'Mod-t': () => run().toggleTaskList(),
      'Mod-l': () => run().toggleBulletList(),
      'Mod-Shift-e': () => run().toggleHighlight(),
      'Mod-Shift-x': () => run().toggleStrike(),
      'Mod-Backspace': () => this.editor.chain().unsetAllMarks().clearNodes().run(),
    };
  },
});

export const richTextExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false },
  }),
  Highlight,
  TaskList,
  TaskItem.configure({ nested: true }),
  Shortcuts,
];
