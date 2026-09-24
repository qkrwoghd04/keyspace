// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app';
import { PASSAGES } from '../src/challenge/passages';
import type { InputEdit, PassageChoice } from '../src/challenge/types';

const closes: (() => Promise<void>)[] = [], directories: string[] = [];
afterEach(async () => { for (const close of closes.splice(0)) await close(); for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
async function setup(databasePath = ':memory:', rateLimits = false) {
  let now = Date.UTC(2026, 8, 23);
  const { app, store } = await createApp({ databasePath, origins: ['https://keyspace.test'], secureCookies: true, now: () => now, rateLimits });
  closes.push(() => app.close());
  const user = async (nickname = '테스터') => {
    const response = await app.inject({ method: 'POST', url: '/api/player', headers: { origin: 'https://keyspace.test' }, payload: { nickname } });
    expect(response.statusCode).toBe(200);
    return { cookie: String(response.headers['set-cookie']).split(';')[0], player: response.json().player };
  };
  const start = async (cookie: string, choice: PassageChoice = 'english') => {
    const response = await app.inject({ method: 'POST', url: '/api/runs', headers: { cookie, origin: 'https://keyspace.test' }, payload: { choice } });
    expect(response.statusCode).toBe(200); return response.json().id as string;
  };
  const finish = (cookie: string, id: string, edits: InputEdit[] = [{ at: 100, start: 0, deleteCount: 0, insert: PASSAGES.english.text.slice(0, 30) }]) => app.inject({ method: 'POST', url: `/api/runs/${id}/finish`, headers: { cookie, origin: 'https://keyspace.test' }, payload: { edits } });
  return { app, store, user, start, finish, advance: (ms: number) => { now += ms; } };
}
describe('server-owned Challenge records', () => {
  it('issues opaque secure identity, stores only its hash and restores the nickname', async () => {
    const { app, store } = await setup();
    const response = await app.inject({ method: 'POST', url: '/api/player', headers: { origin: 'https://keyspace.test' }, payload: { nickname: '  한글  ' } });
    const cookie = String(response.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Secure'); expect(cookie).toContain('SameSite=Lax'); expect(cookie).toContain('Path=/api');
    const rows = store.db.prepare('SELECT * FROM players').all();
    expect(JSON.stringify(rows)).not.toContain(cookie.split(';')[0].split('=')[1]);
    const restored = await app.inject({ url: '/api/player', headers: { cookie: cookie.split(';')[0] } });
    expect(restored.json().player.nickname).toBe('한글');
    expect((await app.inject('/api/player')).json()).toEqual({ player: null });
  });
  it('rejects missing identity, cross-origin writes, malformed names and extra fields', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'POST', url: '/api/player', payload: { nickname: 'test' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/runs', headers: { origin: 'https://keyspace.test' }, payload: { choice: 'english' } })).statusCode).toBe(401);
    for (const nickname of ['   ', '<script>', 'x'.repeat(21), 'bad\u202ename']) expect((await app.inject({ method: 'POST', url: '/api/player', headers: { origin: 'https://keyspace.test' }, payload: { nickname } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/player', headers: { origin: 'https://keyspace.test' }, payload: { nickname: 'test', id: 'forged' } })).statusCode).toBe(400);
  });
  it('recomputes CPS and accuracy, refuses an early finish and saves one idempotent result', async () => {
    const { app, store, user, start, finish, advance } = await setup(); const { cookie } = await user(), id = await start(cookie);
    expect((await finish(cookie, id)).statusCode).toBe(409); advance(33_000);
    const response = await finish(cookie, id); expect(response.statusCode).toBe(200);
    expect(response.json().result).toMatchObject({ speed: 1, correct: 30, accuracy: 100, elapsedMs: 30000 });
    advance(2_000_000); expect((await finish(cookie, id, [])).json()).toEqual(response.json());
    expect(store.db.prepare('SELECT count(*) AS n FROM records').get()).toEqual({ n: 1 });
    expect(JSON.stringify(store.db.prepare('SELECT * FROM records').all())).not.toContain('A quiet room');
    const history = await app.inject({ url: '/api/records?choice=english', headers: { cookie } }); expect(history.json().items).toHaveLength(1);
  });
  it('rejects another browser, elapsed tampering, invalid edits, oversized bodies and non-30-second choices', async () => {
    const { app, user, start, finish, advance } = await setup(); const a = await user('a'), b = await user('b'), id = await start(a.cookie); advance(33_000);
    expect((await finish(b.cookie, id)).statusCode).toBe(404);
    for (const edits of [[{ at: 30000, start: 0, deleteCount: 0, insert: 'A' }], [{ at: 100, start: 50, deleteCount: 0, insert: 'A' }], [{ at: 100, start: 0, deleteCount: 0, insert: 'A' }, { at: 99, start: 1, deleteCount: 0, insert: ' ' }]]) expect((await finish(a.cookie, id, edits)).statusCode).toBe(400);
    const forged = await app.inject({ method: 'POST', url: `/api/runs/${id}/finish`, headers: { cookie: a.cookie, origin: 'https://keyspace.test' }, payload: { edits: [], speed: 1000 } }); expect(forged.statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/runs', headers: { cookie: a.cookie, origin: 'https://keyspace.test' }, payload: { choice: 'english', duration: 60 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `/api/runs/${id}/finish`, headers: { cookie: a.cookie, origin: 'https://keyspace.test' }, payload: { edits: [], junk: 'x'.repeat(300000) } })).statusCode).toBe(413);
  });
  it('keeps corrected error history and uses the final correct prefix after deletion', async () => {
    const { user, start, finish, advance } = await setup(); const { cookie } = await user(), id = await start(cookie); advance(33_000);
    const response = await finish(cookie, id, [{ at: 1, start: 0, deleteCount: 0, insert: 'Ax' }, { at: 2, start: 1, deleteCount: 1, insert: ' quiet' }, { at: 3, start: 1, deleteCount: 6, insert: '' }]);
    expect(response.json().result).toMatchObject({ correct: 1, uniqueCorrect: 7, errors: 1, speed: 1 / 30, accuracy: 87.5 });
  });
  it('cancels old tickets, cancels explicitly, expires submissions and isolates languages', async () => {
    const { app, user, start, finish, advance } = await setup(); const { cookie } = await user(), old = await start(cookie), id = await start(cookie);
    advance(33_000); expect((await finish(cookie, old)).statusCode).toBe(410);
    await app.inject({ method: 'DELETE', url: `/api/runs/${id}`, headers: { cookie, origin: 'https://keyspace.test' } }); expect((await finish(cookie, id)).statusCode).toBe(410);
    const expired = await start(cookie); advance(633001); expect((await finish(cookie, expired)).statusCode).toBe(410);
    const korean = await start(cookie, 'korean'); advance(33000); expect((await finish(cookie, korean, [{ at: 100, start: 0, deleteCount: 0, insert: '작은' }])).json().result.speed).toBe(2 / 30);
    expect((await app.inject('/api/leaderboard?choice=english')).json().items).toHaveLength(0);
    expect((await app.inject('/api/leaderboard?choice=korean')).json().items).toHaveLength(1);
  });
  it('ranks one best per participant, breaks ties by accuracy then earlier time, excludes zero and paginates', async () => {
    const { app, store, user, start, finish, advance } = await setup();
    const a = await user('first'), b = await user('second'), c = await user('third');
    for (const person of [a, b, c]) { const id = await start(person.cookie); advance(33000); await finish(person.cookie, id); }
    const retry = await start(a.cookie); advance(33000); await finish(a.cookie, retry);
    const zero = await user('zero'), z = await start(zero.cookie); advance(33000); await finish(zero.cookie, z, []);
    expect((await app.inject({ url: '/api/leaderboard?choice=english', headers: { cookie: a.cookie } })).json().items.map((row: { nickname: string }) => row.nickname)).toEqual(['first', 'second', 'third']);
    // An older ruleset must never enter the current leaderboard.
    store.db.prepare("UPDATE records SET rule = 'old-rule' WHERE playerId = ?").run(c.player.id); advance(2001);
    for (let i = 0; i < 22; i++) { const p = await user(`player-${i}`), id = await start(p.cookie); advance(33000); await finish(p.cookie, id); }
    const page1 = (await app.inject('/api/leaderboard?choice=english')).json(), page2 = (await app.inject('/api/leaderboard?choice=english&offset=20')).json();
    expect(page1.items).toHaveLength(20); expect(page1.hasMore).toBe(true); expect(page2.items).toHaveLength(4); expect(page2.items[0].rank).toBe(21);
  });
  it('breaks speed ties by accuracy before achievement time and paginates private history', async () => {
    const { app, user, start, finish, advance } = await setup();
    const early = await user('early-inaccurate'), later = await user('later-perfect');
    const first = await start(early.cookie); advance(33000);
    await finish(early.cookie, first, [{ at: 1, start: 0, deleteCount: 0, insert: 'x' }, { at: 2, start: 0, deleteCount: 1, insert: PASSAGES.english.text.slice(0, 30) }]);
    for (let i = 0; i < 21; i++) { const id = await start(later.cookie); advance(33000); await finish(later.cookie, id); }
    expect((await app.inject('/api/leaderboard?choice=english')).json().items.map((row: { nickname: string }) => row.nickname)).toEqual(['later-perfect', 'early-inaccurate']);
    const page1 = (await app.inject({ url: '/api/records?choice=english', headers: { cookie: later.cookie } })).json();
    const page2 = (await app.inject({ url: '/api/records?choice=english&offset=20', headers: { cookie: later.cookie } })).json();
    expect(page1.items).toHaveLength(20); expect(page1.hasMore).toBe(true);
    expect(page2.items).toHaveLength(1); expect(page2.hasMore).toBe(false);
    expect((await app.inject({ url: '/api/records?choice=english&playerId=other', headers: { cookie: later.cookie } })).statusCode).toBe(400);
  });
  it('keeps older passage versions in private history but not the current board', async () => {
    const { app, store, user, start, finish, advance } = await setup();
    const { cookie } = await user(), id = await start(cookie); advance(33000); await finish(cookie, id);
    store.db.prepare('UPDATE records SET passageVersion = 0 WHERE id = ?').run(id);
    expect((await app.inject('/api/leaderboard?choice=english')).json().items).toHaveLength(0);
    expect((await app.inject({ url: '/api/records?choice=english', headers: { cookie } })).json().items).toHaveLength(1);
  });
  it('rolls back failed storage and permits the same ticket to recover', async () => {
    const { store, user, start, finish, advance } = await setup();
    const { cookie } = await user(), id = await start(cookie); advance(33000);
    store.db.exec("CREATE TRIGGER simulate_failure BEFORE INSERT ON records BEGIN SELECT RAISE(ABORT, 'disk unavailable'); END;");
    expect((await finish(cookie, id)).statusCode).toBe(500);
    expect(store.db.prepare('SELECT count(*) AS n FROM records').get()).toEqual({ n: 0 });
    expect(store.db.prepare('SELECT state FROM runs WHERE id = ?').get(id)).toEqual({ state: 'pending' });
    store.db.exec('DROP TRIGGER simulate_failure');
    expect((await finish(cookie, id)).statusCode).toBe(200);
    expect((await finish(cookie, id)).statusCode).toBe(200);
    expect(store.db.prepare('SELECT count(*) AS n FROM records').get()).toEqual({ n: 1 });
  });
  it('deletes only the current participant and prevents deleted tickets from being replayed', async () => {
    const { app, user, start, finish, advance } = await setup(); const a = await user('same'), b = await user('same');
    const aid = await start(a.cookie), bid = await start(b.cookie); advance(33000); await finish(a.cookie, aid); await finish(b.cookie, bid);
    expect((await app.inject({ method: 'DELETE', url: '/api/records', headers: { cookie: a.cookie, origin: 'https://keyspace.test' } })).statusCode).toBe(204);
    expect((await finish(a.cookie, aid)).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/records?choice=english', headers: { cookie: b.cookie } })).json().items).toHaveLength(1);
    expect((await app.inject('/api/leaderboard?choice=english')).json().items).toHaveLength(1);
  });
  it('persists identity and results across reopen and a SQLite backup restore', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'keyspace-db-test-')); directories.push(dir);
    const path = join(dir, 'db.sqlite'), original = await setup(path), { cookie } = await original.user(), id = await original.start(cookie);
    original.advance(33000); await original.finish(cookie, id); await original.store.db.backup(join(dir, 'backup.sqlite')); await original.app.close();
    const reopened = await setup(path), restored = await setup(join(dir, 'backup.sqlite'));
    for (const current of [reopened, restored]) {
      expect((await current.app.inject({ url: '/api/player', headers: { cookie } })).json().player).not.toBeNull();
      expect((await current.app.inject({ url: '/api/records?choice=english', headers: { cookie } })).json().items[0].id).toBe(id);
    }
    expect(restored.store.db.pragma('integrity_check', { simple: true })).toBe('ok');
  });
  it('rate limits the API but never the static site', async () => {
    const root = mkdtempSync(join(tmpdir(), 'keyspace-static-')); directories.push(root);
    writeFileSync(join(root, 'index.html'), '<!doctype html>');
    const { app } = await createApp({ databasePath: ':memory:', origins: ['https://keyspace.test'], staticRoot: root, globalRateLimit: 2 });
    closes.push(() => app.close());
    const pages = [], api = [];
    for (let i = 0; i < 4; i++) pages.push((await app.inject({ url: '/' })).statusCode);
    for (let i = 0; i < 3; i++) api.push((await app.inject({ url: '/api/health' })).statusCode);
    expect(pages).toEqual([200, 200, 200, 200]);
    expect(api).toEqual([200, 200, 429]);
  });
  it('keys limits by the forwarded client address only behind a trusted proxy', async () => {
    const make = async (trustProxy?: string[]) => {
      const { app } = await createApp({ databasePath: ':memory:', origins: ['https://keyspace.test'], globalRateLimit: 1, trustProxy });
      closes.push(() => app.close());
      const hit = (client: string) => app.inject({ url: '/api/health', remoteAddress: '10.0.1.2', headers: { 'x-forwarded-for': client } }).then(response => response.statusCode);
      return [await hit('203.0.113.1'), await hit('203.0.113.2')];
    };
    expect(await make(['10.0.1.0/24'])).toEqual([200, 200]);
    expect(await make()).toEqual([200, 429]);
  });
  it('limits repeated starts by participant without imposing a tiny shared-IP limit', async () => {
    const { app, user } = await setup(':memory:', true); const { cookie } = await user();
    const codes = [];
    for (let i = 0; i < 7; i++) codes.push((await app.inject({ method: 'POST', url: '/api/runs', headers: { cookie, origin: 'https://keyspace.test' }, payload: { choice: 'english' } })).statusCode);
    expect(codes).toEqual([200, 200, 200, 200, 200, 200, 429]);
  });
});
