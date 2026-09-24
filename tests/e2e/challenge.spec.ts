import { test, expect, type Page } from '@playwright/test';

const input = (page: Page) => page.getByRole('textbox', { name: 'Challenge typing input' });
const state = (page: Page) => page.evaluate(() => window.__challenge!.state());
async function open(page: Page, language = 'english', nickname = '브라우저 테스터') {
  await page.clock.install(); await page.goto('/');
  await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await page.getByRole('combobox', { name: '지문 언어' }).selectOption(language);
  await expect(page.getByRole('textbox', { name: '닉네임', exact: true })).toBeEnabled();
  await page.getByRole('textbox', { name: '닉네임', exact: true }).fill(nickname);
}
async function start(page: Page) {
  await page.locator('.race-start').click();
  await expect(page.locator('.challenge')).toHaveAttribute('data-phase', 'countdown');
  await expect(input(page)).toBeFocused();
  await page.clock.runFor(3100);
  await expect(page.locator('.challenge')).toHaveAttribute('data-phase', 'running');
}
async function finish(page: Page, saved = true) {
  const response = await page.request.post('/api/__test/advance', { data: { milliseconds: 33000 }, headers: { origin: 'http://127.0.0.1:5180' } });
  expect(response.ok()).toBe(true);
  await page.clock.fastForward(30000);
  await expect(page.locator('.challenge')).toHaveAttribute('data-phase', 'finished');
  if (saved) await expect(page.locator('.race-save')).toHaveText('저장 완료');
}
async function select(page: Page, id: string) {
  if (page.viewportSize()!.width < 1024) await page.locator('.mobile-collection-open').click();
  // Challenge collapses the desktop collection to give the keyboard room.
  else if (await page.getByRole('button', { name: 'Open collection' }).isVisible()) await page.getByRole('button', { name: 'Open collection' }).click();
  await page.locator('.collection-item[data-theme="' + id + '"]:visible').click();
  await expect(page.locator('.keyspace')).toHaveAttribute('data-preset', id);
}

test('minimal 30-second setup, private Playground, setting locks and adjustable sound', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') posts.push(request.postData() ?? ''); });
  await page.clock.install(); await page.goto('/');
  await page.locator('#typing-space').fill('private 자유 입력\nkeep this');
  await page.locator('#typing-space').evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(8, 11));
  const canvas = await page.locator('canvas').elementHandle();
  await page.getByRole('button', { name: 'Enable keyboard sound' }).click();
  await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await page.getByRole('textbox', { name: '닉네임', exact: true }).fill('잠금 테스터');
  await expect(page.getByRole('combobox', { name: /Ghost|Combo|effects/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '60초', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '지문 언어' }).locator('option')).toHaveCount(2);
  await expect(page.getByText('A LITTLE BETTER THAN YESTERDAY', { exact: true })).toHaveCount(0);
  await start(page);
  await expect(page.getByRole('button', { name: 'Playground', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: '지문 언어' })).toBeDisabled();
  await expect(page.locator('.collection-sidebar [data-theme="inferno"]')).toBeDisabled();
  await expect(page.getByRole('tab', { name: '내 기록' })).toHaveCount(0);
  await page.getByRole('slider', { name: 'Master volume' }).fill('31');
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  await expect(page.locator('#typing-space')).toHaveValue('private 자유 입력\nkeep this');
  expect(await page.locator('#typing-space').evaluate((node: HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd])).toEqual([8, 11]);
  expect(await canvas!.evaluate(node => node === document.querySelector('canvas'))).toBe(true);
  expect(await page.evaluate(() => window.__keyspace!.state().audio)).toMatchObject({ enabled: true, volume: .31 });
  expect(posts.join('')).not.toContain('private');
});

test('native mistakes, deletion, retyping, repeated keys and server-calculated CPS', async ({ page }) => {
  await open(page); await start(page);
  const requests: string[] = []; page.on('request', request => { if (request.url().includes('/api/')) requests.push(request.url()); });
  await page.keyboard.type('Ax'); expect((await state(page)).race).toMatchObject({ correct: 1, uniqueCorrect: 1, errors: 1 });
  await page.keyboard.press('Backspace'); await page.keyboard.type(' quiet');
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Backspace'); await page.keyboard.type('t'); }
  expect((await state(page)).race).toMatchObject({ correct: 7, uniqueCorrect: 7, errors: 1 });
  await page.keyboard.down('x'); await page.keyboard.down('x'); await page.keyboard.down('x'); await page.keyboard.up('x');
  expect((await state(page)).race.errors).toBe(4);
  expect(requests).toEqual([]);
  await finish(page);
  expect((await state(page)).last!.result).toMatchObject({ correct: 7, uniqueCorrect: 7, errors: 4, speed: 7 / 30, elapsedMs: 30000 });
  await expect(page.getByTestId('race-speed')).toHaveText('0.23');
});

test('Chromium IME counts only committed Korean syllables, handles cancellation and duplicate final events', async ({ page }) => {
  await open(page, 'korean'); await start(page);
  const cdp = await page.context().newCDPSession(page);
  for (const text of ['ㅈ', '자', '작']) {
    await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
    expect((await state(page)).race).toMatchObject({ correct: 0, errors: 0 });
  }
  await cdp.send('Input.insertText', { text: '작' });
  await expect(input(page)).toHaveValue('작');
  expect((await state(page)).race).toMatchObject({ correct: 1, uniqueCorrect: 1, errors: 0 });
  await cdp.send('Input.imeSetComposition', { text: 'ㅇ', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
  expect((await state(page)).race).toMatchObject({ correct: 1, errors: 0 });
  await cdp.send('Input.imeSetComposition', { text: '은', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.insertText', { text: '은' });
  await input(page).evaluate(node => node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '은' })));
  expect((await state(page)).race).toMatchObject({ correct: 2, errors: 0 });
  await finish(page);
  expect((await state(page)).last!.result).toMatchObject({ speed: 2 / 30, accuracy: 100 });
});

test('pending IME at the 30-second boundary and post-deadline input never enter saved scores', async ({ page }) => {
  await open(page, 'korean'); await start(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '작', selectionStart: 1, selectionEnd: 1 });
  await finish(page); await cdp.send('Input.insertText', { text: '작' });
  expect((await state(page)).last!.result).toMatchObject({ correct: 0, errors: 0, speed: 0 });
  await page.getByRole('tab', { name: '내 기록' }).click();
  await expect(page.getByRole('table', { name: '내 기록 목록' }).locator('tbody tr')).toHaveCount(1);
});

test('blocks paste, drop and undo, including noncancelable input and a new race', async ({ page }) => {
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

test('reload keeps cookie identity and history without touching old local records', async ({ page }) => {
  await open(page, 'english', '재접속');
  await page.evaluate(() => { localStorage.setItem('keyspace:challenge:v1', 'legacy-keep'); localStorage.setItem('unrelated', 'keep'); });
  await start(page); await page.keyboard.type('A quiet room'); await finish(page);
  const id = (await state(page)).last!.id;
  await page.reload(); await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await expect(page.locator('.player-name')).toHaveText('재접속');
  await page.getByRole('combobox', { name: '지문 언어' }).selectOption('english');
  await page.getByRole('tab', { name: '내 기록' }).click();
  await expect(page.getByRole('table', { name: '내 기록 목록' }).locator('tbody tr')).toHaveCount(1);
  expect((await (await page.request.get('/api/records?choice=english')).json()).items[0].id).toBe(id);
  await page.getByRole('button', { name: '내 기록 삭제', exact: true }).click();
  await page.getByRole('button', { name: '삭제 확인' }).click();
  await expect(page.getByText('아직 기록 없음.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem('keyspace:challenge:v1'), localStorage.getItem('unrelated')])).toEqual(['legacy-keep', 'keep']);
});

test('tab hiding cancels without a saved result', async ({ page }) => {
  await open(page); await start(page); await page.keyboard.type('A quiet');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.challenge')).toHaveAttribute('data-phase', 'canceled');
  await page.clock.fastForward(60000);
  expect((await state(page))).toMatchObject({ saved: false, last: null });
  expect((await (await page.request.get('/api/records?choice=english')).json()).items).toEqual([]);
});

test('lost save response retains result, retries the same ID once, and keeps failed status honest', async ({ page }) => {
  await open(page); await start(page); await page.keyboard.type('A quiet');
  const ids: string[] = [];
  await page.route('**/api/runs/*/finish', async route => {
    ids.push(route.request().url());
    await route.fetch(); // Server saved it, but the browser did not receive the acknowledgement.
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '저장 확인 실패. 다시 시도해 주세요.' }) });
  });
  await finish(page, false);
  await expect(page.getByRole('alert')).toContainText('저장 확인 실패');
  await expect(page.locator('.race-save')).toHaveText('저장되지 않음');
  await expect(page.getByTestId('race-speed')).toHaveText('0.23');
  await page.unroute('**/api/runs/*/finish');
  const retry = page.waitForRequest(request => request.url().endsWith('/finish'));
  await page.getByRole('button', { name: '저장 재시도' }).click();
  expect((await retry).url()).toBe(ids[0]);
  await expect(page.locator('.race-save')).toHaveText('저장 완료');
  expect((await (await page.request.get('/api/records?choice=english')).json()).items).toHaveLength(1);
});

test('independent browser identities share the board, not private history or nickname ownership', async ({ page, browser }) => {
  await open(page, 'english', '공용 순위 A'); await start(page); await page.keyboard.type('A quiet room'); await finish(page);
  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:5180' }), second = await other.newPage();
  try {
    await open(second, 'english', '공용 순위 B');
    await expect(second.getByRole('table', { name: '순위표' })).toContainText('공용 순위 A');
    await second.getByRole('tab', { name: '내 기록' }).click();
    await expect(second.getByText('아직 기록 없음.', { exact: true })).toBeVisible();
    await start(second); await second.keyboard.type('A quiet'); await finish(second);
    await page.getByRole('tab', { name: '내 기록' }).click(); await page.getByRole('tab', { name: '순위' , exact: true }).click();
    await expect(page.getByRole('table', { name: '순위표' })).toContainText('공용 순위 B');
    await expect(page.locator('.record--mine')).toContainText('공용 순위 A');
    await second.getByRole('tab', { name: '내 기록' }).click();
    await expect(second.getByRole('table', { name: '내 기록 목록' }).locator('tbody tr')).toHaveCount(1);
  } finally { await other.close(); }
});

test('all 14 themes keep key movement but suppress Challenge particles, combo and finales', async ({ page }) => {
  test.setTimeout(150000); await open(page);
  const ids = await page.locator('.collection-sidebar [data-theme]').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.theme!));
  expect(ids).toHaveLength(14);
  for (const id of ids) {
    await select(page, id); await start(page); await page.keyboard.type('A quiet room');
    await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await page.clock.runFor(100);
    const studio = await page.evaluate(() => window.__keyspace!.state());
    expect(studio.fits).toBe(true);
    if (studio.effects.signature) expect(studio.effects.signature.starts).toBe(0);
    if (studio.effects.particles !== undefined) expect(studio.effects.particles).toBe(0);
    if (id === 'digimon') {
      expect(studio.effects.mechanism).toMatchObject({ form: 'agumon', packets: 0, missiles: 0, gaiaVisible: false });
      await expect(page.locator('.partner-caption')).toHaveCount(0);
    }
    await finish(page);
    expect((await state(page)).last!.result).toMatchObject({ correct: 12, speed: .4, errors: 2 });
    await page.clock.runFor(1200);
    const after = await page.evaluate(() => window.__keyspace!.state());
    if (after.effects.signature) expect(after.effects.signature.starts).toBe(0);
  }
});

test('Challenge fits desktop, tablet, portrait, landscape and 320px layouts', async ({ page }) => {
  test.setTimeout(90000); await open(page);
  for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [844, 390], [320, 740]]) {
    await page.setViewportSize({ width, height }); await page.clock.runFor(100);
    await select(page, 'howl'); await page.clock.runFor(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => window.__keyspace!.state().fits)).toBe(true);
    await start(page); await page.keyboard.type('A'); await finish(page);
    await page.getByRole('tab', { name: '내 기록' }).click();
    const bounds = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const main = rect('.challenge-main'), side = rect('.challenge-side'), canvas = rect('canvas'), footer = rect('.site-footer');
      return { mainBottom: main.bottom, sideLeft: side.left, sideBottom: side.bottom, canvasTop: canvas.top, canvasRight: canvas.right, canvasBottom: canvas.bottom, footerTop: footer.top, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(bounds.overflow).toBe(false); expect(bounds.canvasTop).toBeGreaterThanOrEqual(bounds.mainBottom - 2); expect(bounds.footerTop).toBeGreaterThanOrEqual(bounds.canvasBottom - 2);
    // Desktop keeps controls in a side panel beside the keyboard; narrower layouts stack them above it.
    if (width >= 1024) expect(bounds.canvasRight).toBeLessThanOrEqual(bounds.sideLeft + 2);
    else expect(bounds.canvasTop).toBeGreaterThanOrEqual(bounds.sideBottom - 2);
  }
});
