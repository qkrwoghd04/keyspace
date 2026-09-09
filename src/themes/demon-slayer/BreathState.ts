import type { TypingPulse } from '../../input/TypingPerformance';
import { DEMON_SLAYER as C, type BreathPhase, type BreathPreference } from './config';

/** Pure monotonic state machine. No DOM, score ownership, renderer or audio dependency. */
export class BreathState {
  phase: BreathPhase = 'water';
  preference: BreathPreference = 'auto';
  serial = 0;
  private since = 0;
  private eligibleSince = Infinity;
  private weakSince = Infinity;
  private cooldownUntil = 0;
  private lastNow = 0;
  private fromMix = 0;

  private clock(now: number) { return this.lastNow = Math.max(this.lastNow, now); }
  private enter(phase: BreathPhase, now: number) {
    if (phase === this.phase) return;
    this.fromMix = this.mix(now); this.phase = phase; this.since = now; this.serial++;
    this.eligibleSince = this.weakSince = Infinity;
    if (phase === 'water') this.cooldownUntil = now + C.cooldownMs;
  }
  reset(now: number) {
    this.enter('water', this.clock(now)); this.eligibleSince = this.weakSince = Infinity;
    this.cooldownUntil = 0;
    if (this.preference === 'sun') this.enter('sun', this.lastNow);
  }
  select(value: BreathPreference, time: number) {
    if (value === this.preference) return;
    const now = this.clock(time); this.preference = value;
    this.eligibleSince = this.weakSince = Infinity;
    if (value === 'sun' && this.phase !== 'sun') this.enter('awakening', now);
    if (value === 'water' && this.phase !== 'water') this.enter('cooling', now);
  }
  advance(pulse: TypingPulse, time: number) {
    const now = this.clock(time);
    const strong = pulse.cpm >= C.awaken.cpm && pulse.precision >= C.awaken.precision && pulse.combo >= C.awaken.combo && pulse.sustainedMs >= C.awaken.sustainedMs && pulse.activeBins >= C.awaken.activeBins && pulse.idleMs < 650;
    const sustaining = pulse.cpm >= C.sustain.cpm && pulse.precision >= C.sustain.precision && pulse.combo >= C.sustain.combo && pulse.idleMs < C.sustain.idleMs;
    if (this.phase === 'water' && this.preference === 'auto') {
      if (strong && now >= this.cooldownUntil) {
        this.eligibleSince = Math.min(this.eligibleSince, now);
        if (now - this.eligibleSince >= C.awaken.holdMs) this.enter('awakening', now);
      } else this.eligibleSince = Infinity;
    } else if (this.phase === 'awakening') {
      if (this.preference === 'auto' && !sustaining) this.enter('cooling', now);
      else if (now - this.since >= C.transitionMs) this.enter('sun', now);
    } else if (this.phase === 'sun' && this.preference === 'auto') {
      if (sustaining) this.weakSince = Infinity;
      else {
        this.weakSince = Math.min(this.weakSince, now);
        if (now - this.since >= C.minimumSunMs && now - this.weakSince >= C.weaknessMs) this.enter('cooling', now);
      }
    } else if (this.phase === 'cooling' && now - this.since >= C.coolingMs) this.enter('water', now);
  }
  mix(now: number) {
    const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
    if (this.phase === 'water') return 0;
    if (this.phase === 'sun') return 1;
    const progress = smooth((now - this.since) / (this.phase === 'awakening' ? C.transitionMs : C.coolingMs));
    return this.phase === 'awakening' ? this.fromMix + (1 - this.fromMix) * progress : this.fromMix * (1 - progress);
  }
  progress(now: number) { return Math.max(0, Math.min(1, (now - this.since) / (this.phase === 'cooling' ? C.coolingMs : C.transitionMs))); }
}
