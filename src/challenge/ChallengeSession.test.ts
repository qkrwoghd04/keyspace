import { describe, expect, it } from 'vitest';
import { ChallengeChannel } from './ChallengeChannel';
import { ChallengeSession } from './ChallengeSession';
import { loadRecords, RECORDS_KEY, type RecordStorage } from './records';

function setup() {
  let now = 0, denied = '';
  const data = new Map<string, string>([['unrelated', 'keep']]);
  const storage: RecordStorage = {
    getItem(key) { if (denied === 'read') throw Error('read denied'); return data.get(key) ?? null; },
    setItem(key, value) { if (denied === 'write') throw Error('quota'); data.set(key, value); },
    removeItem(key) { if (denied === 'delete') throw Error('delete denied'); data.delete(key); },
  };
  const channel = new ChallengeChannel(), session = new ChallengeSession(channel, () => storage, () => now);
  session.configure('english', 30);
  const run = (count = 10) => { session.start(); now += 3100; session.commit(session.passage.text.slice(0, count), 'KeyA'); now += 30000; session.tick(); };
  return { session, channel, data, storage, run, deny: (type: string) => { denied = type; }, time: (value: number) => { now = value; } };
}
describe('challenge session transactions', () => {
  it('saves one completion, compares exact-condition bests and never saves free text', () => {
    const { session, run, data } = setup(); run();
    expect(session.getSnapshot()).toMatchObject({ saved: true, personalBest: true });
    session.tick(); expect(session.getSnapshot().records).toHaveLength(1);
    run(5); expect(session.getSnapshot()).toMatchObject({ personalBest: false, previousBest: { result: { correct: 10 } } });
    expect(data.get(RECORDS_KEY)).not.toContain('A quiet');
    session.configure('code', 30); expect(session.getSnapshot().previousBest).toBeNull();
  });
  it('locks configuration and mode presentation through countdown and run', () => {
    const { session, channel, time } = setup(); session.start();
    session.configure('code', 60); expect(session.getSnapshot()).toMatchObject({ choice: 'english', duration: 30 });
    expect(channel.state.racing).toBe(true); time(5000); session.tick(); session.cancel();
    expect(channel.state.racing).toBe(false); session.configure('code', 60);
    expect(session.getSnapshot()).toMatchObject({ choice: 'code', duration: 60 });
  });
  it('never persists an interrupted run, including during countdown', () => {
    const { session, data, time } = setup(); session.start(); session.cancel('hidden'); time(99000); session.tick();
    expect(session.getSnapshot()).toMatchObject({ race: { phase: 'canceled', result: null }, saved: false, personalBest: false });
    expect(data.has(RECORDS_KEY)).toBe(false);
  });
  it('retains an unsaved result and retries the same id without duplication', () => {
    const { session, deny, run } = setup(); deny('write'); run();
    const id = session.getSnapshot().last!.id;
    expect(session.getSnapshot()).toMatchObject({ saved: false, records: [] }); expect(session.getSnapshot().storageError).toContain('저장 실패');
    deny(''); session.retrySave(); session.retrySave();
    expect(session.getSnapshot()).toMatchObject({ saved: true, storageError: '' }); expect(session.getSnapshot().records.map(row => row.id)).toEqual([id]);
  });
  it('does not overwrite unreadable data, and recovers after explicit deletion', () => {
    const { session, data, run } = setup(); data.set(RECORDS_KEY, '{broken'); run();
    expect(session.getSnapshot().saved).toBe(false); expect(data.get(RECORDS_KEY)).toBe('{broken');
    session.clearRecords(); session.retrySave(); expect(session.getSnapshot().saved).toBe(true);
  });
  it('retains records on delete failure and removes only the challenge key on success', () => {
    const { session, data, deny, run, storage } = setup(); run(); deny('delete'); session.clearRecords();
    expect(session.getSnapshot().records).toHaveLength(1); expect(loadRecords(storage).records).toHaveLength(1);
    deny(''); session.clearRecords(); expect(session.getSnapshot().records).toHaveLength(0); expect(data.get('unrelated')).toBe('keep'); expect(data.has(RECORDS_KEY)).toBe(false);
  });
  it('offers only actual saved ghosts with exactly compatible settings', () => {
    const { session, run } = setup(); run(); const id = session.getSnapshot().last!.id;
    session.chooseGhost(id); expect(session.getSnapshot().ghost?.id).toBe(id);
    session.configure('english', 60); session.chooseGhost(id); expect(session.getSnapshot().ghost).toBeNull();
    session.chooseGhost('fake'); expect(session.getSnapshot().ghost).toBeNull();
  });
});
