import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

const fixtures = path.resolve('tests/e2e/fixtures');

/** Serves fixture content in place of whatever is published, so the test doesn't depend on it. */
async function useFixtures(page: Page) {
  await page.route('**/content/maps/index.json', (route) =>
    route.fulfill({
      json: [
        { slug: 'e2e-fixture', title: 'E2E fixture', updatedAt: new Date().toISOString() },
        { slug: 'e2e-other', title: 'Other canvas', updatedAt: new Date().toISOString() },
      ],
    }),
  );
  await page.route('**/content/maps/e2e-other.json', (route) =>
    route.fulfill({
      json: {
        version: 2,
        title: 'Other canvas',
        nodes: [
          { id: 'o', type: 'note', position: { x: 0, y: 0 }, data: { html: '<p>Other note</p>' } },
        ],
        edges: [],
      },
    }),
  );
  await page.route('**/content/maps/e2e-fixture.json', (route) =>
    route.fulfill({ path: path.join(fixtures, 'e2e-fixture.json') }),
  );
  await page.route('**/content/demos/d-e2e/**', (route) =>
    route.fulfill({
      path: path.join(fixtures, 'd-e2e', path.basename(new URL(route.request().url()).pathname)),
    }),
  );
}

test('published site is read-only and demos still run', async ({ page }) => {
  const editorRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/__mubu/')) editorRequests.push(req.url());
  });
  await useFixtures(page);

  // The root opens the first canvas; the switcher lists canvases but can't create one.
  await page.goto('/');
  await expect(page).toHaveURL(/#\/m\/e2e-fixture$/);
  const switcher = page.getByRole('button', { name: /Switch canvas/ });
  await expect(switcher).toContainText('E2E fixture');
  await switcher.click();
  await expect(page.getByRole('menuitemradio', { name: 'E2E fixture' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('menuitemradio', { name: 'Other canvas' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'New canvas' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('banner')).toHaveCount(0);

  await expect(page.locator('.react-flow__node')).toHaveCount(6);

  // Interactive boxes lift slightly on hover: text, video, demo and stacks (not notes or shapes).
  const scaleOf = (locator: ReturnType<typeof page.locator>) =>
    locator.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  for (const [id, part] of [
    ['note', '[class*="_text_"]'],
    ['demo', '[class*="_demo_"]'],
    ['pile', '[class*="_stack_"]'],
  ] as const) {
    const box = page.locator(`.react-flow__node[data-id="${id}"] ${part}`).first();
    await box.hover();
    await expect.poll(() => scaleOf(box)).toBeCloseTo(1.02, 3);
  }
  await page.locator('.react-flow__node-shape').hover();
  expect(await scaleOf(page.locator('.react-flow__node-shape > div').first())).toBe(1);
  await page.mouse.move(8, 8);

  // In the reader the text is a third of the window wide, selection is a subtle gray, and the
  // custom scrollbar (thumb only, 24px from the edge) fades in on scroll and out 2s later.
  await page.locator('.react-flow__node[data-id="longread"] [class*="_text_"]').click();
  const longReader = page.getByRole('dialog', { name: 'Full text' });
  await expect(longReader).toBeVisible();
  await page.waitForTimeout(500);
  const readerText = longReader.locator('[class*="_block_"]');
  const textWidth = (await readerText.boundingBox())?.width ?? 0;
  expect(textWidth).toBeGreaterThan(1280 / 3 - 4);
  expect(textWidth).toBeLessThan(1280 / 3 + 4);
  expect(
    await longReader
      .locator('p')
      .first()
      .evaluate((el) => getComputedStyle(el, '::selection').backgroundColor),
  ).toBe('rgba(28, 28, 26, 0.12)');
  const thumb = longReader.locator('[class*="_thumb_"]');
  const thumbOpacity = () => thumb.evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(await thumbOpacity()).toBe(0);
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 500);
  await expect.poll(thumbOpacity).toBe(1);
  const thumbBox = await thumb.boundingBox();
  expect(1280 - ((thumbBox?.x ?? 0) + (thumbBox?.width ?? 0))).toBeCloseTo(24, 0);
  // 24px from the bottom edge once scrolled to the end (and from the top at the start).
  await page.mouse.wheel(0, 20000);
  await expect
    .poll(async () => {
      const b = await thumb.boundingBox();
      return Math.round(800 - ((b?.y ?? 0) + (b?.height ?? 0)));
    })
    .toBe(24);
  await page.mouse.wheel(0, -20000);
  await expect.poll(async () => Math.round((await thumb.boundingBox())?.y ?? 0)).toBe(24);
  await page.waitForTimeout(2300);
  await expect.poll(thumbOpacity, { timeout: 2000 }).toBe(0);
  await page.keyboard.press('Escape');
  await expect(longReader).toHaveCount(0);

  // Clicking a stack spreads it out over a blurred canvas; Esc or a click outside stacks it again.
  const pile = page.locator('.react-flow__node-stack');
  await pile.click();
  const spread = page.getByRole('dialog', { name: '2 stacked images' });
  await expect(spread).toBeVisible();
  await expect(spread.getByRole('img')).toHaveCount(2);
  await spread.getByRole('img', { name: 'Red' }).click();
  await expect(spread).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(spread).toHaveCount(0);
  await pile.click();
  await expect(spread).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(spread).toHaveCount(0);

  const snippet = page.locator('.react-flow__node-code');
  await expect(snippet).toContainText('const fixture = true;');
  await expect(snippet.getByText('fixture.ts')).toBeVisible();
  await expect(snippet.getByRole('button', { name: 'Copy' })).toBeVisible();
  await expect(page.getByText('Fixture note')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload files' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Add to canvas' })).toHaveCount(0);

  // Nodes can't be dragged in view mode (the canvas may pan, but the node keeps its position).
  const shape = page.locator('.react-flow__node-shape');
  const transform = () => shape.evaluate((el) => el.style.transform);
  const before = await transform();
  await shape.hover();
  await page.mouse.down();
  await page.mouse.move(100, 700, { steps: 5 });
  await page.mouse.up();
  expect(await transform()).toBe(before);

  // Nodes can still be hovered and selected, to show they could be edited.
  await shape.click();
  await expect(shape).toHaveClass(/selected/);
  await expect(shape.getByText('Shape · 160 × 100')).toBeVisible();
  await page.keyboard.press('Backspace');
  await expect(shape).toHaveCount(1);
  await page.locator('.react-flow__pane').click({ position: { x: 15, y: 15 } });
  await expect(shape).not.toHaveClass(/selected/);

  // Demos are interactive without any extra step.
  const frame = page.frameLocator('.react-flow__node-demo iframe');
  await frame.getByRole('button').click();
  await expect(frame.getByRole('button')).toHaveText('Clicked 1');

  // Text boxes: 10% padding except at the bottom, clipped without a scrollbar; a click zooms up
  // into the full-screen reader (theme switch only), and Esc or Back zooms back.
  const textBox = page.locator('.react-flow__node[data-id="note"] [class*="_text_"]');
  const boxStyle = await textBox.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      overflow: s.overflowY,
      top: s.paddingTop,
      bottom: s.paddingBottom,
      width: (el as HTMLElement).offsetWidth,
    };
  });
  expect(boxStyle).toMatchObject({ overflow: 'hidden', bottom: '0px' });
  expect(Number.parseFloat(boxStyle.top)).toBeCloseTo(boxStyle.width * 0.1, 0);
  const reader = page.getByRole('dialog', { name: 'Full text' });
  await textBox.click();
  await expect(reader).toBeVisible();
  await expect(reader).toContainText('Fixture note');
  await expect(switcher).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Dark theme' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(reader).toHaveCount(0);
  await expect(switcher).toBeVisible();
  // Right after landing, the box under the pointer doesn't lift until the pointer leaves and returns.
  await expect(textBox).toHaveAttribute('data-landing', 'true');
  expect(await scaleOf(textBox)).toBe(1);
  await page.mouse.move(8, 8);
  await textBox.hover();
  await expect.poll(() => scaleOf(textBox)).toBeCloseTo(1.02, 3);
  await textBox.click();
  await reader.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(reader).toHaveCount(0);

  // Zoom gestures over the interface zoom the canvas, never the page.
  const viewport = () => page.locator('.react-flow__viewport').evaluate((el) => el.style.transform);
  const header = switcher;
  const headerBox = await header.boundingBox();
  const beforeZoom = await viewport();
  const pinchPrevented = await header.evaluate((el) => {
    const pinch = new WheelEvent('wheel', {
      deltaY: -100,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(pinch);
    return pinch.defaultPrevented;
  });
  expect(pinchPrevented).toBe(true);
  await expect.poll(viewport).not.toBe(beforeZoom);
  const afterPinch = await viewport();
  // Keys go to whatever has focus; after using a demo, that's its iframe, so click the canvas.
  await page.locator('.react-flow__pane').click({ position: { x: 15, y: 15 } });
  await page.keyboard.press('ControlOrMeta+-');
  await expect.poll(viewport).not.toBe(afterPinch);
  expect(await header.boundingBox()).toEqual(headerBox);

  // The theme switch overrides the system theme and remembers the choice.
  const html = page.locator('html');
  const themeSwitch = page.getByRole('switch', { name: 'Dark theme' });
  await expect(themeSwitch).toHaveAttribute('aria-checked', 'false');
  await themeSwitch.click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const canvasColor = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await canvasColor()).toBe('rgb(22, 22, 21)');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('switch', { name: 'Dark theme' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('switch', { name: 'Dark theme' }).click();
  expect(await canvasColor()).toBe('rgb(246, 246, 244)');

  expect(editorRequests).toEqual([]);

  // Switch to another canvas from the menu.
  await switcher.click();
  await page.getByRole('menuitemradio', { name: 'Other canvas' }).click();
  await expect(page).toHaveURL(/#\/m\/e2e-other$/);
  await expect(switcher).toContainText('Other canvas');
  await expect(page.getByText('Other note')).toBeVisible();
});
