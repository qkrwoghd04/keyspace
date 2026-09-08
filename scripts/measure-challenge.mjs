import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Real wall time and native text insertion. No fake clock or synthetic key events.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5180');
  await page.locator('.collection-sidebar [data-theme="inferno"]').click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'inferno');
  await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await page.getByRole('combobox', { name: 'Passage language' }).selectOption('english');
  await page.getByRole('combobox', { name: 'Combo effects' }).selectOption('full');
  await page.locator('.race-start').click();
  await expect(page.locator('.challenge')).toHaveAttribute('data-phase', 'running');
  const before = await page.evaluate(() => ({ at: performance.now(), frames: window.__keyspace.state().frames }));
  const text = await page.evaluate(() => window.__challenge.passage().slice(0, 1200));
  const samples = [];
  for (const character of text) {
    if (await page.locator('.challenge').getAttribute('data-phase') !== 'running') break;
    await page.keyboard.type(character, { delay: 22 });
    if (samples.length === 0 || Date.now() - samples.at(-1).at > 1000) {
      samples.push(await page.evaluate(() => { const s = window.__keyspace.state(); return { at: Date.now(), elapsed: window.__challenge.state().race.elapsedMs, frameP95: s.frameP95, memory: s.memory, programs: s.programs, rewards: s.rewards, drawCalls: s.drawCalls }; }));
    }
  }
  await expect(page.locator('.challenge')).toHaveAttribute('data-phase', 'finished', { timeout: 35000 });
  const after = await page.evaluate(() => ({ at: performance.now(), frames: window.__keyspace.state().frames, session: window.__challenge.state() }));
  expect(after.session.last.result.elapsedMs).toBe(30000);
  expect(after.session.last.result.errors).toBe(0); expect(after.session.saved).toBe(true);
  expect(after.at - before.at).toBeGreaterThanOrEqual(29000);
  const cycles = [];
  for (let i = 0; i < 20; i++) {
    await page.getByRole('button', { name: 'Playground', exact: true }).click();
    await page.waitForTimeout(80);
    const outside = await page.evaluate(() => ({ memory: window.__keyspace.state().memory, rewards: window.__keyspace.state().rewards }));
    expect(outside.rewards).toBeNull();
    await page.getByRole('button', { name: 'Challenge', exact: true }).click();
    await page.waitForTimeout(80);
    const inside = await page.evaluate(() => ({ memory: window.__keyspace.state().memory, programs: window.__keyspace.state().programs }));
    cycles.push({ outside, inside });
  }
  for (const row of cycles.slice(2)) expect(row).toEqual(cycles[2]);
  expect(errors).toEqual([]);
  const report = { realClock: true, nativeInput: true, elapsedObservedMs: after.at - before.at, fps: (after.frames - before.frames) / (after.at - before.at) * 1000, final: after.session.last.result, samples, cycles, errors };
  await mkdir('artifacts/challenge', { recursive: true });
  await writeFile('artifacts/challenge/performance.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, samples: samples.length, cycles: cycles.length }));
} finally { await browser.close(); }
