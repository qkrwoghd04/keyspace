import { describe, expect, it } from 'vitest';
import { TypingPerformance } from './TypingPerformance';

describe('read-only rolling typing telemetry', () => {
  it('uses a five-second denominator, temporal spread and a bounded history', () => {
    const watcher = new TypingPerformance();
    for (let i = 0; i < 50; i++) watcher.judgment({ type: 'correct', count: 1, combo: i + 1, position: i + 1, tier: 0 }, i * 100);
    expect(watcher.read(5000)).toMatchObject({ cpm: 600, precision: 1, combo: 50, sustainedMs: 5000, activeBins: 5 });
    expect(watcher.read(10001)).toMatchObject({ cpm: 0, combo: 0, sustainedMs: 0, activeBins: 0 });
  });
  it('does not infer accuracy from physical key presses or count combo events twice', () => {
    const watcher = new TypingPerformance();
    watcher.judgment({ type: 'correct', count: 3, combo: 3, position: 3, tier: 0 }, 0);
    watcher.judgment({ type: 'combo', value: 3, tier: 0 }, 1);
    watcher.judgment({ type: 'error', count: 1, position: 3 }, 100);
    expect(watcher.read(100)).toMatchObject({ cpm: 36, precision: .75, combo: 0 });
  });
  it('bounds a burst to one time bin and cannot invent stable elapsed typing', () => {
    const watcher = new TypingPerformance();
    for (let i = 0; i < 2000; i++) watcher.judgment({ type: 'correct', count: 1, combo: i + 1, position: i, tier: 0 }, 50);
    expect(watcher.read(50)).toMatchObject({ activeBins: 1, sustainedMs: 0 });
    expect(watcher.read(5000)).toMatchObject({ combo: 0, sustainedMs: 0 });
  });
  it('normalizes committed graphemes and rejects paste, repeat and selection edits as rhythm', () => {
    const watcher = new TypingPerformance();
    expect(watcher.committed('한', 0)).toBe(1); expect(watcher.committed('한', 1)).toBe(0);
    expect(watcher.read(10)).toMatchObject({ cpm: 12, combo: 1 });
    watcher.committed('한글', 100); watcher.committed('한', 200, 'deleteContentBackward');
    expect(watcher.read(200)).toMatchObject({ combo: 0, precision: 2 / 3 });
    watcher.committed('pasted text', 300, 'insertFromPaste'); expect(watcher.read(300).cpm).toBe(0);
    watcher.committed('pasted textt', 400, 'historyRepeat'); expect(watcher.read(400).combo).toBe(0);
  });
  it('does not turn a giant native insertion into a high combo', () => {
    const watcher = new TypingPerformance(); watcher.committed('a'.repeat(1000), 0);
    expect(watcher.read(0)).toMatchObject({ combo: 12, sustainedMs: 0, activeBins: 1 });
    watcher.reset('seed'); expect(watcher.committed('seeda', 200)).toBe(1);
  });
});
