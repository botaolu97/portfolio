/**
 * Compresses every video in `videos/` for the web into `videos/encoded/` (macOS only; uses the
 * system video encoder through scripts/encode-video.swift, so no ffmpeg needed).
 *
 *   npm run encode-videos                 # new or changed videos, bitrate picked automatically
 *   npm run encode-videos -- --kbps 2500  # sharper (bigger); lower is smaller
 *   npm run encode-videos -- --max-width 1280 --force
 *
 * Videos already encoded (and not changed since) are skipped. `videos/` is git-ignored: upload the
 * encoded file through a Video node in the editor, which copies it into public/content/assets.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const root = join(import.meta.dirname, '..');
const inDir = join(root, 'videos');
const outDir = join(inDir, 'encoded');
const source = join(root, 'scripts', 'encode-video.swift');
const binary = join(root, 'node_modules', '.cache', 'mubu', 'encode-video');
const VIDEO = new Set(['.mp4', '.mov', '.m4v']);

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const kbps = option('--kbps') ?? 'auto';
const maxWidth = option('--max-width') ?? '1920';
const force = args.includes('--force');

if (process.platform !== 'darwin') {
  console.error('encode-videos uses the macOS video encoder; run it on a Mac.');
  process.exit(1);
}
if (!/^(auto|\d+)$/.test(kbps) || !/^\d+$/.test(maxWidth)) {
  console.error('Usage: npm run encode-videos -- [--kbps <number>] [--max-width <px>] [--force]');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
// Build the encoder on first use, and again whenever its source changes.
if (!existsSync(binary) || statSync(binary).mtimeMs < statSync(source).mtimeMs) {
  console.log('Building the encoder (first run only)…');
  mkdirSync(join(binary, '..'), { recursive: true });
  execFileSync('swiftc', ['-O', '-suppress-warnings', source, '-o', binary], { stdio: 'inherit' });
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const videos = readdirSync(inDir).filter((f) => VIDEO.has(extname(f).toLowerCase()));
if (videos.length === 0) console.log(`No videos in ${inDir} (mp4, mov or m4v).`);

let failed = 0;
for (const file of videos) {
  const input = join(inDir, file);
  const output = join(outDir, `${basename(file, extname(file))}.mp4`);
  if (!force && existsSync(output) && statSync(output).mtimeMs > statSync(input).mtimeMs) {
    console.log(`skip  ${file} (already encoded)`);
    continue;
  }
  process.stdout.write(`encode ${file} … `);
  try {
    const info = execFileSync(binary, [input, output, kbps, maxWidth], { encoding: 'utf8' }).trim();
    console.log(`${mb(statSync(input).size)} → ${mb(statSync(output).size)} (${info})`);
  } catch {
    failed++;
    console.log('failed');
  }
}
if (failed) process.exit(1);
