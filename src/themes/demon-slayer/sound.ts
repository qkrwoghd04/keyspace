import type { SoundProfile } from '../../input/soundProfiles';
import { random } from '../shared/random';

const tone = (hz: number, t: number) => Math.sin(Math.PI * 2 * hz * t);
const env = (t: number, decay: number, attack = .0015) => t < 0 ? 0 : (1 - Math.exp(-t / attack)) * Math.exp(-t / decay);
export const WATER_SOUND: SoundProfile = {
  duration: .21, releaseDuration: .05,
  render: ({ t, low, high, pitch: p, body }) =>
    low * env(t, .031, .006) * .6 + high * env(t, .018, .005) * .18 +
    tone(260 * p, t) * env(t, .023) * body * .5 +
    Math.sin(2 * Math.PI * (830 * t + 8 * (1 - Math.exp(-t / .022)))) * env(t, .038, .004) * .25 +
    tone(1580 * p, t) * env(t - .015, .022, .003) * .08,
};
export const SUN_SOUND: SoundProfile = {
  duration: .24, releaseDuration: .06,
  render: ({ t, low, high, pitch: p, body }) =>
    tone(124 * p, t) * env(t, .034) * body * .66 + tone(247 * p, t) * env(t, .018) * .24 +
    low * env(t - .005, .047, .006) * (.75 + .2 * tone(67, t)) +
    high * env(t, .018, .002) * .16 + high * tone(170, t) * env(t - .025, .026, .006) * .12,
};

/** One 280ms upward breath, cached and routed through the same limiter/voice pool. */
export function synthesizeAwakening(rate: number): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(Math.ceil(rate * .28)), rng = random(914);
  let low = 0, peak = 0, mean = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate, p = i / samples.length;
    low += (rng() * 2 - 1 - low) * .09;
    samples[i] = (Math.sin(2 * Math.PI * (190 * t + 1100 * t * t)) * .4 + low * .8) * Math.sin(Math.PI * p) ** 2 * Math.min(1, (1 - p) * 7);
    mean += samples[i];
  }
  mean /= samples.length;
  for (let i = 0; i < samples.length; i++) { samples[i] -= mean; peak = Math.max(peak, Math.abs(samples[i])); }
  for (let i = 0; i < samples.length; i++) samples[i] *= .16 / Math.max(.001, peak);
  return samples;
}
