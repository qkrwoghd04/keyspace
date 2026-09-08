import type { EffectIntensity, JudgmentEvent } from './types';

export interface ChallengePresentation { enabled: boolean; racing: boolean; intensity: EffectIntensity }
export type PresentationEvent = JudgmentEvent | { type: 'presentation'; value: ChallengePresentation };
/** Presentation-only channel. No score or timer calculation in the renderer. */
export class ChallengeChannel {
  private readonly listeners = new Set<(event: PresentationEvent) => void>();
  state: ChallengePresentation = { enabled: false, racing: false, intensity: 'low' };
  subscribe(listener: (event: PresentationEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  configure(value: Partial<ChallengePresentation>) { this.state = { ...this.state, ...value }; this.send({ type: 'presentation', value: this.state }); }
  send(event: PresentationEvent) { for (const listener of this.listeners) listener(event); }
}
