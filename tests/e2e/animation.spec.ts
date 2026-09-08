import { test, expect, type Page } from '@playwright/test';

const animation = ['demon-slayer', 'pokemon', 'spider-verse', 'howl', 'evangelion'];
async function select(page: Page, id: string) {
  if (page.viewportSize()!.width < 1024) await page.locator('.mobile-collection-open').click();
  await page.locator(`.collection-item[data-theme="${id}"]:visible`).click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', id);
}
async function strike(page: Page, code = 'KeyA') {
  return page.evaluate(async code => {
    const editor = document.querySelector<HTMLTextAreaElement>('#typing-space')!;
    editor.focus();
    editor.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    editor.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    await new Promise(requestAnimationFrame);
    return window.__keyspace!.state();
  }, code);
}

test('14 themes retain the same canvas, keys, native content, selection and audio preferences', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable keyboard sound' }).click();
  await page.getByRole('slider', { name: 'Master volume' }).fill('27');
  await page.locator('#typing-space').fill('안녕\nKeep this thought.');
  await page.locator('#typing-space').evaluate((editor: HTMLTextAreaElement) => editor.setSelectionRange(3, 7));
  const canvas = await page.locator('canvas').elementHandle();
  const ids = await page.locator('.collection-sidebar [data-theme]').evaluateAll(buttons => buttons.map(button => (button as HTMLElement).dataset.theme!));
  expect(ids).toHaveLength(14);
  for (const id of ids) {
    await select(page, id);
    await expect(page.locator('#typing-space')).toHaveValue('안녕\nKeep this thought.');
    expect(await page.locator('#typing-space').evaluate((editor: HTMLTextAreaElement) => [editor.selectionStart, editor.selectionEnd])).toEqual([3, 7]);
    expect(await canvas!.evaluate(canvas => canvas === document.querySelector('canvas'))).toBe(true);
    const state = await page.evaluate(() => window.__keyspace!.state());
    expect(state.keys).toHaveLength(82); expect(state.fits).toBe(true);
    expect(state.audio).toMatchObject({ profile: id, enabled: true, volume: .27 });
  }
  await page.getByRole('button', { name: 'Disable keyboard sound' }).click();
  await select(page, 'pokemon');
  expect(await page.evaluate(() => window.__keyspace!.state().audio)).toMatchObject({ enabled: false, volume: .27 });
});

test('all groups collapse with keyboard controls, and the selected theme remains locatable', async ({ page }) => {
  await page.goto('/');
  await select(page, 'howl');
  const count = await page.evaluate(() => window.__keyspace!.state().input.pressCount);
  for (const category of ['CLASSIC', 'EXPERIMENTAL', 'ANIMATION']) {
    const toggle = page.getByRole('button', { name: `${category} group`, exact: true });
    await toggle.focus(); await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  }
  await expect(page.locator('.collection-sidebar [aria-label="ANIMATION"] .group-current')).toHaveText('하울의 움직이는 성');
  expect(await page.evaluate(() => window.__keyspace!.state().input.pressCount)).toBe(count);
  await page.getByRole('button', { name: 'Find selected theme' }).click();
  await expect(page.getByRole('button', { name: 'ANIMATION group', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.collection-sidebar [data-theme="howl"]')).toBeInViewport();
  await expect(page.locator('.collection-sidebar [data-theme="howl"]')).toHaveAttribute('aria-pressed', 'true');
});

test('water and slash trails follow input order including a repeated key', async ({ page }) => {
  await page.goto('/'); await select(page, 'demon-slayer');
  await page.locator('#typing-space').focus();
  await page.keyboard.type('jajj', { delay: 30 });
  await expect.poll(() => page.evaluate(() => window.__keyspace!.state().effects.recentKeys)).toEqual(['KeyJ', 'KeyA', 'KeyJ', 'KeyJ']);
  const state = await page.evaluate(() => window.__keyspace!.state());
  expect(state.effects.waves).toBeGreaterThan(0);
  await expect(page.locator('#typing-space')).toHaveValue('jajj');
});

test('the companion reacts to ordinary typing and the ball and charge have distinct gestures', async ({ page }) => {
  await page.goto('/'); await select(page, 'pokemon');
  const ordinary = await strike(page);
  expect(ordinary.effects.mechanism!.companionEnergy).toBeGreaterThan(0);
  expect(ordinary.effects.mechanism!.companionLook).toBeGreaterThan(0);
  expect(ordinary.effects.signature!.active).toBe(false);
  await strike(page, 'Enter'); await page.waitForTimeout(300);
  expect((await page.evaluate(() => window.__keyspace!.state().effects.mechanism))!.ballOpen).toBeGreaterThan(.3);
  await page.waitForTimeout(1200);
  const charge = await strike(page, 'Space');
  expect(charge.effects.signature).toMatchObject({ active: true, kind: 'space', starts: 2, queued: 0 });
  expect(charge.effects.waves).toBe(2);
  expect(charge.effects.mechanism!.ballOpen).toBe(0);
});

test('comic stepped decoration does not delay physical keys or native editing', async ({ page }) => {
  await page.goto('/'); await select(page, 'spider-verse');
  const rest = await page.evaluate(() => window.__keyspace!.state().keys.find(key => key.code === 'KeyA')!.position[1]);
  await page.locator('#typing-space').focus(); await page.keyboard.down('a');
  await expect(page.locator('#typing-space')).toHaveValue('a');
  const state = await page.evaluate(async () => { await new Promise(requestAnimationFrame); return window.__keyspace!.state(); });
  expect(state.keys.find(key => key.code === 'KeyA')!.position[1]).toBeLessThan(rest);
  expect(state.effects.mechanism!.renderStyle).toBe('toon-halftone-outline');
  expect(state.effects.mechanism!.ghosts).toBeGreaterThan(0);
  await page.keyboard.up('a'); await page.keyboard.press('Enter'); await page.keyboard.type('b c');
  await page.keyboard.press('Backspace');
  await expect(page.locator('#typing-space')).toHaveValue('a\nb ');
});

test('ordinary typing powers the boiler-house joints without starting a hero gesture', async ({ page }) => {
  await page.goto('/'); await select(page, 'howl');
  const state = await strike(page);
  for (const field of ['gearEnergy', 'windowHeat', 'legEnergy', 'steam']) expect(state.effects.mechanism![field]).toBeGreaterThan(0);
  expect(state.effects.signature!.active).toBe(false);
  await strike(page, 'Enter');
  await expect.poll(() => page.evaluate(() => window.__keyspace!.state().effects.signature!.active)).toBe(true);
});

test('hangar joints move in latch, piston, armor order and return fully closed', async ({ page }) => {
  await page.goto('/'); await select(page, 'evangelion');
  const samples = await page.evaluate(async () => {
    const editor = document.querySelector<HTMLTextAreaElement>('#typing-space')!; editor.focus();
    editor.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
    editor.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', bubbles: true }));
    const samples = []; const start = performance.now();
    while (performance.now() - start < 800) {
      await new Promise(requestAnimationFrame);
      samples.push(window.__keyspace!.state().effects.mechanism!);
    }
    return samples;
  });
  const onset = ['latch', 'piston', 'armor'].map(field => samples.findIndex(sample => Number(sample[field]) > .01));
  expect(onset[0]).toBeGreaterThanOrEqual(0); expect(onset[1]).toBeGreaterThan(onset[0]); expect(onset[2]).toBeGreaterThan(onset[1]);
  expect(samples.at(-1)).toMatchObject({ latch: 0, piston: 0, armor: 0, activeModules: 0 });
});

for (const id of animation) {
  test(`${id} bounds 2000 hero requests to one non-queued gesture`, async ({ page }) => {
    await page.goto('/'); await select(page, id);
    const state = await page.evaluate(async () => {
      const editor = document.querySelector<HTMLTextAreaElement>('#typing-space')!; editor.focus();
      for (let i = 0; i < 2000; i++) {
        const code = i % 2 ? 'Space' : 'Enter';
        editor.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
      }
      await new Promise(requestAnimationFrame);
      return window.__keyspace!.state();
    });
    expect(state.input.pressCount).toBe(2000); expect(state.input.pressedCodes).toEqual([]);
    expect(state.effects.signature).toMatchObject({ active: true, starts: 1, queued: 0 });
    expect(state.effects.waves).toBeLessThanOrEqual(state.quality === 'low' ? 4 : 12);
    expect(state.effects.particles).toBeLessThanOrEqual(state.quality === 'low' ? 48 : 128);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__keyspace!.state().effects.signature)).toMatchObject({ active: false, starts: 1, queued: 0 });
    const next = await strike(page, 'Space');
    expect(next.effects.signature).toMatchObject({ active: true, starts: 2, kind: 'space', queued: 0 });
  });
}

test('reduced motion settles every animation theme and suppresses hero gestures', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  for (const id of animation) {
    await select(page, id); await page.waitForTimeout(180);
    const frames = await page.evaluate(() => window.__keyspace!.state().frames);
    await page.waitForTimeout(180);
    expect(await page.evaluate(() => window.__keyspace!.state().frames)).toBe(frames);
    const state = await strike(page, 'Enter');
    expect(state.effects.signature).toMatchObject({ active: false, starts: 0, queued: 0 });
  }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`all animation silhouettes fit ${viewport.width}x${viewport.height}, including signature effects`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.goto('/');
    for (const id of animation) {
      await select(page, id);
      if (viewport.width < 1024) { await expect(page.locator('.collection-sheet')).not.toBeVisible(); await expect(page.locator('.mobile-collection-open')).toBeFocused(); }
      await strike(page, 'Enter'); await page.waitForTimeout(200);
      expect(await page.evaluate(() => window.__keyspace!.state().fits)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      if (viewport.width === 390) await page.screenshot({ path: `artifacts/animation/mobile-${id}.png`, fullPage: true });
    }
  });
}
