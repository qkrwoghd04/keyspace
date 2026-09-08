import { describe, expect, it } from 'vitest';
import { SOUND_PROFILES, soundKeyClass, synthesizeSound } from './soundProfiles';
import type { ThemeId } from '../themes/types';

describe('fourteen locally synthesized materials', () => {
  it('uses fourteen independent excitation profiles', () => {
    expect(Object.keys(SOUND_PROFILES)).toHaveLength(14);
    expect(new Set(Object.values(SOUND_PROFILES).map(profile => profile.render)).size).toBe(14);
  });

  it('produces bounded, finite PCM for all key classes and both edges', () => {
    for (const id of Object.keys(SOUND_PROFILES) as ThemeId[]) for (const keyClass of ['character', 'space', 'enter'] as const) for (const release of [false, true]) {
      const samples = synthesizeSound(id, keyClass, release, 24000);
      let peak = 0, energy = 0;
      for (const value of samples) { expect(Number.isFinite(value)).toBe(true); peak = Math.max(peak, Math.abs(value)); energy += value * value; }
      expect(samples.length).toBeLessThanOrEqual(7200);
      expect(peak).toBeLessThanOrEqual(.236);
      expect(energy).toBeGreaterThan(.01);
      expect(Math.abs(samples[0])).toBeLessThan(.003);
      expect(Math.abs(samples.at(-1)!)).toBeLessThan(.003);
    }
  });

  it('is deterministic and distinguishes Space and Enter within a material', () => {
    expect(synthesizeSound('grove', 'character', false, 24000)).toEqual(synthesizeSound('grove', 'character', false, 24000));
    const lengths = (['character', 'space', 'enter'] as const).map(key => synthesizeSound('grove', key, false, 24000).length);
    expect(new Set(lengths).size).toBe(3);
    expect(soundKeyClass('Space')).toBe('space'); expect(soundKeyClass('Enter')).toBe('enter'); expect(soundKeyClass('KeyA')).toBe('character');
  });
});
