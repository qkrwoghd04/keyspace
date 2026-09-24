import { describe, expect, it, vi } from 'vitest';
import { ChallengeChannel } from './ChallengeChannel';
import { ChallengeSession } from './ChallengeSession';
import { PASSAGES } from './passages';
import { conditionsFor, type RaceRecord, type PassageChoice, type RunTicket } from './types';
import { replay } from './scoring';
import { ApiError, type ChallengeApi } from './api';

async function setup() {
  let now = 0, denied = false, count = 0;
  const saved = new Map<string, RaceRecord>();
  const api: ChallengeApi = {
    player: vi.fn(async () => ({ player: null })),
    register: vi.fn(async nickname => ({ player: { id: 'player', nickname } })),
    start: vi.fn(async (choice: PassageChoice) => ({ id: String(++count), conditions: conditionsFor(PASSAGES[choice]), expiresAt: new Date(633000).toISOString() })),
    finish: vi.fn(async (id, edits) => {
      if (denied) throw new Error('저장 실패');
      const record = { id, createdAt: new Date(now).toISOString(), conditions: conditionsFor(PASSAGES.english), result: replay(PASSAGES.english, edits) };
      saved.set(id, record); return record;
    }),
    cancel: vi.fn(async () => {}), leaderboard: vi.fn(async () => ({ items: [], hasMore: false })),
    records: vi.fn(async () => ({ items: [...saved.values()], hasMore: false })), deleteRecords: vi.fn(async () => {}),
  };
  const channel = new ChallengeChannel(), session = new ChallengeSession(channel, api, () => now);
  await session.initialize(); session.configure('english');
  const run = async () => { await session.start('테스터'); now += 3100; session.commit(PASSAGES.english.text.slice(0, 30)); now += 30000; session.tick(); await vi.waitFor(() => expect(session.getSnapshot().saving).toBe(false)); };
  return { session, channel, api, saved, run, deny: (value: boolean) => { denied = value; }, time: (value: number) => { now = value; } };
}
describe('asynchronous server record session', () => {
  it('registers once, saves confirmed results once and does not use localStorage', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem'), { session, run, api, saved } = await setup();
    await run(); session.tick();
    expect(session.getSnapshot()).toMatchObject({ saved: true, revision: 1, last: { result: { speed: 1 } } });
    expect(saved.size).toBe(1); await run(); expect(api.register).toHaveBeenCalledTimes(1); expect(saved.size).toBe(2); expect(local).not.toHaveBeenCalled();
  });
  it('locks settings through connection, countdown and typing', async () => {
    const { session, channel } = await setup(); const pending = session.start('테스터');
    expect(session.locked).toBe(true); session.configure('korean'); expect(session.getSnapshot().choice).toBe('english');
    await pending; expect(channel.state.racing).toBe(true);
    session.cancel(); expect(channel.state.racing).toBe(false); session.configure('korean'); expect(session.getSnapshot().choice).toBe('korean');
  });
  it('keeps failed results and retries the same ticket without duplication', async () => {
    const { session, run, deny, saved, api } = await setup(); deny(true); await run();
    expect(session.getSnapshot()).toMatchObject({ saved: false, error: '저장 실패', race: { phase: 'finished', correct: 30 } });
    deny(false); await session.retrySave(); await session.retrySave();
    expect(saved.size).toBe(1); expect(api.finish).toHaveBeenCalledTimes(2); expect(session.getSnapshot().saved).toBe(true);
  });
  it('cancels without submitting, including a late ticket arriving after tab hiding', async () => {
    const { session, api, time } = await setup();
    let resolve!: (value: Awaited<ReturnType<ChallengeApi['start']>>) => void;
    api.start = vi.fn(() => new Promise<RunTicket>(done => { resolve = done; }));
    const pending = session.start('테스터'); await vi.waitFor(() => expect(api.start).toHaveBeenCalled());
    session.cancel('hidden'); resolve({ id: 'late', conditions: conditionsFor(PASSAGES.english), expiresAt: '' }); await pending;
    time(99000); session.tick(); expect(api.cancel).toHaveBeenCalledWith('late'); expect(api.finish).not.toHaveBeenCalled(); expect(session.locked).toBe(false);
  });
  it('does not claim persistence before the response and clears saved status on deletion', async () => {
    const { session, run } = await setup(); await run(); expect(session.getSnapshot().saved).toBe(true);
    session.recordsDeleted(); expect(session.getSnapshot()).toMatchObject({ saved: false, last: null, revision: 2 });
  });
  it('rejects a server ticket for a different passage version before countdown', async () => {
    const { session, api } = await setup();
    api.start = vi.fn(async () => ({ id: 'changed', conditions: { ...conditionsFor(PASSAGES.english), passageVersion: 2 }, expiresAt: '' }));
    await session.start('테스터');
    expect(api.cancel).toHaveBeenCalledWith('changed'); expect(session.locked).toBe(false);
    expect(session.getSnapshot().error).toContain('새로고침'); expect(api.finish).not.toHaveBeenCalled();
  });
  it('allows nickname registration again when the cookie was removed while the page stayed open', async () => {
    const { session, api } = await setup();
    api.start = vi.fn(async () => { throw new ApiError('닉네임을 다시 등록해 주세요.', 401); });
    await session.start('테스터'); expect(session.getSnapshot().player).toBeNull(); expect(session.locked).toBe(false);
  });
});
