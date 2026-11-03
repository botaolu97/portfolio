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

  await expect(page.locator('.react-flow__node')).toHaveCount(5);

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
