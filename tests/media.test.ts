import { describe, expect, it } from 'vitest';
import { classifyFile, fitSize } from '../src/canvas/fileDrop';
import { parseVideoSource } from '../src/nodes/videoSource';

describe('parseVideoSource', () => {
  it('recognizes YouTube URLs', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      expect(parseVideoSource(url)).toMatchObject({ kind: 'youtube', id: 'dQw4w9WgXcQ' });
    }
  });

  it('recognizes Vimeo URLs', () => {
    expect(parseVideoSource('https://vimeo.com/76979871')).toMatchObject({
      kind: 'vimeo',
      id: '76979871',
    });
  });

  it('treats other values as files', () => {
    expect(parseVideoSource('content/assets/a.mp4')).toEqual({
      kind: 'file',
      src: 'content/assets/a.mp4',
    });
    expect(parseVideoSource('')).toEqual({ kind: 'none' });
  });
});

describe('file drops', () => {
  it('classifies by extension', () => {
    expect(classifyFile('photo.JPG')).toBe('image');
    expect(classifyFile('icon.svg')).toBe('image');
    expect(classifyFile('clip.webm')).toBe('video');
    expect(classifyFile('index.html')).toBe('demo');
    expect(classifyFile('notes.txt')).toBeNull();
  });

  it('fits large images within the max size', () => {
    expect(fitSize(1920, 1080)).toEqual({ width: 480, height: 270 });
    expect(fitSize(200, 100)).toEqual({ width: 200, height: 100 });
  });
});
