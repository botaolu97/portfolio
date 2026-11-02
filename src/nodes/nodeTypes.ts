import type { NodeTypes } from '@xyflow/react';
import { DemoNode } from './DemoNode';
import { ImageNode } from './ImageNode';
import { ShapeNode } from './ShapeNode';
import { TextNode } from './TextNode';
import { VideoNode } from './VideoNode';

// Defined once at module level so React Flow never re-creates node components.
export const nodeTypes = {
  text: TextNode,
  image: ImageNode,
  video: VideoNode,
  shape: ShapeNode,
  demo: DemoNode,
} satisfies NodeTypes;
