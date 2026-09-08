import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const requested = process.argv.slice(2);
const directory = process.env.CAPTURE_DIR || 'artifacts/collection';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:5180');
  await page.waitForFunction(() => !!window.__keyspace);
  const themes = await page.locator('.collection-sidebar [data-theme]').evaluateAll(buttons => buttons.map(button => ({ id: button.dataset.theme, name: button.getAttribute('aria-label'), category: button.closest('section').getAttribute('aria-label') })));
  const chosen = requested.length ? themes.filter(theme => requested.includes(theme.id)) : themes;
  const gpu = await page.locator('canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    return { renderer: extension && gl.getParameter(extension.UNMASKED_RENDERER_WEBGL), userAgent: navigator.userAgent };
  });
  const report = { gpu, themes: [], errors };
  for (const { name, id, category } of chosen) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(id => document.querySelector('.keyspace')?.getAttribute('data-preset') === id, id);
    await page.waitForTimeout(900);
    const idle = await page.evaluate(() => window.__keyspace.state());
    await page.screenshot({ path: `${directory}/${id}.png` });
    await page.locator('canvas').screenshot({ path: `${directory}/${id}-object.png` });
    await page.locator('#typing-space').focus();
    await page.keyboard.down('a');
    await page.waitForTimeout(170);
    const held = await page.evaluate(() => window.__keyspace.state());
    await page.screenshot({ path: `${directory}/${id}-held.png` });
    await page.keyboard.up('a');
    await page.waitForTimeout(140);
    const released = await page.evaluate(() => window.__keyspace.state());
    await page.waitForTimeout(900);
    const signatures = {};
    if (category === 'ANIMATION') {
      await page.keyboard.type('afjsk', { delay: 70 });
      await page.screenshot({ path: `${directory}/${id}-typing.png` });
      for (const code of ['Enter', 'Space']) {
        await page.keyboard.press(code);
        await page.waitForTimeout(320);
        signatures[code] = await page.evaluate(() => window.__keyspace.state());
        await page.screenshot({ path: `${directory}/${id}-${code.toLowerCase()}.png` });
        await page.waitForTimeout(1100);
      }
    }
    await page.getByRole('button', { name: 'Reset typed text' }).click();
    report.themes.push({ name, id, idle, held, released, signatures });
    console.log(name, JSON.stringify({ drawCalls: idle.drawCalls, frameP95: idle.frameP95, memory: idle.memory, held: held.keys.find(key => key.code === 'KeyA') }));
  }
  const reportName = requested.length ? `capture-report-${chosen.map(theme => theme.id).join('-')}.json` : 'capture-report.json';
  await writeFile(`${directory}/${reportName}`, JSON.stringify(report, null, 2));
  if (errors.length) { console.error(errors); process.exitCode = 1; }
} finally { await browser.close(); }
