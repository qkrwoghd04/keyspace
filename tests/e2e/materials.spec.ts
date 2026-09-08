import { test, expect } from '@playwright/test';

test('Jelly holds a real squash, resumes immediately and leaves text editing native', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Jelly', exact: true }).click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'jelly');
  await page.locator('#typing-space').focus();
  await page.keyboard.down('a');
  await expect.poll(() => page.evaluate(() => window.__keyspace!.state().keys.find(key => key.code === 'KeyA')!.scale[1])).toBeLessThan(.62);
  const strikes = await page.evaluate(() => window.__keyspace!.state().input.pressCount);
  await page.keyboard.down('a');
  expect(await page.evaluate(() => window.__keyspace!.state().input.pressCount)).toBe(strikes);
  await expect(page.locator('#typing-space')).toHaveValue('aa');
  await page.keyboard.up('a');
  await page.waitForTimeout(100);
  await page.keyboard.down('a');
  await expect.poll(() => page.evaluate(() => window.__keyspace!.state().keys.find(key => key.code === 'KeyA')!.scale[1])).toBeLessThan(.62);
  await page.keyboard.up('a');
  await expect.poll(() => page.evaluate(() => window.__keyspace!.state().keys.find(key => key.code === 'KeyA')!.scale[1])).toBeCloseTo(1, 2);
});

test('Inferno keeps a bounded 3D flame field and synchronizes a held key across themes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Inferno', exact: true }).click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'inferno');
  const idle = await page.evaluate(() => window.__keyspace!.state());
  expect(idle.effects.flames).toBeGreaterThan(0);
  expect(idle.effects.flames).toBeLessThanOrEqual(48);
  await page.locator('#typing-space').focus();
  await page.keyboard.down('a');
  const strikes = await page.evaluate(() => window.__keyspace!.state().input.pressCount);
  await page.getByRole('button', { name: 'Jelly', exact: true }).click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'jelly');
  const held = await page.evaluate(() => window.__keyspace!.state());
  expect(held.input.pressCount).toBe(strikes);
  expect(held.input.pressedCodes).toContain('KeyA');
  expect(held.keys.find(key => key.code === 'KeyA')!.scale[1]).toBeCloseTo(.6, 2);
  expect(held.effects.flames).toBe(0);
  await page.keyboard.up('a');
  await expect.poll(() => page.evaluate(() => window.__keyspace!.state().input.pressedCodes.length)).toBe(0);
});
