import { z } from 'zod';

export const MAP_VERSION = 2;

export const SHAPE_KINDS = [
  'rect',
  'rounded',
  'ellipse',
  'diamond',
  'triangle',
  'hexagon',
] as const;
export const DEVICES = { desktop: 1280, tablet: 768, mobile: 390 } as const;
export type Device = keyof typeof DEVICES;

const position = z.object({ x: z.number(), y: z.number() });

const nodeBase = {
  id: z.string().min(1),
  position,
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  zIndex: z.number().optional(),
};

export const NOTE_COLORS = ['yellow', 'pink', 'green', 'blue', 'purple'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

/** A sticky note: rich text on one of the note colors (a token name, not a hex value). */
export const noteData = z.object({
  html: z.string().default(''),
  color: z.enum(NOTE_COLORS).default('yellow'),
});

export const textData = z.object({
  html: z.string(),
  background: z.string().optional(),
});

export const imageData = z.object({
  src: z.string(),
  alt: z.string().default(''),
  fit: z.enum(['contain', 'cover']).default('contain'),
});

export const videoData = z.object({
  /** An uploaded file path, or a YouTube/Vimeo URL. */
  src: z.string(),
  poster: z.string().optional(),
});

export const shapeData = z.object({
  shape: z.enum(SHAPE_KINDS),
  fill: z.string(),
  stroke: z.string(),
  label: z.string().default(''),
});

export const demoData = z.object({
  demoId: z.string().regex(/^[a-z0-9-]+$/),
  /** Entry file inside the demo folder. */
  entry: z.string().default('index.html'),
  title: z.string().default('Demo'),
  device: z.enum(Object.keys(DEVICES) as [Device, ...Device[]]).default('desktop'),
  poster: z.string().optional(),
});

export const mapNode = z.discriminatedUnion('type', [
  z.object({ ...nodeBase, type: z.literal('text'), data: textData }),
  z.object({ ...nodeBase, type: z.literal('note'), data: noteData }),
  z.object({ ...nodeBase, type: z.literal('image'), data: imageData }),
  z.object({ ...nodeBase, type: z.literal('video'), data: videoData }),
  z.object({ ...nodeBase, type: z.literal('shape'), data: shapeData }),
  z.object({ ...nodeBase, type: z.literal('demo'), data: demoData }),
]);

export const mapEdge = z.object({
  id: z.string().min(1),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullish(),
  targetHandle: z.string().nullish(),
  type: z.enum(['default', 'smoothstep', 'straight']).optional(),
  label: z.string().optional(),
  animated: z.boolean().optional(),
});

export const mapDoc = z.object({
  version: z.literal(MAP_VERSION),
  title: z.string(),
  nodes: z.array(mapNode),
  edges: z.array(mapEdge),
});

export const mapIndexEntry = z.object({
  slug: z.string(),
  title: z.string(),
  updatedAt: z.string(),
});

export type MapDoc = z.infer<typeof mapDoc>;
export type MapNode = z.infer<typeof mapNode>;
export type MapEdge = z.infer<typeof mapEdge>;
export type NodeType = MapNode['type'];
export type NodeDataOf<T extends NodeType> = Extract<MapNode, { type: T }>['data'];
export type MapIndexEntry = z.infer<typeof mapIndexEntry>;

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'untitled'
  );
}
