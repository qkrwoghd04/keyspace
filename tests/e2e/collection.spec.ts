import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => !!window.__keyspace);
});

test('classic switching retains text, selection and canvas identity', async ({ page }) => {
  const editor = page.locator('#typing-space');
  await editor.fill('A little room. 한글');
  await editor.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(2, 8));
  await page.locator('canvas').evaluate(node => node.setAttribute('data-original', 'true'));
  for (const name of ['Dark', 'Glass', 'Neon', 'Studio']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', name.toLowerCase());
    await expect(editor).toHaveValue('A little room. 한글');
    expect(await editor.evaluate((node: HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd])).toEqual([2, 8]);
    await expect(page.locator('canvas')).toHaveAttribute('data-original', 'true');
  }
});

test('keyboard navigation in controls does not strike physical keys', async ({ page }) => {
  const start = await page.evaluate(() => window.__keyspace!.state().input.pressCount);
  await page.getByRole('button', { name: 'Dark', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'dark');
  await page.getByRole('slider', { name: 'Master volume' }).focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => window.__keyspace!.state().input.pressCount)).toBe(start);
});

test('collapse expands the main room without replacing the canvas', async ({ page }) => {
  const before = await page.locator('canvas').boundingBox();
  await page.getByRole('button', { name: 'Collapse collection' }).click();
  await expect(page.locator('.collection-sidebar')).toBeHidden();
  const after = await page.locator('canvas').boundingBox();
  expect(after!.width).toBeGreaterThan(before!.width);
  await page.getByRole('button', { name: 'Open collection' }).click();
  await expect(page.locator('.collection-sidebar')).toBeVisible();
});

test('mobile sheet selects, closes and returns focus without summoning the editor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.locator('.mobile-collection-open');
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'dark');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
});
