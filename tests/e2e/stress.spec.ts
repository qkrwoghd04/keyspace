import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ trace: 'off' });
test.setTimeout(240_000);

test('60 seconds at 30 strikes/second and ten complete collection cycles stay bounded', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Inferno', exact: true }).click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'inferno');
  await page.getByRole('button', { name: 'Enable keyboard sound' }).click();
  await page.locator('#typing-space').focus();
  await page.waitForTimeout(1500);
  const environment = await page.locator('canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2')!;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { userAgent: navigator.userAgent, gpu: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), dpr: devicePixelRatio, viewport: [innerWidth, innerHeight] };
  });
  const load = await page.evaluate(async () => {
    const editor = document.querySelector<HTMLTextAreaElement>('#typing-space')!;
    const started = performance.now();
    const initial = window.__keyspace!.state();
    const samples = [];
    const keys = ['KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK', 'KeyL'];
    let strikes = 0;
    let nextSample = 1000;
    while (performance.now() - started < 60_000 || strikes < 1800) {
      const elapsed = performance.now() - started;
      const due = Math.min(1800, Math.floor(elapsed * .03));
      while (strikes < due) {
        const code = keys[strikes % keys.length];
        editor.dispatchEvent(new KeyboardEvent('keydown', { code, key: code.slice(-1).toLowerCase(), bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keyup', { code, key: code.slice(-1).toLowerCase(), bubbles: true }));
        strikes++;
      }
      if (elapsed >= nextSample) {
        const state = window.__keyspace!.state();
        samples.push({ elapsed, quality: state.quality, frames: state.frames, frameP95: state.frameP95, memory: state.memory, programs: state.programs, effects: state.effects, audio: state.audio });
        nextSample += 1000;
      }
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    const final = window.__keyspace!.state();
    return { elapsed: performance.now() - started, strikes, received: final.input.pressCount - initial.input.pressCount, frames: final.frames - initial.frames, samples, held: final.input.pressedCodes };
  });
  expect(load.strikes).toBe(1800);
  expect(load.received).toBe(1800);
  expect(load.held).toEqual([]);
  for (const sample of load.samples) {
    expect(sample.effects.particles).toBeLessThanOrEqual(sample.quality === 'low' ? 48 : 128);
    expect(sample.effects.flames).toBeLessThanOrEqual(sample.quality === 'low' ? 20 : 48);
    expect(sample.effects.waves).toBeLessThanOrEqual(sample.quality === 'low' ? 4 : 12);
    expect(sample.audio.voices).toBeLessThanOrEqual(16);
    expect(sample.audio.buffers).toBeLessThanOrEqual(84);
  }
  const samples = [];
  const themes = await page.locator('.collection-sidebar [data-theme]').evaluateAll(buttons => buttons.map(button => ({ id: (button as HTMLElement).dataset.theme!, name: button.getAttribute('aria-label')! })));
  for (let cycle = 1; cycle <= 10; cycle++) {
    for (const { name, id } of themes) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', id);
      await page.locator('#typing-space').focus();
      await page.keyboard.press('a');
      await page.waitForTimeout(350);
      const state = await page.evaluate(() => window.__keyspace!.state());
      expect(state.input.pressedCodes).toEqual([]);
      expect(state.audio.sources).toBe(0);
      expect(state.audio.voices).toBeLessThanOrEqual(16);
      expect(state.audio.buffers).toBeLessThanOrEqual(84);
      samples.push({ cycle, name, memory: state.memory, programs: state.programs, frameP95: state.frameP95, quality: state.quality });
    }
  }
  await mkdir('artifacts/performance', { recursive: true });
  await writeFile('artifacts/performance/stress-report.json', JSON.stringify({ environment, load, cycles: samples, errors }, null, 2));
  for (const { name } of themes) {
    const perTheme = samples.filter(sample => sample.name === name);
    const initial = perTheme[1]; // Second full cycle is the warm-cache baseline.
    for (const sample of perTheme.slice(2)) {
      expect(sample.memory).toEqual(initial.memory);
      expect(sample.programs).toBeLessThanOrEqual(initial.programs + 1);
    }
  }
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ environment, averageFps: load.frames / (load.elapsed / 1000), lastP95: load.samples.at(-1)!.frameP95, strikes: load.strikes, themeSwitches: samples.length }));
});
