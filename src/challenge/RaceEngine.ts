import { COUNTDOWN_MS, DURATION_MS, MAX_EDITS, type InputEdit, type Passage, type RaceSnapshot } from './types';
import { editBetween, ScoreCounter } from './scoring';
export { characters } from './scoring';

/** No DOM, renderer or wall clock. Countdown and the 30-second deadline use monotonic time. */
export class RaceEngine {
  private score: ScoreCounter;
  private snapshot: RaceSnapshot;
  private startsAt = Infinity;
  private lastNow = 0;
  private edits: InputEdit[] = [];
  constructor(readonly passage: Passage) { this.score = new ScoreCounter(passage); this.snapshot = this.empty(); }
  private empty(): RaceSnapshot {
    return { ...this.score.result(0), phase: 'ready', text: '', remainingMs: DURATION_MS, countdown: 3, reason: '', result: null };
  }
  getSnapshot = () => this.snapshot;
  get transcript(): readonly InputEdit[] { return this.edits; }
  get locked() { return this.snapshot.phase === 'countdown' || this.snapshot.phase === 'running'; }
  start(now: number) {
    if (this.locked) return;
    this.lastNow = now; this.startsAt = now + COUNTDOWN_MS; this.score = new ScoreCounter(this.passage); this.edits = [];
    this.snapshot = { ...this.empty(), phase: 'countdown' };
  }
  advance(now: number) {
    if (!this.locked) return;
    this.lastNow = Math.max(this.lastNow, now);
    const elapsedMs = Math.min(DURATION_MS, Math.max(0, this.lastNow - this.startsAt));
    const phase = this.lastNow < this.startsAt ? 'countdown' : elapsedMs >= DURATION_MS ? 'finished' : 'running';
    const result = this.score.result(elapsedMs);
    this.snapshot = { ...this.snapshot, ...result, phase, remainingMs: DURATION_MS - elapsedMs, countdown: Math.max(0, Math.ceil((this.startsAt - this.lastNow) / 1000)), result: phase === 'finished' ? result : null };
  }
  commit(value: string, now: number) {
    this.advance(now);
    if (this.snapshot.phase !== 'running') return;
    const edit = editBetween(this.snapshot.text, value, this.snapshot.elapsedMs);
    if (!edit) return;
    if (this.edits.length >= MAX_EDITS || edit.insert.length > 1024) { this.cancel('입력 한도 초과. 다시 시작해 주세요.'); return; }
    try { this.score.apply(edit); } catch { this.cancel('입력 범위 초과. 다시 시작해 주세요.'); return; }
    this.edits.push(edit);
    this.snapshot = { ...this.snapshot, ...this.score.result(this.snapshot.elapsedMs), text: this.score.value };
  }
  cancel(reason: string) {
    if (!this.locked) return;
    this.edits = []; this.snapshot = { ...this.snapshot, phase: 'canceled', reason, result: null };
  }
  discardTranscript() { this.edits = []; }
}
