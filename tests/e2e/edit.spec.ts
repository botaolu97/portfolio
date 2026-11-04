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

  // Rotate: drag the dot above the selected note; Shift snaps to 15°.
  await note.click();
  const handle = page.getByRole('slider', { name: 'Rotate' });
  const hb = await handle.boundingBox();
  const nb = await note.boundingBox();
  if (!hb || !nb) throw new Error('rotate handle not visible');
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(nb.x + nb.width + 60, nb.y + 20, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  const paper = note.locator('[class*="_note_"]');
  await expect(paper).toHaveAttribute('style', /rotate\((-?\d+)deg\)/);
  const rotated = Number(
    (await paper.getAttribute('style'))?.match(/rotate\((-?[\d.]+)deg\)/)?.[1],
  );
  expect(rotated).not.toBe(0);
  expect(rotated % 15).toBe(0);

  // Text size: Large scales the note's text (and its headings) up.
  const noteFontSize = () =>
    note
      .locator('p')
      .first()
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  const mediumSize = await noteFontSize();
  await page.getByLabel('Large', { exact: true }).check();
  await expect.poll(noteFontSize).toBeGreaterThan(mediumSize);

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

  // Text boxes are edited in the full-screen view: double-click zooms up, the text becomes
  // editable once landed, and Esc saves and zooms back. Empty lines keep their height.
  await page.getByRole('navigation', { name: 'Add to canvas' }).getByText('Text').click();
  const textNode = page.locator('.react-flow__node-text');
  // The hover lift is for visitors only.
  await textNode.hover();
  await page.waitForTimeout(200);
  expect(
    await textNode.locator('[class*="_text_"]').evaluate((el) => getComputedStyle(el).transform),
  ).toBe('none');
  await textNode.dblclick();
  const reader = page.getByRole('dialog', { name: 'Full text' });
  await expect(page.getByRole('button', { name: /Switch canvas/ })).toHaveCount(0);
  const editor = reader.locator('.ProseMirror');
  await expect(editor).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Line one');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Line three');
  await page.keyboard.press('Escape');
  await expect(reader).toHaveCount(0);
  await expect(textNode).toContainText('Line three');
  const blankLine = textNode.locator('p').nth(1);
  await expect(blankLine).toHaveText('');
  expect(await blankLine.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(5);
  await page.getByRole('button', { name: 'Edit full screen' }).click();
  await expect(reader).toBeVisible();
  await reader.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(reader).toHaveCount(0);

  // A file video fills its box, so in the editor it moves by the strip along its top; the
  // player itself keeps its own drags (seeking) and doesn't move the node.
  await page.getByRole('navigation', { name: 'Add to canvas' }).getByText('Video').click();
  await page
    .getByRole('complementary', { name: 'Inspector' })
    .locator('input[type=file][accept="video/*"]')
    .setInputFiles({
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('not a real video'),
    });
  const videoNode = page.locator('.react-flow__node-video');
  await expect(videoNode.locator('video')).toHaveCount(1);
  const videoAt = () => videoNode.evaluate((el) => el.style.transform);
  const dragFrom = async (selector: string, dy: number) => {
    const b = await videoNode.locator(selector).boundingBox();
    if (!b) throw new Error(`${selector} not visible`);
    await page.mouse.move(b.x + b.width / 2, b.y + dy);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 90, b.y + dy + 60, { steps: 8 });
    await page.mouse.up();
  };
  const videoBefore = await videoAt();
  await dragFrom('video', 60);
  expect(await videoAt()).toBe(videoBefore);
  await videoNode.hover();
  await dragFrom('[class*="_dragStrip_"]', 10);
  expect(await videoAt()).not.toBe(videoBefore);

  // Labels: no box, Fasthand by default; type inline, then change font, size and weight.
  await page.getByRole('navigation', { name: 'Add to canvas' }).getByText('Label').click();
  const label = page.locator('.react-flow__node-label');
  const labelText = label.locator('[class*="_label_"]');
  expect(await labelText.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Fasthand');
  expect(await labelText.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  await labelText.dblclick();
  const labelInput = page.getByRole('textbox', { name: 'Label text' });
  await expect(labelInput).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Hello there');
  await page.keyboard.press('Escape');
  await expect(labelText).toHaveText('Hello there');
  await label.click();
  await page.getByLabel('Font').selectOption('serif');
  await page
    .getByRole('spinbutton')
    .filter({ hasNot: page.locator('[step]') })
    .last()
    .fill('48');
  await page.getByRole('radio', { name: 'Bold', exact: true }).check();
  await expect.poll(() => labelText.evaluate((el) => getComputedStyle(el).fontSize)).toBe('48px');
  expect(await labelText.evaluate((el) => getComputedStyle(el).fontWeight)).toBe('700');

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
    'label',
    'note',
    'shape',
    'text',
    'video',
  ]);
  const codeData = saved.nodes.find((n: { type: string }) => n.type === 'code').data;
  expect(codeData).toMatchObject({ language: 'python', code: 'def hello():\n    return "hi"' });
  expect(codeData.html).toContain('--shiki-dark');
  expect(saved.nodes.find((n: { type: string }) => n.type === 'label').data).toEqual({
    text: 'Hello there',
    font: 'serif',
    size: 48,
    weight: 700,
  });
  const noteData = saved.nodes.find((n: { type: string }) => n.type === 'note').data;
  expect(noteData.color).toBe('pink');
  expect(noteData.size).toBe('lg');
  expect(noteData.rotation % 15).toBe(0);
  expect(noteData.rotation).not.toBe(0);
  expect(noteData.html).toContain('<h1>Plan</h1>');
  expect(noteData.html).toMatch(/data-type="taskList"[\s\S]*Buy milk/);
  expect(noteData.html).toContain('<mark>marked</mark>');
  for (const n of saved.nodes.filter((n: { type: string }) =>
    ['image', 'video'].includes(n.type),
  )) {
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

  // Safari reports a pinch as gesture events; inside a demo or over the interface they zoom the canvas.
  const safariPinch = (target: Window | Document, scale: number) => {
    for (const [type, s] of [
      ['gesturestart', 1],
      ['gesturechange', scale],
      ['gestureend', scale],
    ] as const) {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(e, { scale: s, clientX: 40, clientY: 40 });
      target.dispatchEvent(e);
    }
  };
  // Wait out the window in which a gesture right after a wheel pinch counts as a duplicate.
  await page.waitForTimeout(200);
  zoomBefore = await viewport();
  await frame
    .locator('body')
    .evaluate(
      (_, fn) => new Function('target', 'scale', `(${fn})(target, scale)`)(document, 1.5),
      safariPinch.toString(),
    );
  await expect.poll(viewport).not.toBe(zoomBefore);
  zoomBefore = await viewport();
  await page.evaluate(
    (fn) => new Function('target', 'scale', `(${fn})(target, scale)`)(document, 0.7),
    safariPinch.toString(),
  );
  await expect.poll(viewport).not.toBe(zoomBefore);

  // Swipes stay inside demos and code blocks instead of becoming browser back/forward.
  expect(
    await frame.locator('html').evaluate((el) => getComputedStyle(el).overscrollBehaviorX),
  ).toBe('none');
  expect(
    await code
      .locator('[class*="codeHtml"]')
      .evaluate((el) => getComputedStyle(el).overscrollBehaviorX),
  ).toBe('contain');
  expect(
    await page.locator('html').evaluate((el) => getComputedStyle(el).overscrollBehaviorX),
  ).toBe('none');
  expect(await demo.locator('iframe').getAttribute('src')).toMatch(/\?v=\w+$/);

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
