export interface ChallengePresentation { enabled: boolean; racing: boolean }
/** Mode lock only. Scoring and reward effects never enter the renderer. */
export class ChallengeChannel {
  private readonly listeners = new Set<(value: ChallengePresentation) => void>();
  state: ChallengePresentation = { enabled: false, racing: false };
  subscribe(listener: (value: ChallengePresentation) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  configure(value: Partial<ChallengePresentation>) { this.state = { ...this.state, ...value }; for (const listener of this.listeners) listener(this.state); }
}
