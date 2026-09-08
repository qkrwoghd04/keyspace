import { test, expect, type Page } from '@playwright/test';

const input = (page: Page) => page.getByRole('textbox', { name: 'Challenge typing input' });
const state = (page: Page) => page.evaluate(() => window.__challenge!.state());
async function open(page: Page, language = 'english', clock = true) {
  if (clock) await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await expect(page.locator('.challenge')).toBeVisible();
  await page.getByRole('combobox', { name: 'Passage language' }).selectOption(language);
}
async function start(page: Page) {
  await page.locator('.race-start').click(); await expect(input(page)).toBeFocused();
  await page.clock.runFor(3100); await expect(page.locator('.challenge')).toHaveAttribute('data-phase', 'running');
}
async function finish(page: Page, duration = 30000) {
  await page.clock.fastForward(duration);
  await expect(page.locator('.challenge')).toHaveAttribute('data-phase', 'finished');
}
async function select(page: Page, id: string) {
  if (page.viewportSize()!.width < 1024) await page.locator('.mobile-collection-open').click();
  await page.locator(`.collection-item[data-theme="${id}"]:visible`).click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', id);
}

test('Playground stays native and private across modes, while race settings lock and sound remains adjustable', async ({ page }) => {
  await page.clock.install(); await page.goto('/');
  await page.locator('#typing-space').fill('private 자유 입력\nkeep this');
  await page.locator('#typing-space').evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(8, 11));
  const canvas = await page.locator('canvas').elementHandle();
  await page.getByRole('button', { name: 'Enable keyboard sound' }).click();
  await page.getByRole('slider', { name: 'Master volume' }).fill('27');
  await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Ghost record' })).toBeDisabled();
  await start(page);
  await expect(page.getByRole('button', { name: 'Playground', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Passage language' })).toBeDisabled();
  await expect(page.locator('.collection-sidebar [data-theme="inferno"]')).toBeDisabled();
  await expect(page.getByRole('button', { name: '60초', exact: true })).toBeDisabled();
  await page.getByRole('slider', { name: 'Master volume' }).fill('31');
  await page.getByRole('combobox', { name: 'Combo effects' }).selectOption('off');
  await page.getByRole('button', { name: '경기 취소', exact: true }).click();
  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  await expect(page.locator('#typing-space')).toHaveValue('private 자유 입력\nkeep this');
  expect(await page.locator('#typing-space').evaluate((node: HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd])).toEqual([8, 11]);
  expect(await canvas!.evaluate(node => node === document.querySelector('canvas'))).toBe(true);
  expect(await page.evaluate(() => window.__keyspace!.state().audio)).toMatchObject({ enabled: true, volume: .31 });
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('private');
  expect(await page.locator('#typing-space').evaluate(node => node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true })))).toBe(true);
});

test('native mistakes, deletion, rapid retyping and auto-repeat cannot farm correct events', async ({ page }) => {
  await open(page); await start(page);
  await page.keyboard.type('Ax'); expect((await state(page)).race).toMatchObject({ correct: 1, uniqueCorrect: 1, errors: 1, combo: 0 });
  await page.keyboard.press('Backspace'); await page.keyboard.type(' quiet');
  expect((await state(page)).race).toMatchObject({ correct: 7, uniqueCorrect: 7, errors: 1, combo: 6 });
  const before = await page.evaluate(() => window.__keyspace!.state().rewards!.bursts);
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Backspace'); await page.keyboard.type('t'); }
  expect((await state(page)).race).toMatchObject({ correct: 7, uniqueCorrect: 7, errors: 1, combo: 6 });
  expect(await page.evaluate(() => window.__keyspace!.state().rewards!.bursts)).toBe(before);
  await page.keyboard.down('x'); await page.keyboard.down('x'); await page.keyboard.down('x'); await page.keyboard.up('x');
  expect((await state(page)).race).toMatchObject({ correct: 7, uniqueCorrect: 7, errors: 4, combo: 0 });
  await page.keyboard.press('Backspace'); expect((await state(page)).race.errors).toBe(4);
});

test('Korean composition intermediates, cancellation and duplicate final input are judged once in Chromium IME', async ({ page }) => {
  await open(page, 'korean'); await start(page);
  const cdp = await page.context().newCDPSession(page);
  for (const text of ['ㅈ', '자', '작']) {
    await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
    expect((await state(page)).race).toMatchObject({ correct: 0, errors: 0 });
  }
  await cdp.send('Input.insertText', { text: '작' });
  await expect(input(page)).toHaveValue('작'); expect((await state(page)).race).toMatchObject({ correct: 1, uniqueCorrect: 1, errors: 0, combo: 1 });
  expect(await page.evaluate(() => window.__keyspace!.state().rewards!.bursts)).toBe(1);
  await cdp.send('Input.imeSetComposition', { text: 'ㅇ', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
  expect((await state(page)).race).toMatchObject({ correct: 1, errors: 0 });
  await cdp.send('Input.imeSetComposition', { text: '은', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.insertText', { text: '은' });
  await input(page).evaluate(node => node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '은' })));
  expect((await state(page)).race).toMatchObject({ correct: 2, uniqueCorrect: 2, errors: 0, combo: 2 });
  await finish(page); expect((await state(page)).last!.result).toMatchObject({ speed: 4, unit: 'CPM', accuracy: 100 });
});

test('pending IME at expiry and post-deadline input do not enter the result', async ({ page }) => {
  await open(page, 'korean'); await start(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '작', selectionStart: 1, selectionEnd: 1 });
  await finish(page);
  await cdp.send('Input.insertText', { text: '작' });
  expect((await state(page)).last!.result).toMatchObject({ correct: 0, errors: 0, speed: 0 });
  expect((await state(page)).records).toHaveLength(1);
});

test('Challenge blocks paste, drop and undo before input and reverts noncancelable insertion, including retries', async ({ page }) => {
  await open(page); await start(page); await page.keyboard.type('A');
  for (const type of ['insertFromPaste', 'insertFromDrop', 'historyUndo']) {
    expect(await input(page).evaluate((node, type) => node.dispatchEvent(new InputEvent('beforeinput', { inputType: type, bubbles: true, cancelable: true })), type)).toBe(false);
    await input(page).evaluate((node: HTMLTextAreaElement, type) => { node.value = 'A quiet room'; node.dispatchEvent(new InputEvent('input', { inputType: type, bubbles: true })); }, type);
    await expect(input(page)).toHaveValue('A'); expect((await state(page)).race.correct).toBe(1);
  }
  expect(await input(page).evaluate(node => node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true })))).toBe(false);
  await finish(page); await start(page);
  expect(await input(page).evaluate(node => node.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertFromPaste', bubbles: true, cancelable: true })))).toBe(false);
});

test('actual saved timeline survives reload and Ghost follows pauses and backtracking with exact conditions', async ({ page }) => {
  await open(page); await start(page); await page.clock.runFor(400); await page.keyboard.type('A quiet');
  await page.clock.runFor(4000); await page.keyboard.press('Backspace');
  await page.clock.runFor(1500); await page.keyboard.type('t room'); await finish(page);
  const saved = (await state(page)).last!;
  expect((await state(page)).saved).toBe(true); expect(saved.progress.some((point, index) => index > 0 && point[1] < saved.progress[index - 1][1])).toBe(true);
  await page.getByRole('button', { name: '이 기록과 Ghost Race' }).click();
  await expect(input(page)).toBeFocused(); await page.clock.runFor(3100); await page.keyboard.type('A');
  expect((await state(page)).race.correct).toBe(1);
  await page.clock.runFor(1800);
  let current = await state(page);
  let expected = saved.progress.filter(point => point[0] <= current.race.elapsedMs).at(-1)![1];
  await expect(page.getByRole('progressbar', { name: 'Ghost progress', exact: true })).toHaveAttribute('aria-valuenow', String(expected));
  expect(expected).toBe(7);
  await page.clock.runFor(3000); current = await state(page); expected = saved.progress.filter(point => point[0] <= current.race.elapsedMs).at(-1)![1];
  expect(expected).toBe(6);
  await expect(page.getByTestId('ghost-gap')).toHaveText('5글자 뒤처짐');
  await page.getByRole('button', { name: '경기 취소', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await page.getByRole('combobox', { name: 'Passage language' }).selectOption('english');
  await page.getByRole('combobox', { name: 'Ghost record' }).selectOption(saved.id);
  expect((await state(page)).ghost!.progress).toEqual(saved.progress);
  await page.getByRole('button', { name: '60초', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Ghost record' })).toBeDisabled();
  await page.getByRole('button', { name: '30초', exact: true }).click();
  await page.getByRole('combobox', { name: 'Passage language' }).selectOption('code');
  await expect(page.getByRole('combobox', { name: 'Ghost record' })).toBeDisabled();
});

test('hidden tab policy cancels a running race without saving a best or replay', async ({ page }) => {
  await open(page); await start(page); await page.keyboard.type('A quiet');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.challenge')).toHaveAttribute('data-phase', 'canceled');
  await page.clock.fastForward(60000);
  expect((await state(page))).toMatchObject({ saved: false, personalBest: false, last: null, records: [] });
  expect(await page.evaluate(() => localStorage.getItem('keyspace:challenge:v1'))).toBeNull();
});

test('write failure keeps the result, retry is idempotent, and deletion leaves unrelated storage alone', async ({ page }) => {
  await open(page); await page.evaluate(() => {
    localStorage.setItem('unrelated', 'keep');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'keyspace:challenge:v1' && !(window as any).allowSave) throw new DOMException('Quota', 'QuotaExceededError'); original.call(this, key, value); };
  });
  await start(page); await page.keyboard.type('A quiet'); await finish(page);
  const id = (await state(page)).last!.id;
  await expect(page.getByRole('alert')).toContainText('저장 실패');
  await expect(page.getByRole('button', { name: '이 기록과 Ghost Race' })).toBeDisabled();
  await page.evaluate(() => { (window as any).allowSave = true; });
  await page.getByRole('button', { name: '저장 재시도' }).click();
  expect((await state(page))).toMatchObject({ saved: true, storageError: '' }); expect((await state(page)).records.map(row => row.id)).toEqual([id]);
  await page.locator('.browser-records summary').click();
  await page.getByRole('button', { name: '전체 기록 삭제', exact: true }).click();
  await page.getByRole('button', { name: '전체 기록 삭제 확인' }).click();
  expect((await state(page)).records).toHaveLength(0); expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('keep');
});

test('denied storage reads do not prevent typing or invent a Ghost', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.getItem = function() { throw new DOMException('Blocked', 'SecurityError'); }; });
  await open(page); await expect(page.getByRole('alert')).toBeVisible();
  await start(page); await page.keyboard.type('A quiet'); await finish(page);
  expect((await state(page))).toMatchObject({ saved: false, records: [], race: { correct: 7 } });
  await expect(page.getByRole('combobox', { name: 'Ghost record' })).toBeDisabled();
});

test('native code punctuation, newlines and 60-second WPM remain plain text', async ({ page }) => {
  await open(page, 'code'); await page.getByRole('button', { name: '60초', exact: true }).click(); await start(page);
  const passage = await page.evaluate(() => window.__challenge!.passage().slice(0, 77));
  await page.keyboard.type(passage); await expect(input(page)).toHaveValue(passage);
  expect((await state(page)).race).toMatchObject({ correct: passage.length, errors: 0 });
  await finish(page, 60000);
  expect((await state(page)).last!.result).toMatchObject({ speed: passage.length / 5, unit: 'WPM', elapsedMs: 60000 });
});

test('all 14 themes consume judgments, suppress raw heroes, preserve score, and finish once', async ({ page }) => {
  test.setTimeout(130000); await open(page);
  const ids = await page.locator('.collection-sidebar [data-theme]').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.theme!));
  const text = await page.evaluate(() => window.__challenge!.passage().slice(0, 55));
  for (const id of ids) {
    await select(page, id); await page.getByRole('combobox', { name: 'Combo effects' }).selectOption('full'); await start(page);
    await page.keyboard.type(text); await page.clock.runFor(100);
    let studio = await page.evaluate(() => window.__keyspace!.state());
    expect(studio.rewards).toMatchObject({ tier: 3, finales: 0 });
    expect(studio.rewards!.bursts).toBeGreaterThan(0); expect(studio.fits).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(900);
    if (id === 'orbit') expect(studio.rewards!.stableRing).toBe(true);
    if (studio.effects.signature) expect(studio.effects.signature.starts).toBe(0);
    await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await page.clock.runFor(100);
    studio = await page.evaluate(() => window.__keyspace!.state());
    if (studio.effects.signature) expect(studio.effects.signature.starts).toBe(0);
    await finish(page); await page.clock.runFor(100);
    studio = await page.evaluate(() => window.__keyspace!.state());
    expect(studio.rewards!.finales).toBe(1); expect(studio.rewards!.particles).toBeLessThanOrEqual(64);
    if (studio.effects.signature) expect(studio.effects.signature.starts).toBe(1);
    expect((await state(page)).last!.result).toMatchObject({ correct: 55, speed: 22, errors: 2, maxCombo: 55 });
    await page.clock.runFor(1600); expect((await page.evaluate(() => window.__keyspace!.state())).rewards!.finales).toBe(1);
  }
});

test('off and reduced-motion rewards never change judgment, speed or saving', async ({ page }) => {
  await open(page); await select(page, 'pokemon');
  for (const reduced of [false, true]) {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.getByRole('combobox', { name: 'Combo effects' }).selectOption(reduced ? 'full' : 'off');
    await start(page); await page.keyboard.type('A quiet room'); await finish(page);
    const studio = await page.evaluate(() => window.__keyspace!.state());
    expect(studio.rewards).toMatchObject({ bursts: 0, finales: 0, particles: 0 });
    expect(studio.effects.signature!.starts).toBe(0);
    expect((await state(page)).last!.result).toMatchObject({ correct: 12, speed: 4.8, accuracy: 100, maxCombo: 12 });
  }
});

test('Challenge fits six viewports, with usable settings, keyboard and expandable records', async ({ page }) => {
  test.setTimeout(80000); await open(page);
  for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [844, 390], [320, 740]]) {
    await page.setViewportSize({ width, height }); await page.clock.runFor(100);
    await select(page, 'howl'); await page.clock.runFor(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440) expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => window.__keyspace!.state().fits)).toBe(true);
    await start(page); await page.keyboard.type('A');
    expect(await page.evaluate(() => document.querySelector('.site-footer')!.getBoundingClientRect().top >= document.querySelector('canvas')!.getBoundingClientRect().bottom - 2)).toBe(true);
    await finish(page);
    await page.locator('.browser-records summary').click();
    const bounds = await page.evaluate(() => {
      const main = document.querySelector('.challenge')!.getBoundingClientRect(), canvas = document.querySelector('canvas')!.getBoundingClientRect(), footer = document.querySelector('.site-footer')!.getBoundingClientRect();
      return { mainBottom: main.bottom, canvasTop: canvas.top, canvasBottom: canvas.bottom, footerTop: footer.top, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(bounds.overflow).toBe(false); expect(bounds.canvasTop).toBeGreaterThanOrEqual(bounds.mainBottom - 2); expect(bounds.footerTop).toBeGreaterThanOrEqual(bounds.canvasBottom - 2);
    await page.locator('.browser-records summary').click();
  }
});
