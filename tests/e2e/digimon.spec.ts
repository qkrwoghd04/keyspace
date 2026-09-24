import { test, expect, type Page } from '@playwright/test';

async function enter(page: Page) {
  await page.goto('/');
  await page.locator('.collection-sidebar [data-theme="digimon"]').click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'digimon');
}
const state = (page: Page) => page.evaluate(() => window.__keyspace!.state());

test('Digimon replaces the retired theme without leaving its controls or module requests', async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await enter(page);
  await expect(page.locator('.collection-sidebar [data-theme]')).toHaveCount(14);
  await expect(page.getByRole('button', { name: '귀멸의 칼날', exact: true })).toHaveCount(0);
  await expect(page.locator('.breath-controls')).toHaveCount(0);
  await expect(page.locator('.partner-caption')).toContainText('진화');
  expect(requests.some(url => /demon-slayer|BreathController|BreathControls/.test(url))).toBe(false);
  expect(await page.locator('.collection-sidebar [data-theme="digimon"] img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('native Enter reaches the final stage, each Space skill works and text stays native', async ({ page }) => {
  await page.clock.install(); await enter(page);
  await page.locator('#typing-space').focus(); await page.keyboard.type('Agumon'); await page.clock.runFor(50);
  expect((await state(page)).effects.mechanism!.packets).toBeGreaterThan(0);
  await page.keyboard.press('Enter'); await page.clock.runFor(700);
  expect((await state(page)).effects.mechanism).toMatchObject({ form: 'greymon', armorVisible: true });
  expect((await state(page)).effects.waves).toBe(3);
  await page.clock.runFor(800); await page.keyboard.press('Space'); await page.clock.runFor(60);
  expect((await state(page)).effects.flames).toBeGreaterThan(0);
  await expect(page.locator('#typing-space')).toHaveValue('Agumon\n ');
  await page.clock.runFor(8500);
  expect((await state(page)).effects.mechanism).toMatchObject({ form: 'greymon', armorVisible: true, packets: 0 });
  await page.keyboard.press('Enter'); await page.clock.runFor(700);
  expect((await state(page)).effects.mechanism).toMatchObject({ form: 'metalgreymon', cyberVisible: true, warriorVisible: false });
  await page.clock.runFor(800); await page.keyboard.press('Space'); await page.clock.runFor(300);
  expect((await state(page)).effects.mechanism!.missiles).toBe(2);
  await page.clock.runFor(1200); await page.keyboard.press('Enter'); await page.clock.runFor(700);
  expect((await state(page)).effects.mechanism).toMatchObject({ form: 'wargreymon', final: true, cyberVisible: false, warriorVisible: true });
  await page.clock.runFor(800); await page.keyboard.press('Space'); await page.clock.runFor(450);
  expect((await state(page)).effects.mechanism!.gaiaVisible).toBe(true);
  await page.clock.runFor(20000); await page.keyboard.press('Enter'); await page.clock.runFor(1500);
  expect((await state(page)).effects.mechanism).toMatchObject({ form: 'wargreymon', gaiaVisible: false, missiles: 0 });
  await expect(page.locator('#typing-space')).toHaveValue('Agumon\n \n \n \n');
  expect((await state(page)).input.pressedCodes).toEqual([]);
});

test('final-stage geometry and Gaia Force fit desktop, tablet and small mobile screens', async ({ page }) => {
  await page.clock.install(); await enter(page); await page.locator('#typing-space').focus();
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await page.clock.runFor(1450); }
  for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height }); await page.clock.runFor(80);
    await page.locator('#typing-space').focus(); await page.keyboard.press('Space'); await page.clock.runFor(500);
    const snapshot = await state(page);
    expect(snapshot.effects.mechanism).toMatchObject({ form: 'wargreymon', gaiaVisible: true });
    expect(snapshot.fits).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.partner-caption')).toBeVisible();
    await page.clock.runFor(1000);
  }
});

test('reset clears evolution and software IME insertion does not invent physical packets', async ({ page }) => {
  await page.clock.install(); await enter(page); await page.locator('#typing-space').focus();
  await page.keyboard.press('Enter'); await page.clock.runFor(650);
  await page.getByRole('button', { name: 'Reset typed text' }).click(); await page.clock.runFor(40);
  expect((await state(page)).effects.mechanism).toMatchObject({ form: 'agumon', armorVisible: false, packets: 0 });
  await page.locator('#typing-space').focus();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.insertText', { text: '한' }); await page.clock.runFor(40);
  await expect(page.locator('#typing-space')).toHaveValue('한');
  expect((await state(page)).effects.mechanism!.packets).toBe(0);
});
