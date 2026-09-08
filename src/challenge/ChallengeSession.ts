import { ChallengeChannel } from './ChallengeChannel';
import { RaceEngine } from './RaceEngine';
import { PASSAGES } from './passages';
import { bestRecord, compareResults, deleteRecords, loadRecords, retainRecords, saveRecords, type RecordStorage } from './records';
import { conditionsFor, sameConditions, type Duration, type JudgmentEvent, type PassageChoice, type RaceRecord, type RaceSnapshot } from './types';

export interface SessionSnapshot {
  choice: PassageChoice; duration: Duration; race: RaceSnapshot; records: readonly RaceRecord[];
  ghost: RaceRecord | null; last: RaceRecord | null; previousBest: RaceRecord | null;
  personalBest: boolean; storageError: string; saved: boolean;
}

/** Owns a run and local record transactions; the pure engine owns all rules. */
export class ChallengeSession {
  private engine: RaceEngine;
  private snapshot: SessionSnapshot;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly channel: ChallengeChannel, private readonly storage: () => RecordStorage = () => window.localStorage, private readonly now: () => number = () => performance.now()) {
    this.engine = new RaceEngine(PASSAGES.korean, conditionsFor(PASSAGES.korean, 30));
    let loaded: ReturnType<typeof loadRecords>;
    try { loaded = loadRecords(storage()); } catch { loaded = { records: [], error: '이 브라우저의 저장소에 접근할 수 없음. 저장소 권한 확인 필요.' }; }
    this.snapshot = { choice: 'korean', duration: 30, race: this.engine.getSnapshot(), records: loaded.records, ghost: null, last: null, previousBest: null, personalBest: false, storageError: loaded.error, saved: false };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get passage() { return PASSAGES[this.snapshot.choice]; }
  get conditions() { return this.engine.conditions; }
  get locked() { return this.engine.locked; }
  private publish(patch: Partial<SessionSnapshot> = {}) {
    this.snapshot = { ...this.snapshot, ...patch, race: this.engine.getSnapshot() };
    for (const listener of this.listeners) listener();
  }
  configure(choice: PassageChoice, duration: Duration) {
    if (this.locked) return;
    const passage = PASSAGES[choice]; this.engine = new RaceEngine(passage, conditionsFor(passage, duration));
    this.channel.send({ type: 'reset' });
    this.publish({ choice, duration, ghost: null, last: null, previousBest: null, personalBest: false, saved: false });
  }
  chooseGhost(id: string) {
    if (this.locked) return;
    const ghost = this.snapshot.records.find(record => record.id === id && sameConditions(record.conditions, this.conditions)) ?? null;
    this.publish({ ghost });
  }
  start(ghostId?: string) {
    if (this.locked) return;
    if (ghostId !== undefined) this.chooseGhost(ghostId);
    this.channel.configure({ racing: true });
    this.publish({ last: null, personalBest: false, previousBest: bestRecord(this.snapshot.records, this.conditions) ?? null, saved: false });
    this.process(this.engine.start(this.now()));
  }
  tick() { if (this.locked) this.process(this.engine.advance(this.now())); }
  commit(value: string, code?: string) { this.process(this.engine.commit(value, this.now(), code)); }
  cancel(reason = '경기 취소. 기록은 저장되지 않은 상태.') {
    if (!this.locked) return;
    this.process(this.engine.cancel(reason)); this.channel.configure({ racing: false });
  }
  private process(events: JudgmentEvent[]) {
    for (const event of events) {
      if (event.type === 'finished') {
        const last: RaceRecord = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), conditions: { ...this.conditions }, result: event.result, progress: this.engine.trajectory };
        const previousBest = bestRecord(this.snapshot.records, this.conditions) ?? null;
        const personalBest = last.result.correct > 0 && (!previousBest || compareResults(last, previousBest) > 0);
        this.publish({ last, previousBest, personalBest, saved: false });
        this.retrySave();
        this.channel.send({ ...event, personalBest }); this.channel.configure({ racing: false });
      } else this.channel.send(event);
    }
    this.publish();
  }
  retrySave() {
    const last = this.snapshot.last;
    if (!last || this.locked) return;
    try {
      const storage = this.storage(), loaded = loadRecords(storage);
      if (loaded.error) { this.publish({ storageError: loaded.error, saved: false }); return; }
      const records = retainRecords([last, ...loaded.records.filter(record => record.id !== last.id)]);
      const error = saveRecords(storage, records);
      this.publish(error ? { storageError: error, saved: false } : { records, storageError: '', saved: true });
    } catch { this.publish({ storageError: '기록 저장 실패. 현재 화면의 결과는 유지되며 저장소 권한 확인 후 재시도 가능.', saved: false }); }
  }
  clearRecords() {
    if (this.locked) return;
    try {
      const error = deleteRecords(this.storage());
      this.publish(error ? { storageError: error } : { records: [], ghost: null, saved: false, storageError: '', previousBest: null, personalBest: false });
    } catch { this.publish({ storageError: '기록 삭제 실패. 브라우저 저장소 권한 확인 필요.' }); }
  }
}
