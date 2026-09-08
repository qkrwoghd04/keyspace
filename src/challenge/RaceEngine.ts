import { comboTier, type JudgmentEvent, type Passage, type ProgressPoint, type RaceConditions, type RaceSnapshot } from './types';

const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
export const characters = (text: string) => Array.from(segmenter.segment(text.normalize('NFC')), part => part.segment);
export const accuracyOf = (unique: number, errors: number) => unique + errors ? unique / (unique + errors) * 100 : 100;
export const speedOf = (correct: number, elapsedMs: number, language: 'ko' | 'en') => elapsedMs > 0 ? correct / (language === 'ko' ? 1 : 5) / (elapsedMs / 60000) : 0;

/** No DOM, renderer, wall-clock globals or timers. Caller supplies monotonic time. */
export class RaceEngine {
  private snapshot: RaceSnapshot;
  private readonly target: string[];
  private committed: string[] = [];
  private startsAt = Infinity;
  private lastNow = 0;
  private progress: ProgressPoint[] = [[0, 0]];

  constructor(readonly passage: Passage, readonly conditions: RaceConditions) {
    this.target = characters(passage.text);
    this.snapshot = this.empty();
  }
  private empty(): RaceSnapshot {
    return { phase: 'ready', text: '', correct: 0, uniqueCorrect: 0, errors: 0, combo: 0, maxCombo: 0, tier: 0, accuracy: 100, speed: 0, elapsedMs: 0, remainingMs: this.conditions.duration * 1000, countdown: 3, reason: '', result: null };
  }
  getSnapshot = () => this.snapshot;
  get trajectory(): ProgressPoint[] { return this.progress.map(point => [...point]); }
  get locked() { return this.snapshot.phase === 'countdown' || this.snapshot.phase === 'running'; }
  start(now: number): JudgmentEvent[] {
    if (this.locked) return [];
    this.lastNow = now; this.startsAt = now + 3000; this.committed = []; this.progress = [[0, 0]];
    this.snapshot = { ...this.empty(), phase: 'countdown' };
    return [{ type: 'reset' }];
  }
  advance(now: number): JudgmentEvent[] {
    if (!this.locked) return [];
    this.lastNow = Math.max(this.lastNow, now);
    const elapsed = Math.max(0, this.lastNow - this.startsAt), duration = this.conditions.duration * 1000;
    const phase = this.lastNow < this.startsAt ? 'countdown' : elapsed >= duration ? 'finished' : 'running';
    this.snapshot = { ...this.snapshot, phase, elapsedMs: Math.min(duration, elapsed), remainingMs: Math.max(0, duration - elapsed), countdown: Math.max(0, Math.ceil((this.startsAt - this.lastNow) / 1000)) };
    this.updateMetrics();
    if (phase !== 'finished') return [];
    this.recordProgress(duration, this.snapshot.correct, true);
    const { correct, uniqueCorrect, errors, accuracy, speed, maxCombo } = this.snapshot;
    const result = { correct, uniqueCorrect, errors, accuracy, speed, maxCombo, unit: this.conditions.language === 'ko' ? 'CPM' as const : 'WPM' as const, elapsedMs: duration };
    this.snapshot = { ...this.snapshot, result };
    return [{ type: 'finished', result }];
  }
  commit(value: string, now: number, code?: string): JudgmentEvent[] {
    const clockEvents = this.advance(now);
    if (this.snapshot.phase !== 'running') return clockEvents;
    // Native text remains editable. Only the exact prefix moves the race cursor.
    const next = characters(value).slice(0, this.target.length + 100);
    const normalized = next.join('');
    if (normalized === this.snapshot.text) return clockEvents;
    let shared = 0, suffix = 0, correct = 0;
    while (shared < next.length && shared < this.committed.length && next[shared] === this.committed[shared]) shared++;
    while (suffix < next.length - shared && suffix < this.committed.length - shared && next[next.length - 1 - suffix] === this.committed[this.committed.length - 1 - suffix]) suffix++;
    while (correct < next.length && correct < this.target.length && next[correct] === this.target[correct]) correct++;
    // Count only newly inserted/replaced wrong characters, never Backspace itself.
    const wrong = Math.max(0, next.length - suffix - Math.max(shared, correct));
    const fresh = Math.max(0, correct - this.snapshot.uniqueCorrect);
    const previousCombo = this.snapshot.combo;
    let combo = previousCombo + fresh;
    const maxCombo = Math.max(this.snapshot.maxCombo, combo);
    const events: JudgmentEvent[] = [];
    if (fresh) events.push({ type: 'correct', count: fresh, position: correct, combo, tier: comboTier(combo), code });
    if (wrong) { combo = 0; events.push({ type: 'error', count: wrong, position: correct }); }
    if (combo !== previousCombo) events.push({ type: 'combo', value: combo, tier: comboTier(combo) });
    if (correct !== this.snapshot.correct) this.recordProgress(this.snapshot.elapsedMs, correct);
    this.committed = next;
    this.snapshot = { ...this.snapshot, text: normalized, correct, uniqueCorrect: Math.max(correct, this.snapshot.uniqueCorrect), errors: this.snapshot.errors + wrong, combo, maxCombo, tier: comboTier(combo) };
    this.updateMetrics();
    return [...clockEvents, ...events];
  }
  cancel(reason: string): JudgmentEvent[] {
    if (!this.locked) return [];
    this.snapshot = { ...this.snapshot, phase: 'canceled', reason, result: null, combo: 0, tier: 0 };
    return [{ type: 'reset' }];
  }
  private updateMetrics() {
    this.snapshot = { ...this.snapshot, accuracy: accuracyOf(this.snapshot.uniqueCorrect, this.snapshot.errors), speed: speedOf(this.snapshot.correct, this.snapshot.elapsedMs, this.conditions.language) };
  }
  private recordProgress(elapsed: number, position: number, final = false) {
    const point: ProgressPoint = [Math.round(elapsed), position], previous = this.progress.at(-1)!;
    // At most one observed position per 10ms bucket; retain its actual timestamp.
    // Zero and finish are explicit. No extrapolation or averaged ghost movement.
    if (!final && this.progress.length > 1 && Math.floor(previous[0] / 10) === Math.floor(point[0] / 10)) this.progress[this.progress.length - 1] = point;
    else if (previous[0] === point[0] && this.progress.length > 1) this.progress[this.progress.length - 1] = point;
    else this.progress.push(point);
  }
}
