import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('artifacts/challenge', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto('http://127.0.0.1:5180');
  await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await expect(page.locator('.challenge')).toBeVisible();
  await page.getByRole('combobox', { name: 'Passage language' }).selectOption('english');
  await page.screenshot({ path: 'artifacts/challenge/ready.png' });
  await page.getByRole('button', { name: '시작', exact: true }).click();
  await page.clock.runFor(3100);
  await expect(page.locator('.challenge')).toHaveAttribute('data-phase', 'running');
  await page.keyboard.type('A quiet room leaves enough space for a new thought.');
  await page.clock.runFor(150);
  await page.screenshot({ path: 'artifacts/challenge/running.png' });
  const running = await page.evaluate(() => ({ race: window.__challenge.state(), rewards: window.__keyspace.state().rewards }));
  await page.clock.fastForward(30000);
  await expect(page.locator('.challenge')).toHaveAttribute('data-phase', 'finished');
  await page.clock.runFor(350);
  await page.screenshot({ path: 'artifacts/challenge/result.png' });
  const finished = await page.evaluate(() => window.__challenge.state());
  await page.getByRole('button', { name: '이 기록과 Ghost Race' }).click();
  await expect(page.getByRole('textbox', { name: 'Challenge typing input' })).toBeFocused();
  await page.clock.runFor(3100);
  await page.keyboard.type('A quiet room');
  await expect(page.getByRole('textbox', { name: 'Challenge typing input' })).toHaveValue('A quiet room');
  await page.clock.runFor(300);
  await page.screenshot({ path: 'artifacts/challenge/ghost.png' });
  const ghost = await page.evaluate(() => window.__challenge.state());
  await page.getByRole('button', { name: '경기 취소', exact: true }).click();
  await page.getByRole('combobox', { name: 'Ghost record' }).selectOption('');
  const themes = [];
  for (const id of ['inferno', 'glacier', 'jelly', 'grove', 'orbit', 'demon-slayer', 'pokemon', 'spider-verse', 'howl', 'evangelion']) {
    await page.locator(`.collection-sidebar [data-theme="${id}"]`).click();
    await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', id);
    await page.getByRole('combobox', { name: 'Combo effects' }).selectOption('full');
    await page.locator('.race-start').click(); await page.clock.runFor(3100);
    const text = await page.evaluate(() => window.__challenge.passage().slice(0, 65));
    for (const character of text) { await page.keyboard.type(character); await page.clock.runFor(55); }
    await page.screenshot({ path: `artifacts/challenge/${id}-combo.png` });
    const combo = await page.evaluate(() => window.__keyspace.state());
    await page.clock.fastForward(30000); await page.clock.runFor(300);
    await page.screenshot({ path: `artifacts/challenge/${id}-finish.png` });
    const finish = await page.evaluate(() => window.__keyspace.state());
    themes.push({ id, combo: combo.rewards, finish: finish.rewards, fits: combo.fits && finish.fits });
    expect(combo.fits && finish.fits).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(100);
  await page.screenshot({ path: 'artifacts/challenge/mobile-result.png', fullPage: true });
  await page.locator('.race-start').click(); await page.clock.runFor(3100); await page.keyboard.type('A quiet room');
  await page.screenshot({ path: 'artifacts/challenge/mobile-running.png', fullPage: true });
  await writeFile('artifacts/challenge/capture-report.json', JSON.stringify({ running, finished, ghost, themes, errors }, null, 2));
  console.log(JSON.stringify({ running: running.race.race, saved: finished.saved, records: finished.records.length, errors }));
  expect(errors).toEqual([]);
} finally { await browser.close(); }
