import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

const fixtures = path.resolve('tests/e2e/fixtures');

/** Serves fixture content in place of whatever is published, so the test doesn't depend on it. */
async function useFixtures(page: Page) {
  await page.route('**/content/maps/index.json', (route) =>
    route.fulfill({
      json: [{ slug: 'e2e-fixture', title: 'E2E fixture', updatedAt: new Date().toISOString() }],
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

  await page.goto('/');
  await expect(page.getByRole('link', { name: /E2E fixture/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New map' })).toHaveCount(0);

  await page.getByRole('link', { name: /E2E fixture/ }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
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
  const header = page.getByRole('banner');
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
});
