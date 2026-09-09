import { chromium, expect } from '@playwright/test';
import { mkdir, rename } from 'node:fs/promises';

await mkdir('artifacts/breath/video', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: 'artifacts/breath/video', size: { width: 1440, height: 900 } } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5180');
  await page.locator('.collection-sidebar [data-theme="demon-slayer"]').click();
  await expect(page.locator('.breath-controls')).toBeVisible();
  await page.locator('#typing-space').focus(); await page.keyboard.type('asdf jkl;', { delay: 150 });
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: 'Reset typed text' }).click();
  await page.locator('#typing-space').focus();
  await page.keyboard.type('A steady rhythm. Water becomes fire, one letter at a time.', { delay: 115 });
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'sun');
  await page.keyboard.type(' Flow into flame.', { delay: 110 });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Breath water', exact: true }).click();
  await expect(page.locator('.breath-controls')).toHaveAttribute('data-breath', 'water');
  await page.waitForTimeout(600);
  const video = page.video(); await context.close();
  await rename(await video.path(), 'artifacts/breath/typing-breath.webm');
  console.log('Recorded real browser input, automatic awakening and manual cooling. Video is silent; source audio comparison is separate.');
} finally { await browser.close(); }
