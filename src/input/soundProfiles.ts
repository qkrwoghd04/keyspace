import type { ThemeId } from '../themes/types';
import { random } from '../themes/shared/random';

export type SoundKeyClass = 'character' | 'space' | 'enter';
interface Frame { t: number; white: number; low: number; high: number; pitch: number; body: number; keyClass: SoundKeyClass }
interface SoundProfile { duration: number; releaseDuration: number; render: (frame: Frame) => number }
const TAU = Math.PI * 2;
const tone = (frequency: number, t: number) => Math.sin(TAU * frequency * t);
const envelope = (t: number, decay: number, attack = .0006) => t < 0 ? 0 : (1 - Math.exp(-t / attack)) * Math.exp(-t / decay);
const drop = (start: number, end: number, speed: number, t: number) => Math.sin(TAU * (end * t + (start - end) * speed * (1 - Math.exp(-t / speed))));

/** Different excitation and resonators, rather than one pitch-shifted click. */
export const SOUND_PROFILES: Record<ThemeId, SoundProfile> = {
  studio: {
    duration: .11, releaseDuration: .04,
    render: ({ t, high, low, pitch: p, body }) => high * envelope(t, .004) * .7 + low * envelope(t - .007, .005) * .38 + tone(165 * p, t) * envelope(t, .026) * body + tone(2300 * p, t) * envelope(t, .009) * .23,
  },
  dark: {
    duration: .12, releaseDuration: .046,
    render: ({ t, low, pitch: p, body }) => low * envelope(t, .011, .0018) * 1.4 + tone(95 * p, t) * envelope(t, .032, .0015) * body + tone(210 * p, t) * envelope(t, .012) * .18,
  },
  glass: {
    duration: .18, releaseDuration: .055,
    render: ({ t, white, pitch: p }) => tone(1480 * p, t) * envelope(t, .034) * .65 + tone(2443 * p, t) * envelope(t, .021) * .3 + tone(3977 * p, t) * envelope(t, .011) * .16 + white * envelope(t, .0015) * .12,
  },
  neon: {
    duration: .08, releaseDuration: .03,
    render: ({ t, white, pitch: p }) => Math.sign(tone(920 * p, t)) * envelope(t, .009, .0002) * .23 + Math.round(white * 3) / 3 * envelope(t, .004) * .18 + tone(450 * p, t) * envelope(t, .018) * .55,
  },
  inferno: {
    duration: .18, releaseDuration: .065,
    render: ({ t, low, pitch: p, body }) => drop(145 * p, 59 * p, .015, t) * envelope(t, .04, .0015) * body + low * envelope(t, .012) * .8 + low * envelope(t - .012, .024, .008) * 1.4,
  },
  glacier: {
    duration: .17, releaseDuration: .048,
    render: ({ t, high, white, pitch: p }) => high * (envelope(t, .008) * .55 + envelope(t - .008, .003) * .23 + envelope(t - .019, .004) * .16) + tone(1840 * p, t) * envelope(t, .021) * .45 + tone(2913 * p, t) * envelope(t, .013) * .25 + white * tone(4700 * p, t) * envelope(t, .02) * .08,
  },
  jelly: {
    duration: .21, releaseDuration: .105,
    render: ({ t, low, pitch: p }) => drop(610 * p, 140 * p, .013, t) * envelope(t, .038, .0017) * .82 + drop(345 * p, 105 * p, .029, t) * envelope(t, .023, .003) * .32 + low * envelope(t, .006) * .18,
  },
  grove: {
    duration: .18, releaseDuration: .047,
    render: ({ t, high, low, pitch: p, body }) => tone(490 * p, t) * envelope(t, .033, .001) * .65 + tone(1338 * p, t) * envelope(t, .012) * .24 + tone(2700 * p, t) * envelope(t, .006) * .09 + tone(150 * p, t) * envelope(t, .012) * body * .28 + high * envelope(t, .009) * .09 + low * envelope(t, .007) * .22,
  },
  orbit: {
    duration: .265, releaseDuration: .085,
    render: ({ t, low, pitch: p, body }) => tone(115 * p, t) * envelope(t, .038, .002) * body * .6 + Math.asin(tone(370 * p, t)) / (Math.PI / 2) * envelope(t, .039, .0012) * .65 + tone(746 * p, t) * envelope(t, .02) * .16 + tone(370 * p, t - .027) * envelope(t - .027, .024) * .1 + tone(375 * p, t - .043) * envelope(t - .043, .018) * .065 + low * envelope(t, .008) * .22,
  },
  'demon-slayer': {
    duration: .23, releaseDuration: .055,
    render: ({ t, high, low, pitch: p, keyClass }) => high * envelope(t, .019, .003) * .45 + drop(690 * p, 180 * p, .017, t) * envelope(t, .03) * .5 + tone(2147 * p, t) * envelope(t, .021) * .14 + low * envelope(t - .012, .019, .004) * .6 + (keyClass === 'enter' ? high * envelope(t - .027, .041, .009) * .5 : keyClass === 'space' ? low * envelope(t - .018, .044, .008) * .7 : 0),
  },
  pokemon: {
    duration: .18, releaseDuration: .055,
    render: ({ t, high, pitch: p, keyClass }) => drop(1030 * p, 470 * p, .012, t) * envelope(t, .021) * .55 + tone(210 * p, t) * envelope(t, .011) * .3 + high * envelope(t, .002) * .4 + (keyClass === 'enter' ? tone(1327 * p, t) * envelope(t - .035, .026) * .2 : keyClass === 'space' ? Math.sin(t * 4900 + Math.sin(t * 900) * 3) * envelope(t - .015, .021) * .16 : 0),
  },
  'spider-verse': {
    duration: .15, releaseDuration: .04,
    render: ({ t, white, high, pitch: p, keyClass }) => high * (envelope(t, .004) * .7 + envelope(t - .011, .006) * .3) + Math.round(white * 2) / 2 * envelope(t, .012) * .2 + tone(280 * p, t) * envelope(t, .025) * .6 + (keyClass === 'enter' ? tone(84 * p, t) * envelope(t, .038) * .8 : keyClass === 'space' ? high * envelope(t - .015, .027, .006) * .4 : 0),
  },
  howl: {
    duration: .25, releaseDuration: .065,
    render: ({ t, low, high, pitch: p, keyClass }) => tone(240 * p, t) * envelope(t, .039) * .65 + tone(691 * p, t) * envelope(t, .018) * .18 + high * (envelope(t, .002) * .2 + envelope(t - .016, .003) * .15 + envelope(t - .032, .002) * .11) + low * envelope(t, .009) * .5 + (keyClass === 'enter' ? tone(106 * p, t) * envelope(t - .045, .033) * .5 : keyClass === 'space' ? low * envelope(t - .026, .045, .009) * .7 : 0),
  },
  evangelion: {
    duration: .25, releaseDuration: .07,
    render: ({ t, low, high, pitch: p, keyClass }) => high * envelope(t, .003) * .45 + tone(155 * p, t) * envelope(t - .009, .032) * .65 + Math.asin(tone(720 * p, t)) * envelope(t - .025, .018, .003) * .13 + low * envelope(t - .035, .024) * .6 + (keyClass === 'enter' ? tone(75 * p, t) * envelope(t - .083, .032) * .7 : keyClass === 'space' ? low * envelope(t - .045, .038, .012) * 1.1 : 0),
  },
};

export function soundKeyClass(code: string): SoundKeyClass { return code === 'Space' ? 'space' : code === 'Enter' ? 'enter' : 'character'; }

/** Deterministic PCM, cached by the engine. Zero-mean, tapered and peak bounded. */
export function synthesizeSound(id: ThemeId, keyClass: SoundKeyClass, release: boolean, sampleRate: number): Float32Array<ArrayBuffer> {
  const profile = SOUND_PROFILES[id];
  const width = keyClass === 'space' ? 1.18 : keyClass === 'enter' ? 1.08 : 1;
  const duration = Math.min(.3, (release ? profile.releaseDuration : profile.duration) * width);
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  const rng = random(491 + Object.keys(SOUND_PROFILES).indexOf(id) * 17 + (release ? 3 : 0));
  const pitch = (keyClass === 'space' ? .78 : keyClass === 'enter' ? .91 : 1) * (release ? 1.19 : 1);
  const body = keyClass === 'space' ? 1.25 : keyClass === 'enter' ? 1.1 : 1;
  const lowMix = 1 - Math.exp(-TAU * 900 / sampleRate), highMix = 1 - Math.exp(-TAU * 2400 / sampleRate);
  let low = 0, highLow = 0, mean = 0;
  for (let i = 0; i < samples.length; i++) {
    const white = rng() * 2 - 1;
    low += (white - low) * lowMix; highLow += (white - highLow) * highMix;
    const t = i / sampleRate;
    const fade = Math.min(1, t / .0008, (duration - t) / .009);
    samples[i] = profile.render({ t: release ? t * 1.4 : t, white, low, high: white - highLow, pitch, body, keyClass }) * fade;
    mean += samples[i];
  }
  mean /= samples.length;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) { samples[i] -= mean; peak = Math.max(peak, Math.abs(samples[i])); }
  const gain = (release ? .065 : .235) / Math.max(peak, .001);
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}
