import { describe, expect, it } from 'vitest';
import { synthesizeSound } from '../../input/soundProfiles';
import { synthesizeAwakening } from './sound';

describe('water, fire and awakening synthesis', () => {
  it('uses genuinely different signals, finite and peak bounded at multiple sample rates', () => {
    for (const rate of [24000, 44100, 48000]) {
      const water = synthesizeSound('demon-slayer', 'character', false, rate, 'water');
      const sun = synthesizeSound('demon-slayer', 'character', false, rate, 'sun');
      expect(water).not.toEqual(sun);
      for (const samples of [water, sun, synthesizeAwakening(rate)]) {
        let peak = 0, mean = 0;
        for (const value of samples) { expect(Number.isFinite(value)).toBe(true); peak = Math.max(peak, Math.abs(value)); mean += value; }
        expect(peak).toBeLessThan(.236); expect(Math.abs(mean / samples.length)).toBeLessThan(.00001);
        expect(samples.length / rate).toBeLessThanOrEqual(.3); expect(Math.abs(samples.at(-1)!)).toBeLessThan(.003);
      }
    }
  });
});
