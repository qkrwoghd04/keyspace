import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Run independently of other browser jobs. Native typing and a real 30-second clock.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const errors = [], samples = [], cycles = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5180');
  const select = async id => { await page.locator(`.collection-sidebar [data-theme="${id}"]`).click(); await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', id); };
  const warm = async () => {
    await page.locator('#typing-space').focus(); await page.keyboard.type('asd', { delay: 35 });
    for (let stage = 0; stage < 4; stage++) {
      if (stage) { await page.keyboard.press('Enter'); await page.waitForTimeout(1450); }
      await page.keyboard.press('Space'); await page.waitForTimeout(1450);
    }
  };
  await select('digimon'); await page.getByRole('button', { name: 'Enable keyboard sound' }).click(); await warm();
  await page.getByRole('button', { name: 'Reset typed text' }).click(); await page.locator('#typing-space').focus();
  const initial = await page.evaluate(() => ({ at: performance.now(), state: window.__keyspace.state() }));
  const start = Date.now(), phrase = 'Digital partner.\nAgumon evolves. ', environment = await page.locator('canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { userAgent: navigator.userAgent, gpu: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), dpr: devicePixelRatio };
  });
  let typed = '', index = 0;
  while (Date.now() - start < 30000) {
    const char = phrase[index++ % phrase.length];
    if (char === '\n') await page.keyboard.press('Enter'); else await page.keyboard.type(char, { delay: 30 });
    typed += char;
    if (!samples.length || Date.now() - samples.at(-1).at > 1000) samples.push(await page.evaluate(() => ({ at: Date.now(), ...window.__keyspace.state() })));
  }
  const final = await page.evaluate(() => ({ at: performance.now(), state: window.__keyspace.state() }));
  await expect(page.locator('#typing-space')).toHaveValue(typed);
  expect(final.state.input.pressCount - initial.state.input.pressCount).toBe(typed.length);
  expect(final.state.input.pressedCodes).toEqual([]);
  for (const sample of samples.slice(2)) {
    expect(sample.effects.particles).toBeLessThanOrEqual(80); expect(sample.effects.waves).toBeLessThanOrEqual(3);
    expect(sample.audio.voices).toBeLessThanOrEqual(16); expect(sample.audio.sources).toBeLessThanOrEqual(32);
    expect(sample.memory).toEqual(samples[2].memory); expect(sample.fits).toBe(true);
  }
  for (let i = 0; i < 8; i++) { await select('studio'); await select('digimon'); await warm(); const state = await page.evaluate(() => window.__keyspace.state()); cycles.push({ memory: state.memory, programs: state.programs }); }
  for (const cycle of cycles.slice(1)) expect(cycle).toEqual(cycles[1]);
  const fps = (final.state.frames - initial.state.frames) / (final.at - initial.at) * 1000, p95 = Math.max(...samples.map(s => s.frameP95));
  expect(fps).toBeGreaterThanOrEqual(55); expect(p95).toBeLessThanOrEqual(25); expect(errors).toEqual([]);
  await mkdir('artifacts/digimon', { recursive: true });
  await writeFile('artifacts/digimon/performance.json', JSON.stringify({ environment, characters: typed.length, durationMs: final.at - initial.at, fps, p95, samples, cycles, errors }, null, 2));
  console.log(JSON.stringify({ characters: typed.length, fps, p95, cycles: cycles.length, errors }));
} finally { await browser.close(); }
