import { test, expect, type Page } from '@playwright/test';

async function enter(page: Page) {
  await page.goto('/');
  if (page.viewportSize()!.width < 1024) await page.locator('.mobile-collection-open').click();
  await page.locator('[data-theme="demon-slayer"]:visible').click();
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'water');
}
async function rhythm(page: Page, text: string) {
  for (const char of text) { await page.keyboard.type(char); await page.clock.runFor(100); }
}
const telemetry = (page: Page) => page.evaluate(() => window.__keyspace!.state());

test('breathing controls are theme-local, keyboard-accessible, keep text, selection, volume and canvas', async ({ page }) => {
  await enter(page);
  await page.locator('#typing-space').fill('Keep this / 한글');
  await page.locator('#typing-space').evaluate((input: HTMLTextAreaElement) => input.setSelectionRange(2, 6));
  await page.getByRole('button', { name: 'Enable keyboard sound' }).click();
  await page.getByRole('slider', { name: 'Master volume' }).fill('23');
  const canvas = await page.locator('canvas').elementHandle(), before = await telemetry(page);
  await page.getByRole('button', { name: 'Breath sun', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'sun');
  expect(await page.locator('#typing-space').evaluate((input: HTMLTextAreaElement) => [input.selectionStart, input.selectionEnd])).toEqual([2, 6]);
  await expect(page.locator('#typing-space')).toHaveValue('Keep this / 한글');
  expect(await canvas!.evaluate(canvas => canvas === document.querySelector('canvas'))).toBe(true);
  const after = await telemetry(page);
  expect(after.input.pressCount).toBe(before.input.pressCount);
  expect(after.audio).toMatchObject({ profile: 'demon-slayer', breath: 'sun', enabled: true, volume: .23 });
  await page.getByRole('button', { name: 'Breath water', exact: true }).click();
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'water');
  await page.locator('.collection-sidebar [data-theme="studio"]').click();
  await expect(page.locator('.breath-controls')).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Master volume' })).toHaveValue('23');
});

test('connected three-dimensional water and structurally different Sun strikes preserve native text', async ({ page }) => {
  await enter(page); await page.locator('#typing-space').focus(); await page.keyboard.type('asdf', { delay: 65 });
  const water = await telemetry(page);
  expect(water.effects.recentKeys).toEqual(['KeyA', 'KeyS', 'KeyD', 'KeyF']);
  expect(water.effects.mechanism!.links).toBe(3); expect(water.effects.mechanism!.water).toBe(4);
  expect(water.effects.mechanism!.foam).toBeGreaterThan(0); expect(water.effects.mechanism!.sun).toBe(0);
  expect(water.effects.mechanism!.anchorX).toBeCloseTo(water.keys.find(key => key.code === 'KeyF')!.position[0], 1);
  expect(water.effects.mechanism!.anchorZ).toBeCloseTo(water.keys.find(key => key.code === 'KeyF')!.position[2], 1);
  await page.getByRole('button', { name: 'Breath sun', exact: true }).click();
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'sun');
  await page.locator('#typing-space').focus(); await page.keyboard.type('jkl;', { delay: 65 });
  const sun = await telemetry(page);
  expect(sun.effects.mechanism!.sun).toBeGreaterThan(0); expect(sun.effects.mechanism!.embers).toBeGreaterThan(0);
  expect(sun.effects.mechanism!.transitions).toBe(1); expect(sun.fits).toBe(true);
  await expect(page.locator('#typing-space')).toHaveValue('asdfjkl;');
});

test('sustained free typing awakens, an idle gap cools, and a paste does not awaken', async ({ page }) => {
  await page.clock.install(); await enter(page); await page.locator('#typing-space').focus();
  await rhythm(page, 'A steady stream of letters carries the water into a warmer rhythm. ');
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'sun');
  await page.clock.runFor(800); await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'sun');
  await page.clock.runFor(6500); await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'water');
  await page.locator('#typing-space').evaluate((input: HTMLTextAreaElement) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'pasted '.repeat(300));
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
  });
  await page.clock.runFor(7000); await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'water');
});

test('Challenge auto awakening consumes unthrottled correct judgments without changing the result', async ({ page }) => {
  await page.clock.install(); await enter(page);
  await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await page.getByRole('combobox', { name: 'Passage language' }).selectOption('english');
  await page.getByRole('button', { name: '시작', exact: true }).click(); await page.clock.runFor(3100);
  const passage = await page.evaluate(() => window.__challenge!.passage());
  await rhythm(page, passage.slice(0, 66));
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'sun');
  expect(await page.evaluate(() => window.__challenge!.state().race)).toMatchObject({ correct: 66, errors: 0, combo: 66, accuracy: 100 });
  await page.getByRole('button', { name: 'Breath water', exact: true }).click(); await page.clock.runFor(1700);
  expect(await page.evaluate(() => window.__challenge!.state().race)).toMatchObject({ correct: 66, errors: 0, combo: 66, accuracy: 100 });
  await page.clock.fastForward(30000); await expect(page.getByTestId('race-speed')).toHaveText('26.4');
  await expect(page.getByRole('button', { name: '이 기록과 Ghost Race' })).toBeEnabled();
});

test('a high error rate and held-key repetition cannot build automatic awakening', async ({ page }) => {
  await page.clock.install(); await enter(page); await page.locator('#typing-space').focus();
  await page.keyboard.down('a');
  for (let i = 0; i < 70; i++) { await page.keyboard.down('a'); await page.clock.runFor(100); }
  await page.keyboard.up('a');
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'water');
  await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await page.getByRole('combobox', { name: 'Passage language' }).selectOption('english');
  await page.getByRole('button', { name: '시작', exact: true }).click(); await page.clock.runFor(3100);
  await rhythm(page, 'x'.repeat(65));
  expect(await page.evaluate(() => window.__challenge!.state().race.correct)).toBe(0);
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'water');
});

test('software IME commits give one local reaction without false physical presses or duplicate composition rewards', async ({ page }) => {
  await enter(page); await page.locator('#typing-space').focus();
  const cdp = await page.context().newCDPSession(page), before = await telemetry(page);
  await cdp.send('Input.imeSetComposition', { text: 'ㅎ', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
  expect((await telemetry(page)).effects.mechanism!.emitted).toBe(before.effects.mechanism!.emitted);
  await cdp.send('Input.insertText', { text: '한' });
  await expect(page.locator('#typing-space')).toHaveValue('한');
  await expect.poll(async () => (await telemetry(page)).effects.mechanism!.emitted).toBe(Number(before.effects.mechanism!.emitted) + 1);
  const committed = await telemetry(page);
  expect(committed.input.pressCount).toBe(before.input.pressCount);
  expect(committed.effects.recentKeys).toEqual(['SoftwareCommit']);
  await page.locator('#typing-space').dispatchEvent('input', { inputType: 'insertText', data: '한' });
  await page.waitForTimeout(80);
  expect((await telemetry(page)).effects.mechanism!.emitted).toBe(committed.effects.mechanism!.emitted);
  await cdp.send('Input.imeSetComposition', { text: '글', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
  await expect(page.locator('#typing-space')).toHaveValue('한');
  expect((await telemetry(page)).effects.mechanism!.emitted).toBe(committed.effects.mechanism!.emitted);
});

test('reduced motion preserves automatic state, score and mute while suppressing transition geometry', async ({ page }) => {
  await page.clock.install(); await page.emulateMedia({ reducedMotion: 'reduce' }); await enter(page);
  await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await page.getByRole('combobox', { name: 'Passage language' }).selectOption('english');
  await page.getByRole('button', { name: '시작', exact: true }).click(); await page.clock.runFor(3100);
  const passage = await page.evaluate(() => window.__challenge!.passage());
  await rhythm(page, passage.slice(0, 65));
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'sun');
  const state = await telemetry(page);
  expect(state.effects.mechanism!.transitions).toBe(0); expect(state.effects.particles).toBe(0);
  expect(state.audio).toMatchObject({ enabled: false, sources: 0, state: 'not-created' });
  expect(await page.evaluate(() => window.__challenge!.state().race.correct)).toBe(65);
});

test('effects off remains visually off through automatic Sun awakening and returning to Playground restores effects', async ({ page }) => {
  await page.clock.install(); await enter(page);
  await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await page.getByRole('combobox', { name: 'Passage language' }).selectOption('english');
  await page.getByRole('combobox', { name: 'Combo effects' }).selectOption('off');
  await page.getByRole('button', { name: '시작', exact: true }).click(); await page.clock.runFor(3100);
  const passage = await page.evaluate(() => window.__challenge!.passage());
  await rhythm(page, passage.slice(0, 65));
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'sun');
  expect((await telemetry(page)).effects).toMatchObject({ particles: 0, waves: 0 });
  expect((await telemetry(page)).effects.mechanism).toMatchObject({ emitted: 0, transitions: 0 });
  expect(await page.evaluate(() => window.__challenge!.state().race.correct)).toBe(65);
  await page.getByRole('button', { name: '경기 취소', exact: true }).click();
  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  await page.locator('#typing-space').focus(); await page.keyboard.type('a'); await page.clock.runFor(80);
  expect((await telemetry(page)).effects.mechanism!.emitted).toBeGreaterThan(0);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`Water/Sun controls and geometry fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await enter(page);
    await page.getByRole('button', { name: 'Breath sun', exact: true }).click();
    await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'sun');
    await page.locator('#typing-space').focus(); await page.keyboard.type('asdfjkl;', { delay: 55 });
    const state = await telemetry(page);
    expect(state.fits).toBe(true); expect(state.effects.waves).toBeLessThanOrEqual(viewport.width < 1024 ? 4 : 9);
    expect(state.effects.particles).toBeLessThanOrEqual(viewport.width < 1024 ? 28 : 72);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    const controls = await page.locator('.breath-controls').boundingBox(), canvas = await page.locator('canvas').boundingBox(), footer = await page.locator('.site-footer').boundingBox();
    expect(controls!.y + controls!.height).toBeLessThanOrEqual(canvas!.y + 2);
    expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(footer!.y + 2);
    for (const button of await page.locator('.breath-choice button').all()) { const bounds = await button.boundingBox(); expect(bounds!.height).toBeGreaterThanOrEqual(44); expect(bounds!.width).toBeGreaterThanOrEqual(44); }
  });
}
