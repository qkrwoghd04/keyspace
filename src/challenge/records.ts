import { accuracyOf, characters, speedOf } from './RaceEngine';
import { findPassage } from './passages';
import { conditionKey, conditionsFor, sameConditions, type ProgressPoint, type RaceConditions, type RaceRecord } from './types';

export const RECORDS_KEY = 'keyspace:challenge:v1';
export const MAX_RECENT = 20;
export interface RecordStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, max: number): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max;

/** Validate persisted, untrusted data and reconstruct only whitelisted fields. */
export function validateRecord(value: unknown): RaceRecord | null {
  if (!object(value) || !object(value.conditions) || !object(value.result) || !Array.isArray(value.progress)) return null;
  const c = value.conditions, r = value.result, passage = typeof c.passageId === 'string' ? findPassage(c.passageId) : undefined;
  if (!passage || (c.duration !== 30 && c.duration !== 60)) return null;
  const conditions = conditionsFor(passage, c.duration);
  if (!sameConditions(c as unknown as RaceConditions, conditions)) return null;
  const length = characters(passage.text).length, duration = c.duration * 1000;
  if (typeof value.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value.id) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) return null;
  if (!integer(r.correct, length) || !integer(r.uniqueCorrect, length) || r.correct > r.uniqueCorrect || !integer(r.errors, 1000000) || !integer(r.maxCombo, r.uniqueCorrect) || r.elapsedMs !== duration) return null;
  const unit = c.language === 'ko' ? 'CPM' : 'WPM';
  const accuracy = accuracyOf(r.uniqueCorrect, r.errors), speed = speedOf(r.correct, duration, conditions.language);
  if (r.unit !== unit || typeof r.accuracy !== 'number' || !Number.isFinite(r.accuracy) || Math.abs(r.accuracy - accuracy) > .0001 || typeof r.speed !== 'number' || !Number.isFinite(r.speed) || Math.abs(r.speed - speed) > .0001) return null;
  if (value.progress.length < 2 || value.progress.length > 6002) return null;
  const progress: ProgressPoint[] = []; let lastTime = -1, highest = 0;
  for (const point of value.progress) {
    if (!Array.isArray(point) || point.length !== 2 || !integer(point[0], duration) || !integer(point[1], length) || point[0] < lastTime || (point[0] === lastTime && !(progress.length === 1 && lastTime === 0))) return null;
    lastTime = point[0]; highest = Math.max(highest, point[1]); progress.push([point[0], point[1]]);
  }
  if (progress[0][0] !== 0 || progress[0][1] !== 0 || progress.at(-1)![0] !== duration || progress.at(-1)![1] !== r.correct || highest > r.uniqueCorrect) return null;
  return { id: value.id, createdAt: value.createdAt, conditions, result: { correct: r.correct, uniqueCorrect: r.uniqueCorrect, errors: r.errors, accuracy, speed, unit, maxCombo: r.maxCombo, elapsedMs: duration }, progress };
}
export function bestRecord(records: readonly RaceRecord[], conditions: RaceConditions) {
  return records.filter(record => record.result.correct > 0 && sameConditions(record.conditions, conditions)).reduce<RaceRecord | undefined>((best, record) => !best || compareResults(record, best) > 0 ? record : best, undefined);
}
export function compareResults(a: RaceRecord, b: RaceRecord) { return a.result.speed - b.result.speed || a.result.accuracy - b.result.accuracy; }
export function retainRecords(records: readonly RaceRecord[]) {
  const ordered = [...records].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const best = new Map<string, RaceRecord>();
  for (const record of ordered) {
    const key = conditionKey(record.conditions), previous = best.get(key);
    if (!previous || compareResults(record, previous) > 0) best.set(key, record);
  }
  const keep = new Map(ordered.slice(0, MAX_RECENT).map(record => [record.id, record]));
  for (const record of best.values()) keep.set(record.id, record);
  return [...keep.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
export function loadRecords(storage: RecordStorage): { records: RaceRecord[]; error: string } {
  try {
    const raw = storage.getItem(RECORDS_KEY);
    if (!raw) return { records: [], error: '' };
    if (raw.length > 4_000_000) throw new Error('oversized');
    const data: unknown = JSON.parse(raw);
    if (!object(data) || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 40) throw new Error('schema');
    const valid = data.records.map(validateRecord).filter((record): record is RaceRecord => !!record);
    return { records: retainRecords(valid), error: valid.length === data.records.length ? '' : '호환되지 않거나 손상된 기록은 제외된 상태.' };
  } catch { return { records: [], error: '이 브라우저의 기록을 읽을 수 없음. 새 경기는 가능하며 저장소 설정 확인 필요.' }; }
}
export function saveRecords(storage: RecordStorage, records: readonly RaceRecord[]): string {
  try {
    const clean = records.map(validateRecord);
    if (clean.some(record => !record)) throw new Error('invalid record');
    storage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, records: retainRecords(clean as RaceRecord[]) }));
    return '';
  } catch { return '기록 저장 실패. 결과는 현재 화면에만 유지됨. 저장 공간 또는 브라우저 권한 확인 후 재시도 가능.'; }
}
export function deleteRecords(storage: RecordStorage): string {
  try { storage.removeItem(RECORDS_KEY); return ''; }
  catch { return '기록 삭제 실패. 브라우저 저장소 권한 확인 후 재시도 필요.'; }
}
/** Step playback at recorded timestamps, including real pauses and backtracking. */
export function ghostPosition(progress: readonly ProgressPoint[], elapsedMs: number) {
  let lo = 0, hi = progress.length;
  while (lo < hi) { const middle = (lo + hi) >>> 1; if (progress[middle][0] <= elapsedMs) lo = middle + 1; else hi = middle; }
  return lo ? progress[lo - 1][1] : 0;
}
