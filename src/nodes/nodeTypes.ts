import type { NodeTypes } from '@xyflow/react';
import { CodeNode } from './CodeNode';
import { DemoNode } from './DemoNode';
import { ImageNode } from './ImageNode';
import { LabelNode } from './LabelNode';
import { LinkNode } from './LinkNode';
import { NoteNode } from './NoteNode';
import { ShapeNode } from './ShapeNode';
import { StackNode } from './StackNode';
import { TextNode } from './TextNode';
import { VideoNode } from './VideoNode';

// Defined once at module level so React Flow never re-creates node components.
export const nodeTypes = {
  note: NoteNode,
  text: TextNode,
  label: LabelNode,
  code: CodeNode,
  stack: StackNode,
  image: ImageNode,
  video: VideoNode,
  shape: ShapeNode,
  demo: DemoNode,
  link: LinkNode,
} satisfies NodeTypes;
