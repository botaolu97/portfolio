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
  // Start from a missing canvas (so no real canvas is opened) and create one from the switcher.
  await page.goto('/#/m/__missing__');
  const switcher = page.getByRole('button', { name: /Switch canvas/ });
  await switcher.click();
  await page.getByRole('menuitem', { name: 'New canvas' }).click();
  await page.getByLabel('New canvas name').fill(slug);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`#/m/${slug}$`));
  await expect(switcher).toContainText(slug);

  // Add a shape from the palette; ⌘Z undoes it and there is no redo.
  const shapes = page.locator('.react-flow__node-shape');
  await page.getByRole('navigation', { name: 'Add to canvas' }).getByText('Shape').click();
  await expect(shapes).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(shapes).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await page.keyboard.press('ControlOrMeta+y');
  await expect(shapes).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Add to canvas' }).getByText('Shape').click();
  await expect(shapes).toHaveCount(1);

  // Add a sticky note (yellow by default), write in it with the text shortcuts, make it pink.
  await page.getByRole('navigation', { name: 'Add to canvas' }).getByText('Note').click();
  const note = page.locator('.react-flow__node-note');
  await expect(note).toHaveCount(1);
  await note.dblclick();
  await expect(note.locator('.ProseMirror')).toBeFocused();
  const keys = page.keyboard;
  await keys.type('Plan');
  await keys.press('ControlOrMeta+1');
  await keys.press('Enter');
  await keys.press('ControlOrMeta+t');
  await keys.type('Buy milk');
  await keys.press('Enter');
  await keys.press('Enter');
  await keys.press('ControlOrMeta+Shift+e');
  await keys.type('marked');
  await keys.press('Escape');
  await expect(note.locator('h1')).toHaveText('Plan');
  await expect(note.locator('input[type=checkbox]')).toHaveCount(1);
  await page.getByLabel('Pink').check();

  // Add a code block: highlighted on arrival, editable, re-highlighted for a new language.
  await page.getByRole('navigation', { name: 'Add to canvas' }).getByText('Code').click();
  const code = page.locator('.react-flow__node-code');
  await expect(code.locator('.shiki span[style*="--shiki-light"]').first()).toBeVisible();
  await code.dblclick();
  await page.getByLabel('Code').fill('def hello():\n    return "hi"');
  await page.keyboard.press('Escape');
  await page.getByLabel('Language').selectOption('python');
  await expect(code.locator('.shiki')).toContainText('def hello');
  await expect(code.getByText('Python')).toBeVisible();

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

  // Select everything: the floating toolbar offers to stack the two images, right-click unstacks.
  await page.locator('.react-flow__pane').click({ position: { x: 600, y: 680 } });
  await page.keyboard.press('ControlOrMeta+a');
  await page
    .getByRole('toolbar', { name: 'Selected images' })
    .getByRole('button', { name: 'Stack 2 images' })
    .click();
  const stack = page.locator('.react-flow__node-stack');
  await expect(stack).toHaveCount(1);
  await expect(page.locator('.react-flow__node-image')).toHaveCount(0);
  await expect(stack).toContainText('2');
  await stack.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Unstack' }).click();
  await expect(stack).toHaveCount(0);
  await expect(page.locator('.react-flow__node-image')).toHaveCount(2);

  // Autosave writes the map into public/content.
  await expect(page.getByRole('status')).toHaveText('All changes saved');
  const saved = JSON.parse(await readFile(path.join(content, 'maps', `${slug}.json`), 'utf8'));
  expect(saved.nodes.map((n: { type: string }) => n.type).sort()).toEqual([
    'code',
    'image',
    'image',
    'note',
    'shape',
  ]);
  const codeData = saved.nodes.find((n: { type: string }) => n.type === 'code').data;
  expect(codeData).toMatchObject({ language: 'python', code: 'def hello():\n    return "hi"' });
  expect(codeData.html).toContain('--shiki-dark');
  const noteData = saved.nodes.find((n: { type: string }) => n.type === 'note').data;
  expect(noteData.color).toBe('pink');
  expect(noteData.html).toContain('<h1>Plan</h1>');
  expect(noteData.html).toMatch(/data-type="taskList"[\s\S]*Buy milk/);
  expect(noteData.html).toContain('<mark>marked</mark>');
  for (const n of saved.nodes.filter((n: { type: string }) => n.type === 'image')) {
    createdAssets.push(path.join(content, n.data.src.replace(/^content\//, '')));
  }

  // Add a demo and upload a tiny HTML/CSS/JS page from the inspector.
  await page.getByRole('navigation', { name: 'Add to canvas' }).getByText('Demo').click();
  await page
    .getByRole('complementary', { name: 'Inspector' })
    .locator('input[type=file]')
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
  await expect(demo.locator('iframe')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('All changes saved');
  const demoId = JSON.parse(
    await readFile(path.join(content, 'maps', `${slug}.json`), 'utf8'),
  ).nodes.find((n: { type: string }) => n.type === 'demo').data.demoId;
  createdDemos.push(demoId);
  expect(existsSync(path.join(content, 'demos', demoId, 'counter.js'))).toBe(true);

  // The demo is interactive immediately.
  const frame = page.frameLocator('.react-flow__node-demo iframe');
  await frame.getByRole('button').click();
  await expect(frame.getByRole('button')).toHaveText('Clicked 1');

  // Zooming inside the demo or over a code block zooms the canvas, never the page.
  const viewport = () => page.locator('.react-flow__viewport').evaluate((el) => el.style.transform);
  let zoomBefore = await viewport();
  const insideDemo = await frame.locator('body').evaluate((body) => {
    const e = new WheelEvent('wheel', {
      deltaY: -60,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    body.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(insideDemo).toBe(true);
  await expect.poll(viewport).not.toBe(zoomBefore);
  zoomBefore = await viewport();
  await frame.getByRole('button').press('ControlOrMeta+-');
  await expect.poll(viewport).not.toBe(zoomBefore);
  zoomBefore = await viewport();
  const overCode = await code.locator('.shiki').evaluate(
    (el, e) => {
      const event = new WheelEvent('wheel', e);
      el.dispatchEvent(event);
      return event.defaultPrevented;
    },
    { deltaY: 60, ctrlKey: true, bubbles: true, cancelable: true },
  );
  expect(overCode).toBe(true);
  await expect.poll(viewport).not.toBe(zoomBefore);

  // Its title bar still drags the node.
  const before = await demo.evaluate((el) => el.style.transform);
  const bar = demo.getByText('Demo', { exact: true });
  const box = await bar.boundingBox();
  if (!box) throw new Error('demo title bar not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 80, { steps: 8 });
  await page.mouse.up();
  expect(await demo.evaluate((el) => el.style.transform)).not.toBe(before);

  // The switcher lists this canvas, checked, and offers New canvas in edit mode.
  await switcher.click();
  await expect(page.getByRole('menuitemradio', { name: slug })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('menuitem', { name: 'New canvas' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
});
