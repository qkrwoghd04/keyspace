import { chromium, firefox, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Real clocks and real server. ONLY a local test database; creates two public test participants.
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5284';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('This smoke test is restricted to a local test service');
const chrome = await chromium.launch({ channel: 'chrome', headless: true });
const fox = await firefox.launch({ headless: true });
try {
  await mkdir('artifacts/production', { recursive: true });
  await mkdir('artifacts/challenge', { recursive: true });
  const page = await chrome.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/assets/orbit-*.js', route => route.abort());
  await page.goto(base);
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => typeof window.__keyspace)).toBe('undefined');
  await page.locator('#typing-space').fill('Production preview. 한글');
  await page.getByRole('button', { name: 'Orbit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.unroute('**/assets/orbit-*.js');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', 'orbit');
  const themes = await page.locator('.collection-sidebar [data-theme]').evaluateAll(buttons => buttons.map(button => ({ id: button.dataset.theme, name: button.getAttribute('aria-label') })));
  for (const { name, id } of themes) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', id);
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.locator('#typing-space')).toHaveValue('Production preview. 한글');
  }
  expect(themes).toHaveLength(14);
  const thumbnails = await page.locator('.collection-sidebar img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0));
  expect(thumbnails).toBe(true);
  await page.locator('.collection-sidebar [data-theme="digimon"]').click();
  await expect(page.locator('.partner-caption')).toBeVisible();
  await page.getByRole('button', { name: 'Reset typed text' }).click();
  await page.locator('#typing-space').focus(); await page.keyboard.type('Build verified.'); await page.keyboard.press('Enter'); await page.keyboard.type('Ready');
  await expect(page.locator('#typing-space')).toHaveValue('Build verified.\nReady');
  await page.locator('.collection-sidebar [data-theme="studio"]').click();
  await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  expect(await page.evaluate(() => typeof window.__challenge)).toBe('undefined');
  await page.getByRole('combobox', { name: '지문 언어' }).selectOption('english');
  const suffix = Date.now().toString(36), chromeName = 'Chrome-' + suffix, firefoxName = 'Firefox-' + suffix;
  await page.getByRole('textbox', { name: '닉네임', exact: true }).fill(chromeName);
  await page.screenshot({ path: 'artifacts/challenge/ready.png' });
  const began = Date.now();
  await page.locator('.race-start').click();
  await expect(page.locator('#challenge-input')).toBeFocused();
  await expect(page.locator('.challenge')).toHaveAttribute('data-phase', 'running', { timeout: 10000 });
  await page.keyboard.type('A quiet room leaves enough space');
  await page.screenshot({ path: 'artifacts/challenge/running.png' });
  await expect(page.locator('.race-save')).toHaveText('저장 완료', { timeout: 35000 });
  expect(Date.now() - began).toBeGreaterThanOrEqual(33000);
  await expect(page.getByTestId('race-speed')).toHaveText((32 / 30).toFixed(2));
  await expect(page.getByTestId('race-accuracy')).toHaveText('100.0%');
  await page.screenshot({ path: 'artifacts/challenge/result.png' });

  // A different browser engine, cookie jar and process, not merely another tab.
  const second = await fox.newPage({ viewport: { width: 1280, height: 900 } });
  second.on('pageerror', error => errors.push(error.message));
  await second.goto(base);
  await second.getByRole('button', { name: 'Challenge', exact: true }).click();
  await second.getByRole('combobox', { name: '지문 언어' }).selectOption('english');
  await expect(second.getByRole('table', { name: '순위표' })).toContainText(chromeName);
  await second.getByRole('tab', { name: '내 기록' }).click();
  await expect(second.getByText('아직 기록 없음.', { exact: true })).toBeVisible();
  await second.getByRole('textbox', { name: '닉네임', exact: true }).fill(firefoxName);
  await second.locator('.race-start').click();
  await expect(second.locator('.challenge')).toHaveAttribute('data-phase', 'running', { timeout: 10000 });
  await second.keyboard.type('A quiet room');
  await expect(second.locator('.race-save')).toHaveText('저장 완료', { timeout: 35000 });
  await expect(second.getByTestId('race-speed')).toHaveText('0.40');
  await second.getByRole('tab', { name: '내 기록' }).click();
  await expect(second.getByRole('table', { name: '내 기록 목록' }).locator('tbody tr')).toHaveCount(1);
  await page.getByRole('tab', { name: '내 기록' }).click();
  await expect(page.getByRole('table', { name: '내 기록 목록' }).locator('tbody tr')).toHaveCount(1);
  await page.getByRole('tab', { name: '순위', exact: true }).click();
  await expect(page.getByRole('table', { name: '순위표' })).toContainText(firefoxName);
  await page.bringToFront();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/challenge/shared-ranking.png' });
  await second.screenshot({ path: 'artifacts/challenge/firefox-history.png' });
  for (const [width, height] of [[390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'artifacts/challenge/mobile-' + width + '.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '다시 시작', exact: true }).click();
  await expect(page.locator('#challenge-input')).toBeFocused();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  await expect(page.locator('#typing-space')).toHaveValue('Build verified.\nReady');
  expect(errors).toEqual([]);
  const report = { at: new Date().toISOString(), base, browsers: { chrome: chrome.version(), firefox: fox.version() }, themes: themes.length, oneCanvas: true, debugApisAbsent: true, realThirtySecondSaves: 2, sharedRanking: true, privateHistory: true, textRetained: true, nativeTyping: true, thumbnails, failedChunkRetry: true, errors };
  await writeFile('artifacts/production/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await chrome.close(); await fox.close(); }
