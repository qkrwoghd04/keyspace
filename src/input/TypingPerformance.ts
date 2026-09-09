import type { JudgmentEvent } from '../challenge/types';

export interface TypingPulse { cpm: number; precision: number; combo: number; sustainedMs: number; activeBins: number; idleMs: number }
interface Sample { at: number; correct: number; errors: number }

/** Presentation telemetry only. Challenge scores arrive already judged by RaceEngine. */
export class TypingPerformance {
  private readonly samples: Sample[] = [];
  private combo = 0;
  private started = Infinity;
  private last = -Infinity;
  private clock = 0;
  private text = '';
  private readonly segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });

  reset(value = '') { this.samples.length = 0; this.combo = 0; this.started = Infinity; this.last = -Infinity; this.text = value.normalize('NFC'); }

  judgment(event: JudgmentEvent, now: number) {
    if (event.type === 'reset') { this.reset(); return; }
    if (event.type === 'correct') { this.add(event.count, 0, now); this.combo = event.combo; }
    if (event.type === 'error') { this.add(0, event.count, now); this.combo = 0; }
    if (event.type === 'combo') this.combo = event.value;
  }

  /** Observe committed native text, never intercept an input event or alter its value. */
  committed(value: string, now: number, inputType = 'insertText') {
    const next = value.normalize('NFC'), previous = this.text;
    this.text = next;
    if (next === previous) return 0;
    if (/Paste|Drop|Yank|history/i.test(inputType)) { this.reset(next); return 0; }
    const count = (text: string) => Array.from(this.segmenter.segment(text)).length;
    // Only new appended graphemes build free-typing rhythm. Selection edits break it.
    if (next.startsWith(previous)) { const added = Math.min(12, count(next.slice(previous.length))); this.add(added, 0, now); return added; }
    this.add(0, Math.max(1, count(previous) - count(next)), now); this.combo = 0;
    return 0;
  }

  private add(correct: number, errors: number, time: number) {
    const now = this.clock = Math.max(this.clock, time);
    if (now - this.last > 1400) { this.started = now; this.combo = 0; }
    this.last = now; this.combo += correct;
    // A giant same-timestamp insertion cannot masquerade as sustained typing.
    const previous = this.samples.at(-1);
    if (previous && now - previous.at < 50) { previous.correct += correct; previous.errors += errors; }
    else this.samples.push({ at: now, correct, errors });
    while (this.samples.length > 120 || (this.samples[0] && now - this.samples[0].at > 5000)) this.samples.shift();
  }

  read(time: number): TypingPulse {
    const now = this.clock = Math.max(this.clock, time);
    while (this.samples[0] && now - this.samples[0].at > 5000) this.samples.shift();
    let correct = 0, errors = 0;
    const bins = new Set<number>();
    for (const sample of this.samples) { correct += sample.correct; errors += sample.errors; if (sample.correct) bins.add(Math.min(4, Math.floor((now - sample.at) / 1000))); }
    const idleMs = now - this.last;
    return { cpm: correct * 12, precision: correct + errors ? correct / (correct + errors) : 1, combo: idleMs > 1400 ? 0 : this.combo,
      sustainedMs: idleMs > 1400 ? 0 : Math.max(0, now - this.started), activeBins: bins.size, idleMs };
  }
}
