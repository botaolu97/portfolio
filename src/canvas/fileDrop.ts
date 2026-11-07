import type { XYPosition } from '@xyflow/react';
import { uploadDemo, uploadFile } from '../content/api';
import { NODE_DEFAULTS } from '../store/defaults';
import { useMapStore } from '../store/mapStore';

export type FileKind = 'image' | 'video' | 'demo';

const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const VIDEO = /\.(mp4|webm|mov|m4v|ogv)$/i;
const DEMO = /\.(html?|css|m?js|json)$/i;

export function classifyFile(name: string): FileKind | null {
  if (IMAGE.test(name)) return 'image';
  if (VIDEO.test(name)) return 'video';
  if (DEMO.test(name)) return 'demo';
  return null;
}

const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * Images on the clipboard: copied files and screenshots, or SVG markup copied as text
 * (e.g. Figma's "Copy as SVG"). Unnamed images get a name with the right extension.
 */
export function imagesFromClipboard(data: Pick<DataTransfer, 'files' | 'getData'>): File[] {
  const files = Array.from(data.files)
    .filter((f) => f.type in IMAGE_TYPES || classifyFile(f.name) === 'image')
    .map((f) =>
      classifyFile(f.name) === 'image'
        ? f
        : new File([f], `pasted.${IMAGE_TYPES[f.type]}`, { type: f.type }),
    );
  if (files.length > 0) return files;
  const svg =
    svgMarkup(data.getData('image/svg+xml'), true) ??
    svgMarkup(data.getData('text/plain'), false) ??
    svgMarkup(data.getData('text/html'), true);
  return svg ? [new File([svg], 'pasted.svg', { type: 'image/svg+xml' })] : [];
}

/** What may come before the <svg> in an SVG file: an XML declaration, a doctype, comments. */
const PROLOG =
  /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>\s*)*$/i;

/**
 * The SVG in copied text, as a standalone file. Plain text must be just an SVG file's contents (so
 * pasting a sentence that mentions <svg> does nothing); in HTML, the first <svg>…</svg> is used.
 * Markup copied from a web page often has no xmlns, without which it can't be shown as an image.
 */
export function svgMarkup(text: string, embedded: boolean): string | null {
  const start = text.search(/<svg[\s>]/i);
  const end = text.toLowerCase().lastIndexOf('</svg>');
  if (start < 0 || end < start) return null;
  if (
    !embedded &&
    (!PROLOG.test(text.slice(0, start)) || !/^\s*(<!--[\s\S]*?-->\s*)*$/.test(text.slice(end + 6)))
  ) {
    return null;
  }
  let svg = text.slice(start, end + 6);
  if (!/^<svg[^>]*\sxmlns=/i.test(svg)) {
    svg = svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (/\sxlink:/i.test(svg) && !/^<svg[^>]*\sxmlns:xlink=/i.test(svg)) {
    svg = svg.replace(/^<svg/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }
  return svg;
}

/** Scales natural dimensions down so the longer side is at most `max`. */
export function fitSize(width: number, height: number, max = 480) {
  const ratio = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(fitSize(img.naturalWidth || 320, img.naturalHeight || 240));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 320, height: 240 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Turns dropped files into nodes: each image/video becomes its own node, and all
 * HTML/CSS/JS files in one drop become a single demo.
 */
export async function addNodesFromFiles(files: File[], at: XYPosition) {
  const { addNode } = useMapStore.getState();
  const demoFiles = files.filter((f) => classifyFile(f.name) === 'demo');
  let offset = 0;
  // Each node is centered on the drop point, cascading when several land at once.
  const next = ({ width = 0, height = 0 }: { width?: number; height?: number }) => {
    const size = { width, height };
    const position = { x: at.x - size.width / 2 + offset, y: at.y - size.height / 2 + offset };
    offset += 32;
    return position;
  };

  for (const file of files) {
    const kind = classifyFile(file.name);
    if (kind === 'image') {
      const [{ src }, size] = await Promise.all([uploadFile(file), imageSize(file)]);
      addNode('image', next(size), {
        data: { src, alt: file.name.replace(/\.\w+$/, '') },
        ...size,
      });
    } else if (kind === 'video') {
      const { src } = await uploadFile(file);
      addNode('video', next(NODE_DEFAULTS.video), { data: { src } });
    }
  }

  if (demoFiles.length > 0) {
    const { demoId, entry } = await uploadDemo(demoFiles);
    const title = demoFiles.find((f) => f.name.endsWith('.html'))?.name.replace(/\.html?$/, '');
    addNode('demo', next(NODE_DEFAULTS.demo), { data: { demoId, entry, title: title ?? 'Demo' } });
  }
}
