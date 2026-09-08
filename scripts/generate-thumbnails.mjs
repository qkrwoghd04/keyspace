import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('public/themes', { recursive: true });
await mkdir('artifacts/collection', { recursive: true });
await mkdir('artifacts/animation', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const catalogPage = await browser.newPage();
  await catalogPage.goto('http://127.0.0.1:5180');
  const themes = await catalogPage.locator('.collection-sidebar [data-theme]').evaluateAll(buttons => buttons.map(button => ({ id: button.dataset.theme, name: button.getAttribute('aria-label'), category: button.closest('section').getAttribute('aria-label') })));
  await catalogPage.close();
  for (const { id, name } of themes) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/themes/*.png', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }));
    await page.goto('http://127.0.0.1:5180');
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(id => document.querySelector('.keyspace')?.getAttribute('data-preset') === id && !!window.__keyspace, id);
    // Thumbnail capture only: isolate the actual renderer and give it a fixed frame.
    await page.addStyleTag({ content: '.keyspace{display:block!important}.collection-sidebar,.site-header,.site-footer,.thoughts,.mode-switch,.theme-status{display:none!important}.main-room,.playground{display:block!important;min-height:0!important;height:228px!important}.keyboard-stage,.keyboard-scene{width:336px!important;height:228px!important;min-height:0!important}' });
    await page.setViewportSize({ width: 336, height: 228 });
    await page.waitForTimeout(650);
    await page.screenshot({ path: `public/themes/${id}.png` });
    await page.close();
    console.log(`Captured ${name}`);
  }
  const sheet = await browser.newPage({ viewport: { width: 1120, height: 1540 } });
  await sheet.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;padding:35px 38px;background:#f1efe9;color:#343633;font-family:Arial,sans-serif}header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:25px}h1{font:30px Georgia,serif;margin:0}header span{font-size:10px;letter-spacing:2px;color:#78776f}main{display:grid;grid-template-columns:repeat(3,1fr);gap:24px 20px}figure{margin:0;overflow:hidden}img{display:block;width:100%;height:225px;object-fit:contain}figcaption{display:flex;justify-content:space-between;padding:12px 2px 0;font-size:13px}small{color:#78776f;font-size:9px;letter-spacing:1px}
    </style></head><body><header><h1>The Keyspace collection</h1><span>FOURTEEN OBJECTS. ONE TYPING SPACE.</span></header><main>${themes.map(({ id, name, category }, i) => `<figure><img src="http://127.0.0.1:5180/themes/${id}.png"><figcaption>${name}<small>${String(i + 1).padStart(2, '0')} / ${category}</small></figcaption></figure>`).join('')}</main></body></html>`);
  await sheet.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await sheet.screenshot({ path: 'artifacts/collection/contact-sheet.png', fullPage: true });
  await sheet.locator('figure').evaluateAll((figures, categories) => figures.forEach((figure, index) => { if (categories[index] !== 'ANIMATION') figure.remove(); }), themes.map(theme => theme.category));
  await sheet.locator('h1').evaluate(node => { node.textContent = 'The animation collection'; });
  await sheet.locator('header span').evaluate(node => { node.textContent = 'FIVE WORLDS. ONE TYPING SPACE.'; });
  await sheet.setViewportSize({ width: 1120, height: 720 });
  await sheet.screenshot({ path: 'artifacts/animation/contact-sheet.png', fullPage: true });
} finally { await browser.close(); }
