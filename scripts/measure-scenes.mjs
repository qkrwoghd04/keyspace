import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const configuration of [
    { label: 'desktop-dpr2', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
    { label: 'mobile-emulation', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.newContext(configuration);
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5180');
    await page.waitForFunction(() => !!window.__keyspace);
    const themes = await page.locator('.collection-sidebar [data-theme]').evaluateAll(buttons => buttons.map(button => ({ id: button.dataset.theme, name: button.getAttribute('aria-label') })));
    const environment = await page.locator('canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { gpu: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), userAgent: navigator.userAgent, deviceDpr: devicePixelRatio };
    });
    for (const { name, id } of themes) {
      if (configuration.isMobile) await page.locator('.mobile-collection-open').click();
      const collection = configuration.isMobile ? page.getByRole('dialog') : page.locator('.collection-sidebar');
      await collection.getByRole('button', { name, exact: true }).click();
      await page.waitForFunction(id => document.querySelector('.keyspace')?.getAttribute('data-preset') === id, id);
      const result = await page.evaluate(async () => {
        const editor = document.querySelector('#typing-space');
        const strike = () => {
          editor.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a', bubbles: true }));
          editor.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', key: 'a', bubbles: true }));
        };
        const timer = setInterval(strike, 100);
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const started = performance.now(), before = window.__keyspace.state();
          await new Promise(resolve => setTimeout(resolve, 4000));
          const after = window.__keyspace.state(), elapsed = performance.now() - started;
          return { fps: (after.frames - before.frames) / (elapsed / 1000), frameP95: after.frameP95, quality: after.quality, drawCalls: after.drawCalls, memory: after.memory };
        } finally { clearInterval(timer); }
      });
      results.push({ configuration: configuration.label, name, environment, ...result });
      console.log(configuration.label, name, JSON.stringify(result));
    }
    await context.close();
  }
  await mkdir('artifacts/performance', { recursive: true });
  await writeFile('artifacts/performance/materials-report.json', JSON.stringify(results, null, 2));
} finally { await browser.close(); }
