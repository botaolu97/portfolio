import type { NodeTypes } from '@xyflow/react';
import { CodeNode } from './CodeNode';
import { DemoNode } from './DemoNode';
import { ImageNode } from './ImageNode';
import { NoteNode } from './NoteNode';
import { ShapeNode } from './ShapeNode';
import { StackNode } from './StackNode';
import { TextNode } from './TextNode';
import { VideoNode } from './VideoNode';

// Defined once at module level so React Flow never re-creates node components.
export const nodeTypes = {
  note: NoteNode,
  text: TextNode,
  code: CodeNode,
  stack: StackNode,
  image: ImageNode,
  video: VideoNode,
  shape: ShapeNode,
  demo: DemoNode,
} satisfies NodeTypes;
