import type { NodeDataOf, NodeType } from './schema';

/** Types that can be added from the palette or files; stacks are made from images instead. */
export type AddableNodeType = Exclude<NodeType, 'stack'>;

/** Width and height are left out for nodes that size themselves to their content (labels). */
type Defaults = {
  [T in AddableNodeType]: { data: NodeDataOf<T>; width?: number; height?: number };
};

export const NODE_DEFAULTS: Defaults = {
  text: { data: { html: '<p>Double-click to edit</p>', size: 'md' }, width: 240, height: 120 },
  label: { data: { text: 'Label', font: 'fasthand', size: 32, weight: 400 } },
  note: { data: { html: '', color: 'yellow', size: 'md', rotation: 0 }, width: 200, height: 200 },
  code: {
    data: {
      code: "function greet(name: string): string {\n  return 'Hello, ' + name;\n}\n\nconsole.log(greet('Mubu'));",
      language: 'typescript',
      title: '',
      lineNumbers: true,
      wrap: true,
      html: '',
    },
    width: 420,
    height: 200,
  },
  image: { data: { src: '', alt: '', fit: 'contain' }, width: 320, height: 240 },
  video: { data: { src: '' }, width: 480, height: 270 },
  shape: {
    data: { shape: 'rounded', fill: '#e8f0fe', stroke: '#4f6bed', label: '' },
    width: 160,
    height: 100,
  },
  demo: {
    data: { demoId: 'pending', entry: 'index.html', title: 'Demo', device: 'desktop' },
    width: 640,
    height: 440,
  },
};

export const PALETTE: { type: AddableNodeType; label: string }[] = [
  { type: 'note', label: 'Note' },
  { type: 'text', label: 'Text' },
  { type: 'label', label: 'Label' },
  { type: 'code', label: 'Code' },
  { type: 'shape', label: 'Shape' },
  { type: 'image', label: 'Image' },
  { type: 'video', label: 'Video' },
  { type: 'demo', label: 'Demo' },
];
