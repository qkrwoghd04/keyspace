export type BreathPhase = 'water' | 'awakening' | 'sun' | 'cooling';
export type BreathPreference = 'auto' | 'water' | 'sun';

export const DEMON_SLAYER = {
  title: 'Tanjiro / Flow into flame',
  awaken: { cpm: 240, precision: .96, combo: 25, sustainedMs: 4000, activeBins: 4, holdMs: 900 },
  sustain: { cpm: 156, precision: .87, combo: 8, idleMs: 1800 },
  transitionMs: 900, coolingMs: 1600, minimumSunMs: 4000, weaknessMs: 2200, cooldownMs: 2500,
  trail: { gapMs: 700, lifetime: .12, sunLifetime: .12, maxSlashes: 6, lowSlashes: 3, particles: 72, lowParticles: 28 },
  water: { deep: '#10548d', body: '#147cbd', light: '#60cde6', foam: '#eefbfa' },
  sun: { edge: '#ac252b', body: '#f35b20', light: '#ffb735', core: '#fff0b9' },
} as const;
