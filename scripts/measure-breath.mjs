import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Run on its own, not alongside other browser tests. Real time and native typing.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const errors = [], runs = [], cycles = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5180');
  await page.locator('.collection-sidebar [data-theme="demon-slayer"]').click();
  await expect(page.locator('.breath-controls')).toBeVisible();
  await page.getByRole('button', { name: 'Enable keyboard sound' }).click();
  await page.getByRole('slider', { name: 'Master volume' }).fill('23');
  const environment = await page.locator('canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { userAgent: navigator.userAgent, gpu: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), dpr: devicePixelRatio, viewport: [innerWidth, innerHeight] };
  });
  for (const mode of ['water', 'sun']) {
    await page.getByRole('button', { name: `Breath ${mode}`, exact: true }).click();
    await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', mode);
    await page.getByRole('button', { name: 'Reset typed text' }).click(); await page.locator('#typing-space').focus();
    // WebGL registers a preallocated pool's geometry on its first visible draw.
    // Exercise every slot before measuring growth, then reset only text/effect ages.
    await page.keyboard.type('asdf jkl; '.repeat(5), { delay: 35 });
    await page.getByRole('button', { name: 'Reset typed text' }).click(); await page.locator('#typing-space').focus();
    await page.waitForTimeout(350);
    const initial = await page.evaluate(() => ({ at: performance.now(), state: window.__keyspace.state() }));
    const samples = []; let typed = '', i = 0;
    const text = 'asdf jkl; Water follows the blade. Fire follows the rhythm. ';
    const startsAt = Date.now();
    while (Date.now() - startsAt < 30000) {
      const char = text[i++ % text.length]; await page.keyboard.type(char, { delay: 24 }); typed += char;
      if (!samples.length || Date.now() - samples.at(-1).at >= 1000) {
        samples.push(await page.evaluate(() => ({ at: Date.now(), ...window.__keyspace.state() })));
      }
    }
    const final = await page.evaluate(() => ({ at: performance.now(), state: window.__keyspace.state() }));
    await expect(page.locator('#typing-space')).toHaveValue(typed);
    expect(final.state.input.pressCount - initial.state.input.pressCount).toBe(typed.length);
    expect(final.state.input.pressedCodes).toEqual([]);
    for (const sample of samples) {
      expect(sample.effects.waves).toBeLessThanOrEqual(sample.quality === 'low' ? 6 : 9);
      expect(sample.effects.mechanism.pathPoints).toBeLessThanOrEqual(sample.quality === 'low' ? 6 : 10);
      expect(sample.effects.mechanism.activeFlows).toBeLessThanOrEqual(2);
      expect(sample.effects.mechanism.maxAnchorError).toBeLessThan(.001);
      expect(sample.effects.particles).toBeLessThanOrEqual(sample.quality === 'low' ? 28 : 72);
      expect(sample.audio.voices).toBeLessThanOrEqual(16); expect(sample.audio.sources).toBeLessThanOrEqual(32);
      expect(sample.audio.volume).toBe(.23); expect(sample.audio.breath).toBe(mode); expect(sample.fits).toBe(true);
      expect(sample.memory).toEqual(samples[0].memory); expect(sample.programs).toBe(samples[0].programs);
    }
    runs.push({ mode, realClock: true, nativeTyping: true, characters: typed.length, durationMs: final.at - initial.at,
      fps: (final.state.frames - initial.state.frames) / (final.at - initial.at) * 1000, maxP95: Math.max(...samples.map(sample => sample.frameP95)), samples });
    console.log(JSON.stringify({ mode, characters: typed.length, fps: runs.at(-1).fps, maxP95: runs.at(-1).maxP95 }));
    expect(runs.at(-1).fps).toBeGreaterThanOrEqual(55);
    expect(runs.at(-1).maxP95).toBeLessThanOrEqual(25);
  }
  await page.getByRole('button', { name: 'Breath water', exact: true }).click();
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'water');
  for (let i = 0; i < 20; i++) {
    await page.locator('.collection-sidebar [data-theme="studio"]').click();
    await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'studio');
    await page.locator('.collection-sidebar [data-theme="demon-slayer"]').click();
    await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'demon-slayer');
    await page.locator('#typing-space').focus(); await page.keyboard.type('asdf jkl;', { delay: 35 });
    await page.waitForTimeout(180);
    const state = await page.evaluate(() => window.__keyspace.state());
    cycles.push({ memory: state.memory, programs: state.programs });
  }
  for (const cycle of cycles.slice(2)) expect(cycle).toEqual(cycles[2]);
  expect(errors).toEqual([]);
  await mkdir('artifacts/breath', { recursive: true });
  await writeFile('artifacts/breath/performance.json', JSON.stringify({ environment, runs, cycles, errors }, null, 2));
  console.log(JSON.stringify({ themeRoundTrips: cycles.length, errors }));
} finally { await browser.close(); }
