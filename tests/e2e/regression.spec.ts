import { test, expect } from '@playwright/test';

const themes = ['Studio', 'Dark', 'Glass', 'Neon', 'Inferno', 'Glacier', 'Jelly', 'Grove', 'Orbit'];

test('all nine themes retain text, fit their canvas and use static previews', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.collection-sidebar .collection-item')).toHaveCount(14);
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.locator('#typing-space').fill('Keep this thought.');
  for (const name of themes) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', name.toLowerCase());
    await expect(page.locator('#typing-space')).toHaveValue('Keep this thought.');
    await expect.poll(() => page.evaluate(() => window.__keyspace!.state().fits)).toBe(true);
  }
  const images = await page.locator('.collection-sidebar .collection-group:not([aria-label="ANIMATION"]) img').evaluateAll(images => images.map(image => ({ complete: (image as HTMLImageElement).complete, width: (image as HTMLImageElement).naturalWidth })));
  expect(images.every(image => image.complete && image.width > 0)).toBe(true);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`viewport ${viewport.width}x${viewport.height} keeps every hero in frame`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    for (const name of ['Inferno', 'Grove', 'Orbit']) {
      if (viewport.width < 1024) await page.locator('.mobile-collection-open').click();
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', name.toLowerCase());
      await expect.poll(() => page.evaluate(() => window.__keyspace!.state().fits)).toBe(true);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
    }
    if (viewport.width < 1024) expect(await page.evaluate(() => window.__keyspace!.state().quality)).toBe('low');
    await page.screenshot({ path: `artifacts/responsive/${viewport.width}x${viewport.height}.png`, fullPage: true });
  });
}

test('native selection, deletion, newline, copy and paste stay independent of 3D input', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('#typing-space');
  await editor.focus();
  await page.keyboard.type('hello');
  await page.keyboard.press('Enter');
  await page.keyboard.type('world');
  await expect(editor).toHaveValue('hello\nworld');
  await page.keyboard.press('Backspace');
  await expect(editor).toHaveValue('hello\nworl');
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Meta+v');
  await expect(editor).toHaveValue('hello\nworl\nhello\nworl');
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await expect(editor).toHaveValue('');
});

test('virtual pointer editing replaces the native selection and cancels captured holds', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('#typing-space');
  await editor.fill('hello');
  await editor.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(1, 4));
  const point = await page.evaluate(() => window.__keyspace!.keyPoint('KeyA'));
  await page.mouse.click(point!.x, point!.y);
  await expect(editor).toHaveValue('hao');
  await page.mouse.move(point!.x, point!.y); await page.mouse.down();
  await expect.poll(() => page.evaluate(() => window.__keyspace!.state().input.pressedCodes.includes('KeyA'))).toBe(true);
  // A browser-delivered pointer cancellation must clear the captured source.
  await page.locator('canvas').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__keyspace!.state().input.pressedCodes.length)).toBe(0);
});

test('six physical holds clean up on blur without clearing the text', async ({ page }) => {
  await page.goto('/');
  await page.locator('#typing-space').focus();
  for (const key of ['a', 's', 'd', 'j', 'k', 'l']) await page.keyboard.down(key);
  await expect.poll(() => page.evaluate(() => window.__keyspace!.state().input.pressedCodes.length)).toBe(6);
  await page.waitForTimeout(5000);
  const value = await page.locator('#typing-space').inputValue();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(() => window.__keyspace!.state().input.pressedCodes)).toEqual([]);
  await expect(page.locator('#typing-space')).toHaveValue(value);
  for (const key of ['a', 's', 'd', 'j', 'k', 'l']) await page.keyboard.up(key);
});

test('rapid theme selection commits only the last request', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    for (const label of ['Glacier', 'Grove', 'Jelly', 'Orbit', 'Inferno']) document.querySelector<HTMLButtonElement>(`.collection-sidebar button[aria-label="${label}"]`)!.click();
  });
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'inferno');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__keyspace!.state().theme)).toBe('inferno');
});

test('a load failure keeps the current model and text available', async ({ page }) => {
  await page.route('**/src/themes/orbit.ts*', route => route.abort());
  await page.goto('/');
  await page.locator('#typing-space').fill('Still here.');
  await page.getByRole('button', { name: 'Orbit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'studio');
  await expect(page.locator('#typing-space')).toHaveValue('Still here.');
  await expect(page.getByRole('button', { name: 'Orbit', exact: true })).toHaveAttribute('aria-busy', 'false');
  await page.unroute('**/src/themes/orbit.ts*');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'orbit');
  await expect(page.locator('#typing-space')).toHaveValue('Still here.');
});

test('sound preferences persist, buffers stay bounded and mute disconnects voices', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => window.__keyspace!.state().audio.state)).toBe('not-created');
  await page.getByRole('button', { name: 'Enable keyboard sound' }).click();
  await page.getByRole('slider', { name: 'Master volume' }).fill('27');
  for (const name of themes) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', name.toLowerCase());
    await page.locator('#typing-space').focus();
    await page.keyboard.press('a');
    const audio = await page.evaluate(() => window.__keyspace!.state().audio);
    expect(audio.profile).toBe(name.toLowerCase()); expect(audio.volume).toBe(.27); expect(audio.enabled).toBe(true);
    expect(audio.voices).toBeLessThanOrEqual(16); expect(audio.buffers).toBeLessThanOrEqual(54);
  }
  await page.getByRole('button', { name: 'Disable keyboard sound' }).click();
  await page.getByRole('button', { name: 'Jelly', exact: true }).click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'jelly');
  expect(await page.evaluate(() => window.__keyspace!.state().audio)).toMatchObject({ enabled: false, volume: .27, sources: 0 });
});

test('reduced motion settles all idle themes while preserving a jelly hold', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const name of ['Inferno', 'Glacier', 'Grove', 'Orbit', 'Jelly']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', name.toLowerCase());
    await page.waitForTimeout(150);
    const frames = await page.evaluate(() => window.__keyspace!.state().frames);
    await page.waitForTimeout(180);
    expect(await page.evaluate(() => window.__keyspace!.state().frames)).toBe(frames);
  }
  await page.locator('#typing-space').focus(); await page.keyboard.down('a');
  await expect.poll(() => page.evaluate(() => window.__keyspace!.state().keys.find(key => key.code === 'KeyA')!.scale[1])).toBe(.6);
  await page.keyboard.up('a');
});

test('simulated visibility changes stop RAF, voices and held sources', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Inferno', exact: true }).click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'inferno');
  await page.getByRole('button', { name: 'Enable keyboard sound' }).click();
  await page.locator('#typing-space').focus(); await page.keyboard.down('a');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const stopped = await page.evaluate(() => window.__keyspace!.state());
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__keyspace!.state().frames)).toBe(stopped.frames);
  expect(stopped.input.pressedCodes).toEqual([]); expect(stopped.audio.sources).toBe(0); expect(stopped.audio.state).toBe('suspended');
  await page.evaluate(() => { delete (document as unknown as { hidden?: boolean }).hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.keyboard.up('a');
  await expect.poll(() => page.evaluate(() => window.__keyspace!.state().frames)).toBeGreaterThan(stopped.frames);
});

test('composition guard blocks virtual insertion without taking over native editing', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('#typing-space');
  await editor.fill('한글');
  // This tests our guard only, not an operating-system IME.
  await editor.dispatchEvent('compositionstart', { data: 'ㅎ' });
  const point = await page.evaluate(() => window.__keyspace!.keyPoint('KeyA'));
  await page.mouse.click(point!.x, point!.y);
  await expect(editor).toHaveValue('한글');
  await editor.dispatchEvent('compositionend', { data: '한' });
  await page.waitForTimeout(100);
  await page.mouse.click(point!.x, point!.y);
  await expect(editor).toHaveValue('한글a');
});

test('physical and pointer sources share a strike and a theme switch clears capture', async ({ page }) => {
  await page.goto('/');
  await page.locator('#typing-space').focus();
  await page.keyboard.down('a');
  const strikes = await page.evaluate(() => window.__keyspace!.state().input.pressCount);
  const point = await page.evaluate(() => window.__keyspace!.keyPoint('KeyA'));
  await page.mouse.move(point!.x, point!.y); await page.mouse.down();
  expect(await page.evaluate(() => window.__keyspace!.state().input.pressCount)).toBe(strikes);
  await page.keyboard.up('a');
  expect(await page.evaluate(() => window.__keyspace!.state().input.pressedCodes)).toContain('KeyA');
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('.collection-sidebar button[aria-label="Jelly"]')!.click());
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'jelly');
  expect(await page.evaluate(() => window.__keyspace!.state().input.pressedCodes)).toEqual([]);
  await page.mouse.up();
});

test('emulated touch cancellation releases the key without opening the software keyboard', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:5180');
    await page.waitForFunction(() => !!window.__keyspace);
    const point = await page.evaluate(() => window.__keyspace!.keyPoint('KeyA'));
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point!.x, y: point!.y }] });
    await expect.poll(() => page.evaluate(() => window.__keyspace!.state().input.pressedCodes.includes('KeyA'))).toBe(true);
    await expect(page.locator('#typing-space')).toHaveValue('a');
    await expect(page.locator('#typing-space')).not.toBeFocused();
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.__keyspace!.state().input.pressedCodes.length)).toBe(0);
    await session.detach();
  } finally { await context.close(); }
});

test('WebGL startup failure retains text editing and usable theme controls', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.locator('.scene-fallback')).toBeVisible();
  await page.locator('#typing-space').fill('Still a place to type.');
  await page.getByRole('button', { name: 'Orbit', exact: true }).click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'orbit');
  await expect(page.locator('#typing-space')).toHaveValue('Still a place to type.');
  await expect(page.locator('.theme-status')).toBeEmpty();
});
