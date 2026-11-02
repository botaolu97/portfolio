import type { NodeDataOf, NodeType } from './schema';

type Defaults = { [T in NodeType]: { data: NodeDataOf<T>; width: number; height: number } };

export const NODE_DEFAULTS: Defaults = {
  text: { data: { html: '<p>Double-click to edit</p>' }, width: 240, height: 120 },
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

export const PALETTE: { type: NodeType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'shape', label: 'Shape' },
  { type: 'image', label: 'Image' },
  { type: 'video', label: 'Video' },
  { type: 'demo', label: 'Demo' },
];
