import { CompositionGate } from '../../challenge/CompositionGate';
import type { ChallengeChannel } from '../../challenge/ChallengeChannel';
import type { KeyboardInput } from '../../input/KeyboardInput';
import { TypingPerformance } from '../../input/TypingPerformance';
import { BreathState } from './BreathState';
import { DEMON_SLAYER as C, type BreathPhase, type BreathPreference } from './config';

export interface BreathSnapshot { phase: BreathPhase; preference: BreathPreference; charge: number; challenge: boolean }

/** Connect existing text and judgment streams to presentation. Never changes a score or input. */
export class BreathController {
  readonly state = new BreathState();
  readonly performance = new TypingPerformance();
  private readonly composition = new CompositionGate();
  private readonly listeners = new Set<() => void>();
  private snapshot: BreathSnapshot = { phase: 'water', preference: 'auto', charge: 0, challenge: false };
  private active = false;
  private challenge = false;
  private latestText = '';
  private lastSound = 'water';
  private soundSerial = 0;
  private lastPressCount = 0;
  private repeating = false;
  softwareSequence = 0;
  constructor(private readonly input: KeyboardInput, private readonly now = () => performance.now()) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  setActive(value: boolean) {
    if (this.active === value) return;
    this.active = value; this.input.setBreathSound('water'); this.lastSound = 'water'; this.reset();
  }
  select = (value: BreathPreference) => { this.state.select(value, this.now()); this.tick(); };
  observeRepeat(repeat: boolean) { this.repeating = repeat; }
  beginComposition() { this.composition.begin(); }
  endComposition(value: string) { const committed = this.composition.end(value); if (committed !== null) this.commit(committed, 'insertCompositionText'); }
  observeText(value: string, inputType = 'insertText', composing = false) {
    const committed = this.composition.input(value, composing);
    if (committed !== null) this.commit(committed, inputType);
  }
  private commit(value: string, inputType: string) {
    this.latestText = value;
    const presses = this.input.getSnapshot().pressCount;
    if (this.active && !this.challenge) {
      const added = this.performance.committed(value, this.now(), this.repeating ? 'historyRepeat' : inputType);
      // A software keyboard has no reliable physical code. A local Space-area slash
      // acknowledges its commit without inventing a key-down or double-playing audio.
      if (added && presses === this.lastPressCount) {
        this.softwareSequence++; this.input.playCommittedSound();
        for (const listener of this.listeners) listener();
      }
    }
    this.lastPressCount = presses;
  }
  reset() {
    this.performance.reset(this.latestText); this.composition.reset(this.latestText); this.state.reset(this.now());
    this.soundSerial = this.state.serial; this.lastPressCount = this.input.getSnapshot().pressCount; this.repeating = false; this.tick();
  }
  connect(channel: ChallengeChannel) {
    this.challenge = channel.state.enabled;
    const unsubscribe = channel.subscribe(event => {
      if (event.type === 'presentation') {
        if (this.challenge !== event.value.enabled) { this.challenge = event.value.enabled; this.reset(); }
      } else if (this.active) {
        if (event.type === 'reset') this.reset();
        else this.performance.judgment(event, this.now());
      }
      this.tick();
    });
    const reset = () => { if (document.hidden) this.reset(); };
    const blur = () => this.reset();
    const timer = window.setInterval(() => { if (this.active && !document.hidden) this.tick(); }, 100);
    document.addEventListener('visibilitychange', reset); window.addEventListener('blur', blur);
    return () => { unsubscribe(); clearInterval(timer); document.removeEventListener('visibilitychange', reset); window.removeEventListener('blur', blur); };
  }
  tick() {
    const now = this.now(), pulse = this.performance.read(now);
    if (this.active) this.state.advance(pulse, now);
    const mode = this.state.mix(now) >= .5 ? 'sun' : 'water';
    if (this.active && this.lastSound !== mode) { this.input.setBreathSound(mode); this.lastSound = mode; }
    if (this.soundSerial !== this.state.serial) {
      this.soundSerial = this.state.serial;
      if (this.active && this.state.phase === 'awakening') this.input.playBreathTransition();
    }
    const charge = this.state.preference === 'water' && this.state.phase === 'water' ? 0 : this.state.phase === 'sun' ? 100 : this.state.phase === 'water'
      ? Math.min(95, Math.floor(Math.min(pulse.cpm / C.awaken.cpm, pulse.precision / C.awaken.precision, pulse.combo / C.awaken.combo, pulse.sustainedMs / C.awaken.sustainedMs, pulse.activeBins / C.awaken.activeBins) * 20) * 5)
      : Math.round(this.state.mix(now) * 20) * 5;
    const next = { phase: this.state.phase, preference: this.state.preference, charge, challenge: this.challenge };
    if (Object.keys(next).some(key => next[key as keyof BreathSnapshot] !== this.snapshot[key as keyof BreathSnapshot])) {
      this.snapshot = next; for (const listener of this.listeners) listener();
    }
  }
  visual() { const now = this.now(); return { phase: this.state.phase, mix: this.state.mix(now), progress: this.state.progress(now), serial: this.state.serial, energy: Math.min(1, this.performance.read(now).cpm / 480) }; }
}
