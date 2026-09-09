import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const errors = [], states = {};
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5180');
  await page.locator('.collection-sidebar [data-theme="demon-slayer"]').click();
  await expect(page.locator('[aria-label="Tanjiro breathing"]')).toBeVisible();
  await page.waitForTimeout(400);
  await mkdir('artifacts/breath', { recursive: true });
  const capture = async name => {
    await page.screenshot({ path: `artifacts/breath/${name}.png`, fullPage: true });
    states[name] = await page.evaluate(() => window.__keyspace?.state());
  };
  await capture('water-ready');
  await page.locator('#typing-space').focus();
  await page.keyboard.type('asdf', { delay: 90 });
  await capture('water-flow');
  await page.getByRole('button', { name: 'Breath sun', exact: true }).click();
  await page.waitForTimeout(350); await capture('awakening');
  await page.waitForTimeout(700);
  await page.locator('#typing-space').focus();
  await page.keyboard.type('jkl;', { delay: 90 });
  await capture('sun-flow');
  await page.getByRole('button', { name: 'Breath water', exact: true }).click();
  await page.waitForTimeout(650); await capture('cooling');
  await page.waitForTimeout(1100);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#typing-space').focus(); await page.keyboard.type('asdf', { delay: 90 });
  await capture('mobile-water');
  await page.getByRole('button', { name: 'Breath sun', exact: true }).click();
  await page.waitForTimeout(1100);
  await page.locator('#typing-space').focus(); await page.keyboard.type('jkl;', { delay: 90 });
  await capture('mobile-sun');
  await writeFile('artifacts/breath/captures.json', JSON.stringify({ states, errors }, null, 2));
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ captures: Object.keys(states), errors }));
} finally { await browser.close(); }
