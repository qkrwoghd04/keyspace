import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const label = process.argv[2] || 'after', base = process.argv[3] || 'http://127.0.0.1:5180';
if (!/^[a-z-]+$/.test(label)) throw new Error('Use a simple artifact label');
const directory = `artifacts/flow/${label}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: directory, size: { width: 1440, height: 900 } } });
const page = await context.newPage(), errors = [], states = {};
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto(base);
  await page.locator('.collection-sidebar [data-theme="demon-slayer"]').click();
  for (const mode of ['water', 'sun']) {
    await page.getByRole('button', { name: `Breath ${mode}`, exact: true }).click();
    await page.waitForTimeout(1800);
    for (const [name, text, delay] of [['home', 'asdfghjkl;', 65], ['cross', 'qpalzmxnwo', 65], ['slow', 'asdf', 350]]) {
      await page.getByRole('button', { name: 'Reset typed text' }).click();
      await page.locator('#typing-space').focus();
      await page.keyboard.type(text, { delay });
      await page.waitForTimeout(90);
      await page.screenshot({ path: `${directory}/${mode}-${name}.png` });
      states[`${mode}-${name}`] = await page.evaluate(() => window.__keyspace?.state());
      await page.waitForTimeout(1300);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const mode of ['water', 'sun']) {
    await page.getByRole('button', { name: `Breath ${mode}`, exact: true }).click(); await page.waitForTimeout(1800);
    await page.getByRole('button', { name: 'Reset typed text' }).click(); await page.locator('#typing-space').focus();
    await page.keyboard.type('asdfjkl;', { delay: 65 }); await page.waitForTimeout(90);
    await page.screenshot({ path: `${directory}/${mode}-mobile.png` });
    states[`${mode}-mobile`] = await page.evaluate(() => window.__keyspace?.state());
  }
  expect(errors).toEqual([]);
  await writeFile(`${directory}/report.json`, JSON.stringify({ base, errors, states }, null, 2));
  console.log(JSON.stringify({ base, errors, captures: Object.keys(states) }));
} finally {
  await context.close();
  await page.video()?.saveAs(`${directory}/typing.webm`);
  await browser.close();
}
