import { z } from 'zod';

export const MAP_VERSION = 2;

export const SHAPE_KINDS = [
  'rect',
  'rounded',
  'ellipse',
  'diamond',
  'triangle',
  'hexagon',
  'arrow',
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
/** Text size presets for text nodes and notes (scale tokens --rich-text-scale-*). */
export const TEXT_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const noteData = z.object({
  html: z.string().default(''),
  color: z.enum(NOTE_COLORS).default('yellow'),
  size: z.enum(TEXT_SIZES).default('md'),
  /** Tilt in degrees, -180 to 180 (clockwise positive). */
  rotation: z.number().min(-180).max(180).default(0),
});

export const LABEL_FONTS = {
  fasthand: 'Fasthand',
  caveat: 'Caveat',
  handjet: 'Handjet',
  instrumentSerif: 'Instrument Serif',
  sans: 'Sans',
  serif: 'Serif',
  mono: 'Mono',
} as const;
export type LabelFont = keyof typeof LABEL_FONTS;
export const LABEL_WEIGHTS = [400, 500, 600, 700] as const;

/** Text with no box: a font, a size in canvas px and a weight. Sizes itself to the text. */
export const labelData = z.object({
  text: z.string().default(''),
  font: z.enum(Object.keys(LABEL_FONTS) as [LabelFont, ...LabelFont[]]).default('fasthand'),
  size: z.number().min(8).max(240).default(32),
  weight: z
    .union(
      LABEL_WEIGHTS.map((w) => z.literal(w)) as [
        z.ZodLiteral<400>,
        ...z.ZodLiteral<500 | 600 | 700>[],
      ],
    )
    .default(400),
});

export const CODE_LANGUAGES = {
  typescript: 'TypeScript',
  tsx: 'TSX',
  javascript: 'JavaScript',
  jsx: 'JSX',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  python: 'Python',
  bash: 'Shell',
  swift: 'Swift',
  kotlin: 'Kotlin',
  go: 'Go',
  rust: 'Rust',
  sql: 'SQL',
  markdown: 'Markdown',
  yaml: 'YAML',
  text: 'Plain text',
} as const;
export type CodeLanguage = keyof typeof CODE_LANGUAGES;

/** A code block. `html` is the highlighted rendering, regenerated in the editor from `code`. */
export const codeData = z.object({
  code: z.string().default(''),
  language: z
    .enum(Object.keys(CODE_LANGUAGES) as [CodeLanguage, ...CodeLanguage[]])
    .default('typescript'),
  title: z.string().default(''),
  lineNumbers: z.boolean().default(true),
  /** Wrap long lines (continuation lines hang under their own indentation) instead of scrolling. */
  wrap: z.boolean().default(true),
  html: z.string().default(''),
});

export const textData = z.object({
  html: z.string(),
  background: z.string().optional(),
  size: z.enum(TEXT_SIZES).default('md'),
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
  /** Turn in degrees, -180 to 180 (clockwise positive). */
  rotation: z.number().min(-180).max(180).default(0),
});

export const demoData = z.object({
  demoId: z.string().regex(/^[a-z0-9-]+$/),
  /** Entry file inside the demo folder. */
  entry: z.string().default('index.html'),
  title: z.string().default('Demo'),
  device: z.enum(Object.keys(DEVICES) as [Device, ...Device[]]).default('desktop'),
  poster: z.string().optional(),
});

/**
 * A web page preview card. `url` is the link (http/https only); the rest is fetched at edit time by
 * the dev server and saved with the map, so visitors need no network call except the link itself.
 */
export const linkData = z.object({
  url: z.string().default(''),
  title: z.string().default(''),
  description: z.string().default(''),
  siteName: z.string().default(''),
  /** Stored asset: the page's Open Graph image, or a screenshot when it has none. */
  image: z.string().optional(),
  /** Stored asset: the site's icon. */
  favicon: z.string().optional(),
});

export const mapEdge = z.object({
  id: z.string().min(1),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullish(),
  targetHandle: z.string().nullish(),
  type: z.enum(['default', 'smoothstep', 'straight']).optional(),
  label: z.string().optional(),
  animated: z.boolean().optional(),
  /** Line and arrow color as #rrggbb; the --connector-color default when unset. */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  /** Thickness in px; the --connector-width default when unset. */
  width: z.number().min(0.5).max(12).optional(),
});

export const stackItem = z.object({
  /** The original image node's id, restored on unstack. */
  id: z.string().min(1),
  src: z.string(),
  alt: z.string().default(''),
  fit: z.enum(['contain', 'cover']).default('contain'),
  width: z.number().positive(),
  height: z.number().positive(),
});

/** A pile of images. `items` runs bottom to top; `edges` are the images' own connectors. */
export const stackData = z.object({
  items: z.array(stackItem).min(2),
  edges: z.array(mapEdge).default([]),
});

export const mapNode = z.discriminatedUnion('type', [
  z.object({ ...nodeBase, type: z.literal('text'), data: textData }),
  z.object({ ...nodeBase, type: z.literal('note'), data: noteData }),
  z.object({ ...nodeBase, type: z.literal('label'), data: labelData }),
  z.object({ ...nodeBase, type: z.literal('code'), data: codeData }),
  z.object({ ...nodeBase, type: z.literal('stack'), data: stackData }),
  z.object({ ...nodeBase, type: z.literal('image'), data: imageData }),
  z.object({ ...nodeBase, type: z.literal('video'), data: videoData }),
  z.object({ ...nodeBase, type: z.literal('shape'), data: shapeData }),
  z.object({ ...nodeBase, type: z.literal('demo'), data: demoData }),
  z.object({ ...nodeBase, type: z.literal('link'), data: linkData }),
]);

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
export type StackItem = z.infer<typeof stackItem>;
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
