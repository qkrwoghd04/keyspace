import type { KeyboardInput } from '../../input/KeyboardInput';
import { BaseRuntime, type KeyBody } from '../shared/BaseRuntime';
import type { ThemeDiagnostics } from '../types';
import { Signature } from './Signature';
import type { JudgmentEvent } from '../../challenge/types';

export abstract class AnimationRuntime extends BaseRuntime {
  protected readonly signature = new Signature();
  protected strikes = 0;
  private sequence = 0;
  protected onStrike(_key: KeyBody, _reduced: boolean): void {}
  override setChallengeActive(active: boolean) {
    if (active === this.challengeActive) return;
    super.setChallengeActive(active); this.signature.allowed = !active; this.signature.reset();
  }
  override onChallengeEvent(event: JudgmentEvent) {
    super.onChallengeEvent(event);
    if (event.type === 'reset') this.signature.reset();
    if (event.type === 'correct') {
      const key = this.keys.find(key => key.definition.code === event.code);
      if (key) this.onStrike(key, false);
    } else if (event.type === 'finished') {
      const key = this.keys.find(key => key.definition.code === 'Enter');
      this.signature.reset(); this.signature.allowed = true;
      if (key) this.onStrike(key, false);
      this.signature.allowed = !this.challengeActive;
    }
  }
  override update(delta: number, input: KeyboardInput, reduced: boolean) {
    this.signature.update(delta, reduced);
    // Consume the current bounded history in actual input order, not layout order.
    // Effects never throttle, replay, or queue the browser's text/key state.
    for (const event of input.recentPresses) {
      if (event.sequence <= this.sequence) continue;
      const key = this.keys.find(key => key.definition.code === event.code);
      if (key && !this.challengeActive) { this.strikes++; this.onStrike(key, reduced); }
      this.sequence = event.sequence;
    }
    return super.update(delta, input, reduced) || this.signature.active;
  }
  override reset(input: KeyboardInput) {
    this.sequence = input.getSnapshot().pressCount;
    this.signature.reset();
    super.reset(input);
  }
  override diagnostics(): ThemeDiagnostics { return { ...super.diagnostics(), signature: this.signature.diagnostics(), strikes: this.strikes }; }
}
