import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5180';
await mkdir('artifacts/digimon', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: 'artifacts/digimon', size: { width: 1440, height: 900 } } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.locator('.collection-sidebar [data-theme="digimon"]').click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'digimon');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/digimon/agumon.png' });
  await page.locator('#typing-space').focus();
  await page.keyboard.type('Hello, digital world.', { delay: 95 });
  await page.screenshot({ path: 'artifacts/digimon/typing.png' });
  await page.keyboard.press('Enter'); await page.waitForTimeout(660);
  await page.screenshot({ path: 'artifacts/digimon/evolution.png' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/digimon/greymon.png' });
  await page.keyboard.press('Space'); await page.waitForTimeout(120);
  await page.screenshot({ path: 'artifacts/digimon/flame.png' });
  await page.waitForTimeout(1350);
  for (const [form, attack] of [['metalgreymon', 'giga-destroyer'], ['wargreymon', 'gaia-force']]) {
    await page.keyboard.press('Enter'); await page.waitForTimeout(1450);
    await page.screenshot({ path: `artifacts/digimon/${form}.png` });
    await page.keyboard.press('Space'); await page.waitForTimeout(480);
    await page.screenshot({ path: `artifacts/digimon/${attack}.png` });
    await page.waitForTimeout(1000);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(350);
  await page.screenshot({ path: 'artifacts/digimon/mobile.png', fullPage: true });
  expect(errors).toEqual([]);
  await writeFile('artifacts/digimon/capture.json', JSON.stringify({ base, errors }, null, 2));
  await context.close(); await page.video().saveAs('artifacts/digimon/evolution-chain.webm');
  console.log(JSON.stringify({ base, errors }));
} finally { await browser.close(); }
