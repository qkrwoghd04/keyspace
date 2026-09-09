import { describe, expect, it } from 'vitest';
import { BreathState } from './BreathState';
import type { TypingPulse } from '../../input/TypingPerformance';
const strong: TypingPulse = { cpm: 320, precision: .99, combo: 30, sustainedMs: 5000, activeBins: 5, idleMs: 0 };
const weak: TypingPulse = { cpm: 70, precision: .8, combo: 0, sustainedMs: 0, activeBins: 0, idleMs: 5000 };

describe('breathing hysteresis, independent of scores and frame rate', () => {
  it('requires simultaneous speed, precision, combo, time and spread', () => {
    for (const invalid of [{ cpm: 239 }, { precision: .95 }, { combo: 24 }, { sustainedMs: 3999 }, { activeBins: 3 }, { idleMs: 700 }]) {
      const state = new BreathState();
      for (let now = 0; now <= 10000; now += 100) state.advance({ ...strong, ...invalid }, now);
      expect(state.phase).toBe('water');
    }
  });
  it('does not awaken on one fast sample or queue transitions', () => {
    const state = new BreathState(); state.advance(strong, 0); state.advance(strong, 899);
    expect(state.phase).toBe('water'); state.advance(weak, 900); state.advance(strong, 1000); state.advance(strong, 1899);
    expect(state.phase).toBe('water'); state.advance(strong, 1900); expect(state.phase).toBe('awakening');
    for (let now = 1900; now < 2800; now += 20) state.advance(strong, now);
    expect(state.serial).toBe(1); state.advance(strong, 2800); expect(state.phase).toBe('sun'); expect(state.serial).toBe(2);
  });
  it('uses minimum hold, weakness grace, cooling and re-entry cooldown', () => {
    const state = new BreathState(); state.advance(strong, 0); state.advance(strong, 900); state.advance(strong, 1800);
    state.advance(weak, 1900); state.advance(weak, 5000); expect(state.phase).toBe('sun');
    state.advance(weak, 5800); expect(state.phase).toBe('cooling');
    state.advance(strong, 6800); expect(state.phase).toBe('cooling');
    state.advance(strong, 7400); expect(state.phase).toBe('water');
    state.advance(strong, 9800); expect(state.phase).toBe('water');
    state.advance(strong, 9900); state.advance(strong, 10800); expect(state.phase).toBe('awakening');
  });
  it('recovers from a short speed dip without extinguishing Sun', () => {
    const state = new BreathState(); state.advance(strong, 0); state.advance(strong, 900); state.advance(strong, 1800);
    state.advance(weak, 6000); state.advance(strong, 7000); state.advance(weak, 7100); state.advance(weak, 9200);
    expect(state.phase).toBe('sun'); state.advance(weak, 9300); expect(state.phase).toBe('cooling');
  });
  it('manual Water/Sun are fixed and reversing preserves the current blend', () => {
    const state = new BreathState(); state.select('sun', 0); state.advance(weak, 450);
    const mix = state.mix(450); expect(mix).toBeCloseTo(.5);
    state.select('water', 450); expect(state.mix(450)).toBeCloseTo(mix);
    state.select('water', 500); expect(state.serial).toBe(2);
    state.advance(strong, 2050); expect(state.phase).toBe('water'); state.advance(strong, 10000); expect(state.phase).toBe('water');
    state.select('sun', 10000); state.advance(weak, 10900); state.advance(weak, 100000); expect(state.phase).toBe('sun');
  });
  it('ignores a backwards clock and resets automatic performance', () => {
    const state = new BreathState(); state.select('sun', 1000); state.advance(strong, 1450); state.advance(strong, 1200);
    expect(state.mix(1450)).toBeCloseTo(.5); state.select('auto', 1500); state.reset(1600); expect(state.phase).toBe('water');
  });
});
