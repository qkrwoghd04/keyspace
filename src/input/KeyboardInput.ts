import { KEY_BY_CODE } from '../keyboard/layout';
import { SwitchSound } from './SwitchSound';

export interface InputSnapshot {
  pressedCodes: readonly string[];
  lastCode: string | null;
  pressCount: number;
  soundEnabled: boolean;
}

/** Physical key state is independent of the browser's text/IME editing pipeline. */
export class KeyboardInput {
  private readonly down = new Set<string>();
  private readonly sources = new Map<string, Set<string>>();
  private readonly pressVersions = new Map<string, number>();
  private resetGeneration = 0;
  private readonly listeners = new Set<() => void>();
  private readonly sound = new SwitchSound();
  private disconnect: (() => void) | null = null;
  private snapshot: InputSnapshot = { pressedCodes: [], lastCode: null, pressCount: 0, soundEnabled: false };

  get pressed(): ReadonlySet<string> { return this.down; }

  /** Monotonic versions preserve short taps that finish between rendered frames. */
  getPressVersion(code: string): number { return this.pressVersions.get(code) ?? 0; }

  get resetVersion(): number { return this.resetGeneration; }

  getSnapshot = (): InputSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(update: Partial<InputSnapshot> = {}): void {
    this.snapshot = { ...this.snapshot, ...update, pressedCodes: [...this.down] };
    for (const listener of this.listeners) listener();
  }

  /** Returns true only for a new source hold; repeated keydowns are ignored. */
  press(code: string, source = 'physical'): boolean {
    if (!KEY_BY_CODE.has(code)) return false;
    let holds = this.sources.get(code);
    if (holds?.has(source)) return false;
    if (!holds) {
      holds = new Set();
      this.sources.set(code, holds);
    }
    holds.add(source);
    if (!this.down.has(code)) {
      this.down.add(code);
      this.pressVersions.set(code, this.getPressVersion(code) + 1);
      this.sound.play(code);
      this.publish({ lastCode: code, pressCount: this.snapshot.pressCount + 1 });
    }
    return true;
  }

  release(code: string, source = 'physical'): void {
    const holds = this.sources.get(code);
    if (!holds?.delete(source)) return;
    if (holds.size === 0) {
      this.sources.delete(code);
      this.down.delete(code);
      this.sound.play(code, true);
      this.publish();
    }
  }

  releaseSource(source: string): void {
    let changed = false;
    for (const [code, holds] of this.sources) {
      holds.delete(source);
      if (holds.size === 0) {
        this.sources.delete(code);
        this.down.delete(code);
        changed = true;
      }
    }
    if (changed) this.publish();
  }

  releaseAll(): void {
    this.sources.clear();
    this.down.clear();
    // Notify even with no held keys so consumers can cancel a release afterglow.
    this.resetGeneration++;
    this.publish();
  }

  setSoundEnabled(enabled: boolean): void {
    this.sound.setEnabled(enabled);
    if (enabled !== this.snapshot.soundEnabled) this.publish({ soundEnabled: enabled });
  }

  connect(): () => void {
    if (this.disconnect) return this.disconnect;
    this.sound.setEnabled(this.snapshot.soundEnabled);
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      this.press(event.code);
    };
    const keyup = (event: KeyboardEvent) => {
      this.release(event.code);
      // macOS sometimes suppresses the other keyup events in Command shortcuts.
      if (event.code === 'MetaLeft' || event.code === 'MetaRight') this.releaseSource('physical');
    };
    const blur = () => this.releaseAll();
    const visibility = () => { if (document.hidden) this.releaseAll(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    const disconnect = () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      this.releaseAll();
      this.sound.dispose();
      if (this.disconnect === disconnect) this.disconnect = null;
    };
    this.disconnect = disconnect;
    return disconnect;
  }

  dispose(): void {
    this.disconnect?.();
    this.releaseAll();
    this.listeners.clear();
    this.sound.dispose();
  }
}
