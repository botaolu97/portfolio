import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const content = path.resolve('public/content');
const slug = `e2e-${Date.now()}`;
const createdDemos: string[] = [];
const createdAssets: string[] = [];

test.afterAll(async ({ request }) => {
  await request.post(`/__mubu/delete?slug=${slug}`);
  for (const id of createdDemos) await rm(path.join(content, 'demos', id), { recursive: true });
  for (const file of createdAssets) await rm(file, { force: true });
});

test('create a map, add nodes, undo, and run an uploaded demo', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('New map title').fill(slug);
  await page.getByRole('button', { name: 'New map' }).click();
  await expect(page).toHaveURL(new RegExp(`#/m/${slug}$`));

  // Add a shape from the palette, then undo and redo it.
  await page.getByRole('navigation', { name: 'Add to canvas' }).getByText('Shape').click();
  await expect(page.locator('.react-flow__node-shape')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.react-flow__node-shape')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.locator('.react-flow__node-shape')).toHaveCount(1);

  // Add a sticky note: yellow by default, then write in it and switch it to pink.
  await page.getByRole('navigation', { name: 'Add to canvas' }).getByText('Note').click();
  const note = page.locator('.react-flow__node-note');
  await expect(note).toHaveCount(1);
  await note.dblclick();
  await page.getByLabel('Note text').fill('Remember the milk');
  await page.keyboard.press('Escape');
  await expect(note).toContainText('Remember the milk');
  await page.getByLabel('Pink').check();

  // Paste a PNG and SVG markup from the clipboard.
  await page.locator('.react-flow__pane').click({ position: { x: 600, y: 680 } });
  await page.evaluate(() => {
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
      ),
      (c) => c.charCodeAt(0),
    );
    const paste = (fill: (data: DataTransfer) => void) => {
      const data = new DataTransfer();
      fill(data);
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    };
    paste((d) => d.items.add(new File([png], 'image.png', { type: 'image/png' })));
    paste((d) =>
      d.setData(
        'text/plain',
        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20"/></svg>',
      ),
    );
  });
  await expect(page.locator('.react-flow__node-image')).toHaveCount(2);

  // Autosave writes the map into public/content.
  await expect(page.getByRole('status')).toHaveText('Saved');
  const saved = JSON.parse(await readFile(path.join(content, 'maps', `${slug}.json`), 'utf8'));
  expect(saved.nodes.map((n: { type: string }) => n.type).sort()).toEqual([
    'image',
    'image',
    'note',
    'shape',
  ]);
  expect(saved.nodes.find((n: { type: string }) => n.type === 'note').data).toEqual({
    text: 'Remember the milk',
    color: 'pink',
  });
  for (const n of saved.nodes.filter((n: { type: string }) => n.type === 'image')) {
    createdAssets.push(path.join(content, n.data.src.replace(/^content\//, '')));
  }

  // Upload a tiny HTML/CSS/JS demo through the toolbar.
  await page
    .locator('header input[type=file]')
    .first()
    .setInputFiles([
      {
        name: 'counter.html',
        mimeType: 'text/html',
        buffer: Buffer.from(
          '<link rel="stylesheet" href="counter.css"><button id="b">Clicked 0</button><script src="counter.js"></script>',
        ),
      },
      { name: 'counter.css', mimeType: 'text/css', buffer: Buffer.from('button{font-size:40px}') },
      {
        name: 'counter.js',
        mimeType: 'text/javascript',
        buffer: Buffer.from('let n=0;b.onclick=()=>{b.textContent="Clicked "+(++n)}'),
      },
    ]);
  const demo = page.locator('.react-flow__node-demo');
  await expect(demo).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('Saved');
  const demoId = JSON.parse(
    await readFile(path.join(content, 'maps', `${slug}.json`), 'utf8'),
  ).nodes.find((n: { type: string }) => n.type === 'demo').data.demoId;
  createdDemos.push(demoId);
  expect(existsSync(path.join(content, 'demos', demoId, 'counter.js'))).toBe(true);

  // The demo is interactive immediately.
  const frame = page.frameLocator('.react-flow__node-demo iframe');
  await frame.getByRole('button').click();
  await expect(frame.getByRole('button')).toHaveText('Clicked 1');

  // Its title bar still drags the node.
  const before = await demo.evaluate((el) => el.style.transform);
  const bar = demo.getByText('counter');
  const box = await bar.boundingBox();
  if (!box) throw new Error('demo title bar not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 80, { steps: 8 });
  await page.mouse.up();
  expect(await demo.evaluate((el) => el.style.transform)).not.toBe(before);
});
