import { describe, expect, it } from 'vitest';
import { RaceEngine } from './RaceEngine';
import { PASSAGES } from './passages';
import { conditionsFor, sameConditions } from './types';
import { bestRecord, deleteRecords, ghostPosition, loadRecords, RECORDS_KEY, retainRecords, saveRecords, validateRecord } from './records';

function record(id = 'run-1', count = 3) {
  const passage = PASSAGES.english, conditions = conditionsFor(passage, 30), engine = new RaceEngine(passage, conditions);
  engine.start(0); engine.commit(passage.text.slice(0, count), 3400); engine.advance(33000);
  return { id, createdAt: '2026-09-09T00:00:00.000Z', conditions, result: engine.getSnapshot().result!, progress: engine.trajectory };
}
describe('browser records and exact-course ghosts', () => {
  it('matches id, version, language, duration, kind and rule independently', () => {
    const base = record().conditions;
    for (const changed of [{ passageId: 'other' }, { passageVersion: 2 }, { language: 'ko' }, { duration: 60 }, { kind: 'code' }, { rule: 'other' }]) expect(sameConditions(base, { ...base, ...changed } as typeof base)).toBe(false);
  });
  it('replays real pauses and backwards samples without average-speed interpolation', () => {
    const path: [number, number][] = [[0, 0], [500, 3], [5000, 10], [6000, 7], [30000, 12]];
    expect(ghostPosition(path, 499)).toBe(0); expect(ghostPosition(path, 4999)).toBe(3);
    expect(ghostPosition(path, 5500)).toBe(10); expect(ghostPosition(path, 6000)).toBe(7);
  });
  it('stores only whitelisted record data and never free-play or error text', () => {
    const storage = new Map<string, string>();
    const adapter = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } };
    const item = { ...record(), privateText: 'secret playground thought' };
    expect(saveRecords(adapter, [item])).toBe('');
    expect(storage.get(RECORDS_KEY)).not.toContain('secret'); expect(storage.get(RECORDS_KEY)).not.toContain('privateText');
    expect(loadRecords(adapter).records).toEqual([record()]); expect(deleteRecords(adapter)).toBe(''); expect(storage.size).toBe(0);
  });
  it('rejects malformed, tampered and mismatched-version records', () => {
    const good = record(); expect(validateRecord(good)).toEqual(good);
    expect(validateRecord({ ...good, progress: [[0, 0], [30001, 3]] })).toBeNull();
    expect(validateRecord({ ...good, result: { ...good.result, speed: Infinity } })).toBeNull();
    expect(validateRecord({ ...good, result: { ...good.result, speed: NaN } })).toBeNull();
    expect(validateRecord({ ...good, conditions: { ...good.conditions, passageVersion: 99 } })).toBeNull();
    expect(validateRecord({ ...good, progress: [[0, 0], [500, -1], [30000, 3]] })).toBeNull();
  });
  it('reports read, write and deletion failures without throwing or inventing records', () => {
    const broken = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('denied'); } };
    expect(loadRecords(broken).records).toEqual([]); expect(loadRecords(broken).error).not.toBe('');
    expect(saveRecords(broken, [record()])).not.toBe(''); expect(deleteRecords(broken)).not.toBe('');
  });
  it('retains the best in each condition even when recent results are trimmed', () => {
    const best = record('best', 20);
    const recent = Array.from({ length: 30 }, (_, i) => ({ ...record(`run-${i}`), createdAt: new Date(Date.parse(best.createdAt) + i + 1).toISOString() }));
    const retained = retainRecords([best, ...recent]); expect(retained).toHaveLength(21); expect(bestRecord(retained, best.conditions)?.id).toBe('best');
    expect(bestRecord(retained, conditionsFor(PASSAGES.english, 60))).toBeUndefined();
  });
  it('preserves a zero-time observed edit separately from the starting origin', () => {
    const item = record(), engine = new RaceEngine(PASSAGES.english, item.conditions); engine.start(0); engine.commit('A', 3000); engine.advance(33000);
    expect(validateRecord({ ...item, result: engine.getSnapshot().result!, progress: engine.trajectory })).not.toBeNull();
  });
});
