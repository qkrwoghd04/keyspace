import { DURATION_MS, MAX_EDITS, type InputEdit, type Passage, type RaceResult } from './types';

const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
export const characters = (text: string) => Array.from(segmenter.segment(text.normalize('NFC')), part => part.segment);
export const accuracyOf = (unique: number, errors: number) => unique + errors ? unique / (unique + errors) * 100 : 100;
export const speedOf = (correct: number, elapsedMs: number) => elapsedMs > 0 ? correct / (elapsedMs / 1000) : 0;
const targets = new WeakMap<Passage, string[]>();

export function editBetween(before: string, after: string, at: number): InputEdit | null {
  const previous = characters(before), next = characters(after);
  let start = 0, suffix = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++;
  if (start === previous.length && start === next.length) return null;
  while (suffix < previous.length - start && suffix < next.length - start && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
  return { at: Math.floor(at), start, deleteCount: previous.length - start - suffix, insert: next.slice(start, next.length - suffix).join('') };
}

/** Shared deterministic scorer. Incremental edits avoid replaying whole growing strings on the server. */
export class ScoreCounter {
  private readonly target: readonly string[];
  private text: string[] = [];
  correct = 0;
  uniqueCorrect = 0;
  errors = 0;
  constructor(passage: Passage) {
    if (!targets.has(passage)) targets.set(passage, characters(passage.text));
    this.target = targets.get(passage)!;
  }
  get value() { return this.text.join(''); }
  apply(edit: InputEdit) {
    const inserted = characters(edit.insert);
    if (!Number.isInteger(edit.start) || !Number.isInteger(edit.deleteCount) || edit.start < 0 || edit.deleteCount < 0 || edit.start + edit.deleteCount > this.text.length || this.text.length - edit.deleteCount + inserted.length > this.target.length + 100) throw new Error('invalid edit');
    this.text.splice(edit.start, edit.deleteCount, ...inserted);
    let correct = Math.min(this.correct, edit.start);
    while (correct < this.text.length && correct < this.target.length && this.text[correct] === this.target[correct]) correct++;
    this.errors += Math.max(0, edit.start + inserted.length - Math.max(edit.start, correct));
    this.correct = correct;
    this.uniqueCorrect = Math.max(this.uniqueCorrect, correct);
  }
  result(elapsedMs: number): RaceResult {
    return { correct: this.correct, uniqueCorrect: this.uniqueCorrect, errors: this.errors, accuracy: accuracyOf(this.uniqueCorrect, this.errors), speed: speedOf(this.correct, elapsedMs), elapsedMs };
  }
}

export function replay(passage: Passage, edits: readonly InputEdit[]): RaceResult {
  if (!Array.isArray(edits) || edits.length > MAX_EDITS) throw new Error('invalid edit count');
  const score = new ScoreCounter(passage); let previousAt = -1;
  for (const edit of edits) {
    if (!Number.isInteger(edit.at) || edit.at < previousAt || edit.at < 0 || edit.at >= DURATION_MS || typeof edit.insert !== 'string' || edit.insert.length > 1024) throw new Error('invalid edit timing or text');
    previousAt = edit.at; score.apply(edit);
  }
  return score.result(DURATION_MS);
}
